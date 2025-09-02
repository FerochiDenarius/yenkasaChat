package com.example.yenkasachat.ui

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import android.util.Log
import android.webkit.MimeTypeMap
import android.widget.*
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
// import androidx.lifecycle.lifecycleScope // Not explicitly used for coroutines here, ProfileEditor handles its own scope
import com.bumptech.glide.Glide
import com.example.yenkasachat.R
import com.example.yenkasachat.model.User // Assuming User is your model for profile loading
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
// import kotlinx.coroutines.launch // Not explicitly used for coroutines here
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.io.File
import java.io.FileOutputStream
import java.io.IOException

class AccountInfoActivity : AppCompatActivity() {

    private lateinit var imageProfile: ImageView
    private lateinit var usernameView: EditText
    private lateinit var emailView: EditText
    private lateinit var phoneView: EditText
    private lateinit var locationView: EditText
    private lateinit var textVerifiedStatus: TextView
    private lateinit var btnVerifyAccount: Button

    private lateinit var profileEditor: ProfileEditor // Declare ProfileEditor instance

    private val TAG = "AccountInfoActivity" // For logging

    private val verificationResultLauncher: ActivityResultLauncher<Intent> =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            if (result.resultCode == Activity.RESULT_OK) {
                Log.d(TAG, "Returned from VerificationActivity, refreshing status.")
                updateVerificationStatusDisplay()
                loadUserProfile() // Good idea to reload profile to get latest verification status from backend
            }
        }

    private val imagePickerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            result.data?.data?.let { uri ->
                try {
                    Glide.with(this).load(uri)
                        .placeholder(R.drawable.default_avatar)
                        .error(R.drawable.default_avatar)
                        .circleCrop() // Keep circle crop if you like it
                        .into(imageProfile)
                    Toast.makeText(this, "✅ Image selected, uploading...", Toast.LENGTH_SHORT).show()
                    uploadImageToServer(uri)
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Glide failed or image processing error: ${e.message}", e)
                    Toast.makeText(this, "❌ Failed to display selected image.", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_account_info)

        Log.d(TAG, "onCreate started")

// Initialize ProfileEditor
        profileEditor = ProfileEditor(this,lifecycleScope)
        Log.d(TAG, "ProfileEditor initialized")

        imageProfile = findViewById<ImageView>(R.id.imageProfile)
        usernameView = findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.textUsername)
        emailView = findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.textEmail)
        phoneView = findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.textPhone)
        locationView = findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.textLocation)
        textVerifiedStatus = findViewById<TextView>(R.id.textVerified)
        btnVerifyAccount = findViewById<Button>(R.id.btnVerifyAccount)

        Log.d(TAG, "Views initialized")

// Load initial user info from TokenManager and set it using setText()
        usernameView.setText(TokenManager.getUsername(this) ?: "")
        emailView.setText(TokenManager.getEmail(this) ?: "")
        phoneView.setText(TokenManager.getPhone(this) ?: "")
        locationView.setText(TokenManager.getLocation(this) ?: "")
        Log.d(TAG, "Initial text set from TokenManager")

// Attach auto-save functionality from ProfileEditor
        profileEditor.attachAutoSave(usernameView, "username")
        profileEditor.attachAutoSave(emailView, "email")
        profileEditor.attachAutoSave(phoneView, "phone")
        profileEditor.attachAutoSave(locationView, "location")
        Log.d(TAG, "ProfileEditor auto-save attached to EditTexts")

        updateVerificationStatusDisplay()

        TokenManager.getProfilePicUrl(this)?.let { url ->
            if (url.isNotBlank() && (url.startsWith("http://") || url.startsWith("https://"))) {
                Glide.with(this).load(url)
                    .placeholder(R.drawable.default_avatar)
                    .error(R.drawable.default_avatar)
                    .circleCrop()
                    .into(imageProfile)
            } else {
                Glide.with(this).load(R.drawable.default_avatar).circleCrop().into(imageProfile)
            }
        } ?: run {
            Glide.with(this).load(R.drawable.default_avatar).circleCrop().into(imageProfile)
        }

        loadUserProfile()

        imageProfile.setOnClickListener {
            Log.d(TAG, "imageProfile clicked")
            val intent = Intent(Intent.ACTION_PICK).apply { type = "image/*" }
            imagePickerLauncher.launch(intent)
        }

        btnVerifyAccount.setOnClickListener {
            Log.d(TAG, "btnVerifyAccount clicked. IsVerified: ${TokenManager.isVerified(this)}")
            if (!TokenManager.isVerified(this)) {
                val userEmail = TokenManager.getEmail(this)
                if (userEmail.isNullOrEmpty()) {
                    Toast.makeText(this, "Email not available to start verification.", Toast.LENGTH_LONG).show()
                    Log.w(TAG, "Verification attempted but email is null or empty.")
                    return@setOnClickListener
                }
                val intent = Intent(this, VerificationActivity::class.java)
                intent.putExtra("USER_EMAIL", userEmail)
                Log.d(TAG, "Starting VerificationActivity for email: $userEmail")
                verificationResultLauncher.launch(intent)
            } else {
                Toast.makeText(this, "Your account is already verified.", Toast.LENGTH_SHORT).show()
            }
        }
        Log.d(TAG, "onCreate finished")
    }

    private fun updateVerificationStatusDisplay() {
        val isVerified = TokenManager.isVerified(this)
        Log.d(TAG, "Updating verification status display. IsVerified: $isVerified")
        textVerifiedStatus.text = if (isVerified) "Verified ✅" else "Not Verified ❌"
        btnVerifyAccount.text = if (isVerified) "Account Verified" else "Verify Email / Resend Link"
        btnVerifyAccount.isEnabled = !isVerified
    }

    override fun onResume() {
        super.onResume()
        Log.d(TAG, "onResume called")
        // Refresh verification status and user profile when returning to this activity
        updateVerificationStatusDisplay()
        loadUserProfile() // Good to ensure data is fresh, especially if changes can happen elsewhere
    }

    private fun uploadImageToServer(imageUri: Uri) {
        val file = createTempFileFromUri(imageUri)
        if (file == null) {
            Log.e(TAG, "Could not process image for upload, file is null.")
            Toast.makeText(this, "❌ Could not process image for upload.", Toast.LENGTH_SHORT).show()
            return
        }
        val mimeType = contentResolver.getType(imageUri) ?: "image/*"
        val requestFile = file.asRequestBody(mimeType.toMediaTypeOrNull())
        val multipartBody = MultipartBody.Part.createFormData("profileImage", file.name, requestFile)

        Log.d(TAG, "Attempting to upload profile picture...")
        ApiClient.apiService.uploadProfilePicture(multipartBody)
            .enqueue(object : Callback<Map<String, Any>> {
                override fun onResponse(call: Call<Map<String, Any>>, response: Response<Map<String, Any>>) {
                    if (response.isSuccessful) {
                        val responseBody = response.body()
                        val imageUrl = responseBody?.get("imageUrl") as? String
                        Log.i(TAG, "Upload successful. Image URL: $imageUrl")
                        imageUrl?.let {
                            TokenManager.saveProfilePicUrl(this@AccountInfoActivity, it)
                            Glide.with(this@AccountInfoActivity).load(it)
                                .placeholder(R.drawable.default_avatar)
                                .error(R.drawable.default_avatar)
                                .circleCrop()
                                .into(imageProfile)
                        }
                        Toast.makeText(this@AccountInfoActivity, "✅ Profile picture updated!", Toast.LENGTH_SHORT).show()
                    } else {
                        val errorMsg = response.errorBody()?.string() ?: "Unknown error"
                        Log.e(TAG, "❌ Upload failed: ${response.code()} - ${response.message()}. Error Body: $errorMsg")
                        Toast.makeText(this@AccountInfoActivity, "Upload failed: $errorMsg", Toast.LENGTH_LONG).show()
                    }
                }

                override fun onFailure(call: Call<Map<String, Any>>, t: Throwable) {
                    Log.e(TAG, "❌ Upload network failure: ${t.message}", t)
                    Toast.makeText(this@AccountInfoActivity, "❌ Upload error: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun loadUserProfile() {
        Log.d(TAG, "Loading user profile...")
        if (TokenManager.getToken(this).isNullOrEmpty()) {
            Log.w(TAG, "No token found, user might not be logged in. Profile load might fail or be handled by interceptor.")
            // Consider if you want to prevent the call or show a login prompt
        }

        ApiClient.apiService.getUserProfile()
            .enqueue(object : Callback<User> {
                override fun onResponse(call: Call<User>, response: Response<User>) {
                    if (response.isSuccessful) {
                        val user = response.body()
                        Log.i(TAG, "User profile loaded successfully: ${user?.username}")
                        user?.let { currentUser ->
                            TokenManager.saveUserDetails(
                                this@AccountInfoActivity,
                                currentUser._id,
                                currentUser.username,
                                currentUser.email,
                                currentUser.phone,
                                currentUser.verified,
                                currentUser.profileImage,
                                currentUser.location
                            )

                            // Update UI elements directly using setText for EditTexts
                            usernameView.setText(currentUser.username ?: "")
                            emailView.setText(currentUser.email ?: "")
                            phoneView.setText(currentUser.phone ?: "")
                            locationView.setText(currentUser.location ?: "")
                            Log.d(TAG, "EditText fields updated from network response.")

                            updateVerificationStatusDisplay() // Refresh status based on fresh data

                            currentUser.profileImage?.let { url ->
                                if (url.isNotBlank() && (url.startsWith("http://") || url.startsWith("https://"))) {
                                    Glide.with(this@AccountInfoActivity)
                                        .load(url)
                                        .placeholder(R.drawable.default_avatar)
                                        .error(R.drawable.default_avatar)
                                        .circleCrop()
                                        .into(imageProfile)
                                } else {
                                    Glide.with(this@AccountInfoActivity).load(R.drawable.default_avatar).circleCrop().into(imageProfile)
                                }
                            } ?: run {
                                Glide.with(this@AccountInfoActivity).load(R.drawable.default_avatar).circleCrop().into(imageProfile)
                            }
                        }
                    } else {
                        val errorMsg = response.errorBody()?.string() ?: "Unknown error"
                        Log.e(TAG, "❌ Failed to load profile: ${response.code()} - ${response.message()}. Error: $errorMsg")
                        // Optionally, show a toast to the user about failing to load profile
                        // Toast.makeText(this@AccountInfoActivity, "Failed to load profile details.", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<User>, t: Throwable) {
                    Log.e(TAG, "❌ Profile load network failure: ${t.message}", t)
                    Toast.makeText(this@AccountInfoActivity, "Network error loading profile.", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun createTempFileFromUri(uri: Uri): File? {
        return try {
            val fileName = getFileName(uri) ?: "temp_image_${System.currentTimeMillis()}"
            val inputStream = contentResolver?.openInputStream(uri) ?: run {
                Log.e(TAG, "Content resolver or input stream is null for URI: $uri")
                return null
            }
            // Use a proper extension from mime type
            val extension = MimeTypeMap.getSingleton().getExtensionFromMimeType(contentResolver.getType(uri)) ?: "tmp"
            val tempFile = File.createTempFile("upload_", ".$extension", cacheDir)

            FileOutputStream(tempFile).use { outputStream ->
                inputStream.copyTo(outputStream)
            }
            inputStream.close()
            Log.d(TAG, "Temp file created: ${tempFile.absolutePath}")
            tempFile
        } catch (e: Exception) {
            Log.e(TAG, "❌ File URI to File conversion failed: ${e.message}", e)
            Toast.makeText(this, "Error processing image file.", Toast.LENGTH_SHORT).show()
            null
        }
    }

    private fun getFileName(uri: Uri): String? {
        var name: String? = null
        if (contentResolver == null) return null // Guard against null contentResolver
        try { // Add try-catch for potential security exceptions
            val cursor = contentResolver.query(uri, null, null, null, null)
            cursor?.use {
                if (it.moveToFirst()) {
                    val nameIndex = it.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (nameIndex != -1) {
                        name = it.getString(nameIndex)
                    }
                }
            }
        } catch (e: SecurityException) {
            Log.e(TAG, "SecurityException in getFileName for URI $uri: ${e.message}")
            // Fallback or rethrow depending on how you want to handle this
        }
        return name
    }
}

