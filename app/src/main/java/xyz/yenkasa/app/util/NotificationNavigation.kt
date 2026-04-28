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
            data = null
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
        buildIntentFromTargetUrl(context, targetUrl)?.let { return withLaunchFlags(it) }

        val normalizedTarget = targetType.orEmpty().lowercase()
        val normalizedType = type.orEmpty().lowercase()
        val resolvedPostId = firstNotBlank(postId, targetId.takeIf { normalizedTarget == "post" }, activityId)
        val resolvedCommentId = firstNotBlank(targetId.takeIf { normalizedTarget == "comment" }, activityId)

        val intent = when (normalizedTarget) {
            "call" -> buildIncomingCallIntent(context, data)
            "chat" -> Intent(context, ChatActivity::class.java).apply {
                putExtra("roomId", firstNotBlank(targetId, data?.optString("roomId"), data?.optString("chatId")))
            }
            "wallet" -> Intent(context, CoinWalletActivity::class.java).apply {
                putExtra("ACTIVITY_ID", firstNotBlank(activityId, targetId))
            }
            "post" -> Intent(context, CommentsActivity::class.java).apply {
                putExtra("POST_ID", resolvedPostId)
            }
            "comment" -> Intent(context, CommentsActivity::class.java).apply {
                putExtra("POST_ID", firstNotBlank(postId, data?.optString("postId"), resolvedCommentId))
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
            "new_chat_message" -> Intent(context, ChatActivity::class.java).apply {
                putExtra("roomId", firstNotBlank(data?.optString("roomId"), data?.optString("chatId"), targetId))
            }
            "post_like", "post_liked", "like", "post_comment", "post_reply",
            "post_mention", "post_under_review", "post_pending", "post_approved",
            "post_view", "view_milestone" -> Intent(context, CommentsActivity::class.java).apply {
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

    private fun buildIntentFromTargetUrl(context: Context, targetUrl: String?): Intent? {
        val raw = targetUrl?.takeIf { it.isNotBlank() } ?: return null
        val uri = Uri.parse(raw)
        val path = uri.path.orEmpty()
        val segments = uri.pathSegments
        val openComments = uri.getQueryParameter("openComments").equals("true", ignoreCase = true)

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
            else -> null
        }
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
