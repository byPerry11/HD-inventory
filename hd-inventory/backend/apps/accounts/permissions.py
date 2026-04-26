"""accounts/permissions.py — Permisos basados en rol."""
from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsManager(BasePermission):
    """Solo managers pueden acceder."""
    message = 'Se requiere rol de Manager.'

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.role == 'manager'
        )


class IsSupervisorOrAbove(BasePermission):
    """Supervisors y managers pueden acceder."""
    message = 'Se requiere rol de Supervisor o Manager.'

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.role in ('manager', 'supervisor')
        )


class IsManagerOrReadOnly(BasePermission):
    """Solo managers pueden escribir; autenticados pueden leer."""
    message = 'Se requiere rol de Manager para esta operación.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return request.user.role == 'manager'


class IsSupervisorOrAboveOrReadOnly(BasePermission):
    """Supervisors/Managers escriben; autenticados pueden leer."""
    message = 'Se requiere rol de Supervisor o Manager para realizar esta operación.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return request.user.role in ('manager', 'supervisor')
