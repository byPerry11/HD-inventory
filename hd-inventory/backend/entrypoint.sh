#!/bin/sh
# Entrypoint backend — asegura permisos de escritura en volúmenes montados
# (./media y static_volume llegan owned por root) y luego baja a appuser.
set -e
chown -R appuser:appuser /app/media /app/staticfiles 2>/dev/null || true
exec su -s /bin/sh appuser -c "python manage.py collectstatic --noinput && python manage.py migrate --noinput && uvicorn core_main_hdinventory.asgi:application --host 0.0.0.0 --port 8000"
