# ─── Backend Dockerfile ───────────────────────────────────────
# Python 3.12 slim — estable y con soporte a largo plazo
FROM python:3.12-slim

# Variables de entorno para Python
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependencias de Python
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copiar código fuente
COPY . .

# Crear directorio para archivos estáticos (collectstatic)
RUN mkdir -p /app/staticfiles

EXPOSE 8000

# Healthcheck — verifica que el servidor responde
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl --fail http://localhost:8000/health/ || exit 1
