package xyz.yenkasa.app.network

import com.google.gson.JsonDeserializationContext
import com.google.gson.JsonDeserializer
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import xyz.yenkasa.app.model.Permission
import xyz.yenkasa.app.model.Role
import java.lang.reflect.Type

class RoleJsonAdapter : JsonDeserializer<Role?> {
    override fun deserialize(
        json: JsonElement?,
        typeOfT: Type?,
        context: JsonDeserializationContext?
    ): Role? {
        if (json == null || json.isJsonNull) return null

        if (json.isJsonPrimitive) {
            val id = runCatching { json.asString }.getOrNull().orEmpty()
            return if (id.isBlank() || id == "null") null else Role(_id = id)
        }

        if (!json.isJsonObject) return null
        val obj = json.asJsonObject
        return Role(
            _id = obj.stringOrNull("_id") ?: obj.stringOrNull("id"),
            name = obj.stringOrNull("role") ?: obj.stringOrNull("name"),
            description = obj.stringOrNull("description"),
            roleName = obj.stringOrNull("roleName"),
            permissions = obj.get("permissions")
                ?.takeUnless { it.isJsonNull }
                ?.let { context?.deserialize(it, Permission::class.java) }
        )
    }

    private fun JsonObject.stringOrNull(key: String): String? {
        val value = get(key) ?: return null
        if (value.isJsonNull) return null
        return runCatching { value.asString }
            .getOrNull()
            ?.takeIf { it.isNotBlank() && it != "null" }
    }
}
