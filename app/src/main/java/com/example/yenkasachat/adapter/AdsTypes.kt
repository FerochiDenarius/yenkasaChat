package com.example.yenkasachat.adapter

import android.view.View
import android.widget.*
import androidx.media3.ui.PlayerView
import androidx.recyclerview.widget.RecyclerView
import com.google.android.gms.ads.nativead.NativeAdView
import com.example.yenkasachat.R
import com.example.yenkasachat.model.AdModel
import android.widget.FrameLayout
import com.google.android.gms.ads.nativead.MediaView

/**
 * Small helper file:
 * - AdAdapterCallbacks: interface FeedAdapter expects to call to bind ads
 * - AdsViewHolder: simple ViewHolder that finds the views inside item_ad_post.xml
 *
 * Keep these field ids consistent with your item_ad_post.xml.
 * If your layout uses slightly different ids, update them here.
 */

interface AdAdapterCallbacks {
    fun bind(holder: AdsViewHolder, ad: AdModel)
}

class AdsViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
    val adSponsorLabel: TextView = itemView.findViewById(R.id.adSponsorLabel)
    val adTitle: TextView = itemView.findViewById(R.id.adTitle)

    val adImageThumbnail: ImageView = itemView.findViewById(R.id.adImageThumbnail)
    val adVideoThumbnail: ImageView = itemView.findViewById(R.id.adVideoThumbnail)

    val adPlayerView: PlayerView = itemView.findViewById(R.id.adPlayerView)
    val adPlayButton: ImageButton = itemView.findViewById(R.id.adPlayButton)

    val adCTAButton: Button = itemView.findViewById(R.id.adCTAButton)
    val adWatchRewardButton: Button = itemView.findViewById(R.id.adWatchRewardButton)

    // AdMob-native views (optional)
    val admobNativeContainer: FrameLayout = itemView.findViewById(R.id.admobNativeContainer)
    val nativeAdView: NativeAdView = itemView.findViewById(R.id.nativeAdView)
    // If you used a MediaView inside nativeAdView xml with different id, update accordingly
    val nativeMediaView: MediaView? = itemView.findViewById(R.id.ad_media)
}
