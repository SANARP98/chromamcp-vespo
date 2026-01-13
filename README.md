# ChromaDB MCP Server for Codex CLI

> **A patched ChromaDB MCP server with 22 advanced tools for batch processing, EXIF extraction, and duplicate detection**

---

## Quick Start

### Requirements

Before installing, ensure you have:

1. **Docker Desktop** - [Download](https://docker.com)
   - Must be running before setup

2. **Node.js** (v14+) - [Download](https://nodejs.org)
   - Check: `node --version`

3. **Codex CLI** - [Installation Guide](https://github.com/anthropics/claude-code)
   - Check: `codex --version`

---

## Installation

### macOS/Linux

```bash
cd mcp/vespo-patched
./setup-codex-vespo-mac.sh
```

### Windows

```powershell
cd mcp\vespo-patched
.\setup-codex-vespo.ps1
```

**After installation:**
1. Restart VS Code completely
2. Open Codex and test: `List chroma collections`

---

## What's Included

The main code is in [mcp/vespo-patched](mcp/vespo-patched/) directory:

### Core Files
- **index.js** - Main MCP server (22 tools)
- **batch-processor.js** - Bulk file ingestion
- **exif-extractor.js** - Photo metadata extraction
- **watch-folder.js** - Auto-ingest monitoring
- **duplicate-detector.js** - File deduplication
- **package.json** - Dependencies
- **Dockerfile** - Container configuration

### Setup Scripts
- **setup-codex-vespo.js** - Main automated setup (Node.js)
- **setup-codex-vespo-mac.sh** - macOS/Linux wrapper
- **setup-codex-vespo.ps1** - Windows wrapper

### Documentation
- **[README.md](mcp/vespo-patched/README.md)** - Complete installation and usage guide
- **.env.example** - Configuration template

---

## Features

✅ **22 MCP Tools** for ChromaDB operations
✅ **Batch Processing** - Ingest 500+ files at once
✅ **Photo EXIF** - Extract camera, GPS, date metadata
✅ **Watch Folders** - Auto-ingest new files
✅ **Duplicate Detection** - Find duplicate files by hash
✅ **77 File Types** - Code, documents, photos, CAD files, etc.
✅ **Codex CLI Compatible** - Works with ChatGPT in VS Code

---

## Available Tools (22 Total)

### Core Tools (5)

1. **search_context** - Search for relevant context in ChromaDB (auto routes to local/remote)
2. **store_context** - Store new context in ChromaDB (stores locally and syncs to remote)
3. **list_collections** - List all ChromaDB collections (both local and remote)
4. **find_similar_patterns** - Find similar code patterns (searches local first, then remote)
5. **get_environment** - Get current environment and ChromaDB routing info

### Batch File Processing Tools (10)

1. **scan_directory** - Scan directory and get stats about files (preview before ingesting)
2. **batch_ingest** - Bulk ingest files from directory into ChromaDB with metadata extraction
3. **quick_load** - Rapidly load files into temporary collection for quick searching
4. **unload_collection** - Delete/unload a collection when done processing
5. **export_collection** - Export collection to JSON for backup or transfer
6. **import_collection** - Import collection from a JSON export file
7. **batch_delete** - Delete multiple documents from collection by IDs or filter
8. **get_collection_info** - Get detailed info about collection including document count
9. **ingest_file** - Ingest single file with automatic type detection and metadata
10. **list_file_types** - List all supported file types and extensions (77 types)

### Photo & EXIF Tools (1)

1. **extract_exif** - Extract detailed EXIF metadata from photos (camera, lens, GPS, date)

### Watch Folder Tools (3)

1. **watch_folder** - Start watching folder for new files and auto-ingest them
2. **stop_watch** - Stop watching a folder
3. **list_watchers** - List all active folder watchers

### Duplicate Detection Tools (3)

1. **find_duplicates** - Find duplicate files in directory using file hashing
2. **compare_files** - Compare two specific files to check if they are duplicates
3. **find_collection_duplicates** - Find duplicate entries within a ChromaDB collection

---

## Documentation

For detailed setup instructions, troubleshooting, and usage examples, see:

👉 **[Complete Guide](mcp/vespo-patched/README.md)**

---

## Project Structure

```
ChromaMcp-vespo/
├── README.md                          # This file
├── .gitignore                         # Git ignore rules
│
└── mcp/
    └── vespo-patched/                 # Main application
        ├── README.md                  # Detailed guide
        ├── setup-codex-vespo.js      # Automated setup
        ├── setup-codex-vespo-mac.sh  # macOS installer
        ├── setup-codex-vespo.ps1     # Windows installer
        ├── index.js                   # MCP server
        ├── batch-processor.js         # Batch operations
        ├── exif-extractor.js          # Photo metadata
        ├── watch-folder.js            # Folder monitoring
        ├── duplicate-detector.js      # Duplicate detection
        ├── package.json               # Dependencies
        ├── Dockerfile                 # Container setup
        └── .env.example               # Config template
```

---

## Credits

- **Original Server**: [vespo92/chromadblocal-mcp-server](https://github.com/vespo92/chromadblocal-mcp-server)
- **Patches**: Applied for Codex CLI stdio compliance
- **MCP Protocol**: [Anthropic Model Context Protocol](https://modelcontextprotocol.io)

---

## License

MIT License (inherited from original project)
