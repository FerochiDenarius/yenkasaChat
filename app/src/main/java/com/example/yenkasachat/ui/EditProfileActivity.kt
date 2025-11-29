package com.example.yenkasachat.ui

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.widget.ImageView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.bumptech.glide.Glide
import com.example.yenkasachat.R
import com.example.yenkasachat.model.UpdateProfileRequest
import com.example.yenkasachat.model.User
import com.example.yenkasachat.model.UploadPictureResponse
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
import android.widget.TextView


class EditProfileActivity : AppCompatActivity() {

    private lateinit var imageProfile: ImageView
    private lateinit var btnChangeImage: ImageView

    private lateinit var usernameView: TextInputEditText
    private lateinit var emailView: TextInputEditText
    private lateinit var phoneView: TextInputEditText
    private lateinit var locationView: TextInputEditText
    private lateinit var genderView: TextInputEditText
    private lateinit var dobView: TextInputEditText
    private lateinit var textName: TextView
    private lateinit var textPhone: TextView



    private var selectedImageUri: Uri? = null
    private val token by lazy { TokenManager.getToken(this) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_edit_profile)

        bindViews()
        loadCurrentData()
        loadUserInfo()          // ⭐ updates username + phone header
        fetchRemoteProfile()    // loads full profile (bio, email, gender etc.)

        // Auto-save
        enableAutoSave(usernameView, "username")
        enableAutoSave(emailView, "email")
        enableAutoSave(phoneView, "phoneNumber")
        enableAutoSave(locationView, "location")
        enableAutoSave(genderView, "gender")
        enableAutoSave(dobView, "dateOfBirth")

        btnChangeImage.setOnClickListener { openImagePicker() }
    }

    /** Bind XML Views */
    private fun bindViews() {
        imageProfile = findViewById(R.id.imageProfile)
        btnChangeImage = findViewById(R.id.btnChangeImage)
        textName = findViewById(R.id.textName)
        textPhone = findViewById(R.id.textPhone)


        usernameView = findViewById(R.id.editUsername)
        emailView = findViewById(R.id.editEmail)
        phoneView = findViewById(R.id.editPhone)
        locationView = findViewById(R.id.editLocation)
        genderView = findViewById(R.id.editGender)
        dobView = findViewById(R.id.editDob)
    }

    /** Load cached data */
    private fun loadCurrentData() {
        usernameView.setText(TokenManager.getUsername(this))
        emailView.setText(TokenManager.getEmail(this))
        phoneView.setText(TokenManager.getPhone(this))
        locationView.setText(TokenManager.getLocation(this))
        genderView.setText(TokenManager.getGender(this))
        dobView.setText(TokenManager.getDob(this))

        Glide.with(this)
            .load(TokenManager.getProfilePicUrl(this))
            .placeholder(R.drawable.default_avatar)
            .circleCrop()
            .into(imageProfile)
    }

    /** Image Picker */
    private fun openImagePicker() {
        val intent = Intent(Intent.ACTION_PICK)
        intent.type = "image/*"
        imagePickerLauncher.launch(intent)
    }

    private val imagePickerLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            if (result.resultCode == Activity.RESULT_OK) {
                val uri = result.data?.data ?: return@registerForActivityResult
                selectedImageUri = uri

                Glide.with(this).load(uri).circleCrop().into(imageProfile)

                uploadImageToServer(uri)
            }
        }

    /** Upload profile picture */
    private fun uploadImageToServer(uri: Uri) {
        if (token == null) return

        val file = createTempFileFromUri(uri) ?: return
        val mimeType = contentResolver.getType(uri) ?: "image/*"

        val requestBody = file.asRequestBody(mimeType.toMediaTypeOrNull())
        val multipart = MultipartBody.Part.createFormData(
            "profileImage",
            file.name,
            requestBody
        )

        ApiClient.apiService.uploadProfilePicture("Bearer $token", multipart)
            .enqueue(object : Callback<UploadPictureResponse> {
                override fun onResponse(
                    call: Call<UploadPictureResponse>,
                    response: Response<UploadPictureResponse>
                ) {
                    if (response.isSuccessful) {
                        val imageUrl = response.body()?.imageUrl
                        if (imageUrl != null) {
                            TokenManager.saveProfilePicUrl(this@EditProfileActivity, imageUrl)
                        }
                        Toast.makeText(
                            this@EditProfileActivity,
                            "Image updated!",
                            Toast.LENGTH_SHORT
                        ).show()
                    } else {
                        Toast.makeText(
                            this@EditProfileActivity,
                            "Upload failed",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }

                override fun onFailure(call: Call<UploadPictureResponse>, t: Throwable) {
                    Toast.makeText(
                        this@EditProfileActivity,
                        "Upload error: ${t.message}",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }

    /** Auto-save on losing focus */
    private fun enableAutoSave(view: TextInputEditText, field: String) {
        view.setOnFocusChangeListener { _, hasFocus ->
            if (!hasFocus) {
                val value = view.text?.toString()?.trim() ?: return@setOnFocusChangeListener
                if (value.isNotEmpty()) saveSingleField(field, value)
            }
        }
    }
    private fun loadUserInfo() {
        if (token == null) return

        ApiClient.apiService.getUserProfile("Bearer $token")
            .enqueue(object : Callback<User> {
                override fun onResponse(
                    call: Call<User>,
                    response: Response<User>
                ) {
                    if (response.isSuccessful) {
                        val user = response.body()
                        if (user != null) {
                            textName.text = user.username
                            textPhone.text = user.phone
                        }
                    }
                }

                override fun onFailure(call: Call<User>, t: Throwable) { }
            })
    }

    /** Save a single field to backend */
    private fun saveSingleField(field: String, value: String) {
        if (token == null) return

        val request = UpdateProfileRequest(
            username = if (field == "username") value else null,
            email = if (field == "email") value else null,
            phoneNumber = if (field == "phoneNumber") value else null,
            location = if (field == "location") value else null,
            gender = if (field == "gender") value else null,
            dateOfBirth = if (field == "dateOfBirth") value else null
        )

        lifecycleScope.launch {
            try {
                val res = ApiClient.apiService.updateProfile("Bearer $token", request)

                if (res.isSuccessful) {

                    // Local save
                    when (field) {
                        "username" -> TokenManager.saveUsername(this@EditProfileActivity, value)
                        "email" -> TokenManager.saveEmail(this@EditProfileActivity, value)
                        "phoneNumber" -> TokenManager.savePhone(this@EditProfileActivity, value)
                        "location" -> TokenManager.saveLocation(this@EditProfileActivity, value)
                        "gender" -> TokenManager.saveGender(this@EditProfileActivity, value)
                        "dateOfBirth" -> TokenManager.saveDob(this@EditProfileActivity, value)
                    }

                    Toast.makeText(
                        this@EditProfileActivity,
                        "✔ $field updated",
                        Toast.LENGTH_SHORT
                    ).show()

                } else {
                    Toast.makeText(
                        this@EditProfileActivity,
                        "Failed to update $field",
                        Toast.LENGTH_SHORT
                    ).show()
                }

            } catch (e: Exception) {
                Toast.makeText(
                    this@EditProfileActivity,
                    "Network error",
                    Toast.LENGTH_SHORT
                ).show()
            }
        }
    }

    /** Fetch the latest profile from backend */
    /** Fetch the latest profile from backend */
    /** Fetch the latest profile from backend */
    /** Fetch the latest profile from backend */
    private fun fetchRemoteProfile() {
        if (token == null) return

        ApiClient.apiService.getUserProfile("Bearer $token")
            .enqueue(object : Callback<User> {
                override fun onResponse(call: Call<User>, response: Response<User>) {
                    if (response.isSuccessful && response.body() != null) {

                        val user = response.body()!!  // SAME MODEL AS AccountInfoActivity

                        usernameView.setText(user.username)
                        emailView.setText(user.email)

                        val phoneValue = user.phone ?: user.phone
                        phoneView.setText(phoneValue)

                        locationView.setText(user.location)
                        genderView.setText(user.gender)
                        dobView.setText(user.dateOfBirth)

                        Glide.with(this@EditProfileActivity)
                            .load(user.profileImage)
                            .placeholder(R.drawable.default_avatar)
                            .circleCrop()
                            .into(imageProfile)

                        TokenManager.savePartialUserDetails(
                            this@EditProfileActivity,
                            user.username,
                            user.email,
                            phoneValue,
                            user.location,
                            user.gender,
                            user.dateOfBirth
                        )

                    } else {
                        Toast.makeText(
                            this@EditProfileActivity,
                            "Failed to load profile",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }

                override fun onFailure(call: Call<User>, t: Throwable) {
                    Toast.makeText(
                        this@EditProfileActivity,
                        "Network error: ${t.message}",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }

    /** Convert URI → Temp File */
    private fun createTempFileFromUri(uri: Uri): File? {
        return try {
            val input = contentResolver.openInputStream(uri) ?: return null
            val temp = File.createTempFile("upload_", ".tmp", cacheDir)
            FileOutputStream(temp).use { input.copyTo(it) }
            temp
        } catch (e: Exception) {
            Log.e("EditProfile", "File error: ${e.message}")
            null
        }
    }
}
