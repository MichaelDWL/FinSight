FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm install --omit=dev

COPY src ./src
COPY backend/scripts ./backend/scripts

ENV RUNTIME=long
ENV PORT=3045
EXPOSE 3045

CMD ["node", "src/server.js"]
