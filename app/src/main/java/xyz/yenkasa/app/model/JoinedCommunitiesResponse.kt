
package xyz.yenkasa.app.model

import com.google.gson.annotations.SerializedName

data class JoinedCommunitiesResponse(
    @SerializedName("success")
    val success: Boolean,

    @SerializedName("count")
    val count: Int,

    @SerializedName("communities")
    val communities: List<Community>
)