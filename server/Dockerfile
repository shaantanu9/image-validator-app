# Self-contained image for the Postgres/Prisma backend.
# Build context is THIS folder, so it does not depend on the pnpm workspace or
#   docker build -t image_validator-server server
#   docker run -p 5012:5012 --env-file server/.env image_validator-server

# Build stage
FROM node:26-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@9

COPY package.json ./
RUN pnpm install --no-frozen-lockfile

COPY . .
RUN pnpm db:generate && pnpm build
RUN pnpm prune --prod

# Production stage
FROM node:26-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache dumb-init

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
# Prisma client + schema are needed at runtime.
COPY --from=builder /app/src/database/prisma ./src/database/prisma

EXPOSE 5012

USER node

CMD ["dumb-init", "node", "dist/server.js"]
