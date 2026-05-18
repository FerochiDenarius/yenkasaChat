package xyz.yenkasa.app.ui.ads

import android.app.Dialog
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.view.LayoutInflater
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.AdModel
import xyz.yenkasa.app.model.MonetizationEventRequest
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.ui.player.YenkasaVideoPlayerView
import xyz.yenkasa.app.util.TokenManager

data class MonetizationAdOutcome(
    val completed: Boolean,
    val skipped: Boolean,
    val durationMs: Long
)

data class MonetizationAdRequest(
    val ad: AdModel,
    val placement: MonetizationAdType,
    val rewardEligible: Boolean = false,
    val postId: String? = null
)

object MonetizationAdDialog {
    fun show(
        fragment: Fragment,
        request: MonetizationAdRequest,
        onClosed: (MonetizationAdOutcome) -> Unit
    ) {
        if (!fragment.isAdded) return
        val context = fragment.requireContext()
        val dialog = Dialog(context, android.R.style.Theme_Black_NoTitleBar_Fullscreen)
        val view = LayoutInflater.from(context).inflate(R.layout.dialog_monetization_ad, null, false)
        val player = view.findViewById<YenkasaVideoPlayerView>(R.id.monetizationVideoPlayer)
        val title = view.findViewById<TextView>(R.id.monetizationTitle)
        val subtitle = view.findViewById<TextView>(R.id.monetizationSubtitle)
        val skipButton = view.findViewById<Button>(R.id.monetizationSkipButton)
        val closeButton = view.findViewById<Button>(R.id.monetizationCloseButton)
        val handler = Handler(Looper.getMainLooper())
        val startedAt = System.currentTimeMillis()
        var closed = false
        var skipEnabled = false
        var completionReported = false

        fun close(skipped: Boolean, completed: Boolean) {
            if (closed) return
            closed = true
            handler.removeCallbacksAndMessages(null)
            runCatching { player.release() }
            if (dialog.isShowing) dialog.dismiss()
            onClosed(
                MonetizationAdOutcome(
                    completed = completed,
                    skipped = skipped,
                    durationMs = System.currentTimeMillis() - startedAt
                )
            )
        }

        fun trackEvent(eventType: String, durationMs: Long = 0L, skipped: Boolean = false, completed: Boolean = false) {
            val token = TokenManager.getToken(context) ?: return
            val payload = MonetizationEventRequest(
                eventType = eventType,
                placement = request.placement.name.lowercase(),
                adId = request.ad._id,
                postId = request.postId,
                durationMs = durationMs.toInt(),
                skipped = skipped,
                completed = completed,
                rewarded = request.rewardEligible,
                monetizedSession = true
            )

            fragment.lifecycleScope.launch(Dispatchers.IO) {
                runCatching {
                    ApiClient.apiService.trackMonetizationEvent("Bearer $token", payload).execute()
                }
            }
        }

        fun finishCompleted() {
            if (completionReported) return
            completionReported = true
            trackEvent("completed", durationMs = System.currentTimeMillis() - startedAt, completed = true)
            if (request.rewardEligible) {
                rewardUser(context, fragment, request)
            }
            close(skipped = false, completed = true)
        }

        title.text = request.ad.title ?: context.getString(R.string.sponsored_ad)
        subtitle.text = when (request.placement) {
            MonetizationAdType.REWARDED -> context.getString(R.string.watch_earn_ykc, request.ad.rewardYKC)
            MonetizationAdType.MIDROLL -> context.getString(R.string.sponsored_ad)
            MonetizationAdType.INTERSTITIAL -> context.getString(R.string.sponsored_ad)
            MonetizationAdType.FEED -> context.getString(R.string.sponsored_ad)
        }

        player.setCheckpointListener { second ->
            if (second >= 5 && !skipEnabled) {
                skipEnabled = true
                skipButton.isEnabled = true
                skipButton.text = context.getString(R.string.skip_ad)
            }
        }

        player.bindVideo(
            mediaUrl = request.ad.videoUrl,
            thumbnailUrl = request.ad.thumbnailUrl ?: request.ad.imageUrl,
            autoplay = true,
            muted = false,
            loop = false
        )

        player.setReadyListener {
            trackEvent("shown")
        }
        player.setCompletionListener {
            finishCompleted()
        }

        skipButton.isEnabled = false
        skipButton.text = context.getString(R.string.skip_in_seconds, 5)
        handler.postDelayed({
            if (!closed) {
                skipEnabled = true
                skipButton.isEnabled = true
                skipButton.text = context.getString(R.string.skip_ad)
            }
        }, 5000L)

        skipButton.setOnClickListener {
            if (!skipEnabled) return@setOnClickListener
            trackEvent("skipped", skipped = true)
            close(skipped = true, completed = false)
        }
        closeButton.setOnClickListener {
            if (!skipEnabled) return@setOnClickListener
            trackEvent("skipped", skipped = true)
            close(skipped = true, completed = false)
        }

        dialog.setContentView(view)
        dialog.setOnDismissListener {
            handler.removeCallbacksAndMessages(null)
            runCatching { player.release() }
        }
        dialog.window?.setLayout(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT
        )
        dialog.show()
    }

    private fun rewardUser(context: Context, fragment: Fragment, request: MonetizationAdRequest) {
        val token = TokenManager.getToken(context) ?: return
        val auth = "Bearer $token"
        fragment.lifecycleScope.launch(Dispatchers.IO) {
            val recordResponse = runCatching {
                ApiClient.apiService.recordAdView(
                    request.ad._id,
                    auth,
                    mapOf("durationMs" to 15000, "fullyWatched" to true)
                ).execute()
            }.getOrNull()

            val adViewId = recordResponse?.body()?.get("adViewId")?.toString().orEmpty()

            runCatching {
                ApiClient.apiService.trackAdView(auth).execute()
            }
            if (adViewId.isNotBlank()) {
                runCatching {
                    ApiClient.apiService.rewardAd(
                        request.ad._id,
                        auth,
                        mapOf("adViewId" to adViewId)
                    ).execute()
                }
            }
        }
    }
}
