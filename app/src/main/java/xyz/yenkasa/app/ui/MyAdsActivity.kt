package xyz.yenkasa.app.ui

import android.app.AlertDialog
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ImageButton
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.annotation.StringRes
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import xyz.yenkasa.app.R
import xyz.yenkasa.app.adapter.MyAdsAdapter
import xyz.yenkasa.app.model.AdModel
import xyz.yenkasa.app.model.AdsFeedResponse
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.TokenManager
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class MyAdsActivity : AppCompatActivity() {

    private enum class StatusFilter(@StringRes val labelRes: Int) {
        ALL(R.string.status_all),
        PENDING(R.string.status_pending),
        APPROVED(R.string.status_approved),
        REJECTED(R.string.status_rejected)
    }

    private lateinit var recyclerView: RecyclerView
    private lateinit var progressBar: ProgressBar
    private lateinit var emptyView: TextView
    private lateinit var backButton: ImageButton
    private lateinit var titleView: TextView
    private lateinit var subtitleView: TextView
    private lateinit var searchInput: EditText
    private lateinit var filterButton: Button
    private lateinit var adapter: MyAdsAdapter
    private var allAds: List<AdModel> = emptyList()
    private var currentFilter = StatusFilter.ALL

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_status_list)
        title = getString(R.string.my_ads_title)

        backButton = findViewById(R.id.buttonStatusListBack)
        titleView = findViewById(R.id.textStatusListTitle)
        subtitleView = findViewById(R.id.textStatusListSubtitle)
        recyclerView = findViewById(R.id.recyclerViewStatusList)
        progressBar = findViewById(R.id.progressBarStatusList)
        emptyView = findViewById(R.id.textEmptyStatusList)
        searchInput = findViewById(R.id.inputStatusSearch)
        filterButton = findViewById(R.id.btnStatusFilter)

        titleView.text = getString(R.string.my_ads_title)
        subtitleView.text = getString(R.string.my_ads_subtitle)
        emptyView.text = getString(R.string.my_ads_empty)
        searchInput.hint = getString(R.string.ads_search_hint)
        filterButton.text = filterLabel(currentFilter)

        adapter = MyAdsAdapter(mutableListOf())
        recyclerView.layoutManager = LinearLayoutManager(this)
        recyclerView.adapter = adapter

        backButton.setOnClickListener {
            onBackPressedDispatcher.onBackPressed()
        }
        filterButton.setOnClickListener { showFilterDialog() }
        searchInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                renderAds()
            }
            override fun afterTextChanged(s: Editable?) = Unit
        })

        loadAds()
    }

    override fun onResume() {
        super.onResume()
        loadAds()
    }

    private fun loadAds() {
        val token = TokenManager.getToken(this)
        if (token.isNullOrBlank()) {
            Toast.makeText(this, R.string.login_required, Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        progressBar.visibility = View.VISIBLE
        ApiClient.apiService.getMyAds("Bearer $token")
            .enqueue(object : Callback<AdsFeedResponse> {
                override fun onResponse(call: Call<AdsFeedResponse>, response: Response<AdsFeedResponse>) {
                    progressBar.visibility = View.GONE
                    allAds = response.body()?.ads.orEmpty()
                    renderAds()
                }

                override fun onFailure(call: Call<AdsFeedResponse>, t: Throwable) {
                    progressBar.visibility = View.GONE
                    emptyView.visibility = View.VISIBLE
                    emptyView.text = getString(R.string.my_ads_failed_load)
                }
            })
    }

    private fun showFilterDialog() {
        val filters = StatusFilter.entries.toTypedArray()
        val currentIndex = filters.indexOf(currentFilter).coerceAtLeast(0)
        AlertDialog.Builder(this)
            .setTitle(R.string.ads_filter_title)
            .setSingleChoiceItems(filters.map { filterLabel(it) }.toTypedArray(), currentIndex) { dialog, which ->
                currentFilter = filters[which]
                filterButton.text = filterLabel(currentFilter)
                renderAds()
                dialog.dismiss()
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    private fun renderAds() {
        val query = searchInput.text?.toString().orEmpty().trim()
        val filteredAds = allAds.filter { ad ->
            matchesFilter(ad) && matchesQuery(ad, query)
        }
        val rows = buildRows(filteredAds)
        adapter.submit(rows)
        emptyView.visibility = if (rows.isEmpty()) View.VISIBLE else View.GONE
        subtitleView.text = when (currentFilter) {
            StatusFilter.ALL -> resources.getQuantityString(
                R.plurals.my_ads_showing_all_statuses,
                filteredAds.size,
                filteredAds.size
            )
            else -> resources.getQuantityString(
                R.plurals.my_ads_showing_status,
                filteredAds.size,
                filteredAds.size,
                filterLabel(currentFilter).lowercase()
            )
        }
    }

    private fun matchesFilter(ad: AdModel): Boolean {
        val status = normalizedStatus(ad)
        return currentFilter == StatusFilter.ALL || status == currentFilter.name.lowercase()
    }

    private fun matchesQuery(ad: AdModel, query: String): Boolean {
        if (query.isBlank()) return true
        return ad.title?.contains(query, ignoreCase = true) == true ||
            ad.sponsorName?.contains(query, ignoreCase = true) == true ||
            ad.submittedBy?.username?.contains(query, ignoreCase = true) == true
    }

    private fun buildRows(ads: List<AdModel>): List<MyAdsAdapter.Row> {
        val pending = ads.filter { normalizedStatus(it) == "pending" }
        val approved = ads.filter { normalizedStatus(it) == "approved" }
        val rejected = ads.filter { normalizedStatus(it) == "rejected" }

        val rows = mutableListOf<MyAdsAdapter.Row>()
        when (currentFilter) {
            StatusFilter.ALL -> {
                addSection(rows, getString(R.string.status_pending), pending)
                addSection(rows, getString(R.string.status_approved), approved)
                addSection(rows, getString(R.string.status_rejected), rejected)
            }
            StatusFilter.PENDING -> addSection(rows, getString(R.string.status_pending), pending)
            StatusFilter.APPROVED -> addSection(rows, getString(R.string.status_approved), approved)
            StatusFilter.REJECTED -> addSection(rows, getString(R.string.status_rejected), rejected)
        }
        return rows
    }

    private fun normalizedStatus(ad: AdModel): String {
        val explicitStatus = ad.approvalStatus?.trim()?.lowercase()
        return when {
            explicitStatus == "approved" || ad.isActive -> "approved"
            explicitStatus == "rejected" || (!ad.isActive && !ad.rejectionReason.isNullOrBlank()) -> "rejected"
            else -> "pending"
        }
    }

    private fun addSection(rows: MutableList<MyAdsAdapter.Row>, title: String, ads: List<AdModel>) {
        if (ads.isEmpty()) return
        rows += MyAdsAdapter.Row.Header(title)
        rows += ads.map { MyAdsAdapter.Row.Item(it) }
    }

    private fun filterLabel(filter: StatusFilter): String = getString(filter.labelRes)
}
