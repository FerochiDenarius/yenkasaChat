package com.example.yenkasachat.ui

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.widget.Button
import android.widget.ImageView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.bumptech.glide.Glide
import com.example.yenkasachat.R
import com.example.yenkasachat.model.UpdateProfileRequest
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

class EditProfileActivity : AppCompatActivity() {

    private lateinit var imageProfile: ImageView
    private lateinit var usernameView: TextInputEditText
    private lateinit var emailView: TextInputEditText
    private lateinit var phoneView: TextInputEditText
    private lateinit var locationView: TextInputEditText
    private lateinit var btnSave: Button
    private val TAG = "EditProfileActivity"

    private var selectedImageUri: Uri? = null

    private val imagePickerLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            if (result.resultCode == RESULT_OK) {
                result.data?.data?.let { uri ->
                    selectedImageUri = uri
                    Glide.with(this).load(uri).circleCrop().into(imageProfile)
                    uploadImageToServer(uri)
                }
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_edit_profile)

        bindViews()
        loadCurrentData()

        imageProfile.setOnClickListener { openImagePicker() }
        btnSave.setOnClickListener { saveUserProfile() }
    }

    private fun bindViews() {
        imageProfile = findViewById(R.id.imageProfile)
        usernameView = findViewById(R.id.editUsername)
        emailView = findViewById(R.id.editEmail)
        phoneView = findViewById(R.id.editPhone)
        locationView = findViewById(R.id.editLocation)
        btnSave = findViewById(R.id.btnSave)
    }

    private fun loadCurrentData() {
        usernameView.setText(TokenManager.getUsername(this))
        emailView.setText(TokenManager.getEmail(this))
        phoneView.setText(TokenManager.getPhone(this))
        locationView.setText(TokenManager.getLocation(this))

        val profileUrl = TokenManager.getProfilePicUrl(this)
        Glide.with(this)
            .load(profileUrl ?: R.drawable.default_avatar)
            .circleCrop()
            .into(imageProfile)
    }

    private fun openImagePicker() {
        val intent = Intent(Intent.ACTION_PICK).apply { type = "image/*" }
        imagePickerLauncher.launch(intent)
    }

    private fun saveUserProfile() {
        lifecycleScope.launch {
            try {
                val request = UpdateProfileRequest(
                    username = usernameView.text.toString().trim(),
                    email = emailView.text.toString().trim(),
                    phone = phoneView.text.toString().trim(),
                    location = locationView.text.toString().trim()
                )

                val response = ApiClient.apiService.updateProfile(request)
                if (response.isSuccessful) {
                    Toast.makeText(this@EditProfileActivity, "Profile saved successfully!", Toast.LENGTH_SHORT).show()

                    // Save updated info locally
                    TokenManager.savePartialUserDetails(
                        this@EditProfileActivity,
                        request.username,
                        request.email,
                        request.phone,
                        request.location
                    )

                    setResult(Activity.RESULT_OK)
                    finish()
                } else {
                    Toast.makeText(this@EditProfileActivity, "Save failed. Please try again.", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(this@EditProfileActivity, "Network error: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    /** Uploads new image to backend (Cloudinary via your API) */
    private fun uploadImageToServer(uri: Uri) {
        val file = createTempFileFromUri(uri) ?: return
        val mimeType = contentResolver.getType(uri) ?: "image/*"
        val requestBody = file.asRequestBody(mimeType.toMediaTypeOrNull())
        val multipart = MultipartBody.Part.createFormData("profileImage", file.name, requestBody)

        lifecycleScope.launch {
            try {
                val response = ApiClient.apiService.uploadProfilePicture(multipart)

                if (response.isSuccessful) {
                    val profileResponse = response.body()
                    val imageUrl = profileResponse?.profileImage // ✅ Match your model

                    if (!imageUrl.isNullOrEmpty()) {
                        TokenManager.saveProfilePicUrl(this@EditProfileActivity, imageUrl)
                        Toast.makeText(
                            this@EditProfileActivity,
                            "Profile image updated!",
                            Toast.LENGTH_SHORT
                        ).show()
                    } else {
                        Toast.makeText(
                            this@EditProfileActivity,
                            "Upload succeeded but no image URL returned.",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                } else {
                    Toast.makeText(
                        this@EditProfileActivity,
                        "Failed to upload image (${response.code()})",
                        Toast.LENGTH_SHORT
                    ).show()
                }

            } catch (e: Exception) {
                Log.e(TAG, "Upload failed: ${e.message}", e)
                Toast.makeText(
                    this@EditProfileActivity,
                    "Upload error: ${e.message}",
                    Toast.LENGTH_SHORT
                ).show()
            }
        }
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
}
