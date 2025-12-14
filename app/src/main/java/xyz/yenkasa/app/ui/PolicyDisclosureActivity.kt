package xyz.yenkasa.app.ui

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import xyz.yenkasa.app.R
import xyz.yenkasa.app.util.PreferenceManager

class PolicyDisclosureActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_policy_disclosure)

        val privacy: TextView = findViewById(R.id.linkPrivacy)
        val terms: TextView = findViewById(R.id.linkTerms)
        val guidelines: TextView = findViewById(R.id.linkGuidelines)
        val safety: TextView = findViewById(R.id.linkSafety)
        val ads: TextView = findViewById(R.id.linkAds)

        // Open WebViews
        privacy.setOnClickListener {
            openWeb("https://yenkasa.xyz/privacy-policy.html")
        }

        terms.setOnClickListener {
            openWeb("https://yenkasa.xyz/user-agreement.html")
        }

        guidelines.setOnClickListener {
            openWeb("https://yenkasa.xyz/community-guidelines.html")
        }

        safety.setOnClickListener {
            openWeb("https://yenkasa.xyz/safety-policy.html")
        }

        ads.setOnClickListener {
            openWeb("https://yenkasa.xyz/ads-disclosure.html")
        }

        val btnAccept: Button = findViewById(R.id.btnAccept)
        btnAccept.setOnClickListener {
            PreferenceManager.setPoliciesAccepted(this, true)

            // Send user to main home page
            startActivity(Intent(this, MainActivity::class.java))
            finish()
        }
    }

    private fun openWeb(url: String) {
        val intent = Intent(this, WebViewActivity::class.java)
        intent.putExtra("url", url)
        startActivity(intent)
    }
}
