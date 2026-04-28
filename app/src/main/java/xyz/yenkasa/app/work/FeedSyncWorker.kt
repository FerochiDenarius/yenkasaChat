package xyz.yenkasa.app.work

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.google.gson.Gson
import xyz.yenkasa.app.model.CachedFeedPayload
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.TokenManager

class FeedSyncWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        return try {
            val token = TokenManager.getToken(applicationContext).orEmpty()
            val communityNames = TokenManager.getFeedCacheCommunityNames(applicationContext).orEmpty()

            if (token.isBlank() || communityNames.isBlank()) {
                return Result.success()
            }

            val response = ApiClient.apiService
                .getPostsByCommunities("Bearer $token", communityNames, 1, 20)
                .execute()

            if (!response.isSuccessful || response.body() == null) {
                Log.w("FeedSyncWorker", "Feed sync failed: code=${response.code()}")
                return Result.retry()
            }

            val body = response.body()!!
            val payload = CachedFeedPayload(
                posts = body.posts,
                currentPage = body.pagination.currentPage,
                isLastPage = body.pagination.currentPage >= body.pagination.totalPages
            )

            TokenManager.saveFeedCache(
                applicationContext,
                Gson().toJson(payload)
            )

            Result.success()
        } catch (e: Exception) {
            Log.e("FeedSyncWorker", "Feed sync error", e)
            Result.retry()
        }
    }
}
