"""accounts/urls.py"""
from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import MeView, LogoutView, UserListView

urlpatterns = [
    # Login — obtiene access + refresh token
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    # Renovar access token con refresh token
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    # Datos del usuario logueado
    path('me/', MeView.as_view(), name='me'),
    # Logout — revoca refresh token
    path('logout/', LogoutView.as_view(), name='logout'),
    # Lista de usuarios
    path('users/', UserListView.as_view(), name='user_list'),
]
