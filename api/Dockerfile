# Railway (or any Docker host). Build context: this folder (interactive/api).
FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
COPY src ./src
COPY tsconfig.json ./
RUN npx prisma generate

ENV NODE_ENV=production HOST=0.0.0.0 PORT=3100
EXPOSE 3100
# every start: apply new database migrations, then run the API
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx src/server.ts"]
