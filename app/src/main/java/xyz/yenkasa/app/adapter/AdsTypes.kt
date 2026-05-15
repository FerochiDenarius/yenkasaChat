package xyz.yenkasa.app.adapter

import android.view.View
import android.widget.*
import androidx.recyclerview.widget.RecyclerView
import com.google.android.gms.ads.nativead.NativeAdView
import xyz.yenkasa.app.R
import android.widget.FrameLayout
import com.google.android.gms.ads.nativead.MediaView
import xyz.yenkasa.app.ui.player.YenkasaVideoPlayerView

/**
 * Small helper file:
 * - AdAdapterCallbacks: interface FeedAdapter expects to call to bind ads
 * - AdsViewHolder: simple ViewHolder that finds the views inside item_ad_post.xml
 *
 * Keep these field ids consistent with your item_ad_post.xml.
 * If your layout uses slightly different ids, update them here.
 */

interface AdAdapterCallbacks {
    fun bindYenkasa(holder: YenkasaAdViewHolder, ad: xyz.yenkasa.app.model.AdModel)
    fun bindAdMob(holder: AdMobAdViewHolder, ad: xyz.yenkasa.app.model.AdModel)
}

class YenkasaAdViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
    val adSponsorLabel: TextView = itemView.findViewById(R.id.adSponsorLabel)
    val adTitle: TextView = itemView.findViewById(R.id.adTitle)
    val adMediaFallback: TextView = itemView.findViewById(R.id.adMediaFallback)
    val adImageThumbnail: ImageView = itemView.findViewById(R.id.adImageThumbnail)
    val adVideoThumbnail: ImageView = itemView.findViewById(R.id.adVideoThumbnail)
    val adPlayerView: YenkasaVideoPlayerView = itemView.findViewById(R.id.adPlayerView)
    val adPlayButton: ImageButton = itemView.findViewById(R.id.adPlayButton)
    val adCTAButton: Button = itemView.findViewById(R.id.adCTAButton)
    val adWatchRewardButton: Button = itemView.findViewById(R.id.adWatchRewardButton)
}

class AdMobAdViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
    val admobNativeContainer: FrameLayout = itemView.findViewById(R.id.admobNativeContainer)
    val nativeAdView: NativeAdView = itemView.findViewById(R.id.nativeAdView)
    val nativeMediaView: MediaView? = itemView.findViewById(R.id.ad_media)
}
