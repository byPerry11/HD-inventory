"""accounts/serializers.py"""
from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Serializer de usuario para respuestas de la API."""
    role_display = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'first_name', 'last_name',
            'email', 'role', 'role_display', 'is_active', 'avatar',
            'must_change_password',
        ]
        read_only_fields = ['id', 'role', 'is_active', 'must_change_password']

    def get_role_display(self, obj):
        return obj.get_role_display()
