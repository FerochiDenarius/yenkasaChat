package xyz.yenkasa.app.ui.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** Screen state and user intents for chat; UI controllers can migrate here incrementally. */
class ChatViewModel(
    private val repository: ChatRepository
) : ViewModel() {
    private val _uiState = MutableStateFlow<ChatUiState>(ChatUiState.Idle)
    val uiState: StateFlow<ChatUiState> = _uiState.asStateFlow()

    fun loadMessages(roomId: String) {
        if (roomId.isBlank()) {
            _uiState.value = ChatUiState.Error("Room ID cannot be blank")
            return
        }

        val previousMessages = (_uiState.value as? ChatUiState.Ready)?.messages.orEmpty()
        _uiState.value = ChatUiState.Loading
        viewModelScope.launch {
            repository.getMessages(roomId).fold(
                onSuccess = { messages ->
                    _uiState.value = ChatUiState.Ready(messages)
                    repository.markMessagesAsRead(roomId)
                },
                onFailure = { error ->
                    _uiState.value = ChatUiState.Error(
                        error.message ?: "Unable to load messages",
                        previousMessages,
                    )
                },
            )
        }
    }
}

class ChatViewModelFactory(
    private val repository: ChatRepository = ChatRepository()
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        require(modelClass.isAssignableFrom(ChatViewModel::class.java)) {
            "Unknown ViewModel class: ${modelClass.name}"
        }
        return ChatViewModel(repository) as T
    }
}
