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
        from rest_framework import status as drf_status
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response({'detail': 'Refresh token requerido.'}, status=drf_status.HTTP_400_BAD_REQUEST)
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({'detail': 'Sesión cerrada correctamente.'})
        except Exception:
            return Response({'detail': 'Token inválido.'}, status=drf_status.HTTP_400_BAD_REQUEST)

class UserListView(APIView):
    """Lista usuarios para iniciar chats (paginado + búsqueda)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models import User
        from core_main_hdinventory.pagination import CustomPagination
        qs = User.objects.all().exclude(id=request.user.id).order_by('username')
        q = request.query_params.get('search', '').strip()
        if q:
            from django.db.models import Q
            qs = qs.filter(Q(username__icontains=q) | Q(first_name__icontains=q) | Q(last_name__icontains=q))
        paginator = CustomPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = UserSerializer(page if page is not None else qs, many=True)
        if page is not None:
            return paginator.get_paginated_response(serializer.data)
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
