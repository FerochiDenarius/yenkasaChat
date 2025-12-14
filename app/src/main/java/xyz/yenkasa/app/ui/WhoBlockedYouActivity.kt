package xyz.yenkasa.app.ui

import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import xyz.yenkasa.app.R
import xyz.yenkasa.app.adapter.BlockedUsersAdapter
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.model.BlockedUserModel
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class WhoBlockedYouActivity : AppCompatActivity() {

    private lateinit var adapter: BlockedUsersAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_blocked_users) // reuse same layout

        val rv = findViewById<androidx.recyclerview.widget.RecyclerView>(R.id.rvBlockedUsers)
        rv.layoutManager = LinearLayoutManager(this)
        adapter = BlockedUsersAdapter(mutableListOf())
        rv.adapter = adapter

        loadWhoBlockedYou()
    }

    private fun loadWhoBlockedYou() {
        ApiClient.apiService.getWhoBlockedYou()
            .enqueue(object : Callback<List<BlockedUserModel>> {

                override fun onResponse(
                    call: Call<List<BlockedUserModel>>,
                    response: Response<List<BlockedUserModel>>
                ) {
                    if (response.isSuccessful && response.body() != null) {
                        adapter.update(response.body()!!)
                    }
                }

                override fun onFailure(call: Call<List<BlockedUserModel>>, t: Throwable) {
                    Toast.makeText(
                        this@WhoBlockedYouActivity,
                        "Failed to load",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }
}
