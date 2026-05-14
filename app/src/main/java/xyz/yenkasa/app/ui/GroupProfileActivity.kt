package xyz.yenkasa.app.ui

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.Button
import android.widget.ImageView
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.ChatRoom
import xyz.yenkasa.app.model.GroupImageUploadResponse
import xyz.yenkasa.app.model.GroupProfileUpdateRequest
import xyz.yenkasa.app.model.GroupResponse
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.EdgeToEdgeInsets
import xyz.yenkasa.app.util.GroupImagePartFactory
import xyz.yenkasa.app.util.TokenManager

class GroupProfileActivity : AppCompatActivity() {
    private lateinit var groupImage: ImageView
    private lateinit var groupName: TextView
    private lateinit var groupBio: TextView
    private lateinit var memberCount: TextView
    private lateinit var addMembersButton: Button
    private lateinit var changeImageButton: Button
    private lateinit var imageActionsLayout: View
    private lateinit var imageUploadProgress: ProgressBar
    private lateinit var imageStatus: TextView
    private lateinit var membersAdapter: GroupProfileMemberAdapter

    private val groupId: String
        get() = intent.getStringExtra("groupId").orEmpty()
    private val currentUserId: String
        get() = TokenManager.getUserId(this).orEmpty()
    private var currentGroup: ChatRoom? = null
    private var canManageCurrentGroup: Boolean = false
    private var isUpdatingImage: Boolean = false

    private val pickGroupImage = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) {
            showLocalImagePreview(uri)
            uploadAndApplyGroupImage(uri)
        }
    }

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
        changeImageButton = findViewById(R.id.buttonChangeGroupImage)
        imageActionsLayout = findViewById(R.id.layoutGroupProfileImageActions)
        imageUploadProgress = findViewById(R.id.progressGroupProfileImage)
        imageStatus = findViewById(R.id.textGroupProfileImageStatus)
        membersAdapter = GroupProfileMemberAdapter()

        findViewById<ImageView>(R.id.buttonBackGroupProfile).setOnClickListener { finish() }
        findViewById<RecyclerView>(R.id.recyclerGroupProfileMembers).apply {
            layoutManager = LinearLayoutManager(this@GroupProfileActivity)
            adapter = membersAdapter
        }

        addMembersButton.setOnClickListener { openAddMembers() }
        changeImageButton.setOnClickListener { launchGroupImagePicker() }
        groupImage.setOnClickListener {
            if (canManageCurrentGroup) launchGroupImagePicker() else openImageHint()
        }
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

        groupName.text = initialName.ifBlank { getString(R.string.group_default_name) }
        memberCount.text = if (initialMemberCount > 0) {
            resources.getQuantityString(R.plurals.members_count, initialMemberCount, initialMemberCount)
        } else {
            getString(R.string.group_chat)
        }
        groupBio.text = getString(R.string.group_loading_details)

        Glide.with(this)
            .load(initialImage)
            .placeholder(R.drawable.ic_default_profile)
            .error(R.drawable.ic_default_profile)
            .circleCrop()
            .into(groupImage)
    }

    private fun loadGroupProfile() {
        if (groupId.isBlank()) {
            Toast.makeText(this, getString(R.string.group_details_unavailable), Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        ApiClient.apiService.getSingleGroup(groupId).enqueue(object : Callback<GroupResponse> {
            override fun onResponse(call: Call<GroupResponse>, response: Response<GroupResponse>) {
                val group = response.body()?.group
                if (!response.isSuccessful || group == null) {
                    Toast.makeText(this@GroupProfileActivity, getString(R.string.group_could_not_load_profile), Toast.LENGTH_SHORT).show()
                    return
                }
                bindGroup(group)
            }

            override fun onFailure(call: Call<GroupResponse>, t: Throwable) {
                Log.e("GroupProfileActivity", "Could not load group profile: ${t.message}", t)
                Toast.makeText(this@GroupProfileActivity, getString(R.string.group_could_not_load_profile_with_error, t.message), Toast.LENGTH_SHORT).show()
            }
        })
    }

    private fun bindGroup(group: ChatRoom) {
        currentGroup = group
        groupName.text = group.groupName ?: getString(R.string.group_default_name)
        groupBio.text = group.groupBio?.takeIf { it.isNotBlank() } ?: getString(R.string.group_no_bio_yet)
        memberCount.text = if (group.memberCount > 0) {
            resources.getQuantityString(R.plurals.members_count, group.memberCount, group.memberCount)
        } else {
            getString(R.string.group_chat)
        }
        membersAdapter.submitList(group.participants.orEmpty())

        Glide.with(this)
            .load(group.groupImage.orEmpty())
            .placeholder(R.drawable.ic_default_profile)
            .error(R.drawable.ic_default_profile)
            .circleCrop()
            .into(groupImage)

        val canAddMembers = group.groupCreatedBy == currentUserId || group.groupAdmins.contains(currentUserId)
        canManageCurrentGroup = canAddMembers
        addMembersButton.visibility = if (canAddMembers) View.VISIBLE else View.GONE
        imageActionsLayout.visibility = if (canAddMembers) View.VISIBLE else View.GONE
        groupImage.isClickable = true
        groupImage.contentDescription = getString(
            if (canAddMembers) R.string.group_change_image_content_description else R.string.group_image
        )
        if (!isUpdatingImage) {
            imageStatus.visibility = View.GONE
        }
    }

    private fun launchGroupImagePicker() {
        if (!canManageCurrentGroup) {
            openImageHint()
            return
        }
        if (isUpdatingImage) {
            Toast.makeText(this, getString(R.string.group_wait_image_update), Toast.LENGTH_SHORT).show()
            return
        }
        pickGroupImage.launch("image/*")
    }

    private fun openImageHint() {
        Toast.makeText(this, getString(R.string.group_admins_change_image_only), Toast.LENGTH_SHORT).show()
    }

    private fun showLocalImagePreview(uri: Uri) {
        Glide.with(this)
            .load(uri)
            .placeholder(R.drawable.ic_default_profile)
            .error(R.drawable.ic_default_profile)
            .circleCrop()
            .into(groupImage)
        imageStatus.text = getString(R.string.group_uploading_image)
        imageStatus.visibility = View.VISIBLE
    }

    private fun setImageUpdating(updating: Boolean) {
        isUpdatingImage = updating
        imageUploadProgress.visibility = if (updating) View.VISIBLE else View.GONE
        changeImageButton.isEnabled = !updating
        addMembersButton.isEnabled = !updating
    }

    private fun uploadAndApplyGroupImage(uri: Uri) {
        val part = try {
            GroupImagePartFactory.create(this, uri)
        } catch (err: Exception) {
            null
        }

        if (part == null) {
            imageStatus.text = getString(R.string.group_could_not_read_selected_image)
            Toast.makeText(this, getString(R.string.group_could_not_read_selected_image), Toast.LENGTH_LONG).show()
            return
        }

        setImageUpdating(true)
        ApiClient.apiService.uploadGroupImage(part).enqueue(object : Callback<GroupImageUploadResponse> {
            override fun onResponse(
                call: Call<GroupImageUploadResponse>,
                response: Response<GroupImageUploadResponse>
            ) {
                val body = response.body()
                val imageUrl = body?.imageUrl ?: body?.url
                if (!response.isSuccessful || body?.success != true || imageUrl.isNullOrBlank()) {
                    setImageUpdating(false)
                    imageStatus.text = body?.message ?: getString(R.string.group_image_upload_failed)
                    Toast.makeText(this@GroupProfileActivity, body?.message ?: getString(R.string.group_image_upload_failed), Toast.LENGTH_LONG).show()
                    return
                }
                saveGroupImage(imageUrl)
            }

            override fun onFailure(call: Call<GroupImageUploadResponse>, t: Throwable) {
                setImageUpdating(false)
                imageStatus.text = getString(R.string.group_image_upload_failed)
                Toast.makeText(this@GroupProfileActivity, getString(R.string.group_image_upload_failed_with_error, t.message), Toast.LENGTH_LONG).show()
            }
        })
    }

    private fun saveGroupImage(imageUrl: String) {
        imageStatus.text = getString(R.string.group_saving_image)
        ApiClient.apiService.updateGroupProfile(
            groupId,
            GroupProfileUpdateRequest(groupImage = imageUrl)
        ).enqueue(object : Callback<GroupResponse> {
            override fun onResponse(call: Call<GroupResponse>, response: Response<GroupResponse>) {
                setImageUpdating(false)
                val body = response.body()
                val group = body?.group
                if (!response.isSuccessful || body?.success != true || group == null) {
                    imageStatus.text = body?.message ?: getString(R.string.group_could_not_save_image)
                    Toast.makeText(this@GroupProfileActivity, body?.message ?: getString(R.string.group_could_not_save_image), Toast.LENGTH_LONG).show()
                    return
                }

                intent.putExtra("groupImage", group.groupImage.orEmpty())
                setResult(RESULT_OK, Intent().apply {
                    putExtra("groupId", group._id)
                    putExtra("groupName", group.groupName.orEmpty())
                    putExtra("groupImage", group.groupImage.orEmpty())
                    putExtra("groupMemberCount", group.memberCount)
                })
                imageStatus.text = getString(R.string.group_image_updated)
                Toast.makeText(this@GroupProfileActivity, getString(R.string.group_image_updated), Toast.LENGTH_SHORT).show()
                bindGroup(group)
            }

            override fun onFailure(call: Call<GroupResponse>, t: Throwable) {
                setImageUpdating(false)
                imageStatus.text = getString(R.string.group_could_not_save_image)
                Toast.makeText(this@GroupProfileActivity, getString(R.string.group_could_not_save_image_with_error, t.message), Toast.LENGTH_LONG).show()
            }
        })
    }

    private fun openAddMembers() {
        val group = currentGroup
        if (group == null) {
            Toast.makeText(this, getString(R.string.group_details_still_loading), Toast.LENGTH_SHORT).show()
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
