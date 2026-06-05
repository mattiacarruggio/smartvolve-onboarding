FROM node:20-slim AS builder
WORKDIR /app

# Installa tutte le dipendenze, comprese dev (Tailwind serve a build time)
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV production
EXPOSE 8080
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER node
CMD ["node", "server.js"]
