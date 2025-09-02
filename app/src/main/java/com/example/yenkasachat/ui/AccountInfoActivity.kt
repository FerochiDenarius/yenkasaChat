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
import androidx.lifecycle.lifecycleScope // Added for coroutines
import com.bumptech.glide.Glide
import com.example.yenkasachat.R
import com.example.yenkasachat.model.User
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
import kotlinx.coroutines.launch // Added for coroutines
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import retrofit2.Call // Keep for existing enqueue if not migrating all at once
import retrofit2.Callback // Keep for existing enqueue
import retrofit2.Response // Keep for existing enqueue
import java.io.File
import java.io.FileOutputStream
import java.io.IOException

class AccountInfoActivity : AppCompatActivity() {

    private lateinit var imageProfile: ImageView
    private lateinit var usernameView: TextView
    private lateinit var emailView: TextView
    private lateinit var phoneView: TextView
    private lateinit var locationView: TextView
    private lateinit var textVerifiedStatus: TextView // Renamed for clarity
    private lateinit var btnVerifyAccount: Button

    // Activity result launcher for when VerificationActivity finishes (optional, for immediate UI update)
    private val verificationResultLauncher: ActivityResultLauncher<Intent> =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            if (result.resultCode == Activity.RESULT_OK) {
                // Verification process might have updated the status, refresh UI
                Log.d("AccountInfoActivity", "Returned from VerificationActivity, potentially refresh status.")
                updateVerificationStatusDisplay()
                // Optionally, you could also re-fetch profile if backend is the sole truth
                // loadUserProfile()
            }
        }


    private val imagePickerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            result.data?.data?.let { uri ->
                try {
                    Glide.with(this).load(uri).placeholder(R.drawable.default_avatar)
                        .error(R.drawable.default_avatar).into(imageProfile)
                    Toast.makeText(this, "✅ Image selected, uploading...", Toast.LENGTH_SHORT).show()
                    uploadImageToServer(uri) // Still uses enqueue, consider migrating
                } catch (e: Exception) {
                    Log.e("AccountInfoActivity", "❌ Glide failed or image processing error: ${e.message}", e)
                    Toast.makeText(this, "❌ Failed to display selected image.", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_account_info)

        imageProfile = findViewById(R.id.imageProfile)
        usernameView = findViewById(R.id.textUsername)
        emailView = findViewById(R.id.textEmail)
        phoneView = findViewById(R.id.textPhone)
        locationView = findViewById(R.id.textLocation)
        textVerifiedStatus = findViewById(R.id.textVerified) // Make sure ID matches your layout
        btnVerifyAccount = findViewById(R.id.btnVerifyAccount)

        // Load initial user info from TokenManager
        usernameView.text = TokenManager.getUsername(this) ?: "N/A"
        emailView.text = TokenManager.getEmail(this) ?: "N/A"
        phoneView.text = TokenManager.getPhone(this) ?: "N/A"
        locationView.text = TokenManager.getLocation(this) ?: "N/A"

        updateVerificationStatusDisplay() // Initial status display

        TokenManager.getProfilePicUrl(this)?.let { url ->
            if (url.isNotBlank() && (url.startsWith("http://") || url.startsWith("https://"))) {
                Glide.with(this).load(url).placeholder(R.drawable.default_avatar)
                    .error(R.drawable.default_avatar).into(imageProfile)
            }
        }

        loadUserProfile() // Still uses enqueue, consider migrating

        imageProfile.setOnClickListener {
            val intent = Intent(Intent.ACTION_PICK).apply { type = "image/*" }
            imagePickerLauncher.launch(intent)
        }

        btnVerifyAccount.setOnClickListener {
            if (!TokenManager.isVerified(this)) {
                val userEmail = TokenManager.getEmail(this)
                if (userEmail.isNullOrEmpty()) {
                    Toast.makeText(this, "Email not available to start verification.", Toast.LENGTH_LONG).show()
                    // Potentially prompt user to update their email first or handle this case
                    return@setOnClickListener
                }
                val intent = Intent(this, VerificationActivity::class.java)
                intent.putExtra("USER_EMAIL", userEmail)
                Log.d("AccountInfoActivity", "Starting VerificationActivity for email: $userEmail")
                verificationResultLauncher.launch(intent) // Use launcher
            } else {
                Toast.makeText(this, "Your account is already verified.", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun updateVerificationStatusDisplay() {
        val isVerified = TokenManager.isVerified(this)
        textVerifiedStatus.text = if (isVerified) "Verified ✅" else "Not Verified ❌"
        btnVerifyAccount.text = if (isVerified) "Account Verified" else "Verify Email / Resend Link"
        btnVerifyAccount.isEnabled = !isVerified // Disable button if already verified
    }


    override fun onResume() {
        super.onResume()
        // Refresh verification status when returning to this activity
        // This is important if the user verifies via deep link and then returns
        updateVerificationStatusDisplay()
        // Consider reloading profile if backend is the sole truth for verification
        // loadUserProfile()
    }

    private fun uploadImageToServer(imageUri: Uri) {
        val file = createTempFileFromUri(imageUri)
        if (file == null) {
            Toast.makeText(this, "❌ Could not process image for upload.", Toast.LENGTH_SHORT).show()
            return
        }
        val mimeType = contentResolver.getType(imageUri) ?: "image/*"
        val requestFile = file.asRequestBody(mimeType.toMediaTypeOrNull())
        val multipartBody = MultipartBody.Part.createFormData("profileImage", file.name, requestFile)

        Log.d("AccountInfoActivity", "Attempting to upload profile picture...")
        ApiClient.apiService.uploadProfilePicture(multipartBody)
            .enqueue(object : Callback<Map<String, Any>> {
                override fun onResponse(call: Call<Map<String, Any>>, response: Response<Map<String, Any>>) {
                    if (response.isSuccessful) {
                        val responseBody = response.body()
                        val imageUrl = responseBody?.get("imageUrl") as? String
                        Log.d("AccountInfoActivity", "Upload successful. Image URL: $imageUrl")
                        imageUrl?.let {
                            TokenManager.saveProfilePicUrl(this@AccountInfoActivity, it)
                            Glide.with(this@AccountInfoActivity).load(it)
                                .placeholder(R.drawable.default_avatar).error(R.drawable.default_avatar)
                                .into(imageProfile)
                        }
                        Toast.makeText(this@AccountInfoActivity, "✅ Profile picture updated!", Toast.LENGTH_SHORT).show()
                    } else {
                        Log.e("AccountInfoActivity", "❌ Upload failed: ${response.code()} - ${response.message()}")
                        try {
                            val errorBody = response.errorBody()?.string()
                            Log.e("AccountInfoActivity", "❌ Error Body: $errorBody")
                            Toast.makeText(this@AccountInfoActivity, "Upload failed: ${errorBody ?: "Unknown error"}", Toast.LENGTH_LONG).show()
                        } catch (e: IOException) {
                            Toast.makeText(this@AccountInfoActivity, "Upload failed: Error reading response.", Toast.LENGTH_LONG).show()
                        }
                    }
                }
                override fun onFailure(call: Call<Map<String, Any>>, t: Throwable) {
                    Log.e("AccountInfoActivity", "❌ Upload network failure: ${t.message}", t)
                    Toast.makeText(this@AccountInfoActivity, "❌ Upload error: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun loadUserProfile() {
        if (TokenManager.getToken(this).isNullOrEmpty()) {
            Log.w("AccountInfoActivity", "No token found, user might not be logged in.")
            // Do not proceed if no token, or rely on interceptor to handle (which might lead to errors if API needs auth)
            // return
        }
        Log.d("AccountInfoActivity", "Loading user profile (using enqueue)...")
        // This is a GET request, so no body is needed if token is in interceptor
// Inside AccountInfoActivity.kt, in the onResponse block of loadUserProfile()

// ...
        ApiClient.apiService.getUserProfile()
            .enqueue(object : Callback<User> {
                override fun onResponse(call: Call<User>, response: Response<User>) {
                    if (response.isSuccessful) {
                        val user = response.body()
                        Log.d("AccountInfoActivity", "User profile loaded: ${user?.username}")
                        user?.let { currentUser -> // Using currentUser for clarity
                            // 👇 CORRECTED HERE 👇
                            TokenManager.saveUserDetails(
                                this@AccountInfoActivity,
                                currentUser._id,         // Use currentUser._id
                                currentUser.username,
                                currentUser.email,
                                currentUser.phone,
                                currentUser.verified,    // Use currentUser.verified
                                currentUser.profileImage,
                                currentUser.location     // Use currentUser.location
                            )

                            // Update UI elements directly
                            usernameView.text = currentUser.username ?: "N/A"
                            emailView.text = currentUser.email ?: "N/A"
                            phoneView.text = currentUser.phone ?: "N/A"
                            locationView.text = currentUser.location ?: "N/A" // Ensure locationView is initialized

                            updateVerificationStatusDisplay() // Refresh status based on fresh data

                            currentUser.profileImage?.let { url ->
                                if (url.isNotBlank() && (url.startsWith("http://") || url.startsWith("https://"))) {
                                    Glide.with(this@AccountInfoActivity)
                                        .load(url)
                                        .placeholder(R.drawable.default_avatar)
                                        .error(R.drawable.default_avatar)
                                        .circleCrop() // 🔥 makes it circular
                                        .into(imageProfile)
                                }
                            }
                        }
                    } else {
                        Log.e("AccountInfoActivity", "❌ Failed to load profile: ${response.code()} - ${response.message()}")
                        try {
                            val errorBody = response.errorBody()?.string()
                            Log.e("AccountInfoActivity", "❌ Error Body: $errorBody")
                        } catch (e: IOException) { /* ignore */ }
                    }
                }

                override fun onFailure(call: Call<User>, t: Throwable) {
                    Log.e("AccountInfoActivity", "❌ Profile load network failure: ${t.message}", t)
                }
            })
// ...
    }


    private fun createTempFileFromUri(uri: Uri): File? { /* ... (keep existing implementation) ... */  return try {
        val fileName = getFileName(uri) ?: "temp_image_${System.currentTimeMillis()}"
        val inputStream = contentResolver?.openInputStream(uri) ?: run {
            Log.e("AccountInfoActivity", "Content resolver or input stream is null for URI: $uri")
            return null
        }
        val tempFile = File.createTempFile("upload_", ".${MimeTypeMap.getSingleton().getExtensionFromMimeType(contentResolver.getType(uri)) ?: "tmp"}", cacheDir)
        FileOutputStream(tempFile).use { outputStream ->
            inputStream.copyTo(outputStream)
        }
        inputStream.close()
        Log.d("AccountInfoActivity", "Temp file created: ${tempFile.absolutePath}")
        tempFile
    } catch (e: Exception) {
        Log.e("AccountInfoActivity", "❌ File URI to File conversion failed: ${e.message}", e)
        Toast.makeText(this, "Error processing image file.", Toast.LENGTH_SHORT).show()
        return null
    } }
    private fun getFileName(uri: Uri): String? { /* ... (keep existing implementation) ... */ var name: String? = null
        contentResolver ?: return null
        val cursor = contentResolver.query(uri, null, null, null, null)
        cursor?.use {
            if (it.moveToFirst()) {
                val nameIndex = it.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (nameIndex != -1) {
                    name = it.getString(nameIndex)
                }
            }
        }
        return name }
}
