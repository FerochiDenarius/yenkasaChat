package xyz.yenkasa.app.ui.chat

import retrofit2.Response
import java.io.IOException

object ChatErrorParser {
    fun parse(response: Response<*>): String {
        return try {
            val rawError = response.errorBody()?.string()?.ifBlank { null }
            if (response.code() == 403 && rawError?.contains("blocked", ignoreCase = true) == true) {
                "You can't send this message because this user has blocked you."
            } else {
                rawError ?: "Error ${response.code()} ${response.message()}"
            }
        } catch (e: IOException) {
            "Error ${response.code()}"
        }
    }
}
