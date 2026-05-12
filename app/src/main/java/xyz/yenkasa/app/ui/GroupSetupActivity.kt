package xyz.yenkasa.app.ui

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.GroupCreateRequest
import xyz.yenkasa.app.model.GroupResponse
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.EdgeToEdgeInsets

class GroupSetupActivity : AppCompatActivity() {
    private val memberIds: List<String> by lazy {
        intent.getStringArrayListExtra("memberIds").orEmpty()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_group_setup)
        EdgeToEdgeInsets.setLightSystemBars(window, lightStatusBars = true, lightNavigationBars = false)
        EdgeToEdgeInsets.applySystemBarPadding(findViewById(R.id.groupSetupRoot), top = true, bottom = true)

        val nameInput = findViewById<EditText>(R.id.inputGroupName)
        val bioInput = findViewById<EditText>(R.id.inputGroupBio)
        val imageInput = findViewById<EditText>(R.id.inputGroupImage)
        val finishButton = findViewById<Button>(R.id.buttonFinishGroupSetup)

        finishButton.setOnClickListener {
            val name = nameInput.text.toString().trim()
            if (name.isBlank()) {
                Toast.makeText(this, "Enter a group name", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            createGroup(
                GroupCreateRequest(
                    groupName = name,
                    groupBio = bioInput.text.toString().trim(),
                    groupImage = imageInput.text.toString().trim(),
                    memberIds = memberIds
                )
            )
        }
    }

    private fun createGroup(request: GroupCreateRequest) {
        ApiClient.apiService.createGroup(request).enqueue(object : Callback<GroupResponse> {
            override fun onResponse(call: Call<GroupResponse>, response: Response<GroupResponse>) {
                val body = response.body()
                val group = body?.group
                if (!response.isSuccessful || body?.success != true || group == null) {
                    Toast.makeText(this@GroupSetupActivity, body?.message ?: "Could not create group", Toast.LENGTH_LONG).show()
                    return
                }

                startActivity(Intent(this@GroupSetupActivity, GroupChatActivity::class.java).apply {
                    putExtra("roomId", group._id)
                    putExtra("chatPartnerName", group.groupName ?: request.groupName)
                    putExtra("isGroupChat", true)
                })
                finish()
            }

            override fun onFailure(call: Call<GroupResponse>, t: Throwable) {
                Toast.makeText(this@GroupSetupActivity, "Could not create group: ${t.message}", Toast.LENGTH_LONG).show()
            }
        })
    }
}
