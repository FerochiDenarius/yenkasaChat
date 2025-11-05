package com.example.yenkasachat.ui

import android.os.Bundle
import android.util.Log
import android.widget.ImageView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.bumptech.glide.Glide
import com.example.yenkasachat.R
import com.example.yenkasachat.model.Post
import com.example.yenkasachat.model.ViewResponse
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.network.SocketManager
import com.example.yenkasachat.util.TokenManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

class ViewActivity : AppCompatActivity() {

    private lateinit var textUsername: TextView
    private lateinit var textCaption: TextView
    private lateinit var textViews: TextView
    private lateinit var imageMedia: ImageView

    private var post: Post? = null
    private var token: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_view_post)

        textUsername = findViewById(R.id.textUsername)
        textCaption = findViewById(R.id.textCaption)
        textViews = findViewById(R.id.textViews)
        imageMedia = findViewById(R.id.imageMedia)

        token = TokenManager.getToken(this)

        // ✅ Get post object passed via Intent
        post = intent.getParcelableExtra("POST_DATA")

        if (post == null) {
            Log.e("ViewActivity", "❌ No post data found in intent.")
            finish()
            return
        }

        setupUI()
        recordView()
        setupSocketListener()
    }

    private fun setupUI() {
        textUsername.text = post?.userId?.username ?: "Unknown"
        textCaption.text = post?.caption ?: ""

        textViews.text = "👁️ ${post?.viewCount ?: 0}"

        post?.mediaUrl?.let {
            Glide.with(this)
                .load(it)
                .placeholder(R.drawable.placeholder)
                .into(imageMedia)
        }
    }

    // ✅ Record unique view via API
    private fun recordView() {
        val currentPostId = post?._id ?: return
        val authToken = token ?: return

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val response = ApiClient.apiService.recordView(currentPostId, "Bearer $authToken")
                if (response.isSuccessful) {
                    val body: ViewResponse? = response.body()
                    withContext(Dispatchers.Main) {
                        if (body != null && body.success) {
                            textViews.text = "👁️ ${body.viewsCount}"
                            Log.d("ViewActivity", "✅ View recorded successfully for $currentPostId")
                        } else {
                            Log.w("ViewActivity", "⚠️ View record response: ${body?.message}")
                        }
                    }
                } else {
                    Log.w("ViewActivity", "⚠️ View record failed: ${response.errorBody()?.string()}")
                }
            } catch (e: Exception) {
                Log.e("ViewActivity", "❌ Error recording view: ${e.message}")
            }
        }
    }

    // ⚡ Listen for live view count updates
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
        SocketManager.off("viewUpdate")
    }
}
