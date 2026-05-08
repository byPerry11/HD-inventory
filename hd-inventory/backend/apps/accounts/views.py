"""accounts/views.py"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import UserSerializer


class MeView(APIView):
    """Retorna los datos del usuario autenticado."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class LogoutView(APIView):
    """Revoca el refresh token del usuario."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({'detail': 'Sesión cerrada correctamente.'})
        except Exception:
            return Response({'detail': 'Token inválido.'}, status=400)

class UserListView(APIView):
    """Lista todos los usuarios para iniciar chats."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models import User
        users = User.objects.all().exclude(id=request.user.id)
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)

class ChangePasswordView(APIView):
    """Permite al usuario autenticado cambiar su contraseña."""
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        user = request.user
        new_password = request.data.get('new_password')
        
        if not new_password:
            return Response({'detail': 'Debe proporcionar una nueva contraseña.'}, status=400)
            
        if len(new_password) < 8:
            return Response({'detail': 'La contraseña debe tener al menos 8 caracteres.'}, status=400)

        user.set_password(new_password)
        user.must_change_password = False
        user.save()

        return Response({'detail': 'Contraseña actualizada exitosamente.'})
