package xyz.yenkasa.app.viewmodel

import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.viewModelScope
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.TokenManager // Import your TokenManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class UserViewModel(application: Application) : AndroidViewModel(application) {

    private val _playerIdUpdateResult = MutableLiveData<Boolean>()
    val playerIdUpdateResult: LiveData<Boolean> = _playerIdUpdateResult

    // LiveData to hold the current MongoDB User ID, sourced from TokenManager
    private val _mongoDbUserId = MutableLiveData<String?>()
    val mongoDbUserId: LiveData<String?> = _mongoDbUserId

    init {
        // Load the stored MongoDB User ID from TokenManager when the ViewModel is created
        loadMongoDbUserIdFromTokenManager()
    }

    fun updateUserPlayerId(oneSignalPlayerId: String) {
        // Get User ID from TokenManager
        val currentMongoDbUserId = TokenManager.getUserId(getApplication())

        if (currentMongoDbUserId == null) {
            Log.e("UserViewModel", "MongoDB User ID is missing from TokenManager. Cannot update Player ID.")
            _playerIdUpdateResult.postValue(false)
            return
        }
        if (oneSignalPlayerId.isBlank()) {
            Log.e("UserViewModel", "OneSignal Player ID is missing. Cannot update.")
            _playerIdUpdateResult.postValue(false)
            return
        }

        val requestBody = mapOf("playerId" to oneSignalPlayerId)
        Log.d("UserViewModel", "Attempting to update Player ID for user: $currentMongoDbUserId with Player ID: $oneSignalPlayerId")

        viewModelScope.launch {
            try {
                val success = withContext(Dispatchers.IO) {
                    val response = ApiClient.apiService.updatePlayerId(
                        userId = currentMongoDbUserId,
                        body = requestBody
                    ).execute()

                    if (response.isSuccessful) {
                        Log.i("UserViewModel", "Player ID updated successfully for user: $currentMongoDbUserId.")
                        true
                    } else {
                        Log.e("UserViewModel", "Failed to update Player ID. Code: ${response.code()}, Error: ${response.errorBody()?.string()}")
                        false
                    }
                }
                _playerIdUpdateResult.postValue(success)
            } catch (e: Exception) {
                Log.e("UserViewModel", "Exception while updating Player ID", e)
                _playerIdUpdateResult.postValue(false)
            }
        }
    }

    // --- MongoDB User ID Management (Delegated to TokenManager) ---

    /**
     * Call this after successful login to store the user's MongoDB _id
     * using TokenManager.
     */
    fun saveLoggedInMongoDbUserIdToTokenManager(userId: String) {
        TokenManager.saveUserId(getApplication(), userId)
        _mongoDbUserId.postValue(userId) // Update LiveData
        Log.d("UserViewModel", "Saved MongoDB User ID to TokenManager: $userId")
    }

    /**
     * Loads the MongoDB User ID from TokenManager.
     */
    private fun loadMongoDbUserIdFromTokenManager() {
        val userId = TokenManager.getUserId(getApplication())
        _mongoDbUserId.postValue(userId)
        Log.d("UserViewModel", "Loaded MongoDB User ID from TokenManager: $userId")
    }

    /**
     * Call this on logout to clear the user's MongoDB _id
     * using TokenManager.
     */
    fun clearLoggedInMongoDbUserIdFromTokenManager() {
        TokenManager.clearUserId(getApplication())
        _mongoDbUserId.postValue(null) // Update LiveData
        Log.d("UserViewModel", "Cleared MongoDB User ID from TokenManager.")
    }

    // Optional: A synchronous getter if needed elsewhere in the ViewModel, though LiveData is preferred for UI
    fun getCurrentMongoDbUserId(): String? {
        return TokenManager.getUserId(getApplication())
    }
}

