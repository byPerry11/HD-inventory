from rest_framework import serializers
from .models import Conversation, Message
from apps.accounts.serializers import UserSerializer

class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.ReadOnlyField(source='sender.username')
    sender_avatar = serializers.ImageField(source='sender.avatar', read_only=True)
    content = serializers.CharField() # Property que cifra/descifra
    attachment_url = serializers.SerializerMethodField()
    read_by_details = UserSerializer(source='read_by', many=True, read_only=True)

    class Meta:
        model = Message
        fields = [
            'id', 'conversation', 'sender', 'sender_name', 'sender_avatar', 
            'content', 'message_type', 'attachment', 'attachment_url', 
            'file_name', 'file_size', 'timestamp', 'read_by', 'read_by_details', 'is_pinned'
        ]
        read_only_fields = ['id', 'sender', 'timestamp', 'read_by']

    def get_attachment_url(self, obj):
        if obj.attachment:
            return obj.attachment.url
        return None

class ConversationSerializer(serializers.ModelSerializer):
    participants_details = UserSerializer(source='participants', many=True, read_only=True)
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
        last = obj.messages.all().last()
        if last:
            return MessageSerializer(last).data
        return None

    def get_unread_count(self, obj):
        user = self.context.get('request').user
        if user.is_anonymous:
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
