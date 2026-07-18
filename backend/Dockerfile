# Obsoleto: use o Dockerfile na raiz do monorepo.
# docker compose build (context: .)
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY backend/src ./backend/src
COPY backend/scripts ./backend/scripts
ENV RUNTIME=long
ENV PORT=3045
EXPOSE 3045
CMD ["node", "backend/src/server.js"]
