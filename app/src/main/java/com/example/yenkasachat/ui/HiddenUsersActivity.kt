package com.example.yenkasachat.ui

import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.yenkasachat.R
import com.example.yenkasachat.adapter.BlockedUsersAdapter
import com.example.yenkasachat.network.ApiClient
import kotlinx.coroutines.launch

class HiddenUsersActivity : AppCompatActivity() {

    private lateinit var adapter: BlockedUsersAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_blocked_users)

        val rv = findViewById<androidx.recyclerview.widget.RecyclerView>(R.id.rvBlockedUsers)
        rv.layoutManager = LinearLayoutManager(this)
        adapter = BlockedUsersAdapter(mutableListOf())
        rv.adapter = adapter

        loadHiddenUsers()
    }

    private fun loadHiddenUsers() {
        lifecycleScope.launch {
            try {
                val res = ApiClient.apiService.getHiddenUsers()
                if (res.isSuccessful && res.body() != null) {
                    adapter.update(res.body()!!)
                }
            } catch (e: Exception) {
                Toast.makeText(this@HiddenUsersActivity, "Failed to load", Toast.LENGTH_SHORT).show()
            }
        }
    }
}
