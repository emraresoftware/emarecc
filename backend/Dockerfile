# Stage 1: Build TypeScript
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Stage 2: Production
FROM node:20-alpine
RUN apk add --no-cache tzdata
ENV TZ=Europe/Istanbul
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps

COPY --from=builder /app/dist ./dist
COPY scripts ./scripts
COPY migrations ./migrations

EXPOSE 5000
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
