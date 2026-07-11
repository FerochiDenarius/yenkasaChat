package xyz.yenkasa.app.work

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.google.gson.Gson
import xyz.yenkasa.app.model.CachedFeedPayload
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.ui.feed.FeedCacheController
import xyz.yenkasa.app.util.AppLocalStore
import xyz.yenkasa.app.util.TokenManager

class FeedSyncWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        return try {
            val token = TokenManager.getToken(applicationContext).orEmpty()
            val communityNames = AppLocalStore.getFeedCacheCommunityNames(applicationContext).orEmpty()

            if (token.isBlank()) {
                return Result.success()
            }

            val response = ApiClient.apiService
                .getFeedByMode(
                    token = "Bearer $token",
                    mode = DEFAULT_FEED_MODE,
                    communityNames = communityNames.takeIf { it.isNotBlank() },
                    page = 1,
                    limit = 20
                )
                .execute()

            if (!response.isSuccessful || response.body() == null) {
                Log.w("FeedSyncWorker", "Feed sync failed: code=${response.code()}")
                return Result.retry()
            }

            val body = response.body()!!
            val gson = Gson()
            val cacheController = FeedCacheController(applicationContext, gson)
            val communityKey = cacheController.cacheKeyForCommunityNames(
                communityNames.split(",").map { it.trim() }.filter { it.isNotBlank() }
            )
            val cacheKey = "${DEFAULT_FEED_MODE}_$communityKey"
            val payload = CachedFeedPayload(
                posts = body.posts,
                currentPage = body.pagination.currentPage,
                isLastPage = body.pagination.currentPage >= body.pagination.totalPages,
                cacheSchemaVersion = CACHE_VERSION,
                rendererVersion = PLAYER_RENDERER_VERSION,
                appVersionCode = 0L
            )

            AppLocalStore.saveFeedCache(
                applicationContext,
                cacheKey,
                gson.toJson(payload)
            )
            Log.d("FeedSyncWorker", "Feed sync cache_saved key=$cacheKey posts=${body.posts.size}")

            Result.success()
        } catch (e: Exception) {
            Log.e("FeedSyncWorker", "Feed sync error", e)
            Result.retry()
        }
    }

    private companion object {
        const val CACHE_VERSION = 3
        const val PLAYER_RENDERER_VERSION = "yenkasa_player_v3"
        const val DEFAULT_FEED_MODE = "for-you"
    }
}
