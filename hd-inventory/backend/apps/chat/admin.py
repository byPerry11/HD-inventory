from django.contrib import admin
from .models import Conversation, Message

@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'is_group', 'created_at', 'updated_at']
    list_filter = ['is_group', 'created_at']
    filter_horizontal = ['participants']
    search_fields = ['name']

@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ['id', 'sender', 'conversation', 'message_type', 'timestamp', 'is_pinned']
    list_filter = ['message_type', 'is_pinned', 'timestamp']
    search_fields = ['sender__username', 'encrypted_content']
    readonly_fields = ['timestamp']
