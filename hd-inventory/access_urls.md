# Guía de Acceso — HD Inventory (Modo Nativo / Bypass NGINX)

Este documento ha sido actualizado para reflejar el acceso directo a los servicios sin pasar por NGINX, eliminando posibles errores de redireccionamiento.

## Enlaces de Acceso

| Servicio | URL Local | URL de Red (Dominio/Host) | Descripción |
| :--- | :--- | :--- | :--- |
| **Frontend (Web)** | [http://localhost:5173](http://localhost:5173) | [http://mxtjsf225.tpvaoc.com:5173](http://mxtjsf225.tpvaoc.com:5173) | Servidor de desarrollo Vite |
| **Backend (API)** | [http://localhost:8000/api/](http://localhost:8000/api/) | [http://mxtjsf225.tpvaoc.com:8000/api/](http://mxtjsf225.tpvaoc.com:8000/api/) | Servidor Django Uvicorn |
| **Django Admin** | [http://localhost:8000/admin/](http://localhost:8000/admin/) | [http://mxtjsf225.tpvaoc.com:8000/admin/](http://mxtjsf225.tpvaoc.com:8000/admin/) | Gestión de administración |

## Consideraciones del Modo Nativo
1. **Puertos:** Es obligatorio incluir el puerto `:5173` para el frontend y `:8000` para el backend/admin.
2. **CORS:** El backend está configurado para aceptar peticiones desde el puerto `5173`.
3. **Estáticos:** El admin de Django servirá los estilos directamente desde el servidor de desarrollo.

---

> [!IMPORTANT]
> Si intentas acceder por el puerto `80` (el predeterminado), obtendrás un error ya que NGINX ha sido desactivado en este modo.
