FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY web/package.json web/package-lock.json web/
RUN cd web && npm ci
COPY shared shared
COPY keeper keeper
COPY web web
RUN cd web && npx vite build && rm -rf node_modules
ENV SERVE_WEB=1 NODE_ENV=production
CMD ["node", "keeper/index.mjs"]
