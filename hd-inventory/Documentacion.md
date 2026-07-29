# Documentación del Sistema: HD-Inventory (Almacén de Materiales PE)

## 1. Introducción
**HD-Inventory** es un sistema integral de control de inventario y gestión de almacenes diseñado para el departamento de Ingeniería de Producción (PE). El objetivo principal del sistema es digitalizar, automatizar y centralizar el flujo de entradas, salidas, vales y órdenes de compra de materiales, asegurando una trazabilidad completa y mejorando la toma de decisiones mediante paneles analíticos y alertas de stock en tiempo real.

## 2. Problemática a Resolver
Antes de la implementación de HD-Inventory, la gestión del almacén presentaba los siguientes retos:
- **Control Manual y Descentralizado**: El registro de movimientos dependía de procesos manuales o hojas de cálculo propensas a errores.
- **Falta de Trazabilidad**: Dificultad para saber quién retiró material, para qué área y quién autorizó el movimiento.
- **Quiebres de Stock**: La falta de alertas proactivas generaba situaciones donde materiales críticos se agotaban, deteniendo la producción.
- **Visibilidad Limitada**: No existía una manera rápida de ver el valor del inventario en tránsito ni el consumo histórico.
- **Accesibilidad**: Los sistemas no eran accesibles desde cualquier equipo en la red local (LAN).

## 3. Implementación de Soluciones
- **Registro Digital Estricto**: Módulos dedicados para despachar materiales y registrar entradas vinculadas a personal y turnos.
- **Cálculo Automático de Alertas**: Clasifica automáticamente cada material en estados "OK", "Ordenar" y "Urge".
- **Módulo de Órdenes de Compra**: Seguimiento paso a paso (PR → PO → Ordenado → Recibido) integrado con el stock.
- **Panel de Analíticas**: Gráficos y tablas en tiempo real mostrando consumo, órdenes activas y sugerencias de compra.
- **Chat Integrado con Cifrado**: Comunicación en tiempo real entre el personal del almacén con WebSockets.

## 4. Tecnologías Usadas
### Frontend (Cliente)
- **Framework**: React.js 18.0
- **Construcción**: Vite
- **Estilos**: Vanilla CSS con variables nativas (Design Tokens) y SVG en línea.
- **Llamadas a API**: Axios

### Backend (Servidor)
- **Core**: Django 5.2
- **API**: Django REST Framework (DRF)
- **Tiempo Real**: Django Channels (WebSockets) y Daphne
- **Autenticación**: Simple JWT

### Infraestructura y Base de Datos
- **Base de Datos**: PostgreSQL 16
- **Base de Datos en Memoria**: Redis 7
- **Proxy**: NGINX
- **Gestores**: Docker Compose, Yarn (Frontend), pip (Backend).

## 5. Arquitectura de Software
Arquitectura **Cliente-Servidor (Monolito Desacoplado)**:
- **Frontend (SPA)**: Consume la API REST y gestiona el estado global (sesión, tema visual).
- **Backend (API)**: Expone endpoints estandarizados. Organizado en aplicaciones separadas (`accounts`, `materials`, `inventory`, `purchases`, `analytics`, `chat`).
- **Reverse Proxy (NGINX)**: Enruta `/api/` y `/ws/` al backend, y sirve los archivos `dist/` estáticos de React en el puerto 80.

## 6. Diseño UI/UX
- **Estética Industrial**: Temas oscuros por defecto, fuentes limpias y sistema de semáforos (Verde/Amarillo/Rojo) intuitivo.
- **Micro-interacciones**: Scroll horizontal controlado para alertas de stock y optimización del uso de pantalla.
- **Iconografía**: Transición de emojis del sistema operativo a gráficos SVG profesionales.

## 7. Requerimientos
- **Funcionales**: Roles de usuario (manager, supervisor, capturista), forzar cambio de contraseña, cálculo dinámico de stocks basado en umbrales, chat interno cifrado.
- **No Funcionales**: Despliegue empaquetado vía `docker-compose`, acceso global en la LAN corporativa (`mxtjsf225.tpvaoc.com`), rápido tiempo de respuesta mediante paginación del lado del servidor.

## 8. Tablas de Base de Datos Principales
- **`accounts_user`**: Usuarios y roles.
- **`materials_material`**: Catálogo base, cálculos de stock y estado.
- **`inventory_linea` y `inventory_area`**: Destinos de producción.
- **`inventory_entrada`, `inventory_salida`, `inventory_vale`**: Tablas de trazabilidad y auditoría.
- **`purchases_ordencompra`**: Tiempos, estados y montos de logística.
- **`chat_message`**: Historial de mensajería cifrado en la DB.

## 9. Resumen de Despliegue
Se despliega con `docker-compose up --build`. La orquestación enciende:
1. `db`: PostgreSQL.
2. `redis`: Broker para canales asíncronos.
3. `backend`: Servidor Uvicorn/Django en el puerto 8000. Recolecta estáticos al inicio.
4. `nginx`: Proxy en puerto 80. Monta los estáticos del backend compartidos a través de un Named Volume (`static_volume`).

## 10. Modificaciones Sobre la Marcha
- **Resolución NGINX/Django Admin**: Se resolvió un error de CSS compartiendo `static_volume` entre backend y NGINX, habilitando `WhiteNoise`.
- **Migración a Yarn**: Se cambió de `npm` a `yarn` en los Dockerfiles por cuestiones de seguridad y vulnerabilidades reportadas en NPM.
- **Correcciones CSS Flexbox**: Se forzaron restricciones (`min-width: 0`) a contenedores padres en el dashboard para evitar que las galerías horizontales distorsionaran toda la página web.
- **KPIs Mixtos (Coalesce)**: Para que los gráficos de consumo incluyeran historiales "legacy", se integró la función `Coalesce` en el backend mezclando texto antiguo y relaciones FK modernas.

## 11. Posibles Mejoras a Futuro
- **Escaneo de Código de Barras**: Integración de cámaras o escáneres USB para acelerar el "Despacho".
- **Exportación en Lote**: Generación de PDFs/Excel de historiales completos.
- **Aprobaciones Multinivel**: Firmas digitales entre supervisores y finanzas antes de enviar PRs a Compras.
- **Notificaciones Nativas**: Implementar Service Workers para alertar de quiebres críticos aunque la aplicación esté en segundo plano.
