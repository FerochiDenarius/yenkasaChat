package xyz.yenkasa.app.ui

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import xyz.yenkasa.app.R
import xyz.yenkasa.app.adapter.ChatRoomAdapter
import xyz.yenkasa.app.model.GroupsListResponse
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.EdgeToEdgeInsets
import xyz.yenkasa.app.util.TokenManager

class GroupListActivity : AppCompatActivity() {
    private lateinit var adapter: ChatRoomAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_group_list)
        EdgeToEdgeInsets.setLightSystemBars(window, lightStatusBars = true, lightNavigationBars = false)
        EdgeToEdgeInsets.applySystemBarPadding(findViewById<TextView>(R.id.groupListHeader), top = true)

        val currentUserId = TokenManager.getUserId(this).orEmpty()
        adapter = ChatRoomAdapter(currentUserId) { group ->
            startActivity(Intent(this, GroupChatActivity::class.java).apply {
                putExtra("roomId", group._id)
                putExtra("chatPartnerName", group.groupName ?: "Yenkasa Group")
                putExtra("groupImage", group.groupImage.orEmpty())
                putExtra("groupMemberCount", group.memberCount)
                putExtra("isGroupChat", true)
            })
        }

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
}
