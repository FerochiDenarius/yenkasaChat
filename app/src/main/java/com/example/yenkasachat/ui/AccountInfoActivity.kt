package com.example.yenkasachat.ui

import android.app.Activity
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
    private var selectedImageUri: Uri? = null

    private val imagePickerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            result.data?.data?.let { uri ->
                selectedImageUri = uri
                try {
                    Glide.with(this)
                        .load(uri)
                        .placeholder(R.drawable.default_avatar)
                        .into(imageProfile)

                    Toast.makeText(this, "✅ Image selected", Toast.LENGTH_SHORT).show()
                    uploadImageToServer(uri)
                } catch (e: Exception) {
                    Log.e("AccountInfo", "❌ Glide failed: ${e.message}", e)
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_account_info)

        try {
            val prefs = getSharedPreferences("auth", MODE_PRIVATE)

            imageProfile = findViewById(R.id.imageProfile)
            val usernameView = findViewById<TextView>(R.id.textUsername)
            val emailView = findViewById<TextView>(R.id.textEmail)
            val phoneView = findViewById<TextView>(R.id.textPhone)
            val locationView = findViewById<TextView>(R.id.textLocation)
            val verifiedView = findViewById<TextView>(R.id.textVerified)
            val btnVerify = findViewById<Button>(R.id.btnVerifyAccount)

            usernameView.text = prefs.getString("username", "N/A") ?: "N/A"
            emailView.text = prefs.getString("email", "N/A") ?: "N/A"
            phoneView.text = prefs.getString("phone", "N/A") ?: "N/A"
            locationView.text = prefs.getString("location", "N/A") ?: "N/A"

            val isVerified = prefs.getBoolean("verified", false)
            verifiedView.text = if (isVerified) "Verified ✅" else "Not Verified ❌"

            // Load cached image if valid
            prefs.getString("profilePicUrl", null)?.let { url ->
                if (url.isNotBlank() && url.startsWith("http")) {
                    Glide.with(this)
                        .load(url)
                        .placeholder(R.drawable.default_avatar)
                        .into(imageProfile)
                }
            }

            loadUserProfile()

            imageProfile.setOnClickListener {
                val intent = Intent(Intent.ACTION_PICK)
                intent.type = "image/*"
                imagePickerLauncher.launch(intent)
            }

            btnVerify.setOnClickListener {
                startActivity(Intent(this, VerificationActivity::class.java))
            }

        } catch (e: Exception) {
            Log.e("AccountInfo", "❌ Crash in onCreate: ${e.message}", e)
            Toast.makeText(this, "Something went wrong", Toast.LENGTH_LONG).show()
        }
    }

    private fun uploadImageToServer(imageUri: Uri) {
        val token = getSharedPreferences("auth", MODE_PRIVATE).getString("token", null)
        if (token.isNullOrEmpty()) {
            Toast.makeText(this, "❌ No token found", Toast.LENGTH_SHORT).show()
            return
        }

        val file = createTempFileFromUri(imageUri)
        if (file == null) {
            Toast.makeText(this, "❌ Could not process image", Toast.LENGTH_SHORT).show()
            return
        }

        val requestFile = file.asRequestBody("image/*".toMediaTypeOrNull())
        val multipartBody = MultipartBody.Part.createFormData("profileImage", file.name, requestFile)

        ApiClient.apiService.uploadProfilePicture("Bearer $token", multipartBody)
            .enqueue(object : Callback<Map<String, Any>> {
                override fun onResponse(call: Call<Map<String, Any>>, response: Response<Map<String, Any>>) {
                    if (response.isSuccessful) {
                        val imageUrl = response.body()?.get("imageUrl") as? String
                        imageUrl?.let {
                            getSharedPreferences("auth", MODE_PRIVATE).edit()
                                .putString("profilePicUrl", it)
                                .apply()

                            Glide.with(this@AccountInfoActivity)
                                .load(it)
                                .placeholder(R.drawable.default_avatar)
                                .into(imageProfile)
                        }
                        Toast.makeText(this@AccountInfoActivity, "✅ Profile updated", Toast.LENGTH_SHORT).show()
                    } else {
                        Log.e("Upload", "❌ Response error: ${response.code()} ${response.message()}")
                        Toast.makeText(this@AccountInfoActivity, "❌ Upload failed", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<Map<String, Any>>, t: Throwable) {
                    Log.e("Upload", "❌ Network failure: ${t.message}", t)
                    Toast.makeText(this@AccountInfoActivity, "❌ Upload error", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun loadUserProfile() {
        val token = getSharedPreferences("auth", MODE_PRIVATE).getString("token", null)
        if (token.isNullOrEmpty()) {
            Log.e("Profile", "❌ No token found in shared preferences")
            return
        }

        ApiClient.apiService.getUserProfile("Bearer $token")
            .enqueue(object : Callback<User> {
                override fun onResponse(call: Call<User>, response: Response<User>) {
                    if (response.isSuccessful) {
                        val user = response.body()
                        user?.profileImage?.let { url ->
                            if (url.isNotBlank() && url.startsWith("http")) {
                                getSharedPreferences("auth", MODE_PRIVATE).edit()
                                    .putString("profilePicUrl", url)
                                    .apply()

                                Glide.with(this@AccountInfoActivity)
                                    .load(url)
                                    .placeholder(R.drawable.default_avatar)
                                    .into(imageProfile)
                            }
                        }
                    } else {
                        Log.e("Profile", "❌ Failed response: ${response.code()} ${response.message()}")
                    }
                }

                override fun onFailure(call: Call<User>, t: Throwable) {
                    Log.e("Profile", "❌ Failed to load user: ${t.message}", t)
                }
            })
    }

    private fun createTempFileFromUri(uri: Uri): File? {
        return try {
            val fileName = getFileName(uri) ?: "temp_image.jpg"
            val inputStream = contentResolver.openInputStream(uri) ?: return null
            val tempFile = File.createTempFile("upload_", fileName, cacheDir)
            val outputStream = FileOutputStream(tempFile)

            inputStream.copyTo(outputStream)
            inputStream.close()
            outputStream.close()

            tempFile
        } catch (e: Exception) {
            Log.e("Upload", "❌ File conversion failed: ${e.message}", e)
            null
        }
    }

    private fun getFileName(uri: Uri): String? {
        var name: String? = null
        val cursor = contentResolver.query(uri, null, null, null, null)
        cursor?.use {
            val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (cursor.moveToFirst() && nameIndex != -1) {
                name = cursor.getString(nameIndex)
            }
        }
        return name
    }
}
