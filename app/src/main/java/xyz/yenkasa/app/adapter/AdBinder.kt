package xyz.yenkasa.app.adapter

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import android.widget.Button
import android.widget.TextView
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import com.bumptech.glide.Glide
import xyz.yenkasa.app.model.AdModel
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.TokenManager
import kotlinx.coroutines.*
import android.util.Log
import com.google.android.gms.ads.*
import com.google.android.gms.ads.nativead.*
import xyz.yenkasa.app.R


class AdBinder(private val context: Context) : AdAdapterCallbacks {

    private var exoPlayer: ExoPlayer? = null
    private val trackedImpressions = mutableSetOf<String>()  // avoid duplicate views

    override fun bind(holder: AdsViewHolder, ad: AdModel) {
        val isAdMobSlot = ad.sponsorName.equals("AdMob", ignoreCase = true) ||
            ad._id.startsWith("local-ad")

        // 1️⃣ Track impression ONCE
        holder.itemView.post {
            if (!isAdMobSlot && ad.videoUrl.isNullOrEmpty() && !trackedImpressions.contains(ad._id)) {
                trackedImpressions.add(ad._id)
                sendVerificationAdView("in_app_ad")  // increments adsViewed in backend
            }
        }

        // 2️⃣ Sponsor label
        holder.adSponsorLabel.text =
            ad.sponsorName ?: "Sponsored • Earn ${ad.rewardYKC} YKC"

        if (!ad.title.isNullOrEmpty()) {
            holder.adTitle.visibility = View.VISIBLE
            holder.adTitle.text = ad.title
        } else {
            holder.adTitle.visibility = View.GONE
        }

        // Reset UI
        holder.adImageThumbnail.visibility = View.GONE
        holder.adVideoThumbnail.visibility = View.GONE
        holder.adPlayerView.visibility = View.GONE
        holder.adPlayButton.visibility = View.GONE
        holder.adCTAButton.visibility = View.GONE
        holder.adWatchRewardButton.visibility = View.GONE
        holder.admobNativeContainer.visibility = View.GONE
        holder.nativeAdView.visibility = View.GONE

        // 3️⃣ Image ad
        if (!ad.imageUrl.isNullOrEmpty()) {
            holder.adImageThumbnail.visibility = View.VISIBLE
            Glide.with(context).load(ad.imageUrl)
                .placeholder(R.drawable.placeholder_image)
                .into(holder.adImageThumbnail)
        }

        // 4️⃣ Video ad
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

        // 5️⃣ CTA CLICK REWARD (5 YKC)
        if (!ad.ctaUrl.isNullOrEmpty()) {
            holder.adCTAButton.visibility = View.VISIBLE
            holder.adCTAButton.text = ad.ctaText ?: "Learn More"

            holder.adCTAButton.setOnClickListener {
                rewardClick(ad)
                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(ad.ctaUrl)))
            }
        }

        // 6️⃣ WATCH VIDEO TO EARN REWARD
        holder.adWatchRewardButton.setOnClickListener {
            holder.adWatchRewardButton.text = "Watching…"
            showRewardedAd(ad) {
                holder.adWatchRewardButton.text = "Reward Earned!"
            }
        }

        // 7️⃣ Load AdMob native ad only for Google ad slots.
        if (isAdMobSlot) {
            loadAdmobNativeAd(holder)
        }
    }

    // ---------------- IMPRESSION ----------------

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

    // ---------------- CLICK REWARD ----------------

    private fun rewardClick(ad: AdModel) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val token = TokenManager.getToken(context) ?: return@launch
                ApiClient.apiService.rewardAdClick("Bearer $token", ad._id)
            } catch (e: Exception) {
                Log.e("AdBinder", "Click reward failed: ${e.message}")
            }
        }
    }

    // ---------------- VIDEO PLAY ----------------

    private fun playVideo(holder: AdsViewHolder, ad: AdModel) {
        if (exoPlayer == null)
            exoPlayer = ExoPlayer.Builder(context).build()

        holder.adVideoThumbnail.visibility = View.GONE
        holder.adPlayButton.visibility = View.GONE
        holder.adPlayerView.visibility = View.VISIBLE

        holder.adPlayerView.player = exoPlayer

        exoPlayer!!.setMediaItem(MediaItem.fromUri(ad.videoUrl!!))
        exoPlayer!!.prepare()
        exoPlayer!!.play()

        // Track reward after 10 seconds
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
                ad._id, auth,
                mapOf("durationMs" to watchMs, "fullyWatched" to true)
            ).execute()

            if (!viewRes.isSuccessful) return
            val adViewId = viewRes.body()?.get("adViewId") as? String ?: return

            ApiClient.apiService.rewardAd(
                ad._id, auth, mapOf("adViewId" to adViewId)
            ).execute()

        } catch (e: Exception) {
            Log.e("AdBinder", "Video reward failed: ${e.message}")
        }
    }

    // ---------------- GOOGLE REWARDED AD ----------------

    private fun showRewardedAd(ad: AdModel, onReward: () -> Unit) {
        onReward()
        CoroutineScope(Dispatchers.IO).launch {
            recordVideoReward(ad, 10000)
        }
    }

    // ---------------- ADMOB NATIVE ----------------

    private fun loadAdmobNativeAd(holder: AdsViewHolder) {
        var impressionTracked = false

        val adLoader = AdLoader.Builder(context, "ca-app-pub-5051666473627498/1225516323")
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
