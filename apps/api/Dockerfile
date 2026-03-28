FROM node:20-alpine AS base
RUN npm install -g pnpm

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/core/package.json packages/core/
COPY packages/model-router/package.json packages/model-router/
COPY packages/solana-gateway/package.json packages/solana-gateway/
COPY packages/plugin-sdk/package.json packages/plugin-sdk/
COPY packages/browser-agent/package.json packages/browser-agent/
COPY packages/agent-browser/package.json packages/agent-browser/
COPY packages/tavily-search/package.json packages/tavily-search/
COPY packages/rhclaw/package.json packages/rhclaw/
COPY packages/skill-vetter/package.json packages/skill-vetter/
COPY packages/platforms/package.json packages/platforms/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile || pnpm install

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/packages/*/dist ./packages/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["node", "dist/index.js"]
