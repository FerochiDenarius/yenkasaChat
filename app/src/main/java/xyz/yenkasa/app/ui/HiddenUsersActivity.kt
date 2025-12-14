package xyz.yenkasa.app.ui

import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import xyz.yenkasa.app.R
import xyz.yenkasa.app.adapter.BlockedUsersAdapter
import xyz.yenkasa.app.network.ApiClient
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import xyz.yenkasa.app.model.BlockedUserModel

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

        ApiClient.apiService.getHiddenUsers()
            .enqueue(object : Callback<List<BlockedUserModel>> {

                override fun onResponse(
                    call: Call<List<BlockedUserModel>>,
                    response: Response<List<BlockedUserModel>>
                ) {
                    if (response.isSuccessful && response.body() != null) {
                        adapter.update(response.body()!!)
                    }
                }

                override fun onFailure(
                    call: Call<List<BlockedUserModel>>,
                    t: Throwable
                ) {
                    Toast.makeText(
                        this@HiddenUsersActivity,
                        "Failed to load",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }
}
