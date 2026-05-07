package xyz.yenkasa.app.util

import android.content.Context
import androidx.media3.common.MediaItem
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.datasource.cache.LeastRecentlyUsedCacheEvictor
import androidx.media3.datasource.cache.SimpleCache
import androidx.media3.exoplayer.source.MediaSource
import androidx.media3.exoplayer.source.ProgressiveMediaSource
import java.io.File

object YenkasaMediaCache {
    private const val VIDEO_CACHE_SIZE_BYTES = 120L * 1024L * 1024L

    @Volatile
    private var simpleCache: SimpleCache? = null

    fun mediaSource(context: Context, mediaItem: MediaItem): MediaSource {
        val dataSourceFactory = DefaultDataSource.Factory(context.applicationContext)
        val cacheFactory = CacheDataSource.Factory()
            .setCache(cache(context))
            .setUpstreamDataSourceFactory(dataSourceFactory)
            .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)

        return ProgressiveMediaSource.Factory(cacheFactory)
            .createMediaSource(mediaItem)
    }

    private fun cache(context: Context): SimpleCache {
        simpleCache?.let { return it }
        return synchronized(this) {
            simpleCache ?: SimpleCache(
                File(context.applicationContext.cacheDir, "yenkasa_media_cache"),
                LeastRecentlyUsedCacheEvictor(VIDEO_CACHE_SIZE_BYTES),
                StandaloneDatabaseProvider(context.applicationContext)
            ).also { simpleCache = it }
        }
    }
}
