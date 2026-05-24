package xyz.yenkasa.app.yme

import android.content.Context
import android.util.Log
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.google.gson.Gson
import java.util.concurrent.TimeUnit
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.TokenManager

object YmeEventQueue {
    private const val TAG = "YmeEventQueue"
    private const val UNIQUE_FLUSH_WORK = "yme_event_flush"
    private const val MAX_BATCH_SIZE = 20
    private val gson = Gson()

    suspend fun enqueue(context: Context, event: YmeEventPayload, fingerprint: String): Boolean {
        val entity = YmeQueuedEventEntity(
            clientEventId = event.clientEventId,
            userId = event.userId,
            eventType = event.eventType,
            fingerprint = fingerprint,
            eventJson = gson.toJson(event),
        )
        val inserted = YmeEventDatabase.getInstance(context).eventDao().insert(entity)
        if (inserted == -1L) {
            Log.d(TAG, "Skipping duplicate queued client event=${event.clientEventId} type=${event.eventType}")
            return false
        }
        scheduleFlush(context)
        return true
    }

    fun scheduleFlush(context: Context) {
        val request = OneTimeWorkRequestBuilder<YmeEventWorker>()
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 20, TimeUnit.SECONDS)
            .addTag(UNIQUE_FLUSH_WORK)
            .build()

        WorkManager.getInstance(context.applicationContext)
            .enqueueUniqueWork(UNIQUE_FLUSH_WORK, ExistingWorkPolicy.KEEP, request)
    }

    suspend fun pendingCount(context: Context): Int {
        return YmeEventDatabase.getInstance(context)
            .eventDao()
            .countByStatuses(
                listOf(
                    YmeQueuedEventEntity.STATUS_PENDING,
                    YmeQueuedEventEntity.STATUS_FAILED,
                )
            )
    }

    suspend fun flush(context: Context): FlushResult {
        val appContext = context.applicationContext
        val token = TokenManager.getToken(appContext).orEmpty()
        if (token.isBlank()) {
            return FlushResult(skipped = true, reason = "missing_auth")
        }

        val dao = YmeEventDatabase.getInstance(appContext).eventDao()
        val batch = dao.getDispatchable(
            statuses = listOf(
                YmeQueuedEventEntity.STATUS_PENDING,
                YmeQueuedEventEntity.STATUS_FAILED,
            ),
            limit = MAX_BATCH_SIZE,
        )
        if (batch.isEmpty()) {
            return FlushResult(skipped = true, reason = "empty_queue")
        }

        val ids = batch.map { it.id }
        dao.updateStatus(ids, YmeQueuedEventEntity.STATUS_INFLIGHT)

        return try {
            val payloads = batch.map { gson.fromJson(it.eventJson, YmeEventPayload::class.java) }
            val response = ApiClient.apiService.postYmeEventBatch(YmeBatchRequest(payloads))

            if (response.isSuccessful && response.body()?.success == true) {
                dao.deleteByIds(ids)
                Log.d(TAG, "Flushed ${payloads.size} YME events")
                FlushResult(sent = payloads.size)
            } else {
                val error = "code=${response.code()} body=${response.errorBody()?.string().orEmpty()}"
                dao.markFailed(ids, error = error)
                Log.w(TAG, "YME batch flush failed: $error")
                FlushResult(shouldRetry = true, failure = error)
            }
        } catch (error: Exception) {
            dao.markFailed(ids, error = error.message.orEmpty())
            Log.e(TAG, "YME flush error", error)
            FlushResult(shouldRetry = true, failure = error.message.orEmpty())
        }
    }

    data class FlushResult(
        val sent: Int = 0,
        val skipped: Boolean = false,
        val reason: String = "",
        val shouldRetry: Boolean = false,
        val failure: String = "",
    )
}
