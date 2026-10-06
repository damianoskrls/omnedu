FROM node:20-alpine
RUN npm install -g pnpm@9.12.0
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @omnedu/api exec prisma generate
RUN pnpm --filter @omnedu/api build
EXPOSE 3001
CMD ["sh", "-c", "cd apps/api && node_modules/.bin/prisma migrate deploy; cd /app && node apps/api/dist/main"]
