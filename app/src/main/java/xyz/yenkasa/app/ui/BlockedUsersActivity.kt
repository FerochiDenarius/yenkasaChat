package xyz.yenkasa.app.ui

import android.os.Bundle
import android.view.View
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import xyz.yenkasa.app.R
import xyz.yenkasa.app.adapter.BlockedUsersAdapter
import xyz.yenkasa.app.model.BlockedUserModel
import xyz.yenkasa.app.network.ApiClient
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import xyz.yenkasa.app.util.TokenManager


class BlockedUsersActivity : AppCompatActivity() {

    private lateinit var adapter: BlockedUsersAdapter
    private lateinit var emptyText: TextView
    private lateinit var progress: ProgressBar
    private var token: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_blocked_users)

        token = TokenManager.getToken(this)

        val rv = findViewById<androidx.recyclerview.widget.RecyclerView>(R.id.rvBlockedUsers)
        emptyText = findViewById(R.id.txtEmpty)
        progress = findViewById(R.id.progressBar)

        rv.layoutManager = LinearLayoutManager(this)
        adapter = BlockedUsersAdapter(mutableListOf())
        rv.adapter = adapter

        loadBlockedUsers()
    }


    private fun loadBlockedUsers() {
        progress.visibility = View.VISIBLE
        emptyText.visibility = View.GONE

        ApiClient.apiService.getBlockedUsers("Bearer $token")
            .enqueue(object : Callback<List<BlockedUserModel>> {

                override fun onResponse(
                    call: Call<List<BlockedUserModel>>,
                    response: Response<List<BlockedUserModel>>
                ) {
                    progress.visibility = View.GONE

                    if (!response.isSuccessful || response.body() == null) {
                        emptyText.visibility = View.VISIBLE
                        emptyText.text = "Failed to load blocked users"
                        return
                    }

                    val list = response.body()!!
                    if (list.isEmpty()) {
                        emptyText.visibility = View.VISIBLE
                        emptyText.text = "No blocked users"
                    } else {
                        emptyText.visibility = View.GONE
                    }

                    adapter.update(list)
                }

                override fun onFailure(call: Call<List<BlockedUserModel>>, t: Throwable) {
                    progress.visibility = View.GONE
                    emptyText.visibility = View.VISIBLE
                    emptyText.text = "Connection error"
                }
            })
    }
}
