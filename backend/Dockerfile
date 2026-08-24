FROM node:20-alpine
WORKDIR /app
RUN addgroup -S kopano && adduser -S kopano -G kopano
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev
COPY src ./src
USER kopano
ENV NODE_ENV=production
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "src/index.js"]
