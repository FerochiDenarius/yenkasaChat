package com.example.yenkasachat.adapter

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import android.widget.Button
import android.widget.TextView
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import com.bumptech.glide.Glide
import com.example.yenkasachat.R
import com.example.yenkasachat.model.AdModel
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
import kotlinx.coroutines.*
import android.util.Log
import com.google.android.gms.ads.*
import com.google.android.gms.ads.nativead.*

class AdBinder(private val context: Context) : AdAdapterCallbacks {

    private var exoPlayer: ExoPlayer? = null
    private val trackedImpressions = mutableSetOf<String>()   // Prevent duplicate impressions

    override fun bind(holder: AdsViewHolder, ad: AdModel) {

        // ----------------------------------
        // 1️⃣ TRACK IMPRESSION (User saw ad)
        // ----------------------------------
        holder.itemView.post {
            if (!trackedImpressions.contains(ad._id)) {
                trackedImpressions.add(ad._id)
                sendImpression(ad)       // Backend increments adsViewed
            }
        }

        // ----------------------------------
        // 2️⃣ UI: Sponsor label
        // ----------------------------------
        holder.adSponsorLabel.text =
            ad.sponsorName ?: "Sponsored • Earn ${ad.rewardYKC} YKC"

        // Title
        if (!ad.title.isNullOrEmpty()) {
            holder.adTitle.visibility = View.VISIBLE
            holder.adTitle.text = ad.title
        } else {
            holder.adTitle.visibility = View.GONE
        }

        // Reset UI visibility
        holder.adImageThumbnail.visibility = View.GONE
        holder.adVideoThumbnail.visibility = View.GONE
        holder.adPlayerView.visibility = View.GONE
        holder.adPlayButton.visibility = View.GONE
        holder.adCTAButton.visibility = View.GONE
        holder.adWatchRewardButton.visibility = View.VISIBLE

        // ----------------------------------
        // 3️⃣ IMAGE AD
        // ----------------------------------
        if (!ad.imageUrl.isNullOrEmpty()) {
            holder.adImageThumbnail.visibility = View.VISIBLE

            Glide.with(context)
                .load(ad.imageUrl)
                .placeholder(R.drawable.placeholder_image)
                .into(holder.adImageThumbnail)
        }

        // ----------------------------------
        // 4️⃣ VIDEO AD
        // ----------------------------------
        if (!ad.videoUrl.isNullOrEmpty()) {
            holder.adVideoThumbnail.visibility = View.VISIBLE
            holder.adPlayButton.visibility = View.VISIBLE

            Glide.with(context)
                .load(ad.thumbnailUrl ?: R.drawable.placeholder_image)
                .into(holder.adVideoThumbnail)

            holder.adPlayButton.setOnClickListener {
                playVideo(holder, ad)
            }
        }

        // ----------------------------------
        // 5️⃣ CTA BUTTON
        // ----------------------------------
        if (!ad.ctaUrl.isNullOrEmpty()) {
            holder.adCTAButton.visibility = View.VISIBLE
            holder.adCTAButton.text = ad.ctaText ?: "Learn More"

            holder.adCTAButton.setOnClickListener {
                rewardClick(ad)  // reward user for clicking
                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(ad.ctaUrl)))
            }
        }

        holder.adCTAButton.setOnClickListener {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(ad.ctaUrl))
            context.startActivity(intent)

            // reward backend for click
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    val token = TokenManager.getToken(context) ?: return@launch
                    ApiClient.apiService.rewardAdClick("Bearer $token", ad._id)
                } catch (e: Exception) {
                    Log.e("AdBinder", "Failed to send click reward: ${e.message}")
                }
            }
        }

        // ----------------------------------
        // 6️⃣ WATCH-TO-EARN BUTTON
        // ----------------------------------
        holder.adWatchRewardButton.setOnClickListener {
            holder.adWatchRewardButton.text = "Watching..."
            showRewardedAd(ad) {
                holder.adWatchRewardButton.text = "Reward Earned!"
            }
        }

        // ----------------------------------
        // 7️⃣ Load AdMob Native Ad
        // ----------------------------------
        loadAdmobNativeAd(holder)
    }

    // ---------------------------------------------------------------------
    // IMPRESSION: User saw ad → +1 ADS VIEWED (verification metric)
    // ---------------------------------------------------------------------
    private fun sendImpression(ad: AdModel) {
        val token = TokenManager.getToken(context) ?: return

        CoroutineScope(Dispatchers.IO).launch {
            try {
                ApiClient.apiService.trackAdView("Bearer $token")
            } catch (e: Exception) {
                Log.e("AdBinder", "Failed to track ad view: ${e.message}")
            }
        }
    }

    // ---------------------------------------------------------------------
    // CLICK REWARD: +5 YKC (from ad.rewardYKC)
    // ---------------------------------------------------------------------
    private fun rewardClick(ad: AdModel) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val token = TokenManager.getToken(context) ?: return@launch
                ApiClient.apiService.rewardAdClick(
                    ad._id,
                    "Bearer $token"
                )
            } catch (e: Exception) {
                Log.e("AdBinder", "Click reward failed: ${e.message}")
            }
        }
    }

    // ---------------------------------------------------------------------
    // VIDEO PLAY: Record watch time + backend reward if fully watched
    // ---------------------------------------------------------------------
    private fun playVideo(holder: AdsViewHolder, ad: AdModel) {

        if (exoPlayer == null)
            exoPlayer = ExoPlayer.Builder(context).build()

        holder.adVideoThumbnail.visibility = View.GONE
        holder.adPlayButton.visibility = View.GONE
        holder.adPlayerView.visibility = View.VISIBLE

        holder.adPlayerView.player = exoPlayer

        val url = ad.videoUrl ?: return
        exoPlayer!!.setMediaItem(MediaItem.fromUri(url))
        exoPlayer!!.prepare()
        exoPlayer!!.play()

        // Track reward after video plays for 10 seconds (example)
        CoroutineScope(Dispatchers.IO).launch {
            delay(10000)
            recordVideoReward(ad, 10000)
        }
    }

    private suspend fun recordVideoReward(ad: AdModel, watchMs: Int) {
        val token = TokenManager.getToken(context) ?: return
        val auth = "Bearer $token"

        try {
            val response = ApiClient.apiService.recordAdView(
                ad._id,
                auth,
                mapOf("durationMs" to watchMs, "fullyWatched" to true)
            ).execute()

            if (!response.isSuccessful) return
            val adViewId = response.body()?.get("adViewId") as? String ?: return

            ApiClient.apiService.rewardAd(
                ad._id,
                auth,
                mapOf("adViewId" to adViewId)
            ).execute()

        } catch (e: Exception) {
            Log.e("AdBinder", "Video reward failed: ${e.message}")
        }
    }

    // ---------------------------------------------------------------------
    // GOOGLE REWARDED AD → backend reward
    // ---------------------------------------------------------------------
    private fun showRewardedAd(ad: AdModel, onReward: () -> Unit) {
        onReward()                              // UI update
        CoroutineScope(Dispatchers.IO).launch { recordVideoReward(ad, 10000) }
    }

    // ---------------------------------------------------------------------
    // ADMOB NATIVE AD LOADING
    // ---------------------------------------------------------------------
    private fun loadAdmobNativeAd(holder: AdsViewHolder) {

        val adLoader = AdLoader.Builder(context, "ca-app-pub-3940256099942544/2247696110")
            .forNativeAd { nativeAd ->

                holder.admobNativeContainer.visibility = View.VISIBLE
                holder.nativeAdView.visibility = View.VISIBLE

                val headlineView = holder.nativeAdView.findViewById<TextView>(R.id.ad_headline)
                headlineView.text = nativeAd.headline
                holder.nativeAdView.headlineView = headlineView

                val media = holder.nativeAdView.findViewById<MediaView>(R.id.ad_media)
                media.setMediaContent(nativeAd.mediaContent)
                holder.nativeAdView.mediaView = media

                val ctaButton = holder.nativeAdView.findViewById<Button>(R.id.ad_call_to_action)
                ctaButton.text = nativeAd.callToAction
                holder.nativeAdView.callToActionView = ctaButton

                holder.nativeAdView.setNativeAd(nativeAd)
            }
            .withAdListener(object : AdListener() {
                override fun onAdFailedToLoad(err: LoadAdError) {
                    Log.e("Ads", "Native ad failed: ${err.message}")
                }
            })
            .build()

        adLoader.loadAd(AdRequest.Builder().build())
    }
}
