package xyz.yenkasa.app.ui

import android.app.AlertDialog
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.widget.EditText
import android.widget.Button
import android.widget.ImageButton
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import xyz.yenkasa.app.R
import xyz.yenkasa.app.adapter.AdsApprovalAdapter
import xyz.yenkasa.app.model.AdCreateResponse
import xyz.yenkasa.app.model.AdModel
import xyz.yenkasa.app.model.AdsFeedResponse
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.TokenManager
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class AdsApprovalActivity : AppCompatActivity() {

    private lateinit var recyclerView: RecyclerView
    private lateinit var progressBar: ProgressBar
    private lateinit var emptyView: TextView
    private lateinit var backButton: ImageButton
    private lateinit var searchInput: EditText
    private lateinit var filterButton: Button
    private lateinit var adapter: AdsApprovalAdapter
    private var authToken: String? = null
    private var allAds: List<AdModel> = emptyList()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_approval_list)
        findViewById<TextView>(R.id.textApprovalTitle).text = getString(R.string.ads_approval_title)
        findViewById<TextView>(R.id.textApprovalSubtitle).text = getString(R.string.ads_approval_subtitle)

        authToken = TokenManager.getToken(this)?.let { "Bearer $it" }
        if (authToken.isNullOrBlank()) {
            Toast.makeText(this, R.string.login_required, Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        recyclerView = findViewById(R.id.recyclerViewApproval)
        progressBar = findViewById(R.id.progressBarApproval)
        emptyView = findViewById(R.id.textEmptyApproval)
        backButton = findViewById(R.id.buttonApprovalBack)
        searchInput = findViewById(R.id.inputSearch)
        filterButton = findViewById(R.id.btnFilter)
        emptyView.text = getString(R.string.ads_pending_empty)

        adapter = AdsApprovalAdapter(
            mutableListOf(),
            onApprove = { approveAd(it) },
            onReject = { promptReject(it) }
        )
        recyclerView.layoutManager = LinearLayoutManager(this)
        recyclerView.adapter = adapter
        backButton.setOnClickListener {
            onBackPressedDispatcher.onBackPressed()
        }
        searchInput.hint = getString(R.string.ads_search_hint)
        filterButton.setOnClickListener {
            Toast.makeText(this, R.string.ads_pending_showing, Toast.LENGTH_SHORT).show()
        }
        searchInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                filterAds(s?.toString().orEmpty())
            }
            override fun afterTextChanged(s: Editable?) = Unit
        })

        loadPendingAds()
    }

    private fun loadPendingAds() {
        progressBar.visibility = View.VISIBLE
        ApiClient.apiService.getPendingAds(authToken!!)
            .enqueue(object : Callback<AdsFeedResponse> {
                override fun onResponse(call: Call<AdsFeedResponse>, response: Response<AdsFeedResponse>) {
                    progressBar.visibility = View.GONE
                    allAds = response.body()?.ads.orEmpty()
                    filterAds(searchInput.text?.toString().orEmpty())
                }

                override fun onFailure(call: Call<AdsFeedResponse>, t: Throwable) {
                    progressBar.visibility = View.GONE
                    emptyView.visibility = View.VISIBLE
                    emptyView.text = getString(R.string.ads_pending_failed_load)
                }
            })
    }

    private fun filterAds(query: String) {
        val filtered = allAds.filter { ad ->
            query.isBlank() ||
                (ad.title?.contains(query, ignoreCase = true) == true) ||
                (ad.submittedBy?.username?.contains(query, ignoreCase = true) == true)
        }
        adapter.submit(filtered)
        emptyView.visibility = if (filtered.isEmpty()) View.VISIBLE else View.GONE
    }

    private fun approveAd(ad: AdModel) {
        ApiClient.apiService.approveAd(ad._id, authToken!!)
            .enqueue(object : Callback<AdCreateResponse> {
                override fun onResponse(call: Call<AdCreateResponse>, response: Response<AdCreateResponse>) {
                    if (response.isSuccessful) {
                        adapter.removeAd(ad._id)
                        allAds = allAds.filterNot { it._id == ad._id }
                        filterAds(searchInput.text?.toString().orEmpty())
                        Toast.makeText(this@AdsApprovalActivity, R.string.ad_approved, Toast.LENGTH_SHORT).show()
                    } else {
                        Toast.makeText(this@AdsApprovalActivity, R.string.ad_approve_failed, Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<AdCreateResponse>, t: Throwable) {
                    Toast.makeText(this@AdsApprovalActivity, R.string.approval_failed, Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun promptReject(ad: AdModel) {
        val input = EditText(this)
        input.hint = getString(R.string.ad_rejection_reason_hint)
        AlertDialog.Builder(this)
            .setTitle(R.string.reject_ad_title)
            .setView(input)
            .setPositiveButton(R.string.reject) { _, _ ->
                rejectAd(ad, input.text?.toString().orEmpty())
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    private fun rejectAd(ad: AdModel, reason: String) {
        ApiClient.apiService.rejectAd(ad._id, authToken!!, mapOf("reason" to reason))
            .enqueue(object : Callback<AdCreateResponse> {
                override fun onResponse(call: Call<AdCreateResponse>, response: Response<AdCreateResponse>) {
                    if (response.isSuccessful) {
                        adapter.removeAd(ad._id)
                        allAds = allAds.filterNot { it._id == ad._id }
                        filterAds(searchInput.text?.toString().orEmpty())
                        Toast.makeText(this@AdsApprovalActivity, R.string.ad_rejected, Toast.LENGTH_SHORT).show()
                    } else {
                        Toast.makeText(this@AdsApprovalActivity, R.string.ad_reject_failed, Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<AdCreateResponse>, t: Throwable) {
                    Toast.makeText(this@AdsApprovalActivity, R.string.reject_failed, Toast.LENGTH_SHORT).show()
                }
            })
    }
}
