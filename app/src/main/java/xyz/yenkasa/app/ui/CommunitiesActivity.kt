package xyz.yenkasa.app.ui

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.util.Log
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.SearchView
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import xyz.yenkasa.app.R
import xyz.yenkasa.app.adapter.CommunityAdapter
import xyz.yenkasa.app.adapter.JoinedCommunityAdapter
import xyz.yenkasa.app.model.Community
import xyz.yenkasa.app.model.JoinCommunityResponse
import xyz.yenkasa.app.model.JoinedCommunitiesResponse
import xyz.yenkasa.app.model.UserPrimaryCommunityResponse
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.TokenManager
import com.google.android.material.floatingactionbutton.FloatingActionButton
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class CommunitiesActivity : AppCompatActivity() {

    private lateinit var recyclerView: RecyclerView
    private val joinedCommunityIds = mutableSetOf<String>()

    private fun Community.isUserMember(): Boolean {
        return this.id?.let { joinedCommunityIds.contains(it) } ?: false
    }
    private lateinit var searchView: SearchView
    private lateinit var fabCreateCommunity: FloatingActionButton
    private lateinit var progressBar: ProgressBar
    private lateinit var emptyView: TextView

    private val communities = mutableListOf<Community>()
    private val joinedCommunities = mutableListOf<Community>() // For joined communities
    private lateinit var adapter: CommunityAdapter
    private lateinit var joinedAdapter: JoinedCommunityAdapter // For joined communities
    private var token: String? = null
    private var primaryCommunityId: String? = null

    // ✅ ONLY views that exist in your XML
    private lateinit var textJoinedCommunitiesTitle: TextView
    private lateinit var textAllCommunitiesTitle: TextView
    private lateinit var dividerAfterJoined: View
    private lateinit var recyclerJoinedCommunities: RecyclerView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activities_community)

        Log.d("CommunitiesActivity", "onCreate called — activity started")

        token = TokenManager.getToken(this)
        Log.d("CommunitiesActivity", "Retrieved token from TokenManager: $token")

        if (token == null) {
            Toast.makeText(this, "Please log in", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        primaryCommunityId = TokenManager.getPrimaryCommunityId(this)

        initViews()
        setupRecyclerView()
        setupJoinedCommunitiesRecyclerView() // Setup joined communities
        setupSearch()
        loadCommunities()
        loadJoinedCommunities() // Load user's joined communities
        loadUserPrimaryCommunity()
        setupCreateCommunityButtons()

        // Connect adapter's "View" button click
        adapter.onCommunitySelected = { community ->
            Log.d("CommunitiesActivity", "Community selected: ${community.displayName}")
            val intent = Intent(this, MainActivity::class.java)
            intent.putExtra("communityId", community.id)
            intent.putExtra("communityName", community.displayName)
            startActivity(intent)
        }

    }

    private fun initViews() {
        recyclerView = findViewById(R.id.recyclerViewCommunities)
        searchView = findViewById(R.id.searchViewCommunities)
        fabCreateCommunity = findViewById(R.id.fabCreateCommunity)
        progressBar = findViewById(R.id.progressBarCommunities)
        emptyView = findViewById(R.id.textEmptyCommunities)

        // ✅ ONLY initialize views that exist in XML
        textJoinedCommunitiesTitle = findViewById(R.id.textJoinedCommunitiesTitle)
        textAllCommunitiesTitle = findViewById(R.id.textAllCommunitiesTitle)
        dividerAfterJoined = findViewById(R.id.dividerAfterJoined)
        recyclerJoinedCommunities = findViewById(R.id.recyclerJoinedCommunities)

        recyclerView.isNestedScrollingEnabled = false
        recyclerJoinedCommunities.isNestedScrollingEnabled = true

    }

    private fun setupJoinedCommunitiesRecyclerView() {
        joinedAdapter = JoinedCommunityAdapter(joinedCommunities) { community ->
            // Handle click on joined community - navigate to feed
            val intent = Intent(this, MainActivity::class.java)
            intent.putExtra("communityId", community.id)
            intent.putExtra("communityName", community.displayName)
            startActivity(intent)
        }

        recyclerJoinedCommunities.layoutManager = LinearLayoutManager(this)
        recyclerJoinedCommunities.adapter = joinedAdapter
    }

    private fun loadJoinedCommunities() {
        Log.d("JOINED_DEBUG", "Loading joined communities...")

        // Change this to JoinedCommunitiesResponse (plural)
        ApiClient.apiService.getJoinedCommunities("Bearer $token")
            .enqueue(object : Callback<JoinedCommunitiesResponse> { // FIXED: Use JoinedCommunitiesResponse
                override fun onResponse(
                    call: Call<JoinedCommunitiesResponse>, // FIXED: Use JoinedCommunitiesResponse
                    response: Response<JoinedCommunitiesResponse> // FIXED: Use JoinedCommunitiesResponse
                ) {
                    Log.d("JOINED_DEBUG", "Response code: ${response.code()}")

                    if (response.isSuccessful && response.body() != null) {
                        val responseBody = response.body()!!
                        Log.d("JOINED_DEBUG", "Full response: $responseBody")
                        Log.d("JOINED_DEBUG", "Response body class: ${responseBody.javaClass.simpleName}")

                        val userCommunities = responseBody.communities
                        Log.d("JOINED_DEBUG", "Communities list size: ${userCommunities.size}")

                        // Log each community to see what's in them
                        userCommunities.forEachIndexed { index, community ->
                            Log.d("JOINED_DEBUG", "Community $index: $community")
                            Log.d("JOINED_DEBUG", "  - ID: ${community.id}")
                            Log.d("JOINED_DEBUG", "  - Name: ${community.displayName}")
                            Log.d("JOINED_DEBUG", "  - MemberCount: ${community.memberCount}")
                            Log.d("JOINED_DEBUG", "  - PostCount: ${community.postCount}")
                        }

                        joinedCommunities.clear()
                        joinedCommunities.addAll(userCommunities)
                        joinedAdapter.notifyDataSetChanged()

                        joinedCommunityIds.clear()
                        joinedCommunityIds.addAll(userCommunities.mapNotNull { it.id })

                        Log.d("JOINED_DEBUG", "joinedCommunityIds: $joinedCommunityIds")

                        // Refresh main adapter to update button states
                        adapter.notifyDataSetChanged()

                        // Show/hide the joined communities section
                        if (userCommunities.isNotEmpty()) {
                            textJoinedCommunitiesTitle.visibility = View.VISIBLE
                            recyclerJoinedCommunities.visibility = View.VISIBLE
                            dividerAfterJoined.visibility = View.VISIBLE

                            textJoinedCommunitiesTitle.text = "Your Communities (${userCommunities.size})"
                            Log.d("JOINED_DEBUG", "✅ Showing joined communities section with ${userCommunities.size} communities")
                        } else {
                            textJoinedCommunitiesTitle.visibility = View.GONE
                            recyclerJoinedCommunities.visibility = View.GONE
                            dividerAfterJoined.visibility = View.GONE
                            Log.d("JOINED_DEBUG", "❌ Hiding joined communities section - no communities")
                        }
                    } else {
                        Log.e("JOINED_DEBUG", "❌ API call failed: ${response.code()} - ${response.message()}")
                        if (response.errorBody() != null) {
                            Log.e("JOINED_DEBUG", "Error body: ${response.errorBody()!!.string()}")
                        }
                        // Hide section on failure
                        textJoinedCommunitiesTitle.visibility = View.GONE
                        recyclerJoinedCommunities.visibility = View.GONE
                        dividerAfterJoined.visibility = View.GONE
                    }
                }

                override fun onFailure(call: Call<JoinedCommunitiesResponse>, t: Throwable) { // FIXED
                    Log.e("JOINED_DEBUG", "❌ Network error: ${t.message}", t)
                    textJoinedCommunitiesTitle.visibility = View.GONE
                    recyclerJoinedCommunities.visibility = View.GONE
                    dividerAfterJoined.visibility = View.GONE
                }
            })
    }

    private fun loadUserPrimaryCommunity() {
        val token = TokenManager.getToken(this)
        Log.d("PRIMARY_COMMUNITY", "▶️ loadUserPrimaryCommunity called. Token = $token")

        if (token.isNullOrEmpty()) {
            Log.e("PRIMARY_COMMUNITY", "❌ Token is null or empty, aborting")
            return
        }

        ApiClient.apiService.getUserPrimaryCommunity("Bearer $token")
            .enqueue(object : Callback<UserPrimaryCommunityResponse> {
                override fun onResponse(
                    call: Call<UserPrimaryCommunityResponse>,
                    response: Response<UserPrimaryCommunityResponse>
                ) {
                    Log.d("PRIMARY_COMMUNITY", "✔️ API responded. Code = ${response.code()}")
                    if (!response.isSuccessful) {
                        Log.e("PRIMARY_COMMUNITY", "❌ API call unsuccessful. Message: ${response.message()}")
                        return
                    }

                    val primary = response.body()?.community
                    if (primary == null) {
                        primaryCommunityId = null
                        TokenManager.savePrimaryCommunityId(this@CommunitiesActivity, null)
                        Log.d("PRIMARY_COMMUNITY", "No primary community in response; using joined communities only")
                        return
                    }

                    Log.d("PRIMARY_COMMUNITY", "Primary community received: ID=${primary.id}, Name=${primary.displayName}")
                    primaryCommunityId = primary.id
                    TokenManager.savePrimaryCommunityId(this@CommunitiesActivity, primary.id)

                    // Check if primary already exists
                    val alreadyExists = joinedCommunities.any { it.id == primary.id }
                    Log.d("PRIMARY_COMMUNITY", "Already in joinedCommunities? $alreadyExists")

                    if (!alreadyExists) {
                        joinedCommunities.add(0, primary)
                        primary.id?.let { joinedCommunityIds.add(it) }
                        joinedAdapter.notifyItemInserted(0)
                        adapter.notifyDataSetChanged()
                        Log.d("PRIMARY_COMMUNITY", "✅ Primary added to joinedCommunities at position 0")
                    }

                    // Ensure joined section is visible
                    textJoinedCommunitiesTitle.visibility = View.VISIBLE
                    recyclerJoinedCommunities.visibility = View.VISIBLE
                    dividerAfterJoined.visibility = View.VISIBLE
                    textJoinedCommunitiesTitle.text = "Your Communities (${joinedCommunities.size})"

                    Log.d(
                        "PRIMARY_COMMUNITY",
                        "Joined section updated. joinedCommunities.size = ${joinedCommunities.size}"
                    )
                }

                override fun onFailure(call: Call<UserPrimaryCommunityResponse>, t: Throwable) {
                    Log.e("PRIMARY_COMMUNITY", "❌ Failed to load primary community", t)
                }
            })
    }

    private fun setupRecyclerView() {
        adapter = CommunityAdapter(communities) { community ->
            // Directly open feed activity here
            val intent = Intent(this, MainActivity::class.java)
            intent.putExtra("communityId", community.id)
            intent.putExtra("communityName", community.displayName)
            startActivity(intent)
        }

        adapter.isCommunityJoined = { community ->
            community.id?.let { joinedCommunityIds.contains(it) } == true ||
                community.id == primaryCommunityId ||
                community.isUserMember()
        }

        adapter.onJoinCommunity = { community ->

            val communityId = community.id

            // ID missing → stop here
            if (communityId == null) {
                Toast.makeText(this, "Invalid community", Toast.LENGTH_SHORT).show()
                // no return needed
            }
            // Already joined? stop
            else if (joinedCommunityIds.contains(communityId)) {
                Toast.makeText(this, "Already a member", Toast.LENGTH_SHORT).show()
                // no return needed
            }
            // Primary community? stop
            else if (primaryCommunityId == communityId) {
                Toast.makeText(this, "Already your primary community", Toast.LENGTH_SHORT).show()
                // no return needed
            }
            else {
                // Allowed → perform join
                joinCommunity(community)
            }
        }




        adapter.onViewCommunity = { community ->
            showCommunityDialog(community)  // This will show the dialog
        }

        // NEW: Leave community handler
        adapter.onLeaveCommunity = { community ->
            leaveCommunity(community)  // This will call your leave function
        }

        recyclerView.layoutManager = GridLayoutManager(this, 2)
        recyclerView.adapter = adapter
    }

    // NEW: Leave community function
    private fun leaveCommunity(community: Community) {
        Log.d("LEAVE_COMMUNITY", "→ leaveCommunity called for ${community.displayName} (ID=${community.id})")

        progressBar.visibility = View.VISIBLE

        val communityId = community.id
        if (communityId == null) {
            Log.e("LEAVE_COMMUNITY", "❌ Community ID is null")
            progressBar.visibility = View.GONE
            Toast.makeText(this, "Invalid community ID", Toast.LENGTH_SHORT).show()
            return
        }

        Log.d("LEAVE_COMMUNITY", "→ Sending leave request for ID=$communityId")

        ApiClient.apiService.leaveCommunity("Bearer $token", communityId)
            .enqueue(object : Callback<JoinCommunityResponse> {
                override fun onResponse(
                    call: Call<JoinCommunityResponse>,
                    response: Response<JoinCommunityResponse>
                ) {
                    progressBar.visibility = View.GONE
                    Log.d("LEAVE_COMMUNITY", "→ Response code: ${response.code()}")

                    val body = response.body()

                    if (response.isSuccessful && body?.success == true) {
                        Log.d("LEAVE_COMMUNITY", "✔ Left successfully: ${body.message}")

                        val displayName = community.displayName ?: "Community"

                        Toast.makeText(
                            this@CommunitiesActivity,
                            "Left $displayName!",
                            Toast.LENGTH_SHORT
                        ).show()

                        // Refresh lists
                        loadJoinedCommunities()
                        loadCommunities()

                    } else {
                        val message = body?.message ?: when (response.code()) {
                            400 -> "You are not a member of this community"
                            404 -> "Community not found"
                            else -> "Failed to leave community"
                        }

                        Log.e("LEAVE_COMMUNITY", "❌ Leave failed: $message")
                        Toast.makeText(this@CommunitiesActivity, message, Toast.LENGTH_LONG).show()
                    }
                }

                override fun onFailure(call: Call<JoinCommunityResponse>, t: Throwable) {
                    progressBar.visibility = View.GONE
                    Log.e("LEAVE_COMMUNITY", "❌ Network error: ${t.message}", t)

                    Toast.makeText(
                        this@CommunitiesActivity,
                        "Connection error. Try again.",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }
    private fun setupSearch() {
        searchView.setOnQueryTextListener(object : SearchView.OnQueryTextListener {
            override fun onQueryTextSubmit(query: String?): Boolean {
                query?.let { searchCommunities(it) }
                return true
            }

            override fun onQueryTextChange(newText: String?): Boolean {
                if (newText.isNullOrEmpty()) {
                    loadCommunities()
                }
                return true
            }
        })
    }

    private fun loadCommunities() {
        showLoading(true)
        ApiClient.apiService.getCommunities("Bearer $token")
            .enqueue(object : Callback<List<Community>> {
                override fun onResponse(
                    call: Call<List<Community>>,
                    response: Response<List<Community>>
                ) {
                    showLoading(false)

                    if (response.isSuccessful && response.body() != null) {
                        val allCommunities = response.body()!!

                        // Show all communities in the main RecyclerView
                        communities.clear()
                        communities.addAll(allCommunities)
                        adapter.notifyDataSetChanged()
                        textAllCommunitiesTitle.visibility = View.VISIBLE
                        recyclerView.visibility = View.VISIBLE

                        // Handle empty state
                        emptyView.visibility = if (allCommunities.isEmpty()) View.VISIBLE else View.GONE
                    } else {
                        Toast.makeText(
                            this@CommunitiesActivity,
                            "Failed to load communities",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }

                override fun onFailure(call: Call<List<Community>>, t: Throwable) {
                    showLoading(false)
                    Toast.makeText(
                        this@CommunitiesActivity,
                        "Error: ${t.message}",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }

    private fun searchCommunities(query: String) {
        showLoading(true)

        ApiClient.apiService.getCommunities(
            token = "Bearer $token",
            search = query
        ).enqueue(object : Callback<List<Community>> {
            override fun onResponse(
                call: Call<List<Community>>,
                response: Response<List<Community>>
            ) {
                showLoading(false)

                if (response.isSuccessful && response.body() != null) {
                    val searchedCommunities = response.body()!!

                    communities.clear()
                    communities.addAll(searchedCommunities)
                    adapter.notifyDataSetChanged()

                    if (communities.isEmpty()) {
                        emptyView.text = "No communities found for \"$query\""
                        emptyView.visibility = View.VISIBLE
                        recyclerView.visibility = View.GONE
                    } else {
                        emptyView.visibility = View.GONE
                        recyclerView.visibility = View.VISIBLE
                    }
                } else {
                    Toast.makeText(
                        this@CommunitiesActivity,
                        "Failed to search communities (${response.code()})",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }

            override fun onFailure(call: Call<List<Community>>, t: Throwable) {
                showLoading(false)
                Toast.makeText(
                    this@CommunitiesActivity,
                    "Search error: ${t.message}",
                    Toast.LENGTH_SHORT
                ).show()
            }
        })
    }

    private fun showCommunityDialog(community: Community) {
        val isMember = community.isUserMember()

        val dialogBuilder = android.app.AlertDialog.Builder(this)
            .setTitle(community.displayName)
            .setMessage(
                "${community.description}\n\n" +
                        "📍 ${community.location ?: "Interest-based"}\n" +
                        "👥 ${community.memberCount} members\n" +
                        "📝 ${community.postCount} posts"
            )

        // Show appropriate button based on membership
        if (isMember) {
            dialogBuilder.setPositiveButton("Leave") { _, _ ->
                leaveCommunity(community)
            }
        } else {
            dialogBuilder.setPositiveButton("Join") { _, _ ->
                joinCommunity(community)
            }
        }

        dialogBuilder.setNegativeButton("Cancel", null)
        val dialog = dialogBuilder.create()
        dialog.show()
    }


    private fun joinCommunity(community: Community) {

        val communityId = community.id

        if (communityId.isNullOrEmpty()) {
            Log.e("JOIN_COMMUNITY", "❌ ERROR: community.id is NULL")
            Toast.makeText(this, "Invalid community ID", Toast.LENGTH_SHORT).show()
            return
        }

        // 🔒 Prevent joining a community the user already joined
        if (joinedCommunityIds.contains(communityId)) {
            Toast.makeText(this, "Already a member", Toast.LENGTH_SHORT).show()
            return
        }

        // 🔒 Prevent joining the primary community again
        if (primaryCommunityId != null && primaryCommunityId == communityId) {
            Toast.makeText(this, "Already your primary community", Toast.LENGTH_SHORT).show()
            return
        }

        Log.d("JOIN_COMMUNITY", "🔵 Joining community: ${community.displayName}  (ID=$communityId)")

        progressBar.visibility = View.VISIBLE

        ApiClient.apiService
            .joinCommunity("Bearer $token", communityId)
            .enqueue(object : Callback<JoinCommunityResponse> {

                override fun onResponse(
                    call: Call<JoinCommunityResponse>,
                    response: Response<JoinCommunityResponse>
                ) {
                    progressBar.visibility = View.GONE

                    Log.d("JOIN_COMMUNITY", "🔵 Response Code: ${response.code()}")

                    val result = response.body()

                    when {
                        response.isSuccessful && result?.success == true -> {
                            Log.d("JOIN_COMMUNITY", "✔ SUCCESS: ${result.message}")

                            Toast.makeText(
                                this@CommunitiesActivity,
                                "Joined ${community.displayName ?: "community"}!",
                                Toast.LENGTH_SHORT
                            ).show()

                            // Save locally
                            TokenManager.saveSelectedCommunity(
                                context = this@CommunitiesActivity,
                                communityId = communityId,
                                communityName = community.displayName ?: ""
                            )

                            // Reload lists
                            loadJoinedCommunities()
                            loadCommunities()
                        }

                        response.code() == 404 -> {
                            Log.e("JOIN_COMMUNITY", "❌ ERROR: Community not found")
                            Toast.makeText(this@CommunitiesActivity, "Community not found.", Toast.LENGTH_LONG).show()
                        }

                        response.code() == 403 -> {
                            Log.e("JOIN_COMMUNITY", "❌ ERROR: Join limit reached")
                            Toast.makeText(
                                this@CommunitiesActivity,
                                "You can join up to 5 communities: 2 at signup and 3 more in the app.",
                                Toast.LENGTH_LONG
                            ).show()
                        }

                        else -> {
                            Log.e("JOIN_COMMUNITY", "❌ ERROR: Failed to join")
                            Toast.makeText(this@CommunitiesActivity, "Failed to join community.", Toast.LENGTH_LONG).show()
                        }
                    }
                }

                override fun onFailure(call: Call<JoinCommunityResponse>, t: Throwable) {
                    progressBar.visibility = View.GONE
                    Log.e("JOIN_COMMUNITY", "❌ NETWORK ERROR: ${t.message}", t)
                    Toast.makeText(this@CommunitiesActivity, "Connection error. Try again.", Toast.LENGTH_SHORT).show()
                }
            })
    }

    // Helper function to update UI for a specific community
    private fun updateCommunityUI(joinedCommunityId: String) {
        val position = communities.indexOfFirst { it.id == joinedCommunityId }
        if (position != -1) {
            // Update the community in the list
            communities[position] = communities[position].copy(
                // Update any properties if needed
            )
            adapter.notifyItemChanged(position)
        }
    }

    private fun setupCreateCommunityButtons() {
        val userRole = TokenManager.getUserRole(this)
            .trim()
            .lowercase()
            .replace("\\s+".toRegex(), "_")
        val isVerified = TokenManager.isVerified(this)

        // All roles allowed to bypass verification
        val elevatedRoles = setOf("admin", "moderator", "developer", "senior_developer", "junior_developer")

        val btnCreateCommunity = findViewById<View>(R.id.btnCreateCommunity)

        val launchCreateCommunity = {
            val hasRolePrivilege = elevatedRoles.contains(userRole)

            if (hasRolePrivilege || isVerified) {
                startActivity(Intent(this, CreateCommunityActivity::class.java))
            } else {
                Toast.makeText(
                    this,
                    "You must be verified or have a privileged role to create a community.",
                    Toast.LENGTH_LONG
                ).show()
            }
        }

        btnCreateCommunity.setOnClickListener { launchCreateCommunity() }
        fabCreateCommunity.setOnClickListener { launchCreateCommunity() }
    }

    private fun showLoading(show: Boolean) {
        progressBar.visibility = if (show) View.VISIBLE else View.GONE
        recyclerView.visibility = if (show) View.GONE else View.VISIBLE
    }
}
