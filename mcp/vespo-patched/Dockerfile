# Dockerfile for MCP-compliant Chroma server (stdio clean)
# CRITICAL: This Dockerfile ensures ZERO stdout contamination during MCP handshake
# Supports multi-platform builds (amd64, arm64) for Windows, macOS, and Linux

# Use buildx platform argument for multi-arch support
ARG TARGETPLATFORM
ARG BUILDPLATFORM

FROM oven/bun:1

WORKDIR /app

# Copy all source files
COPY package.json bun.lock* ./
COPY *.js ./
COPY .env.example ./
COPY .env* ./

# Note: .env file is now copied into the image. dotenv will load it automatically.
# You can still override with: docker run -e OPENAI_API_KEY=sk-...

# Install dependencies
# Using --silent to minimize potential stdout noise
RUN bun install --silent 2>&1 || bun install

# CRITICAL: Use direct bun execution (NOT "bun run")
# "bun run" can inject version banners or other output to stdout
# which breaks MCP stdio handshake
CMD ["bun", "index.js"]

# Health check (optional, won't affect stdio)
HEALTHCHECK NONE
