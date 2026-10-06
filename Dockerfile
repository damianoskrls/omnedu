FROM node:20-alpine
RUN apk add --no-cache openssl
RUN npm install -g pnpm@9.12.0
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @omnedu/api exec prisma generate
RUN pnpm --filter @omnedu/api build
RUN ls -la apps/api/dist/
EXPOSE 3001
CMD ["sh", "-c", "pnpm --filter @omnedu/api db:migrate:prod && node apps/api/dist/main"]
