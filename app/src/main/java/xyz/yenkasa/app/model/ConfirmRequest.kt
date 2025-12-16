package xyz.yenkasa.app.model

import com.google.gson.annotations.Expose
import com.google.gson.annotations.SerializedName

data class ConfirmRequest(

    @Expose
    @SerializedName("email")
    val email: String? = null,

    @Expose
    @SerializedName("phone")
    val phone: String? = null,

    @Expose
    @SerializedName("code")
    val code: String
)
