FROM node:20-bullseye-slim

# Only install essential system libraries (no Chrome needed with Baileys!)
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency specifications
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install all dependencies (postinstall will also install backend)
RUN npm install

# Copy application source
COPY . .

# Build frontend assets for production
RUN npm run build

EXPOSE 5000

ENV PORT=5000
ENV NODE_ENV=production

CMD ["node", "backend/server.js"]
