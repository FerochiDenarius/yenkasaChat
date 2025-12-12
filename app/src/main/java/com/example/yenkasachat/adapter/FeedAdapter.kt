package com.example.yenkasachat.adapter

import android.content.Context
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.media3.ui.PlayerView
import androidx.recyclerview.widget.RecyclerView
import com.example.yenkasachat.R
import com.example.yenkasachat.model.Post
import com.example.yenkasachat.model.AdModel

class FeedAdapter(
    private val context: Context,
    private val items: List<Any>,
    private val postAdapterCallbacks: PostAdapterCallbacks,
    private val adAdapterCallbacks: AdAdapterCallbacks
) : RecyclerView.Adapter<RecyclerView.ViewHolder>() {

    private val TYPE_POST = 0
    private val TYPE_AD = 1

    // ⭐ Create a dummy PostAdapter instance so we can instantiate PostViewHolder
    private val internalPostAdapter = PostAdapter(
        context,
        emptyList(),
        onLikeClick = { _, _ -> },
        onCommentClick = { _, _ -> },
        onUserClick = { _ -> },
        onPostClick = { _ -> },
        onShareClick = { _ -> }
    )

    override fun getItemViewType(position: Int): Int {
        return when (items[position]) {
            is Post -> TYPE_POST
            is AdModel -> TYPE_AD
            else -> error("Unknown feed item type")
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {

        return when (viewType) {

            TYPE_POST -> {
                val view = LayoutInflater.from(parent.context)
                    .inflate(R.layout.item_post, parent, false)

                // ⭐ Correct way to instantiate an INNER CLASS:
                internalPostAdapter.PostViewHolder(view)
            }

            TYPE_AD -> {
                val view = LayoutInflater.from(parent.context)
                    .inflate(R.layout.item_ad_post, parent, false)
                AdsViewHolder(view)
            }

            else -> error("Invalid viewType")
        }
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {

        when (val item = items[position]) {

            is Post -> {
                postAdapterCallbacks.bind(holder as PostAdapter.PostViewHolder, item, position)
            }

            is AdModel -> {
                adAdapterCallbacks.bind(holder as AdsViewHolder, item)
            }
        }
    }

    override fun getItemCount() = items.size
}


/* --------------------------------------------------------
   ADS VIEW HOLDER — EXACT MATCH TO XML
   -------------------------------------------------------- */
class AdsViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {

    val adSponsorLabel: TextView = itemView.findViewById(R.id.adSponsorLabel)
    val adTitle: TextView = itemView.findViewById(R.id.adTitle)

    val adImageThumbnail: ImageView = itemView.findViewById(R.id.adImageThumbnail)
    val adVideoThumbnail: ImageView = itemView.findViewById(R.id.adVideoThumbnail)

    val adPlayerView: PlayerView = itemView.findViewById(R.id.adPlayerView)
    val adPlayButton: ImageButton = itemView.findViewById(R.id.adPlayButton)

    val adCTAButton: Button = itemView.findViewById(R.id.adCTAButton)
    val adWatchRewardButton: Button = itemView.findViewById(R.id.adWatchRewardButton)
}


/* --------------------------------------------------------
   CALLBACK INTERFACES
   -------------------------------------------------------- */
interface PostAdapterCallbacks {
    fun bind(holder: PostAdapter.PostViewHolder, post: Post, position: Int)
}

interface AdAdapterCallbacks {
    fun bind(holder: AdsViewHolder, ad: AdModel)
}
