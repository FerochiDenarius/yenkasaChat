package xyz.yenkasa.app.ui

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import xyz.yenkasa.app.R

class VerificationSuccessActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_verification_success)

        findViewById<Button>(R.id.btnVerificationGoDashboard).setOnClickListener {
            startActivity(
                Intent(this, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                    putExtra("openFragment", "feed")
                }
            )
            finish()
        }

        findViewById<TextView>(R.id.btnVerificationGoWallet).setOnClickListener {
            startActivity(Intent(this, CoinWalletActivity::class.java))
        }
    }
}
