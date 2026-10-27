FROM node:22-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Node 22.18+ runs the TypeScript sources directly, so there is no build step.
COPY src ./src
COPY public ./public

EXPOSE 8080
CMD ["node", "src/server.ts"]
