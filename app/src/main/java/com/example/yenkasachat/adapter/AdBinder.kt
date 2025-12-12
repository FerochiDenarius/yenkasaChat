package com.example.yenkasachat.adapter

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import com.bumptech.glide.Glide
import com.example.yenkasachat.R
import com.example.yenkasachat.model.AdModel
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class AdBinder(
    private val context: Context
) : AdAdapterCallbacks {

    private var exoPlayer: ExoPlayer? = null

    override fun bind(holder: AdsViewHolder, ad: AdModel) {

        /* ----------------------------------------------
         * SPONSORED LABEL
         * ---------------------------------------------- */
        holder.adSponsorLabel.text =
            ad.sponsorName ?: "Sponsored • Earn ${ad.rewardYKC} YKC"

        /* ----------------------------------------------
         * TITLE
         * ---------------------------------------------- */
        if (!ad.title.isNullOrEmpty()) {
            holder.adTitle.visibility = View.VISIBLE
            holder.adTitle.text = ad.title
        } else {
            holder.adTitle.visibility = View.GONE
        }

        /* Reset visibility */
        holder.adImageThumbnail.visibility = View.GONE
        holder.adVideoThumbnail.visibility = View.GONE
        holder.adPlayerView.visibility = View.GONE
        holder.adPlayButton.visibility = View.GONE
        holder.adCTAButton.visibility = View.GONE

        /* ----------------------------------------------
         * IMAGE AD
         * ---------------------------------------------- */
        if (!ad.imageUrl.isNullOrEmpty()) {
            holder.adImageThumbnail.visibility = View.VISIBLE

            Glide.with(context)
                .load(ad.imageUrl)
                .placeholder(R.drawable.placeholder_image)
                .into(holder.adImageThumbnail)
        }

        /* ----------------------------------------------
         * VIDEO AD
         * ---------------------------------------------- */
        if (!ad.videoUrl.isNullOrEmpty()) {
            holder.adVideoThumbnail.visibility = View.VISIBLE
            holder.adPlayButton.visibility = View.VISIBLE

            Glide.with(context)
                .load(ad.thumbnailUrl ?: R.drawable.placeholder_image)
                .into(holder.adVideoThumbnail)

            holder.adPlayButton.setOnClickListener {
                playVideo(holder, ad.videoUrl!!)
            }
        }

        /* ----------------------------------------------
         * CTA BUTTON
         * ---------------------------------------------- */
        if (!ad.ctaUrl.isNullOrEmpty()) {
            holder.adCTAButton.visibility = View.VISIBLE
            holder.adCTAButton.text = ad.ctaText ?: "Learn More"

            holder.adCTAButton.setOnClickListener {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(ad.ctaUrl))
                context.startActivity(intent)
            }
        }

        /* ----------------------------------------------
         * REWARDED BUTTON
         * ---------------------------------------------- */
        holder.adWatchRewardButton.setOnClickListener {
            showRewardedAd(holder, ad)
        }
    }

    /* ----------------------------------------------
     * PLAY VIDEO
     * ---------------------------------------------- */
    private fun playVideo(holder: AdsViewHolder, url: String) {
        if (exoPlayer == null) {
            exoPlayer = ExoPlayer.Builder(context).build()
        }

        holder.adVideoThumbnail.visibility = View.GONE
        holder.adPlayButton.visibility = View.GONE
        holder.adPlayerView.visibility = View.VISIBLE

        holder.adPlayerView.player = exoPlayer

        exoPlayer!!.setMediaItem(MediaItem.fromUri(url))
        exoPlayer!!.prepare()
        exoPlayer!!.play()
    }

    /* ----------------------------------------------
     * SAVE REWARD (Backend)
     * ---------------------------------------------- */
    private fun recordAdViewAndReward(ad: AdModel, watchMs: Int) {
        CoroutineScope(Dispatchers.IO).launch {

            val token = TokenManager.getToken(context) ?: return@launch
            val auth = "Bearer $token"

            val viewRes = ApiClient.apiService.recordAdView(
                ad._id,
                auth,
                mapOf<String, Any>(
                    "durationMs" to watchMs,
                    "fullyWatched" to true
                )
            ).execute()   // ⭐ FIX

            if (viewRes.isSuccessful) {

                val body = viewRes.body() ?: return@launch
                val adViewId = body["adViewId"] as? String ?: return@launch

                ApiClient.apiService.rewardAd(
                    ad._id,
                    auth,
                    mapOf("adViewId" to adViewId)
                ).execute()
            }
        }
    }

    /* ----------------------------------------------
     * REWARDED AD (Google → Backend)
     * ---------------------------------------------- */
    private fun showRewardedAd(holder: AdsViewHolder, ad: AdModel) {
        holder.adWatchRewardButton.isEnabled = false
        holder.adWatchRewardButton.text = "Watching…"

        // AFTER Google rewards user:
        holder.adWatchRewardButton.text = "Reward Earned!"

        recordAdViewAndReward(ad, 10000)   // 10 seconds example
    }
}
