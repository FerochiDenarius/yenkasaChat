package xyz.yenkasa.app.ui

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.widget.EditText
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
    private lateinit var emptySubtitle: TextView
    private lateinit var emptyState: View
    private lateinit var progress: ProgressBar
    private lateinit var searchInput: EditText
    private var token: String? = null
    private val allBlockedUsers = mutableListOf<BlockedUserModel>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_blocked_users)

        token = TokenManager.getToken(this)

        val rv = findViewById<androidx.recyclerview.widget.RecyclerView>(R.id.rvBlockedUsers)
        emptyText = findViewById(R.id.txtEmpty)
        emptySubtitle = findViewById(R.id.textEmptySubtitle)
        emptyState = findViewById(R.id.emptyStateBlocked)
        progress = findViewById(R.id.progressBar)
        searchInput = findViewById(R.id.editSearchBlockedUsers)

        findViewById<View>(R.id.btnBack).setOnClickListener {
            finish()
        }

        rv.layoutManager = LinearLayoutManager(this)
        rv.setHasFixedSize(false)
        adapter = BlockedUsersAdapter(mutableListOf()) { removedUser ->
            allBlockedUsers.removeAll { it.userId == removedUser.userId }
            updateEmptyState()
        }
        rv.adapter = adapter

        searchInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit

            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                filterBlockedUsers(s?.toString().orEmpty())
            }

            override fun afterTextChanged(s: Editable?) = Unit
        })

        loadBlockedUsers()
    }


    private fun loadBlockedUsers() {
        progress.visibility = View.VISIBLE
        emptyState.visibility = View.GONE

        ApiClient.apiService.getBlockedUsers("Bearer $token")
            .enqueue(object : Callback<List<BlockedUserModel>> {

                override fun onResponse(
                    call: Call<List<BlockedUserModel>>,
                    response: Response<List<BlockedUserModel>>
                ) {
                    progress.visibility = View.GONE

                    if (!response.isSuccessful || response.body() == null) {
                        emptyText.visibility = View.VISIBLE
                        emptyText.text = getString(R.string.failed_to_load_blocked_users)
                        return
                    }

                    allBlockedUsers.clear()
                    allBlockedUsers.addAll(response.body()!!)
                    filterBlockedUsers(searchInput.text?.toString().orEmpty())
                }

                override fun onFailure(call: Call<List<BlockedUserModel>>, t: Throwable) {
                    progress.visibility = View.GONE
                    emptyState.visibility = View.VISIBLE
                    emptyText.text = getString(R.string.connection_error)
                    emptySubtitle.text = getString(R.string.blocked_users_load_connection_error)
                }
            })
    }

    private fun filterBlockedUsers(query: String) {
        val normalizedQuery = query.trim()
        val filtered = if (normalizedQuery.isBlank()) {
            allBlockedUsers
        } else {
            allBlockedUsers.filter { user ->
                user.username.contains(normalizedQuery, ignoreCase = true) ||
                    user.roleName.orEmpty().contains(normalizedQuery, ignoreCase = true) ||
                    user.role?.name.orEmpty().contains(normalizedQuery, ignoreCase = true)
            }
        }

        adapter.update(filtered)
        updateEmptyState(isSearchEmpty = normalizedQuery.isNotBlank() && filtered.isEmpty())
    }

    private fun updateEmptyState(isSearchEmpty: Boolean = false) {
        emptyState.visibility = View.VISIBLE
        emptyText.text = if (isSearchEmpty) getString(R.string.no_matching_users) else getString(R.string.blocked_empty_title)
        emptySubtitle.text = if (isSearchEmpty) {
            getString(R.string.blocked_search_empty_summary)
        } else {
            getString(R.string.blocked_empty_summary)
        }
    }
}
