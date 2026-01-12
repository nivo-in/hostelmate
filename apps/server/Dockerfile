# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Only copy package.json because we are isolating this package from the monorepo
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts

# ── Stage 2: Production runner ────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY package.json ./package.json

EXPOSE 3001
CMD ["node", "src/index.js"]
