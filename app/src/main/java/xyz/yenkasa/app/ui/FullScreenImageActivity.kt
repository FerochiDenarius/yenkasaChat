package xyz.yenkasa.app.ui

import android.os.Bundle
import android.widget.Toast
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import com.bumptech.glide.Glide
import xyz.yenkasa.app.R
import com.github.chrisbanes.photoview.PhotoView
import xyz.yenkasa.app.util.EdgeToEdgeInsets

class FullscreenImageActivity : AppCompatActivity() {

    private lateinit var photoView: PhotoView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_fullscreen_image)

        photoView = findViewById(R.id.photoView)

        val imageUrl = intent.getStringExtra("IMAGE_URL")
        if (imageUrl.isNullOrEmpty()) {
            Toast.makeText(this, "No image to display", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        // Load image
        Glide.with(this)
            .load(imageUrl)
            .placeholder(R.drawable.placeholder)
            .error(R.drawable.placeholder)
            .into(photoView)

        // Optional: tap anywhere to exit fullscreen
        photoView.setOnViewTapListener { _, _, _ ->
            finish()
        }
    }

    // Optional: hide system UI for true fullscreen
    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            EdgeToEdgeInsets.hideSystemBars(this)
        }
    }
}
