FROM node:22-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/sdk/package.json packages/sdk/
RUN npm ci

# Build SDK
FROM base AS sdk-build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY packages/sdk/ packages/sdk/
COPY tsconfig.json ./
RUN cd packages/sdk && npx tsc

# Build web app
FROM base AS web-build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=sdk-build /app/packages/sdk/dist packages/sdk/dist
COPY --from=sdk-build /app/packages/sdk/package.json packages/sdk/
COPY apps/web/ apps/web/
COPY tsconfig.json turbo.json package.json ./
RUN cd apps/web && npx prisma generate
RUN cd apps/web && npm run build

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=web-build /app/apps/web/.next/standalone ./
COPY --from=web-build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=web-build /app/apps/web/public ./apps/web/public 2>/dev/null || true
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/web/server.js"]
