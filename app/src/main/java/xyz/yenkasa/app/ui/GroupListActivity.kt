package xyz.yenkasa.app.ui

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import xyz.yenkasa.app.R
import xyz.yenkasa.app.adapter.ChatRoomAdapter
import xyz.yenkasa.app.model.ChatRoom
import xyz.yenkasa.app.model.GroupResponse
import xyz.yenkasa.app.model.GroupsListResponse
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.EdgeToEdgeInsets
import xyz.yenkasa.app.util.TokenManager

class GroupListActivity : AppCompatActivity() {
    private lateinit var adapter: ChatRoomAdapter
    private var currentUserId: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_group_list)
        EdgeToEdgeInsets.setLightSystemBars(window, lightStatusBars = true, lightNavigationBars = false)
        EdgeToEdgeInsets.applySystemBarPadding(findViewById<TextView>(R.id.groupListHeader), top = true)

        currentUserId = TokenManager.getUserId(this).orEmpty()
        adapter = ChatRoomAdapter(
            currentUserId = currentUserId,
            onChatRoomClick = { group -> openGroup(group) },
            onChatRoomLongClick = { group -> showGroupLongPressOptions(group) }
        )

        findViewById<RecyclerView>(R.id.recyclerGroupList).apply {
            layoutManager = LinearLayoutManager(this@GroupListActivity)
            adapter = this@GroupListActivity.adapter
        }
        findViewById<Button>(R.id.buttonCreateGroup).setOnClickListener {
            startActivity(Intent(this, GroupContactsSelectorActivity::class.java))
        }
    }

    override fun onResume() {
        super.onResume()
        loadGroups()
    }

    private fun loadGroups() {
        ApiClient.apiService.getGroups().enqueue(object : Callback<GroupsListResponse> {
            override fun onResponse(call: Call<GroupsListResponse>, response: Response<GroupsListResponse>) {
                if (!response.isSuccessful) {
                    val errorBody = response.errorBody()?.string().orEmpty()
                    Log.e("GroupListActivity", "Could not load groups. Code=${response.code()} body=$errorBody")
                    Toast.makeText(this@GroupListActivity, "Could not load groups", Toast.LENGTH_SHORT).show()
                    return
                }
                val groups = response.body()?.groups.orEmpty()
                Log.d("GroupListActivity", "Loaded ${groups.size} groups")
                adapter.submitList(groups)
            }

            override fun onFailure(call: Call<GroupsListResponse>, t: Throwable) {
                Log.e("GroupListActivity", "Could not load groups: ${t.message}", t)
                Toast.makeText(this@GroupListActivity, "Could not load groups: ${t.message}", Toast.LENGTH_SHORT).show()
            }
        })
    }

    private fun openGroup(group: ChatRoom) {
        startActivity(Intent(this, GroupChatActivity::class.java).apply {
            putExtra("roomId", group._id)
            putExtra("chatPartnerName", group.groupName ?: "Yenkasa Group")
            putExtra("groupImage", group.groupImage.orEmpty())
            putExtra("groupMemberCount", group.memberCount)
            putExtra("isGroupChat", true)
        })
    }

    private fun showGroupLongPressOptions(group: ChatRoom) {
        val canManage = currentUserId.isNotBlank() &&
            (group.groupCreatedBy == currentUserId || group.groupAdmins.contains(currentUserId))
        val actions = if (canManage) {
            arrayOf("Open group", "Add members", "Delete group")
        } else {
            arrayOf("Open group", "Leave group")
        }

        AlertDialog.Builder(this)
            .setTitle(group.groupName ?: "Yenkasa Group")
            .setItems(actions) { _, which ->
                when (actions[which]) {
                    "Open group" -> openGroup(group)
                    "Add members" -> openGroupAddMembers(group)
                    "Delete group" -> confirmDeleteGroup(group)
                    "Leave group" -> confirmLeaveGroup(group)
                }
            }
            .show()
    }

    private fun openGroupAddMembers(group: ChatRoom) {
        startActivity(Intent(this, GroupContactsSelectorActivity::class.java).apply {
            putExtra("mode", "addMembers")
            putExtra("groupId", group._id)
            putStringArrayListExtra(
                "existingMemberIds",
                ArrayList(group.participants.orEmpty().map { it._id })
            )
        })
    }

    private fun confirmLeaveGroup(group: ChatRoom) {
        AlertDialog.Builder(this)
            .setTitle("Leave group?")
            .setMessage("You will stop receiving messages from ${group.groupName ?: "this group"}.")
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Leave") { _, _ ->
                ApiClient.apiService.leaveGroup(group._id).enqueue(object : Callback<GroupResponse> {
                    override fun onResponse(call: Call<GroupResponse>, response: Response<GroupResponse>) {
                        if (!response.isSuccessful || response.body()?.success == false) {
                            Toast.makeText(this@GroupListActivity, response.body()?.message ?: "Could not leave group", Toast.LENGTH_LONG).show()
                            return
                        }
                        Toast.makeText(this@GroupListActivity, "You left the group", Toast.LENGTH_SHORT).show()
                        loadGroups()
                    }

                    override fun onFailure(call: Call<GroupResponse>, t: Throwable) {
                        Toast.makeText(this@GroupListActivity, "Could not leave group: ${t.message}", Toast.LENGTH_LONG).show()
                    }
                })
            }
            .show()
    }

    private fun confirmDeleteGroup(group: ChatRoom) {
        AlertDialog.Builder(this)
            .setTitle("Delete group?")
            .setMessage("This deletes ${group.groupName ?: "this group"} for all members. This cannot be undone.")
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Delete") { _, _ ->
                ApiClient.apiService.deleteGroup(group._id).enqueue(object : Callback<GroupResponse> {
                    override fun onResponse(call: Call<GroupResponse>, response: Response<GroupResponse>) {
                        if (!response.isSuccessful || response.body()?.success == false) {
                            Toast.makeText(this@GroupListActivity, response.body()?.message ?: "Could not delete group", Toast.LENGTH_LONG).show()
                            return
                        }
                        Toast.makeText(this@GroupListActivity, "Group deleted", Toast.LENGTH_SHORT).show()
                        loadGroups()
                    }

                    override fun onFailure(call: Call<GroupResponse>, t: Throwable) {
                        Toast.makeText(this@GroupListActivity, "Could not delete group: ${t.message}", Toast.LENGTH_LONG).show()
                    }
                })
            }
            .show()
    }
}
