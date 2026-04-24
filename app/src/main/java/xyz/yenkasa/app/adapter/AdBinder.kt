package xyz.yenkasa.app.adapter

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.TextView
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import com.bumptech.glide.Glide
import com.google.android.gms.ads.*
import com.google.android.gms.ads.nativead.*
import kotlinx.coroutines.*
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.AdModel
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.TokenManager
import xyz.yenkasa.app.util.WalletBalanceManager

class AdBinder(private val context: Context) : AdAdapterCallbacks {

    private var exoPlayer: ExoPlayer? = null
    private val trackedImpressions = mutableSetOf<String>()

    override fun bind(holder: AdsViewHolder, ad: AdModel) {
        val isAdMobSlot =
            ad.adType.equals("google", ignoreCase = true) ||
                    ad.sponsorName.equals("AdMob", ignoreCase = true) ||
                    ad._id.startsWith("local-ad")

        holder.itemView.visibility = View.VISIBLE
        holder.itemView.layoutParams.height = ViewGroup.LayoutParams.WRAP_CONTENT

        holder.adImageThumbnail.visibility = View.GONE
        holder.adVideoThumbnail.visibility = View.GONE
        holder.adPlayerView.visibility = View.GONE
        holder.adPlayButton.visibility = View.GONE
        holder.adCTAButton.visibility = View.GONE
        holder.adWatchRewardButton.visibility = View.GONE
        holder.admobNativeContainer.visibility = View.GONE
        holder.nativeAdView.visibility = View.GONE

        holder.adSponsorLabel.text =
            ad.sponsorName ?: "Sponsored • Earn ${ad.rewardYKC} YKC"

        if (!ad.title.isNullOrEmpty()) {
            holder.adTitle.visibility = View.VISIBLE
            holder.adTitle.text = ad.title
        } else {
            holder.adTitle.visibility = View.GONE
        }

        if (isAdMobSlot) {
            loadAdmobNativeAd(holder)
            return
        }

        if (ad.imageUrl.isNullOrEmpty() && ad.videoUrl.isNullOrEmpty()) {
            holder.itemView.visibility = View.GONE
            holder.itemView.layoutParams.height = 0
            return
        }

        holder.itemView.post {
            if (ad.videoUrl.isNullOrEmpty() && !trackedImpressions.contains(ad._id)) {
                trackedImpressions.add(ad._id)
                sendVerificationAdView("in_app_ad")
            }
        }

        if (!ad.imageUrl.isNullOrEmpty()) {
            holder.adImageThumbnail.visibility = View.VISIBLE
            Glide.with(context)
                .load(ad.imageUrl)
                .placeholder(R.drawable.placeholder_image)
                .into(holder.adImageThumbnail)
        }

        if (!ad.videoUrl.isNullOrEmpty()) {
            holder.adVideoThumbnail.visibility = View.VISIBLE
            holder.adPlayButton.visibility = View.VISIBLE
            holder.adWatchRewardButton.visibility = View.VISIBLE

            Glide.with(context)
                .load(ad.thumbnailUrl ?: R.drawable.placeholder_image)
                .into(holder.adVideoThumbnail)

            holder.adPlayButton.setOnClickListener {
                playVideo(holder, ad)
            }
        }

        if (!ad.ctaUrl.isNullOrEmpty()) {
            holder.adCTAButton.visibility = View.VISIBLE
            holder.adCTAButton.text = ad.ctaText ?: "Learn More"

            holder.adCTAButton.setOnClickListener {
                rewardClick(ad)
                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(ad.ctaUrl)))
            }
        }

        holder.adWatchRewardButton.setOnClickListener {
            holder.adWatchRewardButton.text = "Watching…"
            showRewardedAd(ad) {
                holder.adWatchRewardButton.text = "Reward Earned!"
            }
        }
    }

    private fun sendVerificationAdView(source: String) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val token = TokenManager.getToken(context) ?: return@launch
                val response = ApiClient.apiService.trackAdView("Bearer $token").execute()
                if (!response.isSuccessful) {
                    Log.e("AdBinder", "Failed to track $source ad view: ${response.code()}")
                }
            } catch (e: Exception) {
                Log.e("AdBinder", "Failed to track $source ad view: ${e.message}")
            }
        }
    }

    private fun rewardClick(ad: AdModel) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val token = TokenManager.getToken(context) ?: return@launch
                val response = ApiClient.apiService.rewardAdClick(ad._id, "Bearer $token")
                if (response.success) {
                    WalletBalanceManager.applyKnownBalance(context, response.newBalance)
                }
            } catch (e: Exception) {
                Log.e("AdBinder", "Click reward failed: ${e.message}")
            }
        }
    }

    private fun playVideo(holder: AdsViewHolder, ad: AdModel) {
        if (exoPlayer == null) {
            exoPlayer = ExoPlayer.Builder(context).build()
        }

        holder.adVideoThumbnail.visibility = View.GONE
        holder.adPlayButton.visibility = View.GONE
        holder.adPlayerView.visibility = View.VISIBLE
        holder.adPlayerView.player = exoPlayer

        exoPlayer?.setMediaItem(MediaItem.fromUri(ad.videoUrl!!))
        exoPlayer?.prepare()
        exoPlayer?.play()

        CoroutineScope(Dispatchers.IO).launch {
            delay(10000)
            recordVideoReward(ad, 10000)
        }
    }

    private suspend fun recordVideoReward(ad: AdModel, watchMs: Int) {
        val token = TokenManager.getToken(context) ?: return
        val auth = "Bearer $token"

        try {
            val viewRes = ApiClient.apiService.recordAdView(
                ad._id,
                auth,
                mapOf("durationMs" to watchMs, "fullyWatched" to true)
            ).execute()

            if (!viewRes.isSuccessful) return

            val adViewId = viewRes.body()?.get("adViewId") as? String ?: return

            val rewardRes = ApiClient.apiService.rewardAd(
                ad._id,
                auth,
                mapOf("adViewId" to adViewId)
            ).execute()

            if (rewardRes.isSuccessful) {
                val newBalance = rewardRes.body()?.get("newBalance").toIntOrNull()
                    ?: rewardRes.body()?.get("balance").toIntOrNull()

                if (newBalance != null) {
                    WalletBalanceManager.applyKnownBalance(context, newBalance)
                } else {
                    WalletBalanceManager.refreshBalance(context)
                }
            }
        } catch (e: Exception) {
            Log.e("AdBinder", "Video reward failed: ${e.message}")
        }
    }

    private fun Any?.toIntOrNull(): Int? {
        return when (this) {
            is Int -> this
            is Long -> this.toInt()
            is Double -> this.toInt()
            is Float -> this.toInt()
            is Number -> this.toInt()
            is String -> this.toIntOrNull()
            else -> null
        }
    }

    private fun showRewardedAd(ad: AdModel, onReward: () -> Unit) {
        onReward()
        CoroutineScope(Dispatchers.IO).launch {
            recordVideoReward(ad, 10000)
        }
    }

    private fun loadAdmobNativeAd(holder: AdsViewHolder) {
        var impressionTracked = false

        val adLoader = AdLoader.Builder(
            context,
            "ca-app-pub-5051666473627498/1225516323"
        )
            .forNativeAd { nativeAd ->
                holder.admobNativeContainer.visibility = View.VISIBLE
                holder.nativeAdView.visibility = View.VISIBLE

                val headline = holder.nativeAdView.findViewById<TextView>(R.id.ad_headline)
                headline.text = nativeAd.headline
                holder.nativeAdView.headlineView = headline

                val media = holder.nativeAdView.findViewById<MediaView>(R.id.ad_media)
                media.setMediaContent(nativeAd.mediaContent)
                holder.nativeAdView.mediaView = media

                val btn = holder.nativeAdView.findViewById<Button>(R.id.ad_call_to_action)
                btn.text = nativeAd.callToAction
                holder.nativeAdView.callToActionView = btn

                holder.nativeAdView.setNativeAd(nativeAd)
            }
            .withAdListener(object : AdListener() {
                override fun onAdImpression() {
                    if (!impressionTracked) {
                        impressionTracked = true
                        sendVerificationAdView("admob_native")
                    }
                }

                override fun onAdFailedToLoad(err: LoadAdError) {
                    Log.e("Ads", "Native ad failed: ${err.message}")
                }
            })
            .build()

        adLoader.loadAd(AdRequest.Builder().build())
    }
}