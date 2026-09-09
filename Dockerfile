FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm ci

COPY . .

ENV NODE_ENV=production
ENV PORT=3001
ENV DB_MODE=sqlite

RUN cd client && npm run build

EXPOSE 3001

CMD ["node", "server/index.js"]