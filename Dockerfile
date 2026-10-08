FROM node:20-alpine
RUN apk add --no-cache openssl
RUN npm install -g pnpm@9.12.0
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @omnedu/api exec prisma generate
RUN pnpm --filter @omnedu/api build
RUN NODE_OPTIONS=--max-old-space-size=3072 NEXT_PUBLIC_API_URL=https://omneduapi-production.up.railway.app/api/v1 pnpm --filter @omnedu/web build || echo "web build failed, API will start without the site"
RUN ls -la apps/api/dist/
EXPOSE 3001
CMD ["sh", "scripts/start-production.sh"]
