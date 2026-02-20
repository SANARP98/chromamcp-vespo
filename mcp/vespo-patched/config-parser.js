/**
 * Config File Parser - Structure-aware chunking for Terraform (HCL) and YAML
 *
 * Terraform: regex-based block boundary detection (resource, module, variable, etc.)
 * YAML: document-separator splitting (---) or top-level key splitting
 */

import { extname } from 'path';
import { logWarn } from './logger.js';

/**
 * Detect config file language from file extension.
 * Returns 'terraform', 'yaml', or 'unknown'.
 */
export function detectConfigLanguage(filePath) {
  const ext = extname(filePath).toLowerCase();
  const map = {
    '.tf': 'terraform',
    '.yml': 'yaml',
    '.yaml': 'yaml'
  };
  return map[ext] || 'unknown';
}

// ─────────────────────────────────────────────
// Terraform / HCL
// ─────────────────────────────────────────────

/**
 * Parse a Terraform (.tf) file into top-level HCL block chunks.
 * Each resource / variable / module / output / etc. becomes one chunk.
 *
 * @param {string} code - File content
 * @param {string} filePath - File path (for error messages)
 * @returns {Array} - Array of chunk objects
 */
export function parseTerraform(code, filePath) {
  const lines = code.split('\n');
  const chunks = [];

  // All recognized top-level HCL block keywords
  const blockStartPattern = /^(resource|data|module|variable|output|provider|locals|terraform|moved|import|check|removed)\b/;

  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();

    // Skip blank lines and comments
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
      i++;
      continue;
    }

    const match = blockStartPattern.exec(trimmed);
    if (match) {
      const blockType = match[1];
      const blockStart = i;

      // Extract quoted labels from the header line.
      // e.g. resource "aws_s3_bucket" "main" -> ["aws_s3_bucket", "main"]
      const labels = [];
      const labelRe = /"([^"]+)"/g;
      let labelMatch;
      while ((labelMatch = labelRe.exec(trimmed)) !== null) {
        labels.push(labelMatch[1]);
      }
      const blockName = labels.length > 0 ? labels.join('.') : blockType;

      // The signature is the header line without the opening brace
      const signature = trimmed.replace(/\s*\{.*$/, '').trim();

      // Find the closing brace of this block by counting { }
      let depth = 0;
      let foundOpen = false;
      let blockEnd = i;

      for (let j = i; j < lines.length; j++) {
        for (const ch of lines[j]) {
          if (ch === '{') { depth++; foundOpen = true; }
          else if (ch === '}') depth--;
        }
        if (foundOpen && depth === 0) {
          blockEnd = j;
          break;
        }
      }

      const startChar = lines.slice(0, blockStart).join('\n').length + (blockStart > 0 ? 1 : 0);
      const content = lines.slice(blockStart, blockEnd + 1).join('\n');

      chunks.push({
        type: blockType,
        name: blockName,
        startLine: blockStart + 1,
        endLine: blockEnd + 1,
        startChar,
        endChar: startChar + content.length,
        content,
        signature,
        docstring: null,
        // Terraform-specific structured fields (queryable via ChromaDB where filters)
        tf_block_type:    blockType,
        tf_resource_type: labels[0] || null,  // e.g. "aws_s3_bucket"
        tf_resource_name: labels[1] || null   // e.g. "main"
      });

      i = blockEnd + 1;
    } else {
      i++;
    }
  }

  // Fallback: return whole file as one chunk if no blocks matched
  if (chunks.length === 0) {
    chunks.push({
      type: 'config',
      name: 'terraform',
      startLine: 1,
      endLine: lines.length,
      startChar: 0,
      endChar: code.length,
      content: code,
      signature: null,
      docstring: null,
      tf_block_type:    null,
      tf_resource_type: null,
      tf_resource_name: null
    });
  }

  return chunks;
}

// ─────────────────────────────────────────────
// YAML
// ─────────────────────────────────────────────

/**
 * Parse a YAML file into logical chunks.
 *
 * Strategy 1 (multi-document): If the file contains --- separators, each
 *   document becomes one chunk. This handles Kubernetes manifests, Helm
 *   templates, Ansible playbooks, etc.
 *
 * Strategy 2 (single-document): Split by top-level keys (lines that start
 *   at column 0). This handles GitHub Actions, Docker Compose, config files, etc.
 *
 * @param {string} code - File content
 * @param {string} filePath - File path (for error messages)
 * @returns {Array} - Array of chunk objects
 */
export function parseYAML(code, filePath) {
  const lines = code.split('\n');
  const sepPattern = /^---\s*(?:#.*)?$/;
  const hasSeparators = lines.some(l => sepPattern.test(l));

  if (hasSeparators) {
    const docs = splitYAMLByDocuments(code, lines, sepPattern);
    if (docs.length > 0) return docs;
  }

  return splitYAMLByTopLevelKeys(code, lines);
}

/**
 * Split multi-document YAML by --- separators.
 * Extracts Kubernetes-style kind/name metadata when present.
 */
function splitYAMLByDocuments(code, lines, sepPattern) {
  const chunks = [];
  let docStart = 0;
  let docIdx = 0;

  const flushDoc = (start, end) => {
    const docLines = lines.slice(start, end);
    const content = docLines.join('\n').trim();
    if (!content || content === '---') return;

    // Try to extract a meaningful name from Kubernetes-style YAML
    const kindM = content.match(/^kind:\s*(\S+)/m);
    const nameM = content.match(/^  name:\s*(\S+)/m) || content.match(/^    name:\s*(\S+)/m);
    const docName = kindM
      ? `${kindM[1]}${nameM ? '/' + nameM[1] : ''}`
      : `document_${docIdx + 1}`;

    const startChar = lines.slice(0, start).join('\n').length + (start > 0 ? 1 : 0);

    // Extract additional Kubernetes / multi-doc YAML metadata
    const apiVersionM = content.match(/^apiVersion:\s*(\S+)/m);
    const namespaceM  = content.match(/^  namespace:\s*(\S+)/m) ||
                        content.match(/^    namespace:\s*(\S+)/m);

    chunks.push({
      type: 'document',
      name: docName,
      startLine: start + 1,
      endLine: end,
      startChar,
      endChar: startChar + content.length,
      content,
      signature: kindM ? `kind: ${kindM[1]}` : null,
      docstring: null,
      // YAML-specific structured fields (queryable via ChromaDB where filters)
      yaml_strategy:    'document_separator',
      yaml_kind:        kindM        ? kindM[1]        : null,  // e.g. "Deployment"
      yaml_api_version: apiVersionM  ? apiVersionM[1]  : null,  // e.g. "apps/v1"
      yaml_namespace:   namespaceM   ? namespaceM[1]   : null,  // e.g. "production"
      yaml_top_key:     null
    });
    docIdx++;
  };

  for (let i = 0; i < lines.length; i++) {
    if (sepPattern.test(lines[i])) {
      flushDoc(docStart, i);
      docStart = i + 1;
    }
  }
  flushDoc(docStart, lines.length);

  return chunks;
}

/**
 * Split single-document YAML by top-level keys.
 * A top-level key is a line that starts at column 0 (no indentation)
 * and matches the YAML key pattern.
 */
function splitYAMLByTopLevelKeys(code, lines) {
  const chunks = [];

  // Match lines that start at column 0 with a YAML key (not a comment or list item)
  const topKeyPattern = /^([a-zA-Z_\-][a-zA-Z0-9_\-]*)\s*:/;

  const keyPositions = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip indented lines, comments, list items, and blank lines
    if (!line || line[0] === ' ' || line[0] === '\t' || line[0] === '#' || line[0] === '-') continue;
    const m = topKeyPattern.exec(line);
    if (m) keyPositions.push({ line: i, key: m[1] });
  }

  // No top-level keys found: return whole file as one chunk
  if (keyPositions.length === 0) {
    return [{
      type: 'config',
      name: 'yaml_content',
      startLine: 1,
      endLine: lines.length,
      startChar: 0,
      endChar: code.length,
      content: code,
      signature: null,
      docstring: null,
      yaml_strategy:    'top_level_keys',
      yaml_kind:        null,
      yaml_api_version: null,
      yaml_namespace:   null,
      yaml_top_key:     null
    }];
  }

  for (let k = 0; k < keyPositions.length; k++) {
    const start = keyPositions[k].line;
    const end = k < keyPositions.length - 1
      ? keyPositions[k + 1].line - 1
      : lines.length - 1;

    const content = lines.slice(start, end + 1).join('\n');
    const startChar = lines.slice(0, start).join('\n').length + (start > 0 ? 1 : 0);

    chunks.push({
      type: 'key',
      name: keyPositions[k].key,
      startLine: start + 1,
      endLine: end + 1,
      startChar,
      endChar: startChar + content.length,
      content,
      signature: `${keyPositions[k].key}:`,
      docstring: null,
      yaml_strategy:    'top_level_keys',
      yaml_kind:        null,
      yaml_api_version: null,
      yaml_namespace:   null,
      yaml_top_key:     keyPositions[k].key  // e.g. "jobs", "services", "env"
    });
  }

  return chunks;
}

// ─────────────────────────────────────────────
// Dispatch
// ─────────────────────────────────────────────

/**
 * Extract chunks from a config file based on its language.
 * Falls back to whole-file chunk on any parse error.
 *
 * @param {string} code - File content
 * @param {string} filePath - File path
 * @returns {Array} - Array of chunk objects
 */
export function extractConfigChunks(code, filePath) {
  const language = detectConfigLanguage(filePath);

  try {
    switch (language) {
      case 'terraform':
        return parseTerraform(code, filePath);
      case 'yaml':
        return parseYAML(code, filePath);
      default:
        return [{
          type: 'config',
          name: 'unknown',
          startLine: 1,
          endLine: code.split('\n').length,
          startChar: 0,
          endChar: code.length,
          content: code,
          signature: null,
          docstring: null
        }];
    }
  } catch (error) {
    logWarn(`Config parsing failed for ${filePath}: ${error.message}. Using whole-file fallback.`);
    return [{
      type: 'config',
      name: 'fallback',
      startLine: 1,
      endLine: code.split('\n').length,
      startChar: 0,
      endChar: code.length,
      content: code,
      signature: null,
      docstring: null
    }];
  }
}
