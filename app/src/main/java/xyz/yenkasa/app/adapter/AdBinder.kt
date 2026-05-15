package xyz.yenkasa.app.adapter

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import android.view.View
import android.widget.Button
import android.widget.TextView
import com.bumptech.glide.Glide
import com.bumptech.glide.load.DataSource
import com.bumptech.glide.load.engine.GlideException
import com.bumptech.glide.request.RequestListener
import com.bumptech.glide.request.target.Target
import com.google.android.gms.ads.*
import com.google.android.gms.ads.nativead.*
import kotlinx.coroutines.*
import xyz.yenkasa.app.R
import xyz.yenkasa.app.BuildConfig
import xyz.yenkasa.app.model.AdModel
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.TokenManager
import xyz.yenkasa.app.util.WalletBalanceManager

class AdBinder(private val context: Context) : AdAdapterCallbacks {

    private val trackedImpressions = mutableSetOf<String>()

    override fun bindYenkasa(holder: YenkasaAdViewHolder, ad: AdModel) {
        Log.d("YenkasaAds", "Binding Yenkasa ad id=${ad._id} image=${ad.imageUrl} video=${ad.videoUrl} thumb=${ad.thumbnailUrl}")
        holder.adImageThumbnail.visibility = View.GONE
        holder.adVideoThumbnail.visibility = View.GONE
        holder.adPlayerView.visibility = View.GONE
        holder.adPlayButton.visibility = View.GONE
        holder.adCTAButton.visibility = View.GONE
        holder.adWatchRewardButton.visibility = View.GONE
        holder.adMediaFallback.visibility = View.GONE
        holder.adPlayerView.release()
        holder.adPlayButton.setOnClickListener(null)
        holder.adCTAButton.setOnClickListener(null)
        holder.adWatchRewardButton.setOnClickListener(null)

        holder.adSponsorLabel.text =
            ad.sponsorName?.takeIf { it.isNotBlank() }
                ?: context.getString(R.string.sponsored_earn_ykc, ad.rewardYKC)

        if (!ad.title.isNullOrEmpty()) {
            holder.adTitle.visibility = View.VISIBLE
            holder.adTitle.text = ad.title
        } else {
            holder.adTitle.visibility = View.GONE
        }

        if (ad.imageUrl.isNullOrEmpty() && ad.videoUrl.isNullOrEmpty()) {
            holder.adMediaFallback.visibility = View.VISIBLE
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
                .error(R.drawable.placeholder_image)
                .listener(object : RequestListener<android.graphics.drawable.Drawable> {
                    override fun onLoadFailed(
                        e: GlideException?,
                        model: Any?,
                        target: Target<android.graphics.drawable.Drawable>,
                        isFirstResource: Boolean
                    ): Boolean {
                        Log.e("YenkasaAds", "Image ad failed id=${ad._id}: ${e?.message}")
                        holder.adImageThumbnail.visibility = View.GONE
                        holder.adMediaFallback.visibility = View.VISIBLE
                        return false
                    }

                    override fun onResourceReady(
                        resource: android.graphics.drawable.Drawable,
                        model: Any,
                        target: Target<android.graphics.drawable.Drawable>?,
                        dataSource: DataSource,
                        isFirstResource: Boolean
                    ): Boolean {
                        Log.d("YenkasaAds", "Image ad loaded id=${ad._id}")
                        holder.adMediaFallback.visibility = View.GONE
                        return false
                    }
                })
                .into(holder.adImageThumbnail)
        }

        if (!ad.videoUrl.isNullOrEmpty()) {
            holder.adVideoThumbnail.visibility = View.VISIBLE
            holder.adPlayButton.visibility = View.VISIBLE
            holder.adWatchRewardButton.visibility = View.VISIBLE

            Glide.with(context)
                .load(ad.thumbnailUrl ?: ad.imageUrl ?: R.drawable.placeholder_image)
                .error(R.drawable.placeholder_image)
                .listener(object : RequestListener<android.graphics.drawable.Drawable> {
                    override fun onLoadFailed(
                        e: GlideException?,
                        model: Any?,
                        target: Target<android.graphics.drawable.Drawable>,
                        isFirstResource: Boolean
                    ): Boolean {
                        Log.e("YenkasaAds", "Video thumbnail failed id=${ad._id}: ${e?.message}")
                        holder.adMediaFallback.visibility = View.VISIBLE
                        return false
                    }

                    override fun onResourceReady(
                        resource: android.graphics.drawable.Drawable,
                        model: Any,
                        target: Target<android.graphics.drawable.Drawable>?,
                        dataSource: DataSource,
                        isFirstResource: Boolean
                    ): Boolean {
                        Log.d("YenkasaAds", "Video thumbnail loaded id=${ad._id}")
                        holder.adMediaFallback.visibility = View.GONE
                        return false
                    }
                })
                .into(holder.adVideoThumbnail)

            holder.adPlayButton.setOnClickListener {
                playVideo(holder, ad)
            }
        }

        if (!ad.ctaUrl.isNullOrEmpty()) {
            holder.adCTAButton.visibility = View.VISIBLE
            holder.adCTAButton.text = ad.ctaText ?: context.getString(R.string.learn_more)

            holder.adCTAButton.setOnClickListener {
                rewardClick(ad)
                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(ad.ctaUrl)))
            }
        }

        if (!ad.videoUrl.isNullOrEmpty()) {
            holder.adWatchRewardButton.visibility = View.VISIBLE
            holder.adWatchRewardButton.text = context.getString(R.string.watch_earn_ykc, ad.rewardYKC)
            holder.adWatchRewardButton.setOnClickListener {
                holder.adWatchRewardButton.text = context.getString(R.string.watching)
                showRewardedAd(ad) {
                    holder.adWatchRewardButton.text = context.getString(R.string.reward_earned)
                }
            }
        }
    }

    override fun bindAdMob(holder: AdMobAdViewHolder, ad: AdModel) {
        Log.d("AdMobAds", "Binding AdMob slot id=${ad._id} type=${ad.adType}")
        loadAdmobNativeAd(holder)
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

    private fun playVideo(holder: YenkasaAdViewHolder, ad: AdModel) {
        holder.adVideoThumbnail.visibility = View.GONE
        holder.adPlayButton.visibility = View.GONE
        holder.adPlayerView.visibility = View.VISIBLE
        holder.adMediaFallback.visibility = View.GONE
        holder.adPlayerView.bindVideo(
            mediaUrl = ad.videoUrl,
            thumbnailUrl = ad.thumbnailUrl ?: ad.imageUrl,
            autoplay = true,
            muted = false
        )

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
                val amount = rewardRes.body()?.get("amount").toDoubleOrNull()
                val newBalance = rewardRes.body()?.get("newBalance").toDoubleOrNull()
                    ?: rewardRes.body()?.get("balance").toDoubleOrNull()

                if (newBalance != null) {
                    WalletBalanceManager.applyKnownBalance(context, newBalance, rewardAmount = amount)
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

    private fun loadAdmobNativeAd(holder: AdMobAdViewHolder) {
        var impressionTracked = false
        val adUnitId = if (BuildConfig.DEBUG) {
            "ca-app-pub-3940256099942544/2247696110"
        } else {
            "ca-app-pub-5051666473627498/1225516323"
        }

        if (BuildConfig.DEBUG) {
            Log.d("AdMob", "Using ad unit: $adUnitId")
        }

        val adLoader = AdLoader.Builder(
            context,
            adUnitId
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
                Log.d("AdMobAds", "Native ad loaded unit=$adUnitId")
            }
            .withAdListener(object : AdListener() {
                override fun onAdImpression() {
                    if (!impressionTracked) {
                        impressionTracked = true
                        sendVerificationAdView("admob_native")
                    }
                }

                override fun onAdFailedToLoad(err: LoadAdError) {
                    Log.e("AdMobAds", "Native ad failed unit=$adUnitId: ${err.message}")
                }
            })
            .build()

        adLoader.loadAd(AdRequest.Builder().build())
    }

    private fun Any?.toDoubleOrNull(): Double? {
        return when (this) {
            is Double -> this
            is Float -> this.toDouble()
            is Number -> this.toDouble()
            is String -> this.toDoubleOrNull()
            else -> null
        }
    }
}
