package xyz.yenkasa.app.ui

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity

class GroupChatActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        startActivity(Intent(this, ChatActivity::class.java).apply {
            putExtras(intent)
            putExtra("isGroupChat", true)
        })
        finish()
    }
}
