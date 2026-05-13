package xyz.yenkasa.app.ui

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.ChatRoom
import xyz.yenkasa.app.model.GroupResponse
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.EdgeToEdgeInsets
import xyz.yenkasa.app.util.TokenManager

class GroupProfileActivity : AppCompatActivity() {
    private lateinit var groupImage: ImageView
    private lateinit var groupName: TextView
    private lateinit var groupBio: TextView
    private lateinit var memberCount: TextView
    private lateinit var addMembersButton: Button
    private lateinit var membersAdapter: GroupProfileMemberAdapter

    private val groupId: String
        get() = intent.getStringExtra("groupId").orEmpty()
    private val currentUserId: String
        get() = TokenManager.getUserId(this).orEmpty()
    private var currentGroup: ChatRoom? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_group_profile)
        EdgeToEdgeInsets.setLightSystemBars(window, lightStatusBars = true, lightNavigationBars = false)
        EdgeToEdgeInsets.applySystemBarPadding(findViewById(R.id.groupProfileHeader), top = true)

        groupImage = findViewById(R.id.imageGroupProfile)
        groupName = findViewById(R.id.textGroupProfileName)
        groupBio = findViewById(R.id.textGroupProfileBio)
        memberCount = findViewById(R.id.textGroupProfileMembers)
        addMembersButton = findViewById(R.id.buttonAddGroupMembers)
        membersAdapter = GroupProfileMemberAdapter()

        findViewById<ImageView>(R.id.buttonBackGroupProfile).setOnClickListener { finish() }
        findViewById<RecyclerView>(R.id.recyclerGroupProfileMembers).apply {
            layoutManager = LinearLayoutManager(this@GroupProfileActivity)
            adapter = membersAdapter
        }

        addMembersButton.setOnClickListener { openAddMembers() }
        bindInitialExtras()
    }

    override fun onResume() {
        super.onResume()
        loadGroupProfile()
    }

    private fun bindInitialExtras() {
        val initialName = intent.getStringExtra("groupName").orEmpty()
        val initialImage = intent.getStringExtra("groupImage").orEmpty()
        val initialMemberCount = intent.getIntExtra("groupMemberCount", 0)

        groupName.text = initialName.ifBlank { "Yenkasa Group" }
        memberCount.text = if (initialMemberCount > 0) "$initialMemberCount members" else "Group chat"
        groupBio.text = "Loading group details..."

        Glide.with(this)
            .load(initialImage)
            .placeholder(R.drawable.ic_default_profile)
            .error(R.drawable.ic_default_profile)
            .circleCrop()
            .into(groupImage)
    }

    private fun loadGroupProfile() {
        if (groupId.isBlank()) {
            Toast.makeText(this, "Group details unavailable", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        ApiClient.apiService.getSingleGroup(groupId).enqueue(object : Callback<GroupResponse> {
            override fun onResponse(call: Call<GroupResponse>, response: Response<GroupResponse>) {
                val group = response.body()?.group
                if (!response.isSuccessful || group == null) {
                    Toast.makeText(this@GroupProfileActivity, "Could not load group profile", Toast.LENGTH_SHORT).show()
                    return
                }
                bindGroup(group)
            }

            override fun onFailure(call: Call<GroupResponse>, t: Throwable) {
                Log.e("GroupProfileActivity", "Could not load group profile: ${t.message}", t)
                Toast.makeText(this@GroupProfileActivity, "Could not load group profile: ${t.message}", Toast.LENGTH_SHORT).show()
            }
        })
    }

    private fun bindGroup(group: ChatRoom) {
        currentGroup = group
        groupName.text = group.groupName ?: "Yenkasa Group"
        groupBio.text = group.groupBio?.takeIf { it.isNotBlank() } ?: "No group bio yet"
        memberCount.text = if (group.memberCount > 0) "${group.memberCount} members" else "Group chat"
        membersAdapter.submitList(group.participants.orEmpty())

        Glide.with(this)
            .load(group.groupImage.orEmpty())
            .placeholder(R.drawable.ic_default_profile)
            .error(R.drawable.ic_default_profile)
            .circleCrop()
            .into(groupImage)

        val canAddMembers = group.groupCreatedBy == currentUserId || group.groupAdmins.contains(currentUserId)
        addMembersButton.visibility = if (canAddMembers) View.VISIBLE else View.GONE
    }

    private fun openAddMembers() {
        val group = currentGroup
        if (group == null) {
            Toast.makeText(this, "Group details still loading", Toast.LENGTH_SHORT).show()
            return
        }
        startActivity(Intent(this, GroupContactsSelectorActivity::class.java).apply {
            putExtra("mode", "addMembers")
            putExtra("groupId", group._id)
            putStringArrayListExtra(
                "existingMemberIds",
                ArrayList(group.participants.orEmpty().map { it._id })
            )
        })
    }
}
