package xyz.yenkasa.app.util

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import org.json.JSONObject
import xyz.yenkasa.app.model.NotificationModel
import xyz.yenkasa.app.ui.ChatActivity
import xyz.yenkasa.app.ui.CoinWalletActivity
import xyz.yenkasa.app.ui.CommentsActivity
import xyz.yenkasa.app.ui.GroupChatActivity
import xyz.yenkasa.app.ui.IncomingCallActivity
import xyz.yenkasa.app.ui.MainActivity
import xyz.yenkasa.app.ui.MyAdsActivity
import xyz.yenkasa.app.ui.MyCommunitiesActivity
import xyz.yenkasa.app.ui.PostApprovalActivity
import xyz.yenkasa.app.ui.UserProfileActivity

object NotificationNavigation {

    fun buildIntent(context: Context, notification: NotificationModel): Intent {
        return buildIntent(
            context = context,
            type = notification.type,
            targetType = notification.targetType,
            targetId = notification.targetId,
            activityId = notification.activityId,
            postId = notification.postId,
            targetUrl = notification.targetUrl,
            data = JSONObject().apply {
                notification.commentId?.let { put("commentId", it) }
            }
        )
    }

    fun buildIntent(context: Context, data: JSONObject?): Intent {
        return buildIntent(
            context = context,
            type = data?.optString("type"),
            targetType = data?.optString("targetType"),
            targetId = data?.optString("targetId"),
            activityId = data?.optString("activityId"),
            postId = data?.optString("postId"),
            targetUrl = data?.optString("targetUrl"),
            data = data
        )
    }

    fun buildPendingIntent(context: Context, notification: NotificationModel): PendingIntent {
        return PendingIntent.getActivity(
            context,
            notification.id.hashCode(),
            buildIntent(context, notification),
            pendingIntentFlags()
        )
    }

    fun buildPendingIntent(context: Context, data: JSONObject?): PendingIntent {
        val requestCode = data?.optString("notificationId")
            ?.takeIf { it.isNotBlank() }
            ?.hashCode()
            ?: System.currentTimeMillis().toInt()

        return PendingIntent.getActivity(
            context,
            requestCode,
            buildIntent(context, data),
            pendingIntentFlags()
        )
    }

    private fun buildIntent(
        context: Context,
        type: String?,
        targetType: String?,
        targetId: String?,
        activityId: String?,
        postId: String?,
        targetUrl: String?,
        data: JSONObject?
    ): Intent {
        val normalizedTarget = targetType.orEmpty().lowercase()
        val normalizedType = type.orEmpty().lowercase()
        val resolvedPostId = firstNotBlank(
            postId,
            data?.optString("postId"),
            targetId.takeIf { normalizedTarget == "post" },
            activityId.takeIf { normalizedTarget == "post" || normalizedType in postTargetTypes }
        )
        val resolvedCommentId = firstNotBlank(
            data?.optString("commentId"),
            targetId.takeIf { normalizedTarget == "comment" },
            activityId.takeIf { normalizedTarget == "comment" }
        )

        val hasExplicitPostTarget = resolvedPostId.isNotBlank() &&
            (normalizedTarget in setOf("post", "comment") || normalizedType in postTargetTypes || "comment" in normalizedType || "like" in normalizedType)
        if (!hasExplicitPostTarget) {
            buildIntentFromTargetUrl(context, targetUrl, data)?.let { return withLaunchFlags(it) }
        }

        val intent = when (normalizedTarget) {
            "call" -> buildIncomingCallIntent(context, data)
            "chat" -> buildChatIntent(context, firstNotBlank(targetId, data?.optString("roomId"), data?.optString("chatId")), data)
            "group" -> buildGroupIntent(context, firstNotBlank(targetId, data?.optString("groupId"), data?.optString("roomId")), data)
            "wallet" -> Intent(context, CoinWalletActivity::class.java).apply {
                putExtra("ACTIVITY_ID", firstNotBlank(activityId, targetId))
            }
            "post" -> Intent(context, CommentsActivity::class.java).apply {
                putExtra("POST_ID", resolvedPostId)
            }
            "comment" -> Intent(context, CommentsActivity::class.java).apply {
                putExtra("POST_ID", resolvedPostId)
                putExtra("openComments", true)
                putExtra("COMMENT_ID", resolvedCommentId)
            }
            "profile" -> Intent(context, UserProfileActivity::class.java).apply {
                putExtra("USER_ID", firstNotBlank(targetId, activityId, data?.optString("senderId")))
            }
            "ad" -> Intent(context, MyAdsActivity::class.java).apply {
                putExtra("AD_ID", firstNotBlank(targetId, activityId))
            }
            "community" -> Intent(context, MyCommunitiesActivity::class.java).apply {
                putExtra("COMMUNITY_ID", firstNotBlank(targetId, activityId))
            }
            "approval" -> Intent(context, PostApprovalActivity::class.java).apply {
                putExtra("APPROVAL_ID", firstNotBlank(targetId, activityId))
            }
            "system" -> Intent(context, MainActivity::class.java)
            else -> buildIntentFromType(context, normalizedType, targetId, activityId, postId, data)
        }

        return withLaunchFlags(intent)
    }

    private fun buildIntentFromType(
        context: Context,
        type: String,
        targetId: String?,
        activityId: String?,
        postId: String?,
        data: JSONObject?
    ): Intent {
        val resolvedPostId = firstNotBlank(postId, targetId, activityId, data?.optString("postId"))

        return when (type) {
            "new_chat_message" -> buildChatIntent(context, firstNotBlank(data?.optString("roomId"), data?.optString("chatId"), targetId), data)
            "group_added" -> buildGroupIntent(context, firstNotBlank(data?.optString("groupId"), data?.optString("roomId"), targetId, activityId), data)
            "post_like", "post_liked", "like", "post_comment", "post_reply",
            "post_mention", "post_under_review", "post_pending", "post_approved",
            "post_view", "view_milestone", "community_post" -> Intent(context, CommentsActivity::class.java).apply {
                putExtra("POST_ID", resolvedPostId)
            }
            "comment", "comment_like", "comment_reply" -> Intent(context, CommentsActivity::class.java).apply {
                putExtra("POST_ID", resolvedPostId)
                putExtra("openComments", true)
                putExtra("COMMENT_ID", firstNotBlank(targetId, activityId))
            }
            "follow", "new_follower", "follow_request", "follow_accepted",
            "blocked", "unblocked", "message_request", "message_request_approved" -> {
                Intent(context, UserProfileActivity::class.java).apply {
                    putExtra("USER_ID", firstNotBlank(targetId, activityId, data?.optString("senderId")))
                }
            }
            "reward", "reward_post", "reward_comment", "reward_comment_like",
            "reward_post_like", "reward_post_view", "reward_post_view_received",
            "reward_follow", "reward_verification", "reward_daily_login" -> {
                Intent(context, CoinWalletActivity::class.java).apply {
                    putExtra("ACTIVITY_ID", activityId)
                }
            }
            "ad_approved", "ad_rejected" -> Intent(context, MyAdsActivity::class.java)
            "community_approved", "community_rejected" -> Intent(context, MyCommunitiesActivity::class.java)
            else -> Intent(context, MainActivity::class.java)
        }
    }

    private val postTargetTypes = setOf(
        "post_like",
        "post_liked",
        "like",
        "post_comment",
        "post_reply",
        "comment",
        "comment_like",
        "comment_reply",
        "post_mention",
        "post_under_review",
        "post_pending",
        "post_approved",
        "post_view",
        "view_milestone",
        "community_post"
    )

    private fun buildIntentFromTargetUrl(context: Context, targetUrl: String?, data: JSONObject?): Intent? {
        val raw = targetUrl?.takeIf { it.isNotBlank() } ?: return null
        val normalizedUri = AppLinkManager.canonicalizeUri(raw) ?: Uri.parse(raw)
        if (AppLinkManager.parseRoute(normalizedUri) != null) {
            return AppLinkManager.buildMainActivityIntent(context, normalizedUri)
        }
        val path = normalizedUri.path.orEmpty()
        val segments = normalizedUri.pathSegments
        val openComments = normalizedUri.getQueryParameter("openComments").equals("true", ignoreCase = true)

        return when {
            path == "/wallet" || path.startsWith("/wallet/") -> Intent(context, CoinWalletActivity::class.java)
            path == "/ads/mine" -> Intent(context, MyAdsActivity::class.java)
            path == "/communities/mine" -> Intent(context, MyCommunitiesActivity::class.java)
            path.startsWith("/admin/post-approval") -> Intent(context, PostApprovalActivity::class.java).apply {
                putExtra("APPROVAL_ID", segments.lastOrNull().orEmpty())
            }
            segments.firstOrNull() == "post" -> Intent(context, CommentsActivity::class.java).apply {
                putExtra("POST_ID", segments.getOrNull(1).orEmpty())
                putExtra("openComments", openComments)
            }
            segments.firstOrNull() == "profile" -> Intent(context, UserProfileActivity::class.java).apply {
                putExtra("USER_ID", segments.getOrNull(1).orEmpty())
            }
            segments.firstOrNull() == "chat" -> buildChatIntent(context, segments.getOrNull(1).orEmpty(), data)
            segments.firstOrNull() == "groups" -> buildGroupIntent(context, segments.getOrNull(1).orEmpty(), data)
            else -> null
        }
    }

    private fun buildChatIntent(context: Context, roomId: String, data: JSONObject?): Intent {
        return if (isGroupPayload(data)) {
            buildGroupIntent(context, roomId, data)
        } else {
            Intent(context, ChatActivity::class.java).apply {
                putExtra("roomId", roomId)
            }
        }
    }

    private fun buildGroupIntent(context: Context, groupId: String, data: JSONObject?): Intent {
        return Intent(context, GroupChatActivity::class.java).apply {
            putExtra("roomId", firstNotBlank(groupId, data?.optString("groupId"), data?.optString("chatId")))
            putExtra("chatPartnerName", firstNotBlank(data?.optString("groupName"), "Yenkasa Group"))
            putExtra("groupImage", data?.optString("groupImage").orEmpty())
            putExtra("groupMemberCount", data?.optInt("groupMemberCount", 0) ?: 0)
            putExtra("isGroupChat", true)
        }
    }

    private fun isGroupPayload(data: JSONObject?): Boolean {
        if (data == null) return false
        return data.optBoolean("isGroupChat", false) ||
            data.optString("isGroupChat").equals("true", ignoreCase = true) ||
            data.optString("targetType").equals("group", ignoreCase = true) ||
            data.optString("type").equals("group_added", ignoreCase = true)
    }

    private fun buildIncomingCallIntent(context: Context, data: JSONObject?): Intent {
        val isVideo = when {
            data?.has("isVideo") == true -> data.optBoolean("isVideo", true)
            data?.has("video") == true -> data.optBoolean("video", true)
            else -> data?.optString("callType", "video")?.equals("video", ignoreCase = true) ?: true
        }

        return Intent(context, IncomingCallActivity::class.java).apply {
            putExtra("CALLER_ID", firstNotBlank(data?.optString("callerId"), data?.optString("fromUserId")))
            putExtra("CALLER_NAME", data?.optString("callerName", "Unknown") ?: "Unknown")
            putExtra("IS_VIDEO_CALL", isVideo)
            putExtra("CALL_TYPE", data?.optString("callType", if (isVideo) "video" else "audio") ?: if (isVideo) "video" else "audio")
            putExtra("ROOM_URL", data?.optString("roomUrl").orEmpty())
            putExtra("ROOM_TOKEN", firstNotBlank(data?.optString("token"), data?.optString("roomToken")))
        }
    }

    private fun withLaunchFlags(intent: Intent): Intent {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        return intent
    }

    private fun pendingIntentFlags(): Int {
        return PendingIntent.FLAG_UPDATE_CURRENT or
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
    }

    private fun firstNotBlank(vararg values: String?): String {
        return values.firstOrNull { !it.isNullOrBlank() }.orEmpty()
    }
}
