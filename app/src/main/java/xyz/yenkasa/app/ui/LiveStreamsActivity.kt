package xyz.yenkasa.app.ui

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import xyz.yenkasa.app.R

class LiveStreamsActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_live_streams)
        if (savedInstanceState == null) {
            supportFragmentManager.beginTransaction()
                .replace(R.id.liveStreamsContainer, LiveStreamsFragment())
                .commit()
        }
    }
}
