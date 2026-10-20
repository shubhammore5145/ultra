FROM node:22-slim

WORKDIR /app

# Copy dependency specifications
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install all dependencies (postinstall will also install backend dependencies)
RUN npm install

# Copy application source
COPY . .

# Build frontend assets for production
RUN npm run build

EXPOSE 5000

ENV PORT=5000
ENV NODE_ENV=production

CMD ["node", "backend/server.js"]
