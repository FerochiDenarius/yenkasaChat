package xyz.yenkasa.app.ui

import android.os.Bundle
import android.view.View
import android.widget.ProgressBar
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import xyz.yenkasa.app.R
import xyz.yenkasa.app.adapter.CommunityVisibilityAdapter
import xyz.yenkasa.app.model.CommunityVisibilityModel
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.TokenManager
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class BlockedCommunitiesActivity : AppCompatActivity() {

    private lateinit var adapter: CommunityVisibilityAdapter
    private lateinit var progressBar: ProgressBar
    private var token: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_community_visibility)

        token = TokenManager.getToken(this)

        progressBar = findViewById(R.id.progressBar)

        val rv = findViewById<androidx.recyclerview.widget.RecyclerView>(R.id.rvCommunityVisibility)
        rv.layoutManager = LinearLayoutManager(this)

        adapter = CommunityVisibilityAdapter(mutableListOf())
        rv.adapter = adapter

        loadBlockedCommunities()
    }

    private fun loadBlockedCommunities() {
        progressBar.visibility = View.VISIBLE

        ApiClient.apiService.getCommunityVisibility("Bearer $token")
            .enqueue(object : Callback<List<CommunityVisibilityModel>> {

                override fun onResponse(
                    call: Call<List<CommunityVisibilityModel>>,
                    response: Response<List<CommunityVisibilityModel>>
                ) {
                    progressBar.visibility = View.GONE

                    if (response.isSuccessful && response.body() != null) {
                        val blocked = response.body()!!.filter { it.blockUsers }
                        adapter.update(blocked)
                    } else {
                        Toast.makeText(
                            this@BlockedCommunitiesActivity,
                            R.string.failed_to_load,
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }

                override fun onFailure(
                    call: Call<List<CommunityVisibilityModel>>,
                    t: Throwable
                ) {
                    progressBar.visibility = View.GONE
                    Toast.makeText(
                        this@BlockedCommunitiesActivity,
                        R.string.failed_to_load,
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }
}
