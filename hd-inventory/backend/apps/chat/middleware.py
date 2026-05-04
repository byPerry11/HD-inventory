from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import AccessToken
from urllib.parse import parse_qs

User = get_user_model()

class JWTAuthMiddleware(BaseMiddleware):
    """
    Middleware personalizado para autenticar conexiones WebSocket usando JWT.
    Dado que los WebSockets no soportan headers personalizados en el navegador,
    buscamos el token en el query string (?token=...).
    """
    async def __call__(self, scope, receive, send):
        # Obtener query string
        query_string = scope.get("query_string", b"").decode()
        query_params = parse_qs(query_string)
        
        token = query_params.get("token", [None])[0]
        
        if token:
            scope["user"] = await self.get_user(token)
        else:
            scope["user"] = AnonymousUser()
            
        return await super().__call__(scope, receive, send)

    @database_sync_to_async
    def get_user(self, token_str):
        try:
            # Validar token
            access_token = AccessToken(token_str)
            user_id = access_token["user_id"]
            return User.objects.get(id=user_id)
        except Exception:
            return AnonymousUser()
