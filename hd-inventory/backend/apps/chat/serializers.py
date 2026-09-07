from rest_framework import serializers
from .models import Conversation, Message


def _relative_url(file_field):
    """URL relativa same-origin (el Host del proxy interno no es resoluble)."""
    try:
        return file_field.url if file_field else None
    except Exception:
        return None


def _user_compact(user):
    return {
        'id': user.id,
        'username': user.username,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'avatar': _relative_url(getattr(user, 'avatar', None)),
    }


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.ReadOnlyField(source='sender.username')
    sender_avatar = serializers.SerializerMethodField()
    content = serializers.CharField() # Property que cifra/descifra
    attachment = serializers.SerializerMethodField()
    attachment_url = serializers.SerializerMethodField()
    read_by_details = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            'id', 'conversation', 'sender', 'sender_name', 'sender_avatar', 
            'content', 'message_type', 'attachment', 'attachment_url', 
            'file_name', 'file_size', 'timestamp', 'read_by', 'read_by_details', 'is_pinned'
        ]
        read_only_fields = ['id', 'sender', 'timestamp', 'read_by']

    def get_sender_avatar(self, obj):
        return _relative_url(getattr(obj.sender, 'avatar', None))

    def get_attachment(self, obj):
        return _relative_url(getattr(obj, 'attachment', None))

    def get_attachment_url(self, obj):
        return _relative_url(getattr(obj, 'attachment', None))

    def get_read_by_details(self, obj):
        return [_user_compact(u) for u in obj.read_by.all()]

    def validate_content(self, value):
        if value is not None and len(value) > 2000:
            raise serializers.ValidationError('Máximo 2000 caracteres.')
        return value

class ConversationSerializer(serializers.ModelSerializer):
    participants_details = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    display_name = serializers.SerializerMethodField()
    display_avatar = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            'id', 'name', 'is_group', 'avatar', 'display_name', 'display_avatar',
            'participants', 'participants_details', 'created_at', 'updated_at', 
            'last_message', 'unread_count'
        ]

    def get_last_message(self, obj):
        last = obj.messages.select_related('sender').order_by('-timestamp').first()
        if last:
            return MessageSerializer(last, context=self.context).data
        return None

    def get_participants_details(self, obj):
        return [_user_compact(u) for u in obj.participants.all()]

    def get_unread_count(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or getattr(user, 'is_anonymous', True):
            return 0
        return obj.messages.exclude(read_by=user).count()

    def get_display_name(self, obj):
        if obj.is_group and obj.name:
            return obj.name
        
        user = self.context.get('request').user
        if user.is_anonymous:
            return "Chat"
            
        other_participant = obj.participants.exclude(id=user.id).first()
        if other_participant:
            return f"{other_participant.first_name} {other_participant.last_name}".strip() or other_participant.username
        return "Chat Privado"

    def get_display_avatar(self, obj):
        if obj.is_group and obj.avatar:
            return obj.avatar.url
        
        user = self.context.get('request').user
        if not user.is_anonymous:
            other_participant = obj.participants.exclude(id=user.id).first()
            if other_participant and other_participant.avatar:
                return other_participant.avatar.url
        return None
