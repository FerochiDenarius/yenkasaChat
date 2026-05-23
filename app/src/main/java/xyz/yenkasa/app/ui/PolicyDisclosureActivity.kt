package xyz.yenkasa.app.ui

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import xyz.yenkasa.app.R
import xyz.yenkasa.app.util.AppLinkManager
import xyz.yenkasa.app.util.AppLocalStore
import xyz.yenkasa.app.util.AppUrls

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
            openWeb(AppUrls.privacyPolicy)
        }

        terms.setOnClickListener {
            openWeb(AppUrls.userAgreement)
        }

        guidelines.setOnClickListener {
            openWeb(AppUrls.communityGuidelines)
        }

        safety.setOnClickListener {
            openWeb(AppUrls.safetyPolicy)
        }

        ads.setOnClickListener {
            openWeb(AppUrls.adsDisclosure)
        }

        val btnAccept: Button = findViewById(R.id.btnAccept)
        btnAccept.setOnClickListener {
            AppLocalStore.setPoliciesAccepted(this)

            // Send user to main home page
            val mainIntent = Intent(this, MainActivity::class.java)
            AppLinkManager.copyPendingDeepLink(intent, mainIntent)
            startActivity(mainIntent)
            finish()
        }
    }

    private fun openWeb(url: String) {
        val intent = Intent(this, WebViewActivity::class.java)
        intent.putExtra("url", url)
        startActivity(intent)
    }
}
