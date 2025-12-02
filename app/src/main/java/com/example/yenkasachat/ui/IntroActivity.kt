package com.example.yenkasachat.ui

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.view.animation.AnimationUtils
import androidx.appcompat.app.AppCompatActivity
import android.widget.Button
import com.example.yenkasachat.R

class IntroActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activityintro)

        val buttonGetStarted = findViewById<Button>(R.id.btnGetStarted)
        buttonGetStarted.setOnClickListener {
            startActivity(Intent(this, LoginActivity::class.java))
            overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
            finish()
        }

        // Fade in animations
        val fade = AnimationUtils.loadAnimation(this, R.anim.fade_in)

        findViewById<View>(R.id.ivLogo).startAnimation(fade)
        findViewById<View>(R.id.tvTitle).startAnimation(fade)
        findViewById<View>(R.id.tvTagline).startAnimation(fade)
        findViewById<View>(R.id.lottieIntro).startAnimation(fade)
        findViewById<View>(R.id.ivIllustration).startAnimation(fade)
    }
}
