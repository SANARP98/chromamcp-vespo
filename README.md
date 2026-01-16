# ChromaDB MCP Server for Codex CLI

> **A patched ChromaDB MCP server with 22 advanced tools for batch processing, EXIF extraction, and duplicate detection**

---

## Quick Start

### Step 1: Clone the Repository

```bash
git clone https://github.com/SANARP98/chromamcp-vespo.git
cd chromamcp-vespo
```

### Step 2: Requirements

Before installing, ensure you have:

1. **Docker Desktop** - [Download](https://docker.com)
   - Must be running before setup

2. **Node.js** (v14+) - [Download](https://nodejs.org)
   - Check: `node --version`

3. **Codex CLI** - [Installation Guide](https://github.com/anthropics/claude-code)
   - Check: `codex --version`

---

## Installation

> **Note:** If you have a previous installation, run the uninstall script first. During uninstall, you'll be asked whether to keep or remove existing data - select **Yes** or **No** based on your preference.

### Uninstall Previous Installation (if applicable)

**macOS/Linux:**
```bash
cd mcp/vespo-patched
./uninstall-codex-vespo-mac.sh
```

**Windows:**
```powershell
cd mcp\vespo-patched
.\uninstall-codex-vespo.ps1
```

### Fresh Install

**macOS/Linux:**
```bash
cd mcp/vespo-patched
./setup-codex-vespo-mac.sh
```

**Windows:**
```powershell
cd mcp\vespo-patched
.\setup-codex-vespo.ps1
```

---

## Post-Installation: IMPORTANT

After installation, you **MUST** restart your environment:

### For VS Code Users:
1. **Exit VS Code completely** (File → Exit, not just close the window)
2. **Reopen VS Code**
3. **Close all terminal windows** and open a fresh terminal

### For Terminal Users:
1. **Close your terminal completely**
2. **Open a new terminal session**

### Then:
Navigate to the repository you want to index and run Codex:
```bash
cd /path/to/your/project
codex
```

Test that it's working:
```
List chroma collections
```

---

## Prompt Examples

Here are example prompts you can use with Codex to ingest, index, and retrieve data.

> **Note:** The collection name is automatically set to your repository/folder name, so you don't need to specify it manually.

### Ingesting Files

```
Ingest all files from the current directory
```

```
Batch ingest all JavaScript files from ./src
```

```
Ingest the file ./README.md
```

```
Scan this directory and tell me what files can be ingested
```

```
Quick load all Python files from ./scripts for searching
```

```
Ingest all .ts and .tsx files recursively
```

### Indexing & Managing Collections

```
List all chroma collections
```

```
Get info about the current collection
```

```
Export the current collection to a JSON backup file
```

```
Import collection from ./backup/my-project.json
```

```
Delete the current collection
```

```
Find duplicates in the current collection
```

### Searching & Retrieving

```
Search for "authentication logic"
```

```
Find similar patterns to "async function fetchData"
```

```
Search for code that handles user login
```

```
Find all references to database connections
```

```
Search for error handling patterns
```

```
Find code similar to this function: [paste your code]
```

```
How does the API handle errors?
```

```
Where is the user session managed?
```

### Photo & EXIF Operations

```
Extract EXIF data from ./photos/image.jpg
```

```
Ingest all photos from ./images with EXIF metadata extraction
```

```
Find all photos taken with a Canon camera
```

### Watch Folders

```
Watch the folder ./incoming for new files and auto-ingest them
```

```
List all active folder watchers
```

```
Stop watching the folder ./incoming
```

### Duplicate Detection

```
Find duplicate files in ./documents
```

```
Compare ./file1.txt and ./file2.txt to check if they are duplicates
```

```
Find duplicate entries in the current collection
```

### Advanced Queries

```
Ingest all files from ./src excluding node_modules, then search for "API endpoint"
```

```
Ingest all .tsx and .css files from ./app
```

```
Search across all collections for "database migration"
```

```
Find code patterns similar to React hooks
```

```
What design patterns are used in this codebase?
```

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
- **setup-codex-vespo-mac.sh** - macOS/Linux setup wrapper
- **setup-codex-vespo.ps1** - Windows setup wrapper

### Uninstall Scripts

- **uninstall-codex-vespo.js** - Main automated uninstall (Node.js)
- **uninstall-codex-vespo-mac.sh** - macOS/Linux uninstall wrapper
- **uninstall-codex-vespo.ps1** - Windows uninstall wrapper

### Documentation
- **[README.md](mcp/vespo-patched/README.md)** - Complete installation and usage guide
- **.env.example** - Configuration template

---

## Features

- **22 MCP Tools** for ChromaDB operations
- **Batch Processing** - Ingest 500+ files at once
- **Photo EXIF** - Extract camera, GPS, date metadata
- **Watch Folders** - Auto-ingest new files
- **Duplicate Detection** - Find duplicate files by hash
- **77 File Types** - Code, documents, photos, CAD files, etc.
- **Codex CLI Compatible** - Works with ChatGPT in VS Code

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

**[Complete Guide](mcp/vespo-patched/README.md)**

---

## Project Structure

```
chromamcp-vespo/
├── README.md                          # This file
├── .gitignore                         # Git ignore rules
│
└── mcp/
    └── vespo-patched/                     # Main application
        ├── README.md                      # Detailed guide
        ├── setup-codex-vespo.js          # Automated setup
        ├── setup-codex-vespo-mac.sh      # macOS installer
        ├── setup-codex-vespo.ps1         # Windows installer
        ├── uninstall-codex-vespo.js      # Automated uninstall
        ├── uninstall-codex-vespo-mac.sh  # macOS uninstaller
        ├── uninstall-codex-vespo.ps1     # Windows uninstaller
        ├── index.js                       # MCP server
        ├── batch-processor.js             # Batch operations
        ├── exif-extractor.js              # Photo metadata
        ├── watch-folder.js                # Folder monitoring
        ├── duplicate-detector.js          # Duplicate detection
        ├── package.json                   # Dependencies
        ├── Dockerfile                     # Container setup
        └── .env.example                   # Config template
```

---

## Credits

- **Original Server**: [vespo92/chromadblocal-mcp-server](https://github.com/vespo92/chromadblocal-mcp-server)
- **Patches**: Applied for Codex CLI stdio compliance
- **MCP Protocol**: [Anthropic Model Context Protocol](https://modelcontextprotocol.io)

---

## License

MIT License (inherited from original project)
