package xyz.yenkasa.app.ui

import android.media.MediaPlayer
import android.content.res.ColorStateList
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.bumptech.glide.Glide
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.FollowResponse
import xyz.yenkasa.app.model.Post
import xyz.yenkasa.app.model.TrackAdViewResponse
import xyz.yenkasa.app.model.ViewResponse
import xyz.yenkasa.app.model.ViewRequest
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.network.SocketManager
import xyz.yenkasa.app.ui.player.YenkasaVideoPlayerView
import xyz.yenkasa.app.util.TextPostBackgrounds
import xyz.yenkasa.app.util.TokenManager
import xyz.yenkasa.app.util.WalletBalanceManager
import xyz.yenkasa.app.yme.YmeAnalyticsManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.RewardItem
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback
import com.google.android.material.floatingactionbutton.FloatingActionButton
import androidx.core.content.ContextCompat
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import xyz.yenkasa.app.BuildConfig




class ViewActivity : AppCompatActivity() {

    companion object {
        private const val TEST_REWARDED_AD_UNIT_ID = "ca-app-pub-3940256099942544/5224354917"
        // Replace with your real rewarded ad unit when available.
        private const val RELEASE_REWARDED_AD_UNIT_ID = ""
    }

    private lateinit var textUsername: TextView
    private lateinit var textCaption: TextView
    private lateinit var textViews: TextView
    private lateinit var imageContent: ImageView
    private lateinit var videoContent: YenkasaVideoPlayerView
    private lateinit var audioIcon: ImageView
    private lateinit var mediaContainer: FrameLayout
    private lateinit var textBackgroundPost: TextView
    private lateinit var fabFollow: FloatingActionButton
    private var rewardedAd: RewardedAd? = null


    private var post: Post? = null
    private var token: String? = null
    private var mediaPlayer: MediaPlayer? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_view_post)

        textUsername = findViewById(R.id.textUsername)
        textCaption = findViewById(R.id.textCaption)
        textViews = findViewById(R.id.textViews)

        imageContent = findViewById(R.id.imageMedia)
        videoContent = findViewById(R.id.videoContent)
        audioIcon = findViewById(R.id.audioIcon)
        mediaContainer = findViewById(R.id.mediaContainer)
        textBackgroundPost = findViewById(R.id.textBackgroundPost)
        fabFollow = findViewById(R.id.fabFollow)

        token = TokenManager.getToken(this)
        post = intent.getParcelableExtra("POST_DATA")

        if (post == null) {
            Log.e("ViewActivity", "❌ No post data found in intent.")
            finish()
            return
        }

        setupUI()
        SocketManager.ensureConnected(TokenManager.getUserId(this))
        setupSocketListener()
    }

    private fun setupUI() {
        textUsername.text = post?.userId?.username ?: getString(R.string.unknown_user)
        textCaption.text = post?.caption ?: ""
        fetchTotalViews()

        val authorId = post?.userId?.id
        fabFollow.visibility = if (authorId.isNullOrBlank() || authorId == TokenManager.getUserId(this)) {
            View.GONE
        } else {
            View.VISIBLE
        }
        fabFollow.setOnClickListener { followPostAuthor() }

        imageContent.visibility = View.GONE
        videoContent.visibility = View.GONE
        audioIcon.visibility = View.GONE
        textBackgroundPost.visibility = View.GONE
        mediaContainer.visibility = View.GONE

        val hasImage = !post?.imageUrl.isNullOrEmpty()
        val hasVideo = !post?.videoUrl.isNullOrEmpty()
        val hasAudio = !post?.audioUrl.isNullOrEmpty()
        val hasMedia = hasImage || hasVideo || hasAudio
        val hasTextBackground = !hasMedia &&
            !post?.caption.isNullOrBlank() &&
            TextPostBackgrounds.normalize(post?.textBackgroundColor).isNotBlank()

        textCaption.visibility = if (post?.caption.isNullOrBlank() || hasTextBackground) {
            View.GONE
        } else {
            View.VISIBLE
        }

        if (hasTextBackground) {
            mediaContainer.visibility = View.VISIBLE
            textBackgroundPost.visibility = View.VISIBLE
            textBackgroundPost.text = post?.caption.orEmpty()
            TextPostBackgrounds.apply(textBackgroundPost, post?.textBackgroundColor.orEmpty())
            lifecycleScope.launch { recordViewWithDuration(3) }
        }

        when {
            hasImage -> {
                mediaContainer.visibility = View.VISIBLE
                imageContent.visibility = View.VISIBLE
                Glide.with(this)
                    .load(post?.imageUrl)
                    .placeholder(R.drawable.placeholder)
                    .into(imageContent)
                // Record immediately for image view
                lifecycleScope.launch { recordViewWithDuration(3) }
            }
            hasVideo -> {
                mediaContainer.visibility = View.VISIBLE
                videoContent.visibility = View.VISIBLE
                setupVideoView(post?.optimizedVideoUrl() ?: post?.videoUrl)
            }
            hasAudio -> {
                mediaContainer.visibility = View.VISIBLE
                audioIcon.visibility = View.VISIBLE
                audioIcon.setImageResource(R.drawable.ic_audio)
                try {
                    val uri = Uri.parse(post?.audioUrl)
                    mediaPlayer = MediaPlayer.create(this, uri)
                    mediaPlayer?.start()
                    // Record after a few seconds of audio play
                    lifecycleScope.launch {
                        delay(5000)
                        recordViewWithDuration(5)
                    }
                } catch (e: Exception) {
                    Log.e("ViewActivity", "🎧 Error playing audio: ${e.message}")
                }
            }
        }
    }

    private fun followPostAuthor() {
        val rawToken = token ?: TokenManager.getToken(this)
        val author = post?.userId ?: return

        if (rawToken.isNullOrBlank()) {
            Toast.makeText(this, R.string.please_log_in_first, Toast.LENGTH_SHORT).show()
            return
        }

        if (author.id.isBlank() || author.id == TokenManager.getUserId(this)) {
            return
        }

        val authToken = if (rawToken.startsWith("Bearer")) rawToken else "Bearer $rawToken"
        fabFollow.isEnabled = false

        ApiClient.apiService.followUser(author.id, authToken)
            .enqueue(object : Callback<FollowResponse> {
                override fun onResponse(call: Call<FollowResponse>, response: Response<FollowResponse>) {
                    fabFollow.isEnabled = true
                    val body = response.body()
                    if (response.isSuccessful && body != null) {
                        WalletBalanceManager.refreshAfterReward(this@ViewActivity, body.coinsRewarded)
                        YmeAnalyticsManager.trackRewardClaim(
                            source = "follow_reward",
                            rewardType = "follow",
                            amount = body.coinsRewarded?.toDouble(),
                            targetId = author.id
                        )
                        fabFollow.setImageResource(R.drawable.ic_check)
                        fabFollow.backgroundTintList =
                            ColorStateList.valueOf(ContextCompat.getColor(this@ViewActivity, R.color.yenkasa_black))
                        fabFollow.imageTintList =
                            ColorStateList.valueOf(ContextCompat.getColor(this@ViewActivity, R.color.yenkasa_amber))
                        fabFollow.isEnabled = false
                        Toast.makeText(this@ViewActivity, body.message, Toast.LENGTH_SHORT).show()
                    } else {
                        Toast.makeText(
                            this@ViewActivity,
                            getString(R.string.could_not_follow_user, author.username),
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }

                override fun onFailure(call: Call<FollowResponse>, t: Throwable) {
                    fabFollow.isEnabled = true
                    Toast.makeText(
                        this@ViewActivity,
                        getString(R.string.network_error_with_message, t.message ?: getString(R.string.unknown_error)),
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }

    private fun setupVideoView(url: String?) {
        videoContent.bindVideo(
            mediaUrl = url,
            thumbnailUrl = post?.optimizedVideoPosterUrl(),
            autoplay = true,
            muted = false,
            loop = true
        )
        videoContent.setCheckpointListener { seconds ->
            if (seconds >= 10) {
                lifecycleScope.launch { recordViewWithDuration(seconds) }
            }
        }
    }

    // ✅ Record view with duration and reward support
    private suspend fun recordViewWithDuration(durationSeconds: Int) {
        val currentPostId = post?._id ?: return
        val rawToken = token ?: return

        val authToken = if (rawToken.startsWith("Bearer")) rawToken else "Bearer $rawToken"

        try {
            val payload = ViewRequest(
                watchDuration = durationSeconds,
                mediaType =
                    when {
                        !post?.videoUrl.isNullOrEmpty() -> "video"
                        !post?.audioUrl.isNullOrEmpty() -> "audio"
                        !post?.imageUrl.isNullOrEmpty() -> "image"
                        else -> "text"
                    }
            )


            Log.d(
                "ViewActivity",
                "📡 Sending view record → Post: $currentPostId | Duration: ${durationSeconds}s"
            )

            val response = ApiClient.apiService.recordView(
                postId = currentPostId,
                token = authToken,
                viewData = payload
            )

            withContext(Dispatchers.Main) {
                if (response.isSuccessful) {
                    val body = response.body()
                    if (body != null && body.success) {
                        textViews.text = getString(R.string.views_count, body.viewsCount)
                        // Push update also to feed list when user returns
                        post?.viewCount = body.viewsCount
                        WalletBalanceManager.refreshAfterReward(
                            this@ViewActivity,
                            body.rewardAmount ?: body.rewardTransaction?.amount
                        )
                        YmeAnalyticsManager.trackRewardClaim(
                            source = "post_view_reward",
                            rewardType = body.rewardType,
                            amount = body.rewardAmount ?: body.rewardTransaction?.amount,
                            postId = currentPostId
                        )

                        Log.d(
                            "ViewActivity",
                            "✅ View recorded (${durationSeconds}s, Reward: ${body.rewardAmount})"
                        )
                    } else {
                        Log.w("ViewActivity", "⚠️ View response error: ${body?.message}")
                    }
                } else {
                    Log.w(
                        "ViewActivity",
                        "⚠️ Failed to record view: ${response.errorBody()?.string()}"
                    )
                }
            }
        } catch (e: Exception) {
            Log.e("ViewActivity", "❌ Error recording view: ${e.message}")
        }
    }

    private fun loadRewardedAd() {
        val adRequest = AdRequest.Builder().build()
        val adUnitId = if (BuildConfig.DEBUG) {
            TEST_REWARDED_AD_UNIT_ID
        } else {
            RELEASE_REWARDED_AD_UNIT_ID
        }

        if (BuildConfig.DEBUG) {
            Log.d("AdMob", "Using rewarded ad unit: $adUnitId")
        }

        if (adUnitId.isBlank()) {
            Log.w("Ads", "No production rewarded ad unit configured; skipping rewarded ad load.")
            rewardedAd = null
            return
        }

        RewardedAd.load(
            this,
            adUnitId,
            adRequest,
            object : RewardedAdLoadCallback() {
                override fun onAdFailedToLoad(adError: LoadAdError) {
                    rewardedAd = null
                    Log.e("Ads", "Failed to load rewarded ad: ${adError.message}")
                }

                override fun onAdLoaded(ad: RewardedAd) {
                    rewardedAd = ad
                    Log.d("Ads", "Rewarded ad loaded")
                }
            }
        )
    }

    private fun showRewardedAd() {
        rewardedAd?.show(this) { rewardItem: RewardItem ->
            Log.d("Ads", "User earned reward: ${rewardItem.amount}")
            YmeAnalyticsManager.trackRewardClaim(
                source = "rewarded_ad",
                rewardType = rewardItem.type,
                amount = rewardItem.amount.toDouble(),
                postId = post?._id
            )

            // 🔥 Track the ad view in your backend
            trackAdView()
        } ?: run {
            Log.d("Ads", "Rewarded ad not ready")
        }
    }

    private fun trackAdView() {
        val token = TokenManager.getToken(this) ?: return

        ApiClient.apiService.trackAdView("Bearer $token")
            .enqueue(object : Callback<TrackAdViewResponse> {
                override fun onResponse(
                    call: Call<TrackAdViewResponse>,
                    response: Response<TrackAdViewResponse>
                ) {
                    Log.d("Ads", "Ad tracked successfully on backend")
                }

                override fun onFailure(call: Call<TrackAdViewResponse>, t: Throwable) {
                    Log.e("Ads", "Failed to track ad: ${t.message}")
                }
            })
    }

    private fun fetchTotalViews() {
        val currentPostId = post?._id ?: return
        val authToken = token ?: return

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val response = ApiClient.apiService.getTotalViews(currentPostId, "Bearer $authToken")
                if (response.isSuccessful) {
                    val body: ViewResponse? = response.body()
                    withContext(Dispatchers.Main) {
                        if (body != null && body.success) {
                            textViews.text = getString(R.string.views_count, body.viewsCount)
                            Log.d("ViewActivity", "👁️ Total views fetched: ${body.viewsCount}")
                        } else {
                            Log.w("ViewActivity", "⚠️ Fetch views response: ${body?.message}")
                        }
                    }
                } else {
                    Log.w("ViewActivity", "⚠️ Fetch views failed: ${response.errorBody()?.string()}")
                }
            } catch (e: Exception) {
                Log.e("ViewActivity", "❌ Error fetching total views: ${e.message}")
            }
        }
    }

    private fun setupSocketListener() {
        SocketManager.on("viewUpdate") { data ->
            try {
                val json = data as JSONObject
                val postId = json.getString("postId")
                val viewsCount = json.getInt("viewsCount")

                if (postId == post?._id) {
                    runOnUiThread {
                        textViews.text = getString(R.string.views_count, viewsCount)
                        Log.d("ViewActivity", "👁️ Live view update → $viewsCount views")
                    }
                }
            } catch (e: Exception) {
                Log.e("ViewActivity", "Error parsing viewUpdate: ${e.message}")
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        mediaPlayer?.release()
        SocketManager.off("viewUpdate")
    }
}
