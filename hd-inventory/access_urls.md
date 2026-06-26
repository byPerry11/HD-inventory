# Guía de Acceso — HD Inventory

> **Host:** `MXTJSF225` · **IP LAN:** `192.168.10.163` · **Dominio:** `mxtjsf225.tpvaoc.com`

## Enlaces de Acceso

| Servicio | URL Local (desde este PC) | URL LAN por Dominio | URL LAN por IP | Puerto |
| :--- | :--- | :--- | :--- | :---: |
| **Frontend (Web)** | [http://localhost:5173](http://localhost:5173) | [http://mxtjsf225.tpvaoc.com:5173](http://mxtjsf225.tpvaoc.com:5173) | [http://192.168.10.163:5173](http://192.168.10.163:5173) | `5173` |
| **Backend (API)** | [http://localhost:8000/api/](http://localhost:8000/api/) | [http://mxtjsf225.tpvaoc.com:8000/api/](http://mxtjsf225.tpvaoc.com:8000/api/) | [http://192.168.10.163:8000/api/](http://192.168.10.163:8000/api/) | `8000` |
| **Django Admin** | [http://localhost:8000/admin/](http://localhost:8000/admin/) | [http://mxtjsf225.tpvaoc.com:8000/admin/](http://mxtjsf225.tpvaoc.com:8000/admin/) | [http://192.168.10.163:8000/admin/](http://192.168.10.163:8000/admin/) | `8000` |
| **WebSocket (Chat)** | `ws://localhost:8000/ws/chat/` | `ws://mxtjsf225.tpvaoc.com:8000/ws/chat/` | `ws://192.168.10.163:8000/ws/chat/` | `8000` |

## Acceso desde otros equipos en la LAN

Cualquier equipo conectado a la misma red puede acceder a la aplicación usando:

- **Por dominio:** `http://mxtjsf225.tpvaoc.com:5173` (requiere que el DNS corporativo resuelva el hostname)
- **Por hostname:** `http://mxtjsf225:5173` (funciona en redes Windows con resolución NetBIOS)
- **Por IP directa:** `http://192.168.10.163:5173` (funciona siempre, sin depender de DNS)

## Configuración Actual

| Parámetro | Valor |
| :--- | :--- |
| **ALLOWED_HOSTS** | `localhost`, `127.0.0.1`, `backend`, `0.0.0.0`, `mxtjsf225`, `mxtjsf225.tpvaoc.com`, `mxtj225.inventory` |
| **CORS Origins** | `localhost:5173`, `127.0.0.1:5173`, `mxtjsf225:5173`, `mxtjsf225.tpvaoc.com:5173`, `localhost:3000`, `mxtj225.inventory` |
| **Servidor Backend** | Uvicorn (ASGI) en puerto `8000` |
| **Servidor Frontend** | Vite Dev Server en puerto `5173` |
| **Base de Datos** | PostgreSQL 16 en puerto `5432` |
| **Redis (Channels)** | Redis 7 en puerto `6379` |

## Notas Importantes

> [!IMPORTANT]
> Los puertos `:5173` (frontend) y `:8000` (backend/admin) son **obligatorios** en la URL. No se usa NGINX, por lo que el puerto `80` no está activo.

> [!TIP]
> Si un equipo en la LAN no puede resolver `mxtjsf225.tpvaoc.com`, usa la IP directa `192.168.10.163` en su lugar.

> [!WARNING]
> Si la IP de este equipo cambia (por ejemplo, si usa DHCP), actualiza este documento y la configuración de CORS/ALLOWED_HOSTS en `settings.py`.
