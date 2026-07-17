FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm install --omit=dev

COPY src ./src
COPY backend/scripts ./backend/scripts

ENV RUNTIME=long
ENV PORT=3045
EXPOSE 3045

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3045/live || exit 1

CMD ["node", "src/server.js"]
