package xyz.yenkasa.app.ui

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ImageView
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.bumptech.glide.Glide
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.GroupCreateRequest
import xyz.yenkasa.app.model.GroupImageUploadResponse
import xyz.yenkasa.app.model.GroupResponse
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.EdgeToEdgeInsets
import xyz.yenkasa.app.util.GroupImagePartFactory

class GroupSetupActivity : AppCompatActivity() {
    private val memberIds: List<String> by lazy {
        intent.getStringArrayListExtra("memberIds").orEmpty()
    }
    private var uploadedGroupImageUrl: String = ""
    private var isUploadingGroupImage = false
    private lateinit var imagePreview: ImageView
    private lateinit var imageStatus: TextView
    private lateinit var pickImageButton: Button
    private lateinit var removeImageButton: Button
    private lateinit var imageUploadProgress: ProgressBar
    private lateinit var finishButton: Button

    private val pickGroupImage = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) {
            showLocalPreview(uri)
            uploadGroupImage(uri)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_group_setup)
        EdgeToEdgeInsets.setLightSystemBars(window, lightStatusBars = true, lightNavigationBars = false)
        EdgeToEdgeInsets.applySystemBarPadding(findViewById(R.id.groupSetupRoot), top = true, bottom = true)

        val nameInput = findViewById<EditText>(R.id.inputGroupName)
        val bioInput = findViewById<EditText>(R.id.inputGroupBio)
        imagePreview = findViewById(R.id.imageGroupPreview)
        imageStatus = findViewById(R.id.textGroupImageStatus)
        pickImageButton = findViewById(R.id.buttonPickGroupImage)
        removeImageButton = findViewById(R.id.buttonRemoveGroupImage)
        imageUploadProgress = findViewById(R.id.progressGroupImageUpload)
        finishButton = findViewById(R.id.buttonFinishGroupSetup)

        pickImageButton.setOnClickListener {
            pickGroupImage.launch("image/*")
        }

        removeImageButton.setOnClickListener {
            uploadedGroupImageUrl = ""
            imageStatus.text = "Add a photo from your gallery"
            removeImageButton.visibility = View.GONE
            Glide.with(this)
                .load(R.drawable.ic_profile_placeholder)
                .circleCrop()
                .into(imagePreview)
        }

        finishButton.setOnClickListener {
            val name = nameInput.text.toString().trim()
            if (name.isBlank()) {
                Toast.makeText(this, "Enter a group name", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            if (isUploadingGroupImage) {
                Toast.makeText(this, "Wait for the group image to finish uploading", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            createGroup(
                GroupCreateRequest(
                    groupName = name,
                    groupBio = bioInput.text.toString().trim(),
                    groupImage = uploadedGroupImageUrl,
                    memberIds = memberIds
                )
            )
        }
    }

    private fun showLocalPreview(uri: Uri) {
        Glide.with(this)
            .load(uri)
            .placeholder(R.drawable.ic_profile_placeholder)
            .error(R.drawable.ic_profile_placeholder)
            .circleCrop()
            .into(imagePreview)
        imageStatus.text = "Uploading image..."
        removeImageButton.visibility = View.GONE
    }

    private fun setUploading(uploading: Boolean) {
        isUploadingGroupImage = uploading
        imageUploadProgress.visibility = if (uploading) View.VISIBLE else View.GONE
        pickImageButton.isEnabled = !uploading
        removeImageButton.isEnabled = !uploading
        finishButton.isEnabled = !uploading
    }

    private fun uploadGroupImage(uri: Uri) {
        val part = try {
            GroupImagePartFactory.create(this, uri)
        } catch (err: Exception) {
            null
        }

        if (part == null) {
            imageStatus.text = "Could not read selected image"
            Toast.makeText(this, "Could not read selected image", Toast.LENGTH_LONG).show()
            return
        }

        setUploading(true)
        ApiClient.apiService.uploadGroupImage(part).enqueue(object : Callback<GroupImageUploadResponse> {
            override fun onResponse(
                call: Call<GroupImageUploadResponse>,
                response: Response<GroupImageUploadResponse>
            ) {
                setUploading(false)
                val bodyResponse = response.body()
                val imageUrl = bodyResponse?.imageUrl ?: bodyResponse?.url
                if (!response.isSuccessful || bodyResponse?.success != true || imageUrl.isNullOrBlank()) {
                    imageStatus.text = bodyResponse?.message ?: "Image upload failed"
                    Toast.makeText(this@GroupSetupActivity, bodyResponse?.message ?: "Image upload failed", Toast.LENGTH_LONG).show()
                    return
                }

                uploadedGroupImageUrl = imageUrl
                imageStatus.text = "Group image added"
                pickImageButton.text = "Change Image"
                removeImageButton.visibility = View.VISIBLE
            }

            override fun onFailure(call: Call<GroupImageUploadResponse>, t: Throwable) {
                setUploading(false)
                imageStatus.text = "Image upload failed"
                Toast.makeText(this@GroupSetupActivity, "Image upload failed: ${t.message}", Toast.LENGTH_LONG).show()
            }
        })
    }

    private fun createGroup(request: GroupCreateRequest) {
        finishButton.isEnabled = false
        ApiClient.apiService.createGroup(request).enqueue(object : Callback<GroupResponse> {
            override fun onResponse(call: Call<GroupResponse>, response: Response<GroupResponse>) {
                finishButton.isEnabled = true
                val body = response.body()
                val group = body?.group
                if (!response.isSuccessful || body?.success != true || group == null) {
                    Toast.makeText(this@GroupSetupActivity, body?.message ?: "Could not create group", Toast.LENGTH_LONG).show()
                    return
                }

                startActivity(Intent(this@GroupSetupActivity, GroupChatActivity::class.java).apply {
                    putExtra("roomId", group._id)
                    putExtra("chatPartnerName", group.groupName ?: request.groupName)
                    putExtra("groupImage", group.groupImage ?: request.groupImage)
                    putExtra("groupMemberCount", group.memberCount)
                    putExtra("isGroupChat", true)
                })
                finish()
            }

            override fun onFailure(call: Call<GroupResponse>, t: Throwable) {
                finishButton.isEnabled = true
                Toast.makeText(this@GroupSetupActivity, "Could not create group: ${t.message}", Toast.LENGTH_LONG).show()
            }
        })
    }
}
