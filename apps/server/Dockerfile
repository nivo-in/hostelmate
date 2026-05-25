# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

RUN npm install -g pnpm@10.33.2

# Only copy package.json — the root pnpm-lock.yaml is a workspace lockfile
# that references all monorepo packages and cannot be used standalone here.
# --no-frozen-lockfile installs from package.json directly, reproducibly.
COPY package.json ./
RUN pnpm install --no-frozen-lockfile --ignore-scripts

# ── Stage 2: Production runner ────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY package.json ./package.json

EXPOSE 3001
CMD ["node", "src/index.js"]
