FROM node:20-bullseye-slim

# Install Chromium and all system dependencies required for Puppeteer on Linux
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libnss3 \
    libatk-bridge2.0-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libatk1.0-0 \
    libcups2 \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copy dependency specifications
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install root and backend dependencies
RUN npm install
RUN cd backend && npm install

# Copy application source
COPY . .

# Build frontend assets for production
RUN npm run build

EXPOSE 5000

ENV PORT=5000
ENV NODE_ENV=production

CMD ["node", "backend/server.js"]
