FROM node:20-alpine
RUN apk add --no-cache openssl
RUN npm install -g pnpm@9.12.0
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @omnedu/api exec prisma generate
RUN pnpm --filter @omnedu/api build
RUN NODE_OPTIONS=--max-old-space-size=2048 NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_API_URL=https://omneduapi-production.up.railway.app/api/v1 pnpm --filter @omnedu/web build > apps/web/.web-build.log 2>&1 || true
RUN if [ -f apps/web/.next/BUILD_ID ]; then echo web-ok > apps/api/web-build-status.txt; else { echo web-failed; tail -80 apps/web/.web-build.log; } > apps/api/web-build-status.txt; fi
RUN ls -la apps/api/dist/
EXPOSE 3001
CMD ["sh", "scripts/start-production.sh"]
