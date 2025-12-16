package xyz.yenkasa.app.ui

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import xyz.yenkasa.app.R
import android.widget.Button
import xyz.yenkasa.app.util.TokenManager

class IntroActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activityintro)

        val buttonGetStarted = findViewById<Button>(R.id.btnGetStarted)
        buttonGetStarted.setOnClickListener {
            TokenManager.markFirstLaunchCompleted(this)
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
        }
    }


}
