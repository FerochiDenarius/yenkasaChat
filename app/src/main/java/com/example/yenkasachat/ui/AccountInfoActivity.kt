package com.example.yenkasachat.ui

import android.app.Activity
import android.webkit.MimeTypeMap
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import android.util.Log
import android.widget.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.bumptech.glide.Glide
import com.example.yenkasachat.R
import com.example.yenkasachat.model.User
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.io.File
import java.io.FileOutputStream
import java.io.IOException // Added for explicit exception handling

class AccountInfoActivity : AppCompatActivity() {

    private lateinit var imageProfile: ImageView
    // selectedImageUri is already declared, no need to re-declare here.
    // It's used by imagePickerLauncher and uploadImageToServer.

    private val imagePickerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            result.data?.data?.let { uri ->
                // selectedImageUri = uri // This is already being done if you need to store it class-wide
                try {
                    Glide.with(this)
                        .load(uri)
                        .placeholder(R.drawable.default_avatar)
                        .error(R.drawable.default_avatar) // Good practice to add error placeholder
                        .into(imageProfile)

                    Toast.makeText(this, "✅ Image selected, uploading...", Toast.LENGTH_SHORT).show()
                    uploadImageToServer(uri)
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
        val usernameView = findViewById<TextView>(R.id.textUsername)
        val emailView = findViewById<TextView>(R.id.textEmail)
        val phoneView = findViewById<TextView>(R.id.textPhone)
        val locationView = findViewById<TextView>(R.id.textLocation)
        val verifiedView = findViewById<TextView>(R.id.textVerified)
        val btnVerify = findViewById<Button>(R.id.btnVerifyAccount)

        // Load initial user info from TokenManager
        usernameView.text = TokenManager.getUsername(this) ?: "N/A"
        emailView.text = TokenManager.getEmail(this) ?: "N/A"
        phoneView.text = TokenManager.getPhone(this) ?: "N/A"
        locationView.text = TokenManager.getLocation(this) ?: "N/A" // Assuming you have this in TokenManager
        verifiedView.text = if (TokenManager.isVerified(this)) "Verified ✅" else "Not Verified ❌"

        // Load initial profile picture from TokenManager cache
        TokenManager.getProfilePicUrl(this)?.let { url ->
            if (url.isNotBlank() && (url.startsWith("http://") || url.startsWith("https://"))) {
                Glide.with(this)
                    .load(url)
                    .placeholder(R.drawable.default_avatar)
                    .error(R.drawable.default_avatar)
                    .into(imageProfile)
            }
        }

        // Fetch latest user profile from server
        loadUserProfile()

        imageProfile.setOnClickListener {
            val intent = Intent(Intent.ACTION_PICK).apply {
                type = "image/*"
            }
            imagePickerLauncher.launch(intent)
        }

        btnVerify.setOnClickListener {
            startActivity(Intent(this, VerificationActivity::class.java))
        }
    }

    private fun uploadImageToServer(imageUri: Uri) {
        // Token is now handled by the ApiClient's interceptor,
        // so we don't need to explicitly fetch and check it here for the upload call.
        // However, it's good practice if other parts of your app rely on TokenManager.getToken() for UI logic.
        // For this specific API call, ApiClient's interceptor will add it.

        val file = createTempFileFromUri(imageUri)
        if (file == null) {
            Toast.makeText(this, "❌ Could not process image for upload.", Toast.LENGTH_SHORT).show()
            return
        }

        // Determine MIME type more reliably from the URI
        val mimeType = contentResolver.getType(imageUri) ?: "image/*"
        val requestFile = file.asRequestBody(mimeType.toMediaTypeOrNull())

        // "profileImage" must match the name expected by your backend API (upload.single('profileImage'))
        val multipartBody = MultipartBody.Part.createFormData("profileImage", file.name, requestFile)

        Log.d("AccountInfoActivity", "Attempting to upload profile picture...")

        // CORRECTED CALL: Only pass the multipartBody as the token is handled by the interceptor
        ApiClient.apiService.uploadProfilePicture(multipartBody)
            .enqueue(object : Callback<Map<String, Any>> {
                override fun onResponse(call: Call<Map<String, Any>>, response: Response<Map<String, Any>>) {
                    if (response.isSuccessful) {
                        val responseBody = response.body()
                        val imageUrl = responseBody?.get("imageUrl") as? String
                        Log.d("AccountInfoActivity", "Upload successful. Image URL: $imageUrl")
                        imageUrl?.let {
                            TokenManager.saveProfilePicUrl(this@AccountInfoActivity, it)
                            Glide.with(this@AccountInfoActivity)
                                .load(it)
                                .placeholder(R.drawable.default_avatar)
                                .error(R.drawable.default_avatar)
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
        // Token is now handled by the ApiClient's interceptor for the getUserProfile call.
        // You might still want to check TokenManager.getToken() if you have UI logic dependent on user being logged in,
        // but it's not strictly needed for the ApiClient call itself anymore.
        if (TokenManager.getToken(this).isNullOrEmpty()) {
            Log.w("AccountInfoActivity", "No token found, user might not be logged in. Profile fetch might rely on interceptor.")
            // Optionally, prevent the call or guide user to login if your interceptor doesn't handle absent tokens gracefully.
            // For now, we assume the interceptor handles it or the call is made regardless.
        }

        Log.d("AccountInfoActivity", "Loading user profile...")
        // CORRECTED CALL: No need to pass "Bearer $token" as it's handled by the interceptor
        ApiClient.apiService.getUserProfile()
            .enqueue(object : Callback<User> {
                override fun onResponse(call: Call<User>, response: Response<User>) {
                    if (response.isSuccessful) {
                        val user = response.body()
                        Log.d("AccountInfoActivity", "User profile loaded: ${user?.username}")
                        user?.profileImage?.let { url ->
                            if (url.isNotBlank() && (url.startsWith("http://") || url.startsWith("https://"))) {
                                TokenManager.saveProfilePicUrl(this@AccountInfoActivity, url)
                                Glide.with(this@AccountInfoActivity)
                                    .load(url)
                                    .placeholder(R.drawable.default_avatar)
                                    .error(R.drawable.default_avatar)
                                    .into(imageProfile)
                            }
                        }
                        // Update other UI elements if needed from the 'user' object
                        // findViewById<TextView>(R.id.textUsername).text = user?.username ?: "N/A"
                        // findViewById<TextView>(R.id.textEmail).text = user?.email ?: "N/A"
                        // ... etc.
                    } else {
                        Log.e("AccountInfoActivity", "❌ Failed to load profile: ${response.code()} - ${response.message()}")
                        try {
                            val errorBody = response.errorBody()?.string()
                            Log.e("AccountInfoActivity", "❌ Error Body: $errorBody")
                        } catch (e: IOException) {
                            // ignore
                        }
                    }
                }

                override fun onFailure(call: Call<User>, t: Throwable) {
                    Log.e("AccountInfoActivity", "❌ Profile load network failure: ${t.message}", t)
                }
            })
    }

    private fun createTempFileFromUri(uri: Uri): File? {
        return try {
            val fileName = getFileName(uri) ?: "temp_image_${System.currentTimeMillis()}"
            // Ensure contentResolver is available
            val inputStream = contentResolver?.openInputStream(uri) ?: run {
                Log.e("AccountInfoActivity", "Content resolver or input stream is null for URI: $uri")
                return null
            }
            val tempFile = File.createTempFile("upload_", ".${MimeTypeMap.getSingleton().getExtensionFromMimeType(contentResolver.getType(uri)) ?: "tmp"}", cacheDir) // Use MIME type for extension
            FileOutputStream(tempFile).use { outputStream -> // Use .use for automatic closing
                inputStream.copyTo(outputStream)
            }
            inputStream.close() // Still good to close input stream explicitly
            Log.d("AccountInfoActivity", "Temp file created: ${tempFile.absolutePath}")
            tempFile
        } catch (e: Exception) { // Catch specific exceptions like IOException, SecurityException if needed
            Log.e("AccountInfoActivity", "❌ File URI to File conversion failed: ${e.message}", e)
            Toast.makeText(this, "Error processing image file.", Toast.LENGTH_SHORT).show()
            return null
        }
    }

    private fun getFileName(uri: Uri): String? {
        var name: String? = null
        // Ensure contentResolver is available
        contentResolver ?: return null
        val cursor = contentResolver.query(uri, null, null, null, null)
        cursor?.use { // .use ensures the cursor is closed
            if (it.moveToFirst()) {
                val nameIndex = it.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (nameIndex != -1) {
                    name = it.getString(nameIndex)
                }
            }
        }
        return name
    }
}
