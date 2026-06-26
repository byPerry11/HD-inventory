# ─── Frontend Dockerfile (Vite dev server) ───────────────────
FROM node:20-alpine

WORKDIR /app

# Copiar manifiestos primero para aprovechar cache de Docker
COPY package.json yarn.lock* ./
RUN yarn install

COPY . .

EXPOSE 5173

# Vite necesita --host para ser accesible desde fuera del contenedor
CMD ["yarn", "dev", "--host", "0.0.0.0"]
