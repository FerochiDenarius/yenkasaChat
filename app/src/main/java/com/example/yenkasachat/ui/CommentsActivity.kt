package com.example.yenkasachat.ui

import android.os.Bundle
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.yenkasachat.R
import com.example.yenkasachat.adapter.CommentAdapter
import com.example.yenkasachat.model.Comment
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class CommentsActivity : AppCompatActivity() {

    private lateinit var recyclerComments: RecyclerView
    private lateinit var editComment: EditText
    private lateinit var buttonSend: ImageButton
    private lateinit var adapter: CommentAdapter
    private val comments = mutableListOf<Comment>()
    private var postId: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_comments)

        recyclerComments = findViewById(R.id.recyclerComments)
        editComment = findViewById(R.id.editComment)
        buttonSend = findViewById(R.id.buttonSend)

        // ✅ FIX: Pass both context and comments to match CommentAdapter constructor
        adapter = CommentAdapter(this, comments)
        recyclerComments.layoutManager = LinearLayoutManager(this)
        recyclerComments.adapter = adapter

        postId = intent.getStringExtra("POST_ID")

        if (postId.isNullOrEmpty()) {
            Toast.makeText(this, "Post not found", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        loadComments()

        buttonSend.setOnClickListener {
            val text = editComment.text.toString().trim()
            if (text.isEmpty()) {
                Toast.makeText(this, "Enter a comment", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            postComment(text)
        }
    }

    private fun loadComments() {
        val token = TokenManager.getToken(this)
        if (token.isNullOrEmpty()) {
            Toast.makeText(this, "Please log in first", Toast.LENGTH_SHORT).show()
            return
        }

        ApiClient.apiService.getComments("Bearer $token", postId!!)
            .enqueue(object : Callback<List<Comment>> {
                override fun onResponse(call: Call<List<Comment>>, response: Response<List<Comment>>) {
                    if (response.isSuccessful) {
                        comments.clear()
                        response.body()?.let { comments.addAll(it.reversed()) }
                        adapter.notifyDataSetChanged()
                    } else {
                        Toast.makeText(this@CommentsActivity, "Failed to load comments", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<List<Comment>>, t: Throwable) {
                    Toast.makeText(this@CommentsActivity, "Network error: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun postComment(text: String) {
        val token = TokenManager.getToken(this)
        if (token.isNullOrEmpty()) {
            Toast.makeText(this, "Please log in first", Toast.LENGTH_SHORT).show()
            return
        }

        ApiClient.apiService.addComment("Bearer $token", postId!!, mapOf("text" to text))
            .enqueue(object : Callback<Comment> {
                override fun onResponse(call: Call<Comment>, response: Response<Comment>) {
                    if (response.isSuccessful) {
                        response.body()?.let {
                            comments.add(it) // instead of comments.add(0, it)
                            adapter.notifyItemInserted(comments.size - 1)
                            recyclerComments.scrollToPosition(comments.size - 1)
                            editComment.text.clear()
                        }
                    } else {
                        Toast.makeText(this@CommentsActivity, "Failed to post comment", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<Comment>, t: Throwable) {
                    Toast.makeText(this@CommentsActivity, "Network error: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }
}
