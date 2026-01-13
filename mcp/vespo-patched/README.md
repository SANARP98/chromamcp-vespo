# ChromaDB MCP Server - Patched for Codex CLI

> MCP-compliant ChromaDB server with 22 advanced tools for batch file processing, EXIF extraction, folder watching, and duplicate detection.

[![MCP](https://img.shields.io/badge/MCP-Protocol%20Compliant-green)](https://modelcontextprotocol.io)
[![Codex CLI](https://img.shields.io/badge/Codex%20CLI-Compatible-blue)](https://github.com/anthropics/claude-code)
[![Version](https://img.shields.io/badge/version-3.0.1--patched-orange)](https://github.com/vespo92/chromadblocal-mcp-server)

---

## What is This?

This is a **patched and Codex CLI-compatible** version of [vespo92/chromadblocal-mcp-server](https://github.com/vespo92/chromadblocal-mcp-server) that works correctly with ChatGPT Codex CLI in VS Code.

### Why Patched?

The original server had MCP stdio protocol compliance issues:
- ❌ `console.error()` contaminated stdio during handshake
- ❌ Startup banners interfered with MCP initialization
- ❌ Progress logs broke JSON-RPC messages

### What We Fixed

✅ All `console.error()` wrapped in `DEBUG_MCP` flag
✅ Removed startup banners and progress logs
✅ Clean Dockerfile using `bun index.js` (not `bun run`)
✅ Stdio-compliant handshake for Codex CLI
✅ Preserves all 22 advanced tools from original

---

## Features

### Core MCP Tools
- `search_context` - Vector search across collections
- `store_context` - Store documents with metadata
- `list_collections` - List local/remote collections
- `find_similar_patterns` - Find similar code patterns
- `get_environment` - Environment routing info

### Batch File Processing
- `scan_directory` - Preview files before ingesting
- `batch_ingest` - Bulk ingest 500+ files with metadata
- `quick_load` - Fast temporary collection loading
- `unload_collection` - Clean up temp collections
- `export_collection` - Backup to JSON
- `import_collection` - Restore from JSON
- `batch_delete` - Delete by IDs or filters
- `get_collection_info` - Collection statistics
- `ingest_file` - Single file ingestion
- `list_file_types` - Show 77 supported file types

### Photo & EXIF Tools
- `extract_exif` - Extract camera, lens, GPS, date from photos

### Watch Folder Tools
- `watch_folder` - Auto-ingest new files
- `stop_watch` - Stop watching
- `list_watchers` - List active watchers

### Duplicate Detection
- `find_duplicates` - Find duplicate files by hash
- `compare_files` - Compare two files
- `find_collection_duplicates` - Find dupes in collection

**Supports 77 file types**: Photos (.jpg, .png, .raw, .heic), CAD (.stl, .obj, .dxf), Documents (.pdf, .docx), Data (.json, .yaml), Code (.js, .py, .rs, etc.)

---

## Prerequisites

Before installation, ensure you have:

1. **Docker Desktop** - [Download](https://docker.com)
   - Must be installed and **running**
   - Required for ChromaDB and MCP server containers

2. **Node.js** (v14 or higher) - [Download](https://nodejs.org)
   - Required to run the setup script
   - Check: `node --version`

3. **Codex CLI** - [Installation Guide](https://github.com/anthropics/claude-code)
   - The ChatGPT CLI for VS Code
   - Check: `codex --version`

---

## Installation

### macOS/Linux

1. **Navigate to the directory:**
   ```bash
   cd mcp/vespo-patched
   ```

2. **Run the setup script:**
   ```bash
   ./setup-codex-vespo-mac.sh
   ```

3. **Follow the prompts:**
   - The script will check prerequisites
   - Start ChromaDB (Docker)
   - Build the patched MCP server
   - Configure Codex CLI
   - Test the handshake

4. **Restart VS Code** (important!)

5. **Test in Codex:**
   ```
   You: List chroma collections
   You: Scan directory /workspace
   ```

### Windows

1. **Navigate to the directory:**
   ```powershell
   cd mcp\vespo-patched
   ```

2. **Run the setup script:**
   ```powershell
   .\setup-codex-vespo.ps1
   ```

3. **Follow the prompts:**
   - The script will check prerequisites
   - Start ChromaDB (Docker)
   - Build the patched MCP server
   - Configure Codex CLI
   - Test the handshake

4. **Restart VS Code completely** (important!)

5. **Test in Codex:**
   ```
   You: List chroma collections
   You: Scan directory /workspace
   ```

---

## What the Setup Script Does

The automated setup script (`setup-codex-vespo.js`) performs these steps:

1. ✅ Checks prerequisites (Docker, Node.js, Codex CLI)
2. ✅ Verifies Docker Desktop is running
3. ✅ Creates Docker network `chroma-net`
4. ✅ Finds available port (starting from 8003)
5. ✅ Starts ChromaDB container
6. ✅ Builds the patched MCP server image
7. ✅ Configures Codex CLI (`~/.codex/config.toml`)
8. ✅ Tests MCP handshake
9. ✅ Verifies registration with `codex mcp list`

**Platform-specific handling:**
- **Windows**: Uses PowerShell-compatible paths (`C:\\Users\\...`)
- **macOS/Linux**: Uses Unix paths (`/Users/...` or `/home/...`)

---

## Manual Setup (Advanced)

If you prefer manual setup:

### 1. Start ChromaDB

```bash
docker network create chroma-net

docker run -d \
  --name chromadb-vespo \
  --network chroma-net \
  -p 8003:8000 \
  chromadb/chroma:latest
```

### 2. Build the Patched MCP Server

```bash
cd mcp/vespo-patched
docker build -t chroma-mcp-vespo-patched:latest .
```

### 3. Configure Codex CLI

Edit `~/.codex/config.toml`:

**macOS/Linux:**
```toml
[mcp_servers.chromadb_context_vespo]
command = "docker"
args = [
  "run", "--rm", "-i",
  "--network", "chroma-net",
  "-e", "CHROMA_URL=http://chromadb-vespo:8000",
  "-e", "CHROMADB_URL=http://chromadb-vespo:8000",
  "-v", "/Users/yourusername/your-project:/workspace:ro",
  "chroma-mcp-vespo-patched:latest"
]
startup_timeout_sec = 45
tool_timeout_sec = 180
enabled = true
```

**Windows:**
```toml
[mcp_servers.chromadb_context_vespo]
command = "docker"
args = [
  "run", "--rm", "-i",
  "--network", "chroma-net",
  "-e", "CHROMA_URL=http://chromadb-vespo:8000",
  "-e", "CHROMADB_URL=http://chromadb-vespo:8000",
  "-v", "C:\\Users\\yourusername\\your-project:/workspace:ro",
  "chroma-mcp-vespo-patched:latest"
]
startup_timeout_sec = 45
tool_timeout_sec = 180
enabled = true
```

### 4. Verify

```bash
codex mcp list
```

You should see `chromadb_context_vespo` in the list.

---

## First-Time Commands

After installation, test these commands in Codex:

### Basic Commands
```
You: List all MCP tools available
You: List chroma collections
You: Get environment info
```

### Index a Directory
```
You: Scan directory /workspace
You: Batch ingest /workspace into collection my_codebase
You: Search for authentication in my_codebase
```

### Work with Photos
```
You: Extract EXIF from /workspace/photo.jpg
You: Quick load /workspace/photos (categories: images)
You: Find photos taken with Canon in the collection
```

### Find Duplicates
```
You: Find duplicates in /workspace (recursive: true)
You: Compare files /workspace/file1.jpg and /workspace/file2.jpg
```

---

## Uninstallation

If you want to completely remove the ChromaDB MCP Server setup:

### Uninstall on macOS/Linux

```bash
cd mcp/vespo-patched
./uninstall-codex-vespo-mac.sh
```

### Uninstall on Windows

```powershell
cd mcp\vespo-patched
.\uninstall-codex-vespo.ps1
```

### What Gets Removed

The uninstall script will prompt you to:

1. **Remove Docker Containers** (default: Yes)
   - `chromadb-vespo`
   - `chromadb-mcp-server`

2. **Remove Docker Images** (default: No)
   - `chroma-mcp-vespo-patched:latest`
   - `chromadb/chroma:latest`

**Always removed (no prompt):**

- Docker network `chroma-net`
- Docker wrapper script `~/.codex/docker-wrapper.sh`
- Codex CLI configuration for ChromaDB MCP

**After uninstall:** Restart VS Code to apply Codex CLI configuration changes.

---

## Troubleshooting

### Issue: "handshaking with MCP server failed"

**Solution:**
1. Ensure Docker Desktop is running
2. Verify ChromaDB is accessible:
   ```bash
   curl http://localhost:8003/api/v2/heartbeat
   ```
3. Check Docker network:
   ```bash
   docker network inspect chroma-net
   ```
4. Check logs:
   ```bash
   codex mcp logs chromadb_context_vespo
   ```

### Issue: Server starts but tools not available

**Solution:**
1. Completely quit VS Code (not just reload)
2. Ensure `enabled = true` in `~/.codex/config.toml`
3. Start a **new** Codex chat (old chats won't see new MCPs)

### Issue: "Docker not found" or "Docker not running"

**Solution:**
1. Install [Docker Desktop](https://docker.com)
2. Start Docker Desktop
3. Wait for it to fully initialize
4. Run the setup script again

### Issue: Port 8003 already in use

**Solution:**
The setup script automatically finds the next available port. If manual setup:
```bash
docker run -d \
  --name chromadb-vespo \
  --network chroma-net \
  -p 8004:8000 \
  chromadb/chroma:latest
```
Update the port in your `config.toml` accordingly.

---

## Enable Debug Logging

Set `DEBUG_MCP=true` to see internal logs:

```toml
[mcp_servers.chromadb_context_vespo]
command = "docker"
args = [
  "run", "--rm", "-i",
  "--network", "chroma-net",
  "-e", "DEBUG_MCP=true",          # <-- Add this
  "-e", "CHROMA_URL=http://chromadb-vespo:8000",
  ...
]
```

---

## Project Structure

```
vespo-patched/
├── README.md                      # This file
├── package.json                   # Dependencies
├── Dockerfile                     # Container setup
├── .env.example                   # Configuration template
│
├── setup-codex-vespo.js          # Main setup script (Node.js)
├── setup-codex-vespo-mac.sh      # macOS/Linux wrapper
├── setup-codex-vespo.ps1         # Windows wrapper
│
├── index.js                       # Main MCP server
├── batch-processor.js            # Batch file processing
├── exif-extractor.js             # EXIF extraction
├── watch-folder.js               # Folder watching
└── duplicate-detector.js         # Duplicate detection
```

---

## Architecture

```
┌─────────────────┐
│   Codex CLI     │
│   (VS Code)     │
└────────┬────────┘
         │ stdio (JSON-RPC)
         │
┌────────▼────────────────────┐
│  Patched Vespo MCP Server   │
│  (Docker: Bun + Node)        │
│  - 22 Tools                  │
│  - Stdio Compliant           │
│  - No stderr contamination   │
└────────┬────────────────────┘
         │ HTTP
         │
┌────────▼────────────┐
│    ChromaDB         │
│  (Docker: port 8003)│
│  - Vector Storage   │
│  - Embeddings       │
└─────────────────────┘
```

---

## Key Differences vs. Official Chroma MCP

| Feature | Official `mcp/chroma` | Patched Vespo Server |
|---------|----------------------|---------------------|
| **Basic CRUD** | ✅ 11 tools | ✅ Same |
| **Batch Processing** | ❌ None | ✅ 10 tools (500+ files) |
| **EXIF Extraction** | ❌ None | ✅ Camera, GPS, date |
| **Watch Folders** | ❌ None | ✅ Auto-ingest |
| **Duplicate Detection** | ❌ None | ✅ Hash-based |
| **77 File Types** | ❌ Manual only | ✅ Auto-processed |
| **Codex CLI Compatible** | ✅ Yes (Python) | ✅ Yes (patched) |
| **Runtime** | Python/uv | Bun/Node |

---

## Credits

- **Original Server**: [vespo92/chromadblocal-mcp-server](https://github.com/vespo92/chromadblocal-mcp-server)
- **Patches**: Applied for Codex CLI compatibility
- **MCP Protocol**: [Anthropic Model Context Protocol](https://modelcontextprotocol.io)
- **ChromaDB**: [Chroma Vector Database](https://www.trychroma.com)

---

## License

Inherits MIT License from [vespo92/chromadblocal-mcp-server](https://github.com/vespo92/chromadblocal-mcp-server)

---

## FAQ

### Q: Why not use the official `mcp/chroma` server?

**A:** The official server is excellent for basic CRUD but lacks batch processing (500+ files), EXIF extraction, watch folders, duplicate detection, and support for 77 file types.

### Q: Can I use this with Claude Desktop?

**A:** Yes! Use the Bun command instead of Docker:

```json
{
  "mcpServers": {
    "chromadb-vespo": {
      "command": "bun",
      "args": ["run", "/path/to/vespo-patched/index.js"],
      "env": {
        "CHROMA_URL": "http://localhost:8003"
      }
    }
  }
}
```

### Q: Does the setup script work on both macOS and Windows?

**A:** Yes! The main setup script (`setup-codex-vespo.js`) detects your platform and generates the correct configuration format. Just use the appropriate wrapper (`.sh` for macOS/Linux, `.ps1` for Windows).

---

## Success!

If everything works, you now have:
- ✅ ChatGPT with persistent memory via ChromaDB
- ✅ 22 advanced MCP tools for file processing
- ✅ Batch indexing of entire codebases
- ✅ Photo EXIF extraction and search
- ✅ Watch folder auto-ingestion
- ✅ Duplicate file detection

**Enjoy building with MCP! 🚀**
