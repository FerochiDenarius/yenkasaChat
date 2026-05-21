enum ChatRole { assistant, user }

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.role,
    required this.content,
    this.isStreaming = false,
  });

  final String id;
  final ChatRole role;
  final String content;
  final bool isStreaming;

  ChatMessage copyWith({
    String? id,
    ChatRole? role,
    String? content,
    bool? isStreaming,
  }) {
    return ChatMessage(
      id: id ?? this.id,
      role: role ?? this.role,
      content: content ?? this.content,
      isStreaming: isStreaming ?? this.isStreaming,
    );
  }

  Map<String, dynamic> toApiJson() {
    return {
      'role': role == ChatRole.assistant ? 'assistant' : 'user',
      'content': content,
    };
  }
}
