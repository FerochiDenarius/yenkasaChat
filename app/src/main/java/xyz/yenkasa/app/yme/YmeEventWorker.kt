package xyz.yenkasa.app.yme

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

class YmeEventWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        val result = YmeEventQueue.flush(applicationContext)
        return when {
            result.shouldRetry -> Result.retry()
            else -> Result.success()
        }
    }
}
