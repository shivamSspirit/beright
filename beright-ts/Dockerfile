# BeRight Agents Dockerfile - Railway Deployment
# ================================================
# Multi-service deployment with PM2 process manager
# Services: API, Telegram Bot, Heartbeat Agent

FROM node:20-slim

# Install dependencies for native modules + PM2
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g pm2

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (need devDependencies for ts-node)
# Using npm install since this is a monorepo workspace without its own package-lock
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build TypeScript / Next.js
RUN npm run build

# Create directories (Railway volume will mount at /data)
RUN mkdir -p /app/memory /data/state /data/memory /data/logs /data/.pm2

# Make entrypoint executable
RUN chmod +x /app/scripts/railway-entrypoint.sh

# Railway uses port 8080 (configurable via PORT env)
ENV PORT=8080
EXPOSE 8080

# Health check on Railway port
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8080}/api/health || exit 1

# Use PM2 runtime for multi-process management
CMD ["/app/scripts/railway-entrypoint.sh"]
