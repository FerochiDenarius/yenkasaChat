package xyz.yenkasa.app.yme

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "yme_queued_events",
    indices = [
        Index(value = ["clientEventId"], unique = true),
        Index(value = ["status", "createdAt"]),
        Index(value = ["fingerprint", "status"]),
    ],
)
data class YmeQueuedEventEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val clientEventId: String,
    val userId: String,
    val eventType: String,
    val fingerprint: String,
    val eventJson: String,
    val status: String = STATUS_PENDING,
    val attemptCount: Int = 0,
    val lastError: String = "",
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
) {
    companion object {
        const val STATUS_PENDING = "pending"
        const val STATUS_INFLIGHT = "inflight"
        const val STATUS_FAILED = "failed"
    }
}
