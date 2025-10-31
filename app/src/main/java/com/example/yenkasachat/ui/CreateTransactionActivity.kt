package com.example.yenkasachat.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import com.example.yenkasachat.R

class CreateTransactionActivity : AppCompatActivity() {

    private lateinit var tvWalletId: TextView
    private lateinit var btnCopyWalletId: Button
    private lateinit var etRecipientId: EditText
    private lateinit var etAmount: EditText
    private lateinit var btnSend: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_create_transaction)

        // Initialize views from XML
        tvWalletId = findViewById(R.id.tvWalletId)
        btnCopyWalletId = findViewById(R.id.btnCopyWalletId)
        etRecipientId = findViewById(R.id.etRecipientId)
        etAmount = findViewById(R.id.etAmount)
        btnSend = findViewById(R.id.btnSend)

        // Get action type from intent (send or receive)
        val action = intent.getStringExtra("action")

        // Adjust visibility depending on action
        if (action == "receive") {
            etRecipientId.visibility = View.GONE
            etAmount.visibility = View.GONE
            btnSend.visibility = View.GONE
        }

        // Copy wallet ID button
        btnCopyWalletId.setOnClickListener {
            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            val clip = ClipData.newPlainText("Wallet ID", tvWalletId.text.toString())
            clipboard.setPrimaryClip(clip)
            Toast.makeText(this, "Wallet ID copied to clipboard", Toast.LENGTH_SHORT).show()
        }

        // Send coins button
        btnSend.setOnClickListener {
            val recipientId = etRecipientId.text.toString().trim()
            val amount = etAmount.text.toString().trim()

            if (recipientId.isEmpty() || amount.isEmpty()) {
                Toast.makeText(this, "Please fill in all fields", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            // TODO: Replace with your real Retrofit call to send coins
            Toast.makeText(this, "Sending $amount coins to $recipientId", Toast.LENGTH_SHORT).show()
        }
    }
}
