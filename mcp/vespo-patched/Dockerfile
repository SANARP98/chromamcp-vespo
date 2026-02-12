# Dockerfile for MCP-compliant Chroma server (stdio clean)
# CRITICAL: This Dockerfile ensures ZERO stdout contamination during MCP handshake
# Supports multi-platform builds (amd64, arm64) for Windows, macOS, and Linux

# Use buildx platform arguments for multi-arch support
ARG TARGETPLATFORM
ARG BUILDPLATFORM

FROM oven/bun:1

LABEL org.opencontainers.image.title="ChromaDB MCP Server"
LABEL org.opencontainers.image.description="MCP server for ChromaDB with batch file processing, smart chunking, and vector search"
LABEL org.opencontainers.image.source="https://github.com/SANARP98/chromamcp-vespo"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app

# Install dependencies first (cached layer unless package.json changes)
COPY package.json bun.lock* ./
RUN bun install --silent 2>&1 || bun install

# Copy application source
COPY *.js ./

# Copy env template (users provide real values at runtime via -e or --env-file)
COPY .env.example ./

# CRITICAL: Use direct bun execution (NOT "bun run")
# "bun run" can inject version banners or other output to stdout
# which breaks MCP stdio handshake
CMD ["bun", "index.js"]

# Health check disabled - MCP server communicates via stdio, not HTTP
HEALTHCHECK NONE
