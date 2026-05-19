package xyz.yenkasa.app.ui.ads

import android.content.Context
import android.net.Uri
import android.util.Log
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import xyz.yenkasa.app.model.AdModel
import xyz.yenkasa.app.util.YenkasaMediaCache

class MonetizationAdPreloader(context: Context) {
    private val appContext = context.applicationContext
    private var player: ExoPlayer? = null
    private var preloadedAdId: String? = null

    fun preload(ad: AdModel?) {
        val videoUrl = ad?.videoUrl?.takeIf { it.isNotBlank() } ?: return
        if (preloadedAdId == ad._id && player != null) return

        release()
        preloadedAdId = ad._id
        player = ExoPlayer.Builder(appContext).build().also { exo ->
            exo.volume = 0f
            exo.playWhenReady = false
            exo.setMediaSource(
                YenkasaMediaCache.mediaSource(appContext, MediaItem.fromUri(Uri.parse(videoUrl)))
            )
            exo.addListener(object : Player.Listener {
                override fun onPlayerError(error: PlaybackException) {
                    Log.w(TAG, "Ad preload failed id=${ad._id}: ${error.message}")
                    release()
                }
            })
            exo.prepare()
            Log.d(TAG, "Preloading monetization ad id=${ad._id}")
        }
    }

    fun release() {
        player?.release()
        player = null
        preloadedAdId = null
    }

    private companion object {
        const val TAG = "MonetizationAdPreloader"
    }
}
