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
        current_password = request.data.get('current_password')
        new_password = request.data.get('new_password')
        
        if not current_password or not new_password:
            return Response({'detail': 'Debe proporcionar la contraseña actual y la nueva contraseña.'}, status=400)

        # 1. Validar la contraseña actual
        if not user.check_password(current_password):
            return Response({'detail': 'La contraseña actual es incorrecta.'}, status=400)

        # 2. Validar la robustez de la nueva contraseña con las políticas de Django
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError
        
        try:
            validate_password(new_password, user=user)
        except ValidationError as e:
            return Response({'detail': e.messages}, status=400)

        # 3. Guardar la nueva contraseña
        user.set_password(new_password)
        user.must_change_password = False
        user.save()

        return Response({'detail': 'Contraseña actualizada exitosamente.'})
