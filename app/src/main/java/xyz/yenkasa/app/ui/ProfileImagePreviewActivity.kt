package xyz.yenkasa.app.ui

import android.os.Bundle
import android.widget.ImageView
import androidx.appcompat.app.AppCompatActivity
import com.bumptech.glide.Glide
import xyz.yenkasa.app.R

class ProfileImagePreviewActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_profile_image_preview)

        val imageView = findViewById<ImageView>(R.id.imageProfilePreview)
        val imageUrl = intent.getStringExtra("IMAGE_URL")

        Glide.with(this)
            .load(imageUrl)
            .placeholder(R.drawable.ic_profile_placeholder)
            .error(R.drawable.ic_profile_placeholder)
            .into(imageView)

        // Close preview on tap
        imageView.setOnClickListener {
            finish()
        }
    }
}
