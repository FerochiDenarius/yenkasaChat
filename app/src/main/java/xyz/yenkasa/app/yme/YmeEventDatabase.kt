package xyz.yenkasa.app.yme

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [YmeQueuedEventEntity::class],
    version = 1,
    exportSchema = false,
)
abstract class YmeEventDatabase : RoomDatabase() {
    abstract fun eventDao(): YmeEventDao

    companion object {
        @Volatile
        private var INSTANCE: YmeEventDatabase? = null

        fun getInstance(context: Context): YmeEventDatabase {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    YmeEventDatabase::class.java,
                    "yenkasa_yme.db",
                ).build().also { INSTANCE = it }
            }
        }
    }
}
