package xyz.yenkasa.app.network

import com.google.gson.JsonDeserializationContext
import com.google.gson.JsonDeserializer
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import xyz.yenkasa.app.model.UserBasic
import java.lang.reflect.Type

class UserBasicJsonAdapter : JsonDeserializer<UserBasic?> {
    override fun deserialize(
        json: JsonElement?,
        typeOfT: Type?,
        context: JsonDeserializationContext?
    ): UserBasic? {
        if (json == null || json.isJsonNull) return null

        if (json.isJsonPrimitive) {
            val id = json.asString.orEmpty()
            return if (id.isBlank()) null else UserBasic(id = id, username = "")
        }

        if (!json.isJsonObject) return null
        val obj = json.asJsonObject
        val id = obj.stringOrBlank("_id")
            .ifBlank { obj.stringOrBlank("id") }
        return UserBasic(
            id = id,
            username = obj.stringOrBlank("username")
                .ifBlank { obj.stringOrBlank("name") },
            profileImage = obj.stringOrNull("profileImage")
                ?: obj.stringOrNull("avatar")
                ?: obj.stringOrNull("profilePic"),
            verified = obj.booleanOrFalse("verified"),
            roleName = obj.stringOrNull("roleName")
                ?: obj.stringOrNull("accessRole")
        )
    }

    private fun JsonObject.stringOrBlank(key: String): String {
        return stringOrNull(key).orEmpty()
    }

    private fun JsonObject.stringOrNull(key: String): String? {
        val value = get(key) ?: return null
        if (value.isJsonNull) return null
        return runCatching { value.asString }.getOrNull()?.takeIf { it.isNotBlank() && it != "null" }
    }

    private fun JsonObject.booleanOrFalse(key: String): Boolean {
        val value = get(key) ?: return false
        if (value.isJsonNull) return false
        return runCatching { value.asBoolean }.getOrDefault(false)
    }
}
