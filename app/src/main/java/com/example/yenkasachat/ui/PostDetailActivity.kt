package com.example.yenkasachat.ui

import android.os.Bundle
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.example.yenkasachat.R

class PostDetailActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_post_detail) // You'll need to create this layout file

        // Retrieve the post ID passed from FeedActivity
        val postId = intent.getStringExtra("POST_ID")

        if (postId == null) {
            Toast.makeText(this, "Error: Post ID not found.", Toast.LENGTH_LONG).show()
            finish() // Close the activity if there's no ID
            return
        }

        // Now you can use the postId to fetch and display the post details
        // For example, display it in a TextView
        val detailTextView: TextView = findViewById(R.id.textPostDetailContent)
        detailTextView.text = "Loading details for post: $postId"

        // TODO: Add your logic here to fetch the full post from your API using the postId
    }
}
