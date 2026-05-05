package xyz.yenkasa.app.model

import com.google.gson.annotations.SerializedName

data class ConversationStreak(
    @SerializedName("current")
    val current: Int = 0,
    @SerializedName("longest")
    val longest: Int = 0
)
