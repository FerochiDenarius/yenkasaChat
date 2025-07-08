package com.example.yenkasachat.ui

import android.os.Bundle
import android.widget.ImageView
import androidx.appcompat.app.AppCompatActivity
import com.bumptech.glide.Glide
import com.example.yenkasachat.R

class ImagePreviewActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_image_preview)

        val imageUrl = intent.getStringExtra("imageUrl")
        val imageView = findViewById<ImageView>(R.id.fullscreenImageView)

        if (imageView == null) {
            finish() // Defensive: crash protection
            return
        }

        if (!imageUrl.isNullOrEmpty()) {
            Glide.with(this)
                .load(imageUrl)
                .placeholder(R.drawable.placeholder_image)
                .error(R.drawable.error_image)
                .into(imageView)
        } else {
            finish() // Defensive: no image to show
        }

        // Tap to close
        imageView.setOnClickListener {
            finish()
        }
    }
}
