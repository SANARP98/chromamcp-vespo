/**
 * lancedb-adapter.js
 *
 * ChromaDB-compatible API wrapper around LanceDB.
 * Drop-in replacement for the `chromadb` package — no Python, no HTTP server.
 *
 * Implements the exact API surface used by index.js, batch-processor.js,
 * watch-folder.js, and duplicate-detector.js:
 *   ChromaClient  → getCollection, getOrCreateCollection, deleteCollection, listCollections
 *   Collection    → add, delete, query, get, peek, count
 *
 * Storage : ~/.vespo/lancedb/  (overridable via VESPO_DB_PATH env var)
 * Embeddings (queryTexts path): chromadb-default-embed (all-MiniLM-L6-v2, ONNX, local)
 * Embeddings (smart_ingest path): pre-computed OpenAI vectors passed in directly
 *
 * Result shapes are identical to chromadb so no changes are needed upstream.
 */

import * as lancedb from '@lancedb/lancedb';
import { homedir } from 'os';
import { join } from 'path';
import { mkdir } from 'fs/promises';

// ─── Storage path ─────────────────────────────────────────────────────────────

const DB_PATH = process.env.VESPO_DB_PATH || join(homedir(), '.vespo', 'lancedb');

let _db = null;

async function getDB() {
  if (!_db) {
    await mkdir(DB_PATH, { recursive: true });
    _db = await lancedb.connect(DB_PATH);
  }
  return _db;
}

// ─── Local embedder (MiniLM via ONNX — same model ChromaDB uses by default) ──
// Uses chromadb-default-embed's pipeline API directly.
// Loads once per process (~40 MB, ~2s on first call), then cached.

let _pipeline = null;

async function getEmbedder() {
  if (!_pipeline) {
    const { pipeline } = await import('chromadb-default-embed');
    _pipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return _pipeline;
}

async function embedTexts(texts) {
  const extractor = await getEmbedder();
  // Process each text and extract the pooled Float32 vector
  const outputs = await Promise.all(
    texts.map(text => extractor(text, { pooling: 'mean', normalize: true }))
  );
  return outputs.map(out => Array.from(out.data));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseMeta(row) {
  try {
    return JSON.parse(row.metadata_json || '{}');
  } catch {
    return {};
  }
}

function matchesWhere(meta, where) {
  return Object.entries(where).every(([k, v]) => meta[k] === v);
}

function escapeIds(ids) {
  return ids.map(id => `'${String(id).replace(/'/g, "''")}'`).join(', ');
}

// ─── LanceCollection — wraps an existing LanceDB table ───────────────────────

class LanceCollection {
  constructor(table, name) {
    this.table = table;
    this.name = name;
  }

  /**
   * Add documents to the collection.
   * embeddings are optional — if omitted, MiniLM generates them locally.
   */
  async add({ ids, documents, metadatas = [], embeddings = null }) {
    let vectors = embeddings;
    if (!vectors) {
      vectors = await embedTexts(documents);
    }

    const rows = ids.map((id, i) => ({
      id,
      text: documents[i] ?? '',
      vector: Array.from(vectors[i]),
      metadata_json: JSON.stringify(metadatas[i] ?? {})
    }));

    await this.table.add(rows);
  }

  /**
   * Vector search. Accepts queryTexts (auto-embedded) or queryEmbeddings (pre-computed).
   * Returns ChromaDB-compatible nested-array shape.
   */
  async query({ queryTexts, queryEmbeddings, nResults = 10, where = null }) {
    let queryVector;

    if (queryEmbeddings) {
      queryVector = Array.from(queryEmbeddings[0]);
    } else if (queryTexts) {
      const vecs = await embedTexts(queryTexts);
      queryVector = Array.from(vecs[0]);
    } else {
      throw new Error('Must provide queryTexts or queryEmbeddings');
    }

    // Over-fetch when where filtering so we can reach nResults after JS filtering
    const fetchLimit = where ? Math.max(nResults * 20, 100) : nResults;
    const rows = await this.table.search(queryVector).limit(fetchLimit).toArray();

    const filtered = where
      ? rows.filter(row => matchesWhere(parseMeta(row), where)).slice(0, nResults)
      : rows;

    // Return ChromaDB nested-array shape: results.documents[0][i], results.metadatas[0][i] etc.
    return {
      ids:       [filtered.map(r => r.id)],
      documents: [filtered.map(r => r.text)],
      metadatas: [filtered.map(r => parseMeta(r))],
      distances: [filtered.map(r => r._distance ?? 0)]
    };
  }

  /**
   * Retrieve documents by IDs, or all documents if no IDs given.
   * Returns ChromaDB flat-array shape: { ids, documents, metadatas }
   */
  async get({ ids } = {}) {
    let rows;
    if (ids && ids.length > 0) {
      rows = await this.table.query()
        .where(`id IN (${escapeIds(ids)})`)
        .toArray();
    } else {
      rows = await this.table.query().toArray();
    }
    return this._flatResult(rows);
  }

  /**
   * Return a small sample of documents from the collection.
   * Returns ChromaDB flat-array shape.
   */
  async peek({ limit = 10 } = {}) {
    const rows = await this.table.query().limit(limit).toArray();
    return this._flatResult(rows);
  }

  /** Total number of documents in the collection. */
  async count() {
    return await this.table.countRows();
  }

  /**
   * Delete documents by IDs or by a where-filter object.
   * where uses the same { key: value } ChromaDB syntax.
   */
  async delete({ ids, where } = {}) {
    if (ids && ids.length > 0) {
      await this.table.delete(`id IN (${escapeIds(ids)})`);
    } else if (where) {
      // Scan to find matching IDs, then delete by ID
      const allRows = await this.table.query().toArray();
      const matchingIds = allRows
        .filter(row => matchesWhere(parseMeta(row), where))
        .map(r => r.id);

      if (matchingIds.length > 0) {
        await this.table.delete(`id IN (${escapeIds(matchingIds)})`);
      }
    }
  }

  _flatResult(rows) {
    return {
      ids:       rows.map(r => r.id),
      documents: rows.map(r => r.text),
      metadatas: rows.map(r => parseMeta(r))
    };
  }
}

// ─── PendingLanceCollection — returned by getOrCreateCollection ───────────────
// when the table doesn't exist yet. The LanceDB table is created on the first
// add() call (we need data to infer the vector dimension). All read operations
// return empty results until data is added.

class PendingLanceCollection {
  constructor(db, name) {
    this._db = db;
    this.name = name;
    this._real = null; // becomes a LanceCollection after first add()
  }

  async add({ ids, documents, metadatas = [], embeddings = null }) {
    let vectors = embeddings;
    if (!vectors) {
      vectors = await embedTexts(documents);
    }

    const rows = ids.map((id, i) => ({
      id,
      text: documents[i] ?? '',
      vector: Array.from(vectors[i]),
      metadata_json: JSON.stringify(metadatas[i] ?? {})
    }));

    if (this._real) {
      // Table was created by a prior add() call in this same session
      await this._real.table.add(rows);
    } else {
      // First add — create the table from data (LanceDB infers schema from rows)
      const table = await this._db.createTable(this.name, rows);
      this._real = new LanceCollection(table, this.name);
    }
  }

  async query(opts) {
    if (this._real) return this._real.query(opts);
    return { ids: [[]], documents: [[]], metadatas: [[]], distances: [[]] };
  }

  async get(opts) {
    if (this._real) return this._real.get(opts);
    return { ids: [], documents: [], metadatas: [] };
  }

  async peek({ limit = 10 } = {}) {
    if (this._real) return this._real.peek({ limit });
    return { ids: [], documents: [], metadatas: [] };
  }

  async count() {
    if (this._real) return this._real.count();
    return 0;
  }

  async delete(opts) {
    if (this._real) return this._real.delete(opts);
    // Nothing to delete — collection hasn't been created yet
  }
}

// ─── ChromaClient — public API ───────────────────────────────────────────────

export class ChromaClient {
  /**
   * @param {object} [options]
   * @param {string} [options.path]  Ignored in desktop mode (kept for API compat).
   *                                 Storage location is always VESPO_DB_PATH or ~/.vespo/lancedb/
   */
  constructor({ path } = {}) {
    // path param accepted for API compatibility but not used
    // Desktop mode always uses local file-based LanceDB
  }

  /** Retrieve an existing collection. Throws if not found (matches chromadb behaviour). */
  async getCollection({ name }) {
    const db = await getDB();
    const names = await db.tableNames();
    if (!names.includes(name)) {
      throw new Error(`Collection '${name}' does not exist.`);
    }
    const table = await db.openTable(name);
    return new LanceCollection(table, name);
  }

  /** Get an existing collection or create a new one if it doesn't exist. */
  async getOrCreateCollection({ name }) {
    const db = await getDB();
    const names = await db.tableNames();
    if (names.includes(name)) {
      const table = await db.openTable(name);
      return new LanceCollection(table, name);
    }
    // Table doesn't exist yet — return pending wrapper that creates on first add
    return new PendingLanceCollection(db, name);
  }

  /** Permanently delete a collection and all its documents. */
  async deleteCollection({ name }) {
    const db = await getDB();
    try {
      await db.dropTable(name);
    } catch {
      throw new Error(`Collection '${name}' does not exist or could not be deleted.`);
    }
  }

  /**
   * List all collections.
   * Returns array of objects with .name property (matches chromadb v1.8 format).
   */
  async listCollections() {
    const db = await getDB();
    const names = await db.tableNames();
    return names.map(name => ({ name }));
  }
}
