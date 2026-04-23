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
import xyz.yenkasa.app.util.UserPermissions
import com.google.android.material.floatingactionbutton.FloatingActionButton
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class CommunitiesActivity : AppCompatActivity() {

    private lateinit var recyclerView: RecyclerView
    private val joinedCommunityIds = mutableSetOf<String>()

    private fun Community.isCurrentUserMember(): Boolean {
        return this.id?.let { joinedCommunityIds.contains(it) } == true ||
            this.id == primaryCommunityId ||
            this.isUserMember()
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
    private lateinit var tabMyCommunities: TextView
    private lateinit var tabAllCommunities: TextView
    private lateinit var layoutMyCommunitiesHeader: View
    private lateinit var layoutDiscoverHeader: View
    private lateinit var textJoinedCommunitiesTitle: TextView
    private lateinit var textPopularCategoriesTitle: TextView
    private lateinit var layoutPopularCategories: View
    private lateinit var dividerAfterJoined: View
    private lateinit var recyclerJoinedCommunities: RecyclerView
    private var showingMyCommunities = true

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
        setupCommunityTabs()
        setupBottomNavigation()
        loadCommunities()
        loadJoinedCommunities() // Load user's joined communities
        loadUserPrimaryCommunity()
        setupCreateCommunityButtons()

        // Connect adapter's "View" button click
        adapter.onCommunitySelected = { community ->
            Log.d("CommunitiesActivity", "Community selected: ${community.displayName}")
            showCommunityDialog(community)
        }

    }

    private fun initViews() {
        recyclerView = findViewById(R.id.recyclerViewCommunities)
        searchView = findViewById(R.id.searchViewCommunities)
        fabCreateCommunity = findViewById(R.id.fabCreateCommunity)
        progressBar = findViewById(R.id.progressBarCommunities)
        emptyView = findViewById(R.id.textEmptyCommunities)

        // ✅ ONLY initialize views that exist in XML
        tabMyCommunities = findViewById(R.id.tabMyCommunities)
        tabAllCommunities = findViewById(R.id.tabAllCommunities)
        layoutMyCommunitiesHeader = findViewById(R.id.layoutMyCommunitiesHeader)
        layoutDiscoverHeader = findViewById(R.id.layoutDiscoverHeader)
        textJoinedCommunitiesTitle = findViewById(R.id.textJoinedCommunitiesTitle)
        textPopularCategoriesTitle = findViewById(R.id.textPopularCategoriesTitle)
        layoutPopularCategories = findViewById(R.id.layoutPopularCategories)
        dividerAfterJoined = findViewById(R.id.dividerAfterJoined)
        recyclerJoinedCommunities = findViewById(R.id.recyclerJoinedCommunities)

        recyclerView.isNestedScrollingEnabled = false
        recyclerView.clipToPadding = false
        recyclerJoinedCommunities.isNestedScrollingEnabled = false

    }

    private fun setupCommunityTabs() {
        tabMyCommunities.setOnClickListener { setCommunityMode(showMy = true) }
        tabAllCommunities.setOnClickListener { setCommunityMode(showMy = false) }
        setCommunityMode(showMy = true)
    }

    private fun setCommunityMode(showMy: Boolean) {
        showingMyCommunities = showMy

        tabMyCommunities.setBackgroundResource(
            if (showMy) R.drawable.bg_community_tab_selected else android.R.color.transparent
        )
        tabMyCommunities.setTextColor(
            getColor(if (showMy) R.color.yenkasa_black else R.color.account_secondary_text)
        )

        tabAllCommunities.setBackgroundResource(
            if (showMy) android.R.color.transparent else R.drawable.bg_community_tab_selected
        )
        tabAllCommunities.setTextColor(
            getColor(if (showMy) R.color.account_secondary_text else R.color.yenkasa_black)
        )

        updateJoinedSectionVisibility()
        layoutDiscoverHeader.visibility = View.VISIBLE
        recyclerView.visibility = if (communities.isEmpty()) View.GONE else View.VISIBLE
        textPopularCategoriesTitle.visibility = View.VISIBLE
        layoutPopularCategories.visibility = View.VISIBLE
    }

    private fun updateJoinedSectionVisibility() {
        val showJoined = showingMyCommunities && joinedCommunities.isNotEmpty()
        layoutMyCommunitiesHeader.visibility = if (showJoined) View.VISIBLE else View.GONE
        recyclerJoinedCommunities.visibility = if (showJoined) View.VISIBLE else View.GONE
        dividerAfterJoined.visibility = if (showJoined) View.VISIBLE else View.GONE
        textJoinedCommunitiesTitle.text = "My Communities (${joinedCommunities.size})"
        tabMyCommunities.text = "My Communities (${joinedCommunities.size})"
    }

    private fun setupJoinedCommunitiesRecyclerView() {
        joinedAdapter = JoinedCommunityAdapter(joinedCommunities) { community ->
            showCommunityDialog(community)
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

                        updateJoinedSectionVisibility()
                        Log.d("JOINED_DEBUG", "✅ Joined communities section updated with ${userCommunities.size} communities")
                    } else {
                        Log.e("JOINED_DEBUG", "❌ API call failed: ${response.code()} - ${response.message()}")
                        if (response.errorBody() != null) {
                            Log.e("JOINED_DEBUG", "Error body: ${response.errorBody()!!.string()}")
                        }
                        updateJoinedSectionVisibility()
                    }
                }

                override fun onFailure(call: Call<JoinedCommunitiesResponse>, t: Throwable) { // FIXED
                    Log.e("JOINED_DEBUG", "❌ Network error: ${t.message}", t)
                    updateJoinedSectionVisibility()
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

                    updateJoinedSectionVisibility()

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
            community.isCurrentUserMember()
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

        recyclerView.layoutManager = LinearLayoutManager(this, LinearLayoutManager.HORIZONTAL, false)
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
                        recyclerView.visibility = if (allCommunities.isEmpty()) View.GONE else View.VISIBLE

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
        val isMember = community.isCurrentUserMember()

        val dialogBuilder = android.app.AlertDialog.Builder(this)
            .setTitle(community.displayName ?: community.name ?: "Community")
            .setMessage(
                "${community.description.orEmpty().ifBlank { "No description yet." }}\n\n" +
                        "Location: ${community.location ?: "Interest-based"}\n" +
                        "Members: ${community.memberCount}\n" +
                        "Posts: ${community.postCount}\n" +
                        "Status: ${if (community.isApproved) "Approved" else "Pending approval"}"
            )

        dialogBuilder.setPositiveButton("View Feed") { _, _ ->
            openCommunityFeed(community)
        }

        dialogBuilder.setNegativeButton(if (isMember) "Leave" else "Join") { _, _ ->
            if (isMember) leaveCommunity(community) else joinCommunity(community)
        }

        if (canEditCommunity(community)) {
            dialogBuilder.setNeutralButton("Edit") { _, _ ->
                openEditCommunity(community)
            }
        }

        val dialog = dialogBuilder.create()
        dialog.show()
    }

    private fun openCommunityFeed(community: Community) {
        val communityId = community.id
        if (communityId.isNullOrBlank()) {
            Toast.makeText(this, "Invalid community", Toast.LENGTH_SHORT).show()
            return
        }
        val intent = Intent(this, MainActivity::class.java)
        intent.putExtra("communityId", communityId)
        intent.putExtra("communityName", community.displayName ?: community.name)
        startActivity(intent)
    }

    private fun canEditCommunity(community: Community): Boolean {
        val role = TokenManager.getUserRole(this)
        val userId = TokenManager.getUserId(this)
        val isCreator = !userId.isNullOrBlank() && community.createdById == userId
        val isModerator = !userId.isNullOrBlank() && community.moderators.contains(userId)
        return UserPermissions.canCreateCommunity(role) || isCreator || isModerator
    }

    private fun openEditCommunity(community: Community) {
        val communityId = community.id
        if (communityId.isNullOrBlank()) {
            Toast.makeText(this, "Invalid community", Toast.LENGTH_SHORT).show()
            return
        }

        startActivity(Intent(this, CreateCommunityActivity::class.java).apply {
            putExtra("communityId", communityId)
            putExtra("communityDisplayName", community.displayName ?: community.name.orEmpty())
            putExtra("communityDescription", community.description.orEmpty())
            putExtra("communityLocation", community.location.orEmpty())
            putStringArrayListExtra("communityCategories", ArrayList(community.categories))
            putExtra("communityIsPrivate", community.isPrivate)
        })
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

        val btnCreateCommunity = findViewById<View>(R.id.btnCreateCommunity)

        val launchCreateCommunity = {
            val hasRolePrivilege = UserPermissions.canCreateCommunity(userRole)

            if (hasRolePrivilege || isVerified) {
                startActivity(Intent(this, CreateCommunityActivity::class.java))
            } else {
                Toast.makeText(
                    this,
                    "You need a privileged role or verified creator access to create a community.",
                    Toast.LENGTH_LONG
                ).show()
            }
        }

        btnCreateCommunity.setOnClickListener { launchCreateCommunity() }
        fabCreateCommunity.setOnClickListener { launchCreateCommunity() }
    }

    private fun setupBottomNavigation() {
        findViewById<View>(R.id.navCommunityHome).setOnClickListener {
            startActivity(Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            })
            finish()
        }
        findViewById<View>(R.id.navCommunityWallet).setOnClickListener {
            startActivity(Intent(this, CoinWalletActivity::class.java))
        }
        findViewById<View>(R.id.navCommunitySend).setOnClickListener {
            startActivity(Intent(this, CreateTransactionActivity::class.java))
        }
        findViewById<View>(R.id.navCommunityReceive).setOnClickListener {
            startActivity(Intent(this, CreateTransactionActivity::class.java).putExtra("action", "receive"))
        }
        findViewById<View>(R.id.navCommunityProfile).setOnClickListener {
            startActivity(Intent(this, AccountInfoActivity::class.java))
        }
    }

    private fun showLoading(show: Boolean) {
        progressBar.visibility = if (show) View.VISIBLE else View.GONE
        recyclerView.visibility = if (show) View.GONE else View.VISIBLE
    }
}
