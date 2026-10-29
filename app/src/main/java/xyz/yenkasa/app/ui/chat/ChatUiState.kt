package xyz.yenkasa.app.ui.chat

import xyz.yenkasa.app.model.ChatMessage

sealed interface ChatUiState {
    data object Idle : ChatUiState
    data object Loading : ChatUiState
    data class Ready(val messages: List<ChatMessage>) : ChatUiState
    data class Error(val message: String, val previousMessages: List<ChatMessage> = emptyList()) : ChatUiState
}
