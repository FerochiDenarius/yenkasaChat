package com.example.yenkasachat.ui

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.widget.Button
import androidx.activity.result.contract.ActivityResultContracts
import android.widget.ImageView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.example.yenkasachat.R
import com.example.yenkasachat.adapter.ProfilePostAdapter
import com.example.yenkasachat.model.Post
import com.example.yenkasachat.model.UpdateProfileRequest
import com.example.yenkasachat.model.User
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
import com.google.android.material.textfield.TextInputEditText
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.io.File
import java.io.FileOutputStream

class AccountInfoActivity : AppCompatActivity() {

    private lateinit var imageProfile: ImageView
    private lateinit var usernameView: TextInputEditText
    private lateinit var emailView: TextInputEditText
    private lateinit var phoneView: TextInputEditText
    private lateinit var locationView: TextInputEditText
    private lateinit var btnEditSave: Button
    private lateinit var recyclerUserPosts: RecyclerView

    private lateinit var profilePostAdapter: ProfilePostAdapter
    private val userPostsList = mutableListOf<Post>()

    private var isEditing = false
    private val TAG = "AccountInfoActivity"

    private val imagePickerLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            if (result.resultCode == RESULT_OK) {
                result.data?.data?.let { uri ->
                    Glide.with(this).load(uri).circleCrop().into(imageProfile)
                    uploadImageToServer(uri)
                }
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_account_info)

        bindViews()
        setupRecyclerView()
        loadProfileFromToken()
        loadUserPosts()
        setupListeners()
    }

    private fun bindViews() {
        imageProfile = findViewById(R.id.imageProfile)
        usernameView = findViewById(R.id.textUsername)
        emailView = findViewById(R.id.textEmail)
        phoneView = findViewById(R.id.textPhone)
        locationView = findViewById(R.id.textLocation)
        btnEditSave = findViewById(R.id.btnEditSave)
        recyclerUserPosts = findViewById(R.id.recyclerUserPosts)
    }

    private fun setupRecyclerView() {
        profilePostAdapter = ProfilePostAdapter(userPostsList)
        recyclerUserPosts.adapter = profilePostAdapter
        recyclerUserPosts.layoutManager = GridLayoutManager(this, 3)
        recyclerUserPosts.isNestedScrollingEnabled = false
    }

    private fun setupListeners() {
        btnEditSave.setOnClickListener {
            isEditing = !isEditing
            setFieldsEnabled(isEditing)
            btnEditSave.text = if (isEditing) "Save" else "Edit"

            if (!isEditing) saveUserProfile()
        }

        imageProfile.setOnClickListener {
            val intent = Intent(Intent.ACTION_PICK).apply { type = "image/*" }
            imagePickerLauncher.launch(intent)
        }

        findViewById<TextInputEditText>(R.id.textFollowersCount).setOnClickListener {
            openFollowList("followers")
        }

        findViewById<TextInputEditText>(R.id.textFollowingCount).setOnClickListener {
            openFollowList("following")
        }
    }

    private fun setFieldsEnabled(enabled: Boolean) {
        usernameView.isEnabled = enabled
        emailView.isEnabled = enabled
        phoneView.isEnabled = enabled
        locationView.isEnabled = enabled
    }

    private fun loadProfileFromToken() {
        usernameView.setText(TokenManager.getUsername(this) ?: "")
        emailView.setText(TokenManager.getEmail(this) ?: "")
        phoneView.setText(TokenManager.getPhone(this) ?: "")
        locationView.setText(TokenManager.getLocation(this) ?: "")

        val profileUrl = TokenManager.getProfilePicUrl(this)
        Glide.with(this)
            .load(profileUrl ?: R.drawable.default_avatar)
            .circleCrop()
            .into(imageProfile)
    }

    private fun loadUserPosts() {
        val userId = TokenManager.getUserId(this) ?: return
        val token = TokenManager.getToken(this) ?: return

        ApiClient.apiService.getPostsForUser("Bearer $token", userId)
            .enqueue(object : Callback<List<Post>> {
                override fun onResponse(call: Call<List<Post>>, response: Response<List<Post>>) {
                    if (response.isSuccessful) {
                        userPostsList.clear()
                        response.body()?.let { userPostsList.addAll(it) }
                        profilePostAdapter.notifyDataSetChanged()
                    }
                }

                override fun onFailure(call: Call<List<Post>>, t: Throwable) {
                    Log.e(TAG, "Failed to load posts: ${t.message}")
                }
            })
    }

    private fun saveUserProfile() {
        val updatedUser = UpdateProfileRequest(
            username = usernameView.text.toString(),
            email = emailView.text.toString(),
            phone = phoneView.text.toString(),
            location = locationView.text.toString()
        )

        lifecycleScope.launch {
            try {
                val response = ApiClient.apiService.updateProfile(updatedUser)
                if (response.isSuccessful) {
                    TokenManager.saveUserDetails(
                        this@AccountInfoActivity,
                        TokenManager.getUserId(this@AccountInfoActivity),
                        updatedUser.username,
                        updatedUser.email,
                        updatedUser.phone,
                        TokenManager.isVerified(this@AccountInfoActivity),
                        TokenManager.getProfilePicUrl(this@AccountInfoActivity),
                        updatedUser.location
                    )
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error saving profile: ${e.message}")
            }
        }
    }

    private fun uploadImageToServer(uri: Uri) {
        val file = createTempFileFromUri(uri) ?: return
        val mimeType = contentResolver.getType(uri) ?: "image/*"
        val requestBody = file.asRequestBody(mimeType.toMediaTypeOrNull())
        val multipart = MultipartBody.Part.createFormData("profileImage", file.name, requestBody)

        ApiClient.apiService.uploadProfilePicture(multipart)
            .enqueue(object : Callback<Map<String, Any>> {
                override fun onResponse(call: Call<Map<String, Any>>, response: Response<Map<String, Any>>) {
                    if (response.isSuccessful) {
                        val url = response.body()?.get("imageUrl") as? String
                        url?.let { TokenManager.saveProfilePicUrl(this@AccountInfoActivity, it) }
                    }
                }

                override fun onFailure(call: Call<Map<String, Any>>, t: Throwable) {
                    Log.e(TAG, "Upload failed: ${t.message}")
                }
            })
    }

    private fun createTempFileFromUri(uri: Uri): File? {
        return try {
            val inputStream = contentResolver.openInputStream(uri) ?: return null
            val tempFile = File.createTempFile("upload_", ".tmp", cacheDir)
            FileOutputStream(tempFile).use { inputStream.copyTo(it) }
            inputStream.close()
            tempFile
        } catch (e: Exception) {
            Log.e(TAG, "File creation failed: ${e.message}")
            null
        }
    }

    private fun openFollowList(type: String) {
        val intent = Intent(this, FollowListActivity::class.java)
        intent.putExtra("TYPE", type)
        intent.putExtra("USER_ID", TokenManager.getUserId(this))
        startActivity(intent)
    }
}
