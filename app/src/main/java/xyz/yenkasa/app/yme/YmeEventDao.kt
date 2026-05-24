package xyz.yenkasa.app.yme

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface YmeEventDao {
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(event: YmeQueuedEventEntity): Long

    @Query(
        """
        SELECT * FROM yme_queued_events
        WHERE status IN (:statuses)
        ORDER BY createdAt ASC
        LIMIT :limit
        """
    )
    suspend fun getDispatchable(statuses: List<String>, limit: Int): List<YmeQueuedEventEntity>

    @Query(
        """
        UPDATE yme_queued_events
        SET status = :status, updatedAt = :updatedAt
        WHERE id IN (:ids)
        """
    )
    suspend fun updateStatus(ids: List<Long>, status: String, updatedAt: Long = System.currentTimeMillis())

    @Query(
        """
        UPDATE yme_queued_events
        SET status = :status,
            attemptCount = attemptCount + 1,
            lastError = :error,
            updatedAt = :updatedAt
        WHERE id IN (:ids)
        """
    )
    suspend fun markFailed(
        ids: List<Long>,
        status: String = YmeQueuedEventEntity.STATUS_FAILED,
        error: String,
        updatedAt: Long = System.currentTimeMillis(),
    )

    @Query("DELETE FROM yme_queued_events WHERE id IN (:ids)")
    suspend fun deleteByIds(ids: List<Long>)

    @Query("SELECT COUNT(*) FROM yme_queued_events WHERE status IN (:statuses)")
    suspend fun countByStatuses(statuses: List<String>): Int
}
