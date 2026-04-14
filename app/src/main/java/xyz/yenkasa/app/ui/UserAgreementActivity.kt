// UserAgreementActivity.kt
package xyz.yenkasa.app.ui

import android.os.Bundle
import android.webkit.WebView
import androidx.appcompat.app.AppCompatActivity
import xyz.yenkasa.app.R
import xyz.yenkasa.app.util.AppUrls

class UserAgreementActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_user_agreement)

        val webView: WebView = findViewById(R.id.webView)
        webView.settings.javaScriptEnabled = false
        webView.loadUrl(AppUrls.userAgreement)
        // or "file:///android_asset/user_agreement.html"
    }
}
