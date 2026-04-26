# ─── Frontend Dockerfile (Vite dev server) ───────────────────
FROM node:20-alpine

WORKDIR /app

# Copiar manifiestos primero para aprovechar cache de Docker
COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

# Vite necesita --host para ser accesible desde fuera del contenedor
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
