# ChromaDB MCP Server - Architecture & Algorithms Documentation

This document provides a comprehensive overview of the ChromaDB MCP Server's architecture, logical flow, and algorithms used throughout the system.

## Table of Contents

1. [Overview](#overview)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Server Initialization & Lifecycle](#server-initialization--lifecycle)
5. [Tool System Architecture](#tool-system-architecture)
6. [Data Flow Diagrams](#data-flow-diagrams)
7. [Key Algorithms](#key-algorithms)
8. [Configuration & Environment](#configuration--environment)
9. [Error Handling & Resilience](#error-handling--resilience)

---

## Overview

The ChromaDB MCP Server is a Model Context Protocol (MCP) server that provides intelligent code understanding, file organization, and vector search capabilities. It integrates with ChromaDB for vector storage and supports 77+ file types with specialized handling for code, images, and CAD files.

### Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Runtime | Node.js (ES Modules) | - |
| MCP Protocol | @modelcontextprotocol/sdk | 0.5.0 |
| Vector Database | ChromaDB | 1.8.1 |
| Embeddings | OpenAI API (text-embedding-3-large) | 4.28.0 |
| AST Parser | Acorn | 8.11.3 |
| Communication | Stdio-based MCP Protocol | - |

---

## Project Structure

```
chromamcp-vespo/
├── README.md                          # Project documentation
└── mcp/vespo-patched/                 # Main application directory
    ├── index.js                       # MCP server entry point (1965 lines)
    ├── batch-processor.js             # File processing & chunking (611 lines)
    ├── smart-chunker.js               # Intelligent code chunking (407 lines)
    ├── code-parser.js                 # AST parsing for JS/Python (449 lines)
    ├── openai-embedder.js             # OpenAI embedding integration (249 lines)
    ├── exif-extractor.js              # JPEG/TIFF metadata extraction
    ├── duplicate-detector.js          # File deduplication (483 lines)
    ├── watch-folder.js                # Directory monitoring (405 lines)
    ├── logger.js                       # Logging utilities (30 lines)
    ├── package.json                   # Dependencies & scripts
    ├── Dockerfile                     # Container configuration
    ├── setup-codex-vespo.js           # Setup automation
    ├── setup-codex-vespo.ps1          # Windows setup script
    ├── setup-codex-vespo-mac.sh       # macOS setup script
    └── uninstall-codex-vespo.js       # Uninstall automation
```

---

## Core Components

### 1. MCP Server Core (`index.js`)

The central orchestrator handling all MCP protocol communication and tool dispatching.

**Responsibilities:**
- Tool registration and invocation handling
- Path translation between host and container environments
- ChromaDB client lifecycle management
- Request/response serialization for MCP protocol

**Key Functions:**

| Function | Purpose |
|----------|---------|
| `translateToWorkspacePath()` | Converts host paths (Windows/Unix) to container paths |
| `getRepoName()` | Extracts repository name from HOST_WORKSPACE for collection naming |
| `routeQuery()` | Routes searches to local or remote ChromaDB based on availability |
| `cleanMetadata()` | Removes null/undefined values (ChromaDB requirement) |

### 2. Batch File Processor (`batch-processor.js`)

Handles bulk file processing with intelligent categorization and metadata extraction.

**Supported File Types (77 total):**

| Category | Count | Extensions |
|----------|-------|------------|
| Images | 10 | jpg, png, gif, bmp, webp, heic, raw, tiff, tif |
| CAD | 13 | dxf, dwg, step, stl, obj, iges, fbx, 3ds, blend, skp, fcstd, scad |
| Documents | 9 | pdf, txt, md, doc, docx, rtf, odt, rst |
| Data | 10 | json, yaml, xml, csv, toml, ini, conf |
| Code | 35 | js, ts, py, java, go, rust, php, swift, c++, etc. |

**Key Functions:**
- `scanDirectory()` - Recursive file discovery with exclusion patterns
- `processFile()` - Type-specific file processing
- `batchProcessFiles()` - Concurrent processing with controlled parallelism
- `extractFileMetadata()` - Metadata extraction based on file type
- `exportCollection()` / `importCollection()` - JSON-based backup/restore

### 3. Smart Code Chunker (`smart-chunker.js`)

Intelligent code-aware chunking that preserves semantic boundaries.

**Algorithm Overview:**
1. Detect language from file extension
2. Parse code into AST to extract logical units
3. Split oversized chunks at optimal boundaries
4. Enrich chunks with metadata (complexity, importance scores)

### 4. Code Parser (`code-parser.js`)

AST-based extraction for JavaScript/TypeScript and Python.

**JavaScript/TypeScript:**
- Uses Acorn parser with latest ES features
- Extracts: FunctionDeclaration, ClassDeclaration, ArrowFunctions, Exports
- Captures JSDoc comments

**Python:**
- Regex-based pattern matching
- Extracts: function/class definitions, decorators, docstrings
- Indentation-based block boundary detection

### 5. OpenAI Embeddings (`openai-embedder.js`)

High-quality embedding generation using OpenAI's API.

**Configuration:**
- Model: `text-embedding-3-large` (3072 dimensions)
- Batch size: Up to 100 texts per request
- Rate limits: 3000 req/min, 1M tokens/min
- Cost: $0.13 per million tokens

### 6. Duplicate Detector (`duplicate-detector.js`)

Multi-strategy file deduplication system.

**Hashing Strategies:**
1. **Partial Hash** (fast) - First + last + middle 64KB chunks
2. **Full Hash** (thorough) - Entire file MD5/SHA256
3. **Perceptual Hash** (images) - Content-based fingerprinting

### 7. Watch Folder (`watch-folder.js`)

Real-time directory monitoring for auto-ingestion.

**Features:**
- Uses Node.js `fs.watch()` API
- Debounced processing (default 1000ms)
- Persistent watcher state saved to `~/.chromadb-watchers.json`

### 8. EXIF Extractor (`exif-extractor.js`)

Pure JavaScript metadata extraction for images.

**Extracted Data:**
- Camera: Make, model, serial number
- Lens: Model, focal length, aperture range
- Exposure: ISO, shutter speed, aperture
- Location: GPS coordinates, altitude
- Time: Date taken, digitized

---

## Server Initialization & Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION STARTUP                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                   ┌──────────────────────┐
                   │  Load Environment    │
                   │  Variables (dotenv)  │
                   └──────────────────────┘
                              │
                              ▼
                   ┌──────────────────────┐
                   │  Create MCP Server   │
                   │  Instance            │
                   │  (name, version,     │
                   │   capabilities)      │
                   └──────────────────────┘
                              │
                              ▼
                   ┌──────────────────────┐
                   │  Register Request    │
                   │  Handlers            │
                   │  • ListToolsRequest  │
                   │  • CallToolRequest   │
                   └──────────────────────┘
                              │
                              ▼
                   ┌──────────────────────┐
                   │  Create Stdio        │
                   │  Transport           │
                   └──────────────────────┘
                              │
                              ▼
                   ┌──────────────────────┐
                   │  Connect & Listen    │
                   │  for MCP Messages    │
                   └──────────────────────┘
```

**Server Class Structure:**

```javascript
class ChromaContextMCP {
  constructor() {
    this.server = new Server({
      name: 'chromadb-context',
      version: '3.0.0'
    })
    this.localClient = null
    this.remoteClient = null
    this.currentEnvironment = null
    this.routerEnabled = false
    this.setupTools()
  }

  async run() {
    const transport = new StdioServerTransport()
    await this.server.connect(transport)
  }
}
```

---

## Tool System Architecture

### Available Tools (22 Total)

#### Core Tools (5)
| Tool | Description |
|------|-------------|
| `search_context` | Vector search with local/remote routing |
| `store_context` | Store new documents with metadata |
| `list_collections` | List all collections |
| `find_similar_patterns` | Code pattern similarity search |
| `get_environment` | Get environment and routing info |

#### Batch Processing Tools (10)
| Tool | Description |
|------|-------------|
| `scan_directory` | Preview files before ingestion |
| `batch_ingest` | Bulk ingest with metadata |
| `smart_ingest` | Code-aware ingestion with OpenAI embeddings |
| `quick_load` | Fast temporary loading |
| `unload_collection` | Delete collections |
| `export_collection` | JSON backup |
| `import_collection` | Restore from JSON |
| `batch_delete` | Delete by IDs or filter |
| `get_collection_info` | Collection statistics |
| `list_file_types` | Show supported types |
| `ingest_file` | Single file ingestion |

#### Photo/EXIF Tools (1)
| Tool | Description |
|------|-------------|
| `extract_exif` | Extract metadata from photos |

#### Watch Folder Tools (3)
| Tool | Description |
|------|-------------|
| `watch_folder` | Start monitoring directory |
| `stop_watch` | Stop monitoring |
| `list_watchers` | Show active watchers |

#### Duplicate Detection Tools (3)
| Tool | Description |
|------|-------------|
| `find_duplicates` | Find duplicates in directory |
| `compare_files` | Compare two specific files |
| `find_collection_duplicates` | Find duplicates in ChromaDB |

### Tool Handler Pattern

```javascript
this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  switch (name) {
    case 'search_context':
      // Process search
      return { content: [{ type: 'text', text: JSON.stringify(result) }] }

    case 'batch_ingest':
      // Process batch ingest
      return { content: [{ type: 'text', text: JSON.stringify(result) }] }

    // ... more tools

    default:
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true
      }
  }
})
```

---

## Data Flow Diagrams

### Complete Request/Response Cycle

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (Codex CLI)                        │
└────────────────────────────┬────────────────────────────────┘
                             │ MCP JSON-RPC over stdio
                             ▼
              ┌─────────────────────────────┐
              │  CallToolRequestSchema      │
              │  Handler                    │
              └─────────────────────────────┘
                             │
                             ▼
              ┌─────────────────────────────┐
              │  Tool Name Switch           │
              │  Statement                  │
              └─────────────────────────────┘
                             │
                             ▼
              ┌─────────────────────────────┐
              │  Path Translation           │
              │  (if applicable)            │
              │  • Windows → Container      │
              │  • Unix → Container         │
              │  • Relative → Absolute      │
              └─────────────────────────────┘
                             │
                             ▼
              ┌─────────────────────────────┐
              │  Get ChromaDB Client        │
              │  • getLocalClient()         │
              │  • routeQuery() [optional]  │
              │  • getRemoteClient()        │
              └─────────────────────────────┘
                             │
                             ▼
              ┌─────────────────────────────┐
              │  Execute Tool Logic         │
              │  • File operations          │
              │  • ChromaDB operations      │
              │  • Metadata extraction      │
              │  • Chunking/embedding       │
              └─────────────────────────────┘
                             │
                             ▼
              ┌─────────────────────────────┐
              │  Format Response            │
              │  • JSON stringify           │
              │  • Wrap in content array    │
              │  • Include isError flag     │
              └─────────────────────────────┘
                             │
                             ▼
              ┌─────────────────────────────┐
              │  Return MCP Response        │
              └─────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (Codex CLI)                        │
└─────────────────────────────────────────────────────────────┘
```

### Batch Ingest Flow

```
batch_ingest({path, collection, max_files})
                    │
                    ▼
         ┌─────────────────────┐
         │  scanDirectory()    │
         │  → files[]          │
         └─────────────────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │  batchProcessFiles()│
         │  (concurrency: 10)  │
         └─────────────────────┘
                    │
     ┌──────────────┼──────────────┐
     ▼              ▼              ▼
┌─────────┐   ┌─────────┐    ┌─────────┐
│ File 1  │   │ File 2  │    │ File N  │
│ Process │   │ Process │    │ Process │
└─────────┘   └─────────┘    └─────────┘
     │              │              │
     └──────────────┼──────────────┘
                    ▼
         ┌─────────────────────┐
         │  For each file:     │
         │  • Detect type      │
         │  • Extract metadata │
         │  • Smart chunk      │
         │  • Track progress   │
         └─────────────────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │  Store in ChromaDB  │
         │  (batch size: 100)  │
         └─────────────────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │  Generate Report    │
         │  • files_found      │
         │  • files_processed  │
         │  • errors           │
         │  • sample_files     │
         └─────────────────────┘
```

### Smart Ingest Flow (with OpenAI)

```
smart_ingest({path, chunk_size: 4000, overlap: 200})
                    │
                    ▼
         ┌─────────────────────┐
         │  scanDirectory()    │
         │  → code files only  │
         │  (.js, .ts, .py)    │
         └─────────────────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │  batchProcessFiles  │
         │  useSmartChunking   │
         └─────────────────────┘
                    │
                    ▼
     ┌──────────────┴──────────────┐
     │                             │
     ▼                             ▼
┌────────────────┐    ┌────────────────────┐
│  code-parser   │    │  smart-chunker     │
│  .extractChunks│───▶│  .intelligentChunk │
└────────────────┘    └────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  Enriched chunks    │
                    │  with metadata      │
                    └─────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  OpenAI Embeddings  │
                    │  • Batch processing │
                    │  • Rate limiting    │
                    │  • Cost tracking    │
                    └─────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  Store in ChromaDB  │
                    │  with embeddings    │
                    │  (batch size: 100)  │
                    └─────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  Return stats       │
                    │  • chunks_created   │
                    │  • embedding_tokens │
                    │  • estimated_cost   │
                    └─────────────────────┘
```

### Vector Search Flow

```
search_context({query, collection, limit})
                    │
                    ▼
         ┌─────────────────────┐
         │  routeQuery()       │
         │  → 'local'/'remote' │
         └─────────────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
   ┌─────────┐            ┌─────────┐
   │ Local   │            │ Remote  │
   │ Client  │            │ Client  │
   └─────────┘            └─────────┘
        │                       │
        └───────────┬───────────┘
                    ▼
         ┌─────────────────────┐
         │  getOrCreate        │
         │  Collection         │
         └─────────────────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │  coll.query({       │
         │    queryTexts,      │
         │    nResults         │
         │  })                 │
         └─────────────────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │  Format results     │
         │  • Map documents    │
         │  • Include metadata │
         │  • Include scores   │
         │  • Include source   │
         └─────────────────────┘
```

---

## Key Algorithms

### 1. Smart Chunking Algorithm

**Location:** `smart-chunker.js`

**Purpose:** Split code files into semantically meaningful chunks while preserving context.

```
INPUT: Raw source code + file path
OUTPUT: Array of enriched chunks with metadata

ALGORITHM:

1. LANGUAGE DETECTION
   ┌─────────────────────────────────────┐
   │ ext = extname(filePath).toLowerCase()│
   │ .js → 'javascript'                   │
   │ .ts → 'typescript'                   │
   │ .py → 'python'                       │
   └─────────────────────────────────────┘

2. AST PARSING
   ┌─────────────────────────────────────┐
   │ parsedChunks = extractChunks(       │
   │   content, filePath                 │
   │ )                                   │
   │ Returns: [{                         │
   │   type, name, startLine,            │
   │   content, signature, docstring     │
   │ }]                                  │
   └─────────────────────────────────────┘

3. CHUNK FILTERING
   ┌─────────────────────────────────────┐
   │ For each chunk:                     │
   │   IF chunk.size < maxChunkSize:     │
   │     Keep as-is, enrich metadata     │
   │   ELSE:                             │
   │     Split at logical boundaries     │
   └─────────────────────────────────────┘

4. SPLIT WITH OVERLAP
   ┌─────────────────────────────────────┐
   │ linesPerChunk = floor(maxChunkSize  │
   │                 / avgLineLength)    │
   │ overlapLines = floor(overlap        │
   │                / avgLineLength)     │
   │                                     │
   │ WHILE currentLine < lines.length:   │
   │   splitPoint = findOptimalSplitPoint│
   │     (lines, window, language)       │
   │   Extract chunk with overlap        │
   │   currentLine = splitPoint -        │
   │                 overlapLines        │
   └─────────────────────────────────────┘

5. METADATA ENRICHMENT
   ┌─────────────────────────────────────┐
   │ enrichChunkMetadata(chunk) → {      │
   │   content,                          │
   │   metadata: {                       │
   │     chunk_type, name, language,     │
   │     start_line, end_line,           │
   │     signature, has_docstring,       │
   │     complexity_estimate, loc,       │
   │     chunk_score, is_public,         │
   │     is_exported, is_async,          │
   │     preview                         │
   │   }                                 │
   │ }                                   │
   └─────────────────────────────────────┘
```

**Split Point Scoring:**

| Line Type | Score | Reason |
|-----------|-------|--------|
| Empty line | 10 | Best natural break |
| Comment line | 8 | Logical boundary |
| Closing brace/bracket | 7 | End of block |
| Return statement | 6 | End of logic |
| Break/continue | 5 | Loop boundary |
| Regular code | 1 | Poor split point |

**Complexity Scoring:**

```javascript
score = 5 (base)
      + (isExported ? 2 : 0)
      + (publicName ? 1 : 0)
      + (isFunction ? 1 : 0)
      + (isClass ? 1 : 0)
      + (hasDocstring ? 1 : 0)
      + (isAsync ? 0.5 : 0)

// Final score capped at 10
```

**Cyclomatic Complexity Estimation:**

```javascript
// Count control flow statements
complexity = count of:
  if, else if, else,
  for, while, case,
  catch, try, &&, ||, ?

// Capped at 100
```

---

### 2. Duplicate Detection Algorithm

**Location:** `duplicate-detector.js`

**Purpose:** Efficiently find duplicate files using multi-strategy hashing.

```
ALGORITHM:

PHASE 1: GROUP BY SIZE (Pre-filter)
┌─────────────────────────────────────┐
│ 1. Read all files in directory      │
│ 2. Get file stats for each          │
│ 3. Group files by size              │
│    (identical size = potential dup) │
└─────────────────────────────────────┘
              │
              ▼
PHASE 2: HASH POTENTIAL DUPLICATES
┌─────────────────────────────────────┐
│ 1. Keep only size groups with >1    │
│ 2. Calculate hash for each file     │
│    (partial/full/perceptual)        │
│ 3. Group by hash                    │
│ 4. Keep only hash groups with >1    │
└─────────────────────────────────────┘
              │
              ▼
PHASE 3: REPORTING
┌─────────────────────────────────────┐
│ 1. Calculate wasted space           │
│    (sum of duplicates except oldest)│
│ 2. Sort groups by wasted space      │
│ 3. Return sorted results            │
└─────────────────────────────────────┘
```

**Partial Hash Algorithm (Fast):**

```javascript
hash(file) = MD5(
  fileSize +
  first64KB +
  (if size > 128KB: last64KB) +
  (if size > 192KB: middle64KB)
)

// Samples strategic positions to catch differences
// while avoiding full file read
```

**Perceptual Hash (Images Only):**

```javascript
// JPEG: Sample SOS (Start of Scan) marker data
// PNG: Sample IDAT chunks
// Creates fingerprint insensitive to minor edits
```

---

### 3. Path Translation Algorithm

**Location:** `index.js` - `translateToWorkspacePath()`

**Purpose:** Convert paths between host system and Docker container.

```
INPUT: Path from client (may be Windows, Unix, or relative)
OUTPUT: Container path (/workspace/...)

ALGORITHM:

┌─────────────────────────────────────────┐
│ 1. IF relative path (., ./, src):       │
│    → Append to /workspace               │
│                                         │
│ 2. IF Windows absolute (C:\...):        │
│    → Check if matches HOST_WORKSPACE    │
│    → If yes: translate subpath          │
│    → If no: use /workspace fallback     │
│                                         │
│ 3. IF Unix absolute (/Users/..., /home/)│
│    → Check if matches HOST_WORKSPACE    │
│    → If yes: translate subpath          │
│    → If no: use /workspace fallback     │
│                                         │
│ 4. IF already /workspace path:          │
│    → Return as-is                       │
│                                         │
│ 5. IF no HOST_WORKSPACE set:            │
│    → Log warning, use /workspace        │
└─────────────────────────────────────────┘
```

**Translation Examples:**

| Host Path | Container Path |
|-----------|----------------|
| `C:\Users\foo\project` | `/workspace` |
| `/Users/foo/project` | `/workspace` |
| `./src` | `/workspace/src` |
| `src` | `/workspace/src` |
| `/workspace/src` | `/workspace/src` |

---

### 4. OpenAI Embeddings Pipeline

**Location:** `openai-embedder.js`

**Purpose:** Generate high-quality vector embeddings with rate limiting.

```
INPUT: Array of text strings
OUTPUT: Array of embedding vectors (3072 dimensions each)

ALGORITHM:

┌─────────────────────────────────────┐
│  texts[] → Batch (size: 100)        │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  For each batch:                    │
│                                     │
│  1. CHECK RATE LIMITS               │
│     - 3000 req/min window           │
│     - 1M tokens/min window          │
│     - If approaching: wait          │
│                                     │
│  2. CALL OPENAI API                 │
│     openai.embeddings.create({      │
│       model: 'text-embedding-3-large│
│       input: batch,                 │
│       dimensions: 3072              │
│     })                              │
│                                     │
│  3. HANDLE ERRORS                   │
│     - 429/5xx: exponential backoff  │
│       (1s, 2s, 4s, max 3 retries)   │
│     - 400-499: fail immediately     │
│                                     │
│  4. EXTRACT EMBEDDINGS              │
│     response.data[].embedding       │
│                                     │
│  5. TRACK TOKEN USAGE               │
│     response.usage.total_tokens     │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  Return: embedding_vectors[][]      │
│  (3072 dimensions per text)         │
└─────────────────────────────────────┘
```

**Cost Calculation:**

```javascript
// text-embedding-3-large: $0.13 per million tokens
cost = (tokens / 1_000_000) * 0.13

// Token estimation (rough approximation)
estimatedTokens = Math.ceil(text.length / 4)
```

---

### 5. Text Chunking Algorithm

**Location:** `batch-processor.js`

**Purpose:** Split large text files into manageable overlapping chunks.

```
INPUT: content, chunkSize=1500, overlap=200
OUTPUT: Array of chunk strings with headers

ALGORITHM:

┌─────────────────────────────────────┐
│  IF content.length <= chunkSize:    │
│    Return [content] (single chunk)  │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  WHILE position < content.length:   │
│                                     │
│  1. Extract chunk of chunkSize      │
│     starting at position            │
│                                     │
│  2. Add header:                     │
│     "[filename] (chunk X/Y)"        │
│                                     │
│  3. Advance position by             │
│     (chunkSize - overlap)           │
│                                     │
│  4. Overlap ensures context         │
│     preservation between chunks     │
└─────────────────────────────────────┘
```

**Visual Representation:**

```
Content: |---------------------------------------------------------------|

Chunk 1: |=================|
Chunk 2:           |=================|
Chunk 3:                     |=================|
                   ↑         ↑
                 overlap   overlap
```

---

## Configuration & Environment

### Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `DEBUG_MCP` | Enable debug logging | `'false'` |
| `CHROMA_URL` / `CHROMADB_URL` | ChromaDB endpoint | `'http://chromadb-vespo:8000'` |
| `HOST_WORKSPACE` | Original host path (for translation) | `null` |
| `OPENAI_API_KEY` | Required for smart_ingest | `null` |
| `CHROMA_ROUTER_ENABLED` | Enable multi-environment routing | `'false'` |

### Logging System

```javascript
// logger.js - All logging to stderr only

logDebug(...args)  // Only if DEBUG_MCP='true'
logWarn(...args)   // Only if DEBUG_MCP='true'
logError(...args)  // Only if DEBUG_MCP='true'

// CRITICAL: Prevents stdout contamination
// during MCP protocol handshake
```

### Collection Naming

```javascript
getRepoName() → Extracts from HOST_WORKSPACE

// Examples:
// /Users/user/my-project → 'my_project'
// C:\Users\user\my-project → 'my_project'

// Sanitization:
// [^a-zA-Z0-9_-] → '_'
```

---

## Error Handling & Resilience

### Graceful Degradation

| Error Scenario | Recovery Strategy |
|----------------|-------------------|
| File read error | Skip file, continue batch |
| EXIF parsing fails | Continue with basic metadata |
| Smart chunking fails | Fall back to simple chunking |
| Remote ChromaDB unavailable | Use local only |
| JavaScript parsing error | Return whole file as single chunk |

### OpenAI Retry Logic

```
┌─────────────────────────────────────┐
│  TRANSIENT ERRORS (429, 5xx):       │
│  • Exponential backoff: 1s, 2s, 4s  │
│  • Max 3 retries                    │
│  • Warn before each retry           │
│                                     │
│  CLIENT ERRORS (400-499 except 429):│
│  • Fail immediately                 │
│                                     │
│  NETWORK ERRORS:                    │
│  • Retry with backoff               │
└─────────────────────────────────────┘
```

### Data Validation

- **Metadata cleaning:** Remove null/undefined (ChromaDB requirement)
- **File accessibility:** Verify before processing (watch_folder)
- **Size checks:** Skip empty/incomplete files (<10 bytes)
- **Path validation:** Verify existence before operations

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                       CODEX CLI / CLIENT                        │
└────────────────────────────┬────────────────────────────────────┘
                             │ MCP JSON-RPC over stdio
                             ▼
           ┌─────────────────────────────────────┐
           │       MCP Server (index.js)         │
           │   • Tool handler dispatcher         │
           │   • Path translation                │
           │   • ChromaDB routing                │
           └────────────────┬────────────────────┘
                            │
       ┌────────────────────┼────────────────────┐
       ▼                    ▼                    ▼
┌─────────────┐    ┌──────────────┐    ┌──────────────┐
│    File     │    │   Search     │    │  Utilities   │
│  Processor  │    │   Engine     │    │              │
│             │    │              │    │  • duplicate │
│ batch-      │    │  ChromaDB +  │    │    detector  │
│ processor   │    │  vector      │    │  • watch-    │
│             │    │  search      │    │    folder    │
│ • scan      │    │              │    │  • exif-     │
│ • process   │    │              │    │    extractor │
│ • extract   │    │              │    │  • logger    │
└──────┬──────┘    └──────────────┘    └──────────────┘
       │
       ▼
┌──────────────┐    ┌──────────────┐
│ smart-       │    │ openai-      │
│ chunker      │    │ embedder     │
│              │    │              │
│ • AST parse  │    │ • Batch      │
│ • Split      │    │   embeddings │
│ • Enrich     │    │ • Rate limit │
└──────┬───────┘    └──────────────┘
       │
       ▼
┌──────────────┐
│ code-parser  │
│              │
│ • Acorn (JS) │
│ • Regex (Py) │
└──────────────┘

                             ▼
              ┌──────────────────────────────┐
              │    ChromaDB (Docker)          │
              │  http://chromadb-vespo:8000   │
              │                               │
              │    Persistent Volume Storage  │
              └──────────────────────────────┘
```

---

## Appendix: File Type Support Matrix

| Category | Extensions | Processing |
|----------|------------|------------|
| **JavaScript** | `.js`, `.mjs`, `.cjs` | AST + Smart Chunking |
| **TypeScript** | `.ts`, `.tsx` | AST + Smart Chunking |
| **Python** | `.py`, `.pyw` | Regex + Smart Chunking |
| **Images** | `.jpg`, `.png`, `.gif`, `.bmp`, `.webp` | EXIF + Metadata |
| **CAD** | `.dxf`, `.dwg`, `.stl`, `.obj` | Geometry Metadata |
| **Documents** | `.md`, `.txt`, `.rst` | Text Chunking |
| **Data** | `.json`, `.yaml`, `.xml`, `.csv` | Text Chunking |
| **Config** | `.toml`, `.ini`, `.conf` | Text Chunking |

---

*Generated for ChromaDB MCP Server v3.0.0*
