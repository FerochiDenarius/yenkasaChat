package xyz.yenkasa.app.util

import org.json.JSONObject

object CallPayloadUtils {
    private val dataCallTypes = setOf(
        "data",
        "datacall",
        "data_call",
        "data_call_request",
        "data-call",
        "data-call-request"
    )

    fun isDataCall(data: JSONObject?): Boolean {
        if (data == null) return false
        return isDataCall(
            type = data.optString("type", ""),
            targetType = data.optString("targetType", ""),
            callType = data.optString("callType", "")
        )
    }

    fun isDataCall(data: Map<String, String>): Boolean {
        return isDataCall(
            type = data["type"].orEmpty(),
            targetType = data["targetType"].orEmpty(),
            callType = data["callType"].orEmpty()
        )
    }

    fun isDataCall(type: String?, targetType: String?, callType: String?): Boolean {
        return normalize(callType) in dataCallTypes ||
            normalize(targetType) in dataCallTypes ||
            normalize(type) in dataCallTypes
    }

    private fun normalize(value: String?): String {
        return value.orEmpty().trim().lowercase()
    }
}
