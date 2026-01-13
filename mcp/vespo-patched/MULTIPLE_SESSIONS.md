# Multiple Concurrent Codex Sessions

## Problem Solved

**Question:** "If I have two terminals with codex in different repos, do we have a conflict?"

**Answer:** Not anymore! As of the latest update, you can run **multiple Codex sessions simultaneously** without conflicts.

## The Original Problem

Previously, the setup used a fixed container name:

```toml
args = [
  "run", "--rm", "-i",
  "--name", "chromadb-mcp-server",  # ❌ CONFLICT!
  ...
]
```

This caused:
```bash
# Terminal 1
cd /repo-a
codex  # Creates container: chromadb-mcp-server

# Terminal 2
cd /repo-b
codex  # ERROR: Container name already in use!
```

## The Solution

Removed the `--name` flag to allow Docker to auto-generate unique names:

```toml
args = [
  "run", "--rm", "-i",
  # No --name flag
  "--network", "chroma-net",
  ...
]
```

Now:
```bash
# Terminal 1
cd /repo-a
codex  # Container: eloquent_darwin (auto-generated)

# Terminal 2
cd /repo-b
codex  # Container: focused_tesla (auto-generated)

# Both work simultaneously! ✅
```

## How It Works

### 1. Auto-Generated Container Names

Docker automatically assigns unique names when `--name` is omitted:
- `elegant_curie`
- `focused_tesla`
- `quirky_darwin`
- etc.

### 2. Automatic Cleanup

The `--rm` flag ensures containers are removed when Codex exits:
```toml
"run", "--rm", "-i"  # --rm = remove on exit
```

### 3. Independent Workspaces

Each session mounts its own workspace:
- Terminal 1: `/repo-a` → `/workspace` in container 1
- Terminal 2: `/repo-b` → `/workspace` in container 2
- No shared state between them

### 4. Shared ChromaDB Backend

All MCP servers connect to the same ChromaDB instance:
```
Terminal 1 MCP → chromadb-vespo:8000
Terminal 2 MCP → chromadb-vespo:8000 (same)
```

**Benefits:**
- Collections are shared across sessions
- Data persists when switching terminals
- Can query collections created in other sessions

## Usage Examples

### Example 1: Concurrent Development

```powershell
# Terminal 1 - Work on frontend
cd C:\Projects\webapp\frontend
codex
You: "Batch ingest /workspace into collection frontend_code"
You: "Search for React components in frontend_code"

# Terminal 2 - Work on backend (SIMULTANEOUSLY!)
cd C:\Projects\webapp\backend
codex
You: "Batch ingest /workspace into collection backend_code"
You: "Search for API endpoints in backend_code"
You: "List collections"  # Shows both frontend_code and backend_code
```

### Example 2: Multi-Project Analysis

```bash
# Terminal 1 - Analyze photos
cd ~/Photos/2024-vacation
codex
You: "Extract EXIF from all images in /workspace"
You: "Quick load /workspace categories:images collection:vacation"

# Terminal 2 - Analyze code (at the same time)
cd ~/repos/my-app
codex
You: "Scan directory /workspace"
You: "Batch ingest /workspace into collection myapp"

# Terminal 3 - Compare projects
cd ~/repos/other-app
codex
You: "Find similar patterns between myapp and /workspace"
```

### Example 3: Team Workflow

```powershell
# Developer A - Feature branch
cd C:\Projects\app\feature\user-auth
codex
You: "Ingest /workspace into collection feature_auth"

# Developer B - Different feature (same time, different terminal)
cd C:\Projects\app\feature\payment
codex
You: "Ingest /workspace into collection feature_payment"

# Both can work independently without conflicts
```

## Technical Details

### Container Lifecycle

Each Codex session:
1. Wrapper script reads `$PWD` (current directory)
2. Converts path to Docker format
3. Executes: `docker run --rm -i --network chroma-net -v ${PWD}:/workspace:ro ...`
4. Docker assigns auto-generated name
5. MCP server starts, connects to shared ChromaDB
6. When Codex exits, container is removed (`--rm`)

### Wrapper Script Changes

**Before (had conflicts):**
```powershell
if ($ContainerName) {
    & $DockerBin rm -f $ContainerName  # Tried to kill existing
}
```

**After (no conflicts):**
```powershell
# No container name handling needed
# Docker handles uniqueness automatically
```

### Resource Usage

Each MCP server container:
- **Memory:** ~50-100MB per instance
- **CPU:** Minimal when idle
- **Network:** Shared network `chroma-net`
- **Storage:** Ephemeral (removed on exit)

**Shared ChromaDB:**
- **Memory:** ~200-500MB (persistent)
- **CPU:** Minimal
- **Storage:** Persistent volume

## Limitations & Considerations

### 1. Shared ChromaDB State

All sessions share the same ChromaDB instance:

**Pros:**
- Collections persist across terminals
- Can access data from other sessions
- Collaborative workflows possible

**Cons:**
- Collection names must be unique
- Concurrent writes to same collection could conflict
- No isolation between sessions

### 2. Port Availability

Only one ChromaDB instance runs (port 8003):
- All MCP servers connect to same port
- Multiple Codex sessions OK
- Cannot run multiple ChromaDB instances on same port

### 3. Network Performance

All containers share the `chroma-net` network:
- No isolation between MCP servers
- Potential network congestion (rare)
- All use same ChromaDB connection

### 4. Collection Naming

Use unique collection names per project:

```powershell
# Terminal 1
You: "Batch ingest /workspace into collection webapp_frontend"

# Terminal 2
You: "Batch ingest /workspace into collection webapp_backend"

# Not: "my_collection" (conflicts if both use same name)
```

## Best Practices

### 1. Use Descriptive Collection Names

```bash
# Good
"batch ingest /workspace into collection myapp_auth_v1"

# Bad
"batch ingest /workspace into collection temp"
```

### 2. Close Unused Sessions

```powershell
# Check running MCP containers
docker ps --filter "ancestor=chroma-mcp-vespo-patched"

# Clean up manually if needed (containers auto-remove on exit)
```

### 3. Monitor Resource Usage

```powershell
# Check memory usage
docker stats

# Check ChromaDB health
curl http://localhost:8003/api/v2/heartbeat
```

### 4. Organize Collections

```bash
# Use prefixes for organization
project1_codebase
project1_docs
project2_codebase
project2_tests
```

## Troubleshooting

### Issue: Too Many Containers

**Symptom:** Docker resources exhausted

**Solution:**
```bash
# List MCP containers
docker ps --filter "ancestor=chroma-mcp-vespo-patched"

# Should auto-remove with --rm, but if stuck:
docker container prune
```

### Issue: ChromaDB Connection Refused

**Symptom:** All sessions fail to connect

**Solution:**
```bash
# Check ChromaDB is running
docker ps --filter "name=chromadb-vespo"

# Restart if needed
docker restart chromadb-vespo
```

### Issue: Collection Name Conflicts

**Symptom:** "Collection already exists" error

**Solution:**
```bash
You: "List collections"
You: "Unload collection existing_name"  # Or use different name
```

## Comparison: Before vs After

| Feature | Before (Named Container) | After (Auto-Named) |
|---------|-------------------------|-------------------|
| **Concurrent sessions** | ❌ Conflict | ✅ Works |
| **Container cleanup** | ⚠️ Manual | ✅ Automatic |
| **Setup complexity** | Higher | Lower |
| **Resource usage** | Higher (conflicts) | Lower (isolated) |
| **Reliability** | Lower | Higher |

## Migration Guide

If you have an old setup with named containers:

### 1. Update Setup Script

```bash
cd mcp/vespo-patched
git pull  # Get latest changes
```

### 2. Re-run Setup

```bash
./setup-codex-vespo.ps1  # Windows
./setup-codex-vespo-mac.sh  # macOS/Linux
```

### 3. Verify Config

```bash
codex mcp get chromadb_context_vespo
# Should NOT see "--name" flag in args
```

### 4. Restart VS Code

```powershell
# Close completely (Ctrl+Q)
# Reopen and test
```

### 5. Test Multiple Sessions

```powershell
# Terminal 1
cd /path/to/project1
codex

# Terminal 2 (simultaneously)
cd /path/to/project2
codex

# Both should work!
```

## Summary

✅ **Multiple Codex sessions now work simultaneously**
✅ **No container name conflicts**
✅ **Automatic cleanup with `--rm`**
✅ **Shared ChromaDB for persistent collections**
✅ **Independent workspaces per terminal**

The removal of the `--name` flag allows Docker to handle container uniqueness automatically, enabling true concurrent multi-session workflows!
