package xyz.yenkasa.app.ui

import android.media.MediaPlayer
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.ImageView
import android.widget.TextView
import android.widget.VideoView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.bumptech.glide.Glide
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.Post
import xyz.yenkasa.app.model.TrackAdViewResponse
import xyz.yenkasa.app.model.ViewResponse
import xyz.yenkasa.app.model.ViewRequest
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.network.SocketManager
import xyz.yenkasa.app.util.TokenManager
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
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response




class ViewActivity : AppCompatActivity() {

    private lateinit var textUsername: TextView
    private lateinit var textCaption: TextView
    private lateinit var textViews: TextView
    private lateinit var imageContent: ImageView
    private lateinit var videoContent: VideoView
    private lateinit var audioIcon: ImageView
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

        token = TokenManager.getToken(this)
        post = intent.getParcelableExtra("POST_DATA")

        if (post == null) {
            Log.e("ViewActivity", "❌ No post data found in intent.")
            finish()
            return
        }

        setupUI()
        setupSocketListener()
    }

    private fun setupUI() {
        textUsername.text = post?.userId?.username ?: "Unknown"
        textCaption.text = post?.caption ?: ""
        fetchTotalViews()

        imageContent.visibility = View.GONE
        videoContent.visibility = View.GONE
        audioIcon.visibility = View.GONE

        when {
            !post?.imageUrl.isNullOrEmpty() -> {
                imageContent.visibility = View.VISIBLE
                Glide.with(this)
                    .load(post?.imageUrl)
                    .placeholder(R.drawable.placeholder)
                    .into(imageContent)
                // Record immediately for image view
                lifecycleScope.launch { recordViewWithDuration(3) }
            }
            !post?.videoUrl.isNullOrEmpty() -> {
                videoContent.visibility = View.VISIBLE
                setupVideoView(Uri.parse(post?.videoUrl))
            }
            !post?.audioUrl.isNullOrEmpty() -> {
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

    private fun setupVideoView(uri: Uri) {
        videoContent.setVideoURI(uri)
        videoContent.setOnPreparedListener { player ->
            player.isLooping = true
            videoContent.start()

            var watchSeconds = 0
            val rewardThreshold = 10
            var rewarded = false

            lifecycleScope.launch(Dispatchers.IO) {
                while (videoContent.isPlaying) {
                    delay(1000)
                    watchSeconds++
                    if (watchSeconds >= rewardThreshold && !rewarded) {
                        rewarded = true
                        recordViewWithDuration(watchSeconds)
                    }
                }
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
                        textViews.text = "👁️ ${body.viewsCount}"
                        // Push update also to feed list when user returns
                        post?.viewCount = body.viewsCount

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

        RewardedAd.load(
            this,
            "ca-app-pub-3940256099942544/5224354917", // TEST Rewarded Ad ID
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
                            textViews.text = "👁️ ${body.viewsCount}"
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
                        textViews.text = "👁️ $viewsCount"
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
