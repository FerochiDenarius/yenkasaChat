package xyz.yenkasa.app.ui

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
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.ActivateRoleCodeRequest
import xyz.yenkasa.app.model.ActivateRoleCodeResponse
import xyz.yenkasa.app.model.UpdateProfileRequest
import xyz.yenkasa.app.model.User
import xyz.yenkasa.app.model.ChangePasswordRequest
import xyz.yenkasa.app.model.UploadPictureResponse
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.TokenManager
import xyz.yenkasa.app.util.UploadMediaOptimizer
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
import android.app.DatePickerDialog
import java.util.Calendar
import com.google.android.material.datepicker.MaterialDatePicker
import java.time.*
import android.view.View
import android.view.WindowManager
import androidx.appcompat.app.AlertDialog
import com.google.gson.Gson





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
    private lateinit var rowPassword: View
    private lateinit var roleUpgradeCodeView: TextInputEditText
    private lateinit var btnActivateRoleCode: TextView




    private var selectedImageUri: Uri? = null
    private var roleActivationInFlight = false
    private val token by lazy { TokenManager.getToken(this) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_edit_profile)

        bindViews()

        loadCurrentData()
        loadUserInfo()          // ⭐ updates username + phone header
        fetchRemoteProfile()
        setupDobPicker()// loads full profile (bio, email, gender etc.)
        setupGenderPicker()

        findViewById<View>(R.id.btnEditProfileBack).setOnClickListener { finish() }
        findViewById<View>(R.id.btnSaveProfile).setOnClickListener {
            saveProfileSnapshot()
        }

        rowPassword.setOnClickListener {
            showChangePasswordDialog()
        }
        btnActivateRoleCode.setOnClickListener {
            activateRoleCode()
        }
        // Auto-save
        enableAutoSave(usernameView, "username")
        enableAutoSave(emailView, "email")
        enableAutoSave(phoneView, "phoneNumber")
        enableAutoSave(locationView, "location")
        enableAutoSave(genderView, "gender")

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
        rowPassword = findViewById(R.id.rowPassword)
        roleUpgradeCodeView = findViewById(R.id.editRoleUpgradeCode)
        btnActivateRoleCode = findViewById(R.id.btnActivateRoleCode)






    }

    /** Load cached data */
    private fun loadCurrentData() {
        usernameView.setText(TokenManager.getUsername(this))
        emailView.setText(TokenManager.getEmail(this))
        phoneView.setText(TokenManager.getPhone(this))
        locationView.setText(TokenManager.getLocation(this))
        genderView.setText(TokenManager.getGender(this))
        dobView.setText(TokenManager.getDob(this))
        textName.text = TokenManager.getUsername(this) ?: getString(R.string.username)
        textPhone.text = TokenManager.getPhone(this) ?: getString(R.string.no_phone_number)

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

        val file = UploadMediaOptimizer.prepareForUpload(
            context = this,
            uri = uri,
            type = "image",
            maxImageDimension = 720,
            jpegQuality = 82
        ) ?: createTempFileFromUri(uri) ?: return
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
                            getString(R.string.image_updated),
                            Toast.LENGTH_SHORT
                        ).show()
                    } else {
                        Toast.makeText(
                            this@EditProfileActivity,
                            getString(R.string.upload_failed),
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }

                override fun onFailure(call: Call<UploadPictureResponse>, t: Throwable) {
                    Toast.makeText(
                        this@EditProfileActivity,
                        getString(R.string.upload_error, t.message ?: ""),
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
                        "username" -> {
                            TokenManager.saveUsername(this@EditProfileActivity, value)
                            textName.text = value
                        }
                        "email" -> TokenManager.saveEmail(this@EditProfileActivity, value)
                        "phoneNumber" -> {
                            TokenManager.savePhone(this@EditProfileActivity, value)
                            textPhone.text = value
                        }
                        "location" -> TokenManager.saveLocation(this@EditProfileActivity, value)
                        "gender" -> TokenManager.saveGender(this@EditProfileActivity, value)
                        "dateOfBirth" -> TokenManager.saveDob(this@EditProfileActivity, value)
                    }

                    Toast.makeText(
                        this@EditProfileActivity,
                        getString(R.string.field_updated, field),
                        Toast.LENGTH_SHORT
                    ).show()

                } else {
                    Toast.makeText(
                        this@EditProfileActivity,
                        getString(R.string.failed_to_update_field, field),
                        Toast.LENGTH_SHORT
                    ).show()
                }

            } catch (e: Exception) {
                Toast.makeText(
                    this@EditProfileActivity,
                    getString(R.string.network_error),
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
                        textName.text = user.username
                        textPhone.text = phoneValue ?: getString(R.string.no_phone_number)

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
                            getString(R.string.failed_to_load_profile),
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }

                override fun onFailure(call: Call<User>, t: Throwable) {
                    Toast.makeText(
                        this@EditProfileActivity,
                        getString(R.string.upload_error, t.message ?: ""),
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }

    private fun saveProfileSnapshot() {
        val currentToken = token ?: return

        val username = usernameView.text?.toString()?.trim().orEmpty()
        val email = emailView.text?.toString()?.trim().orEmpty()
        val phone = phoneView.text?.toString()?.trim().orEmpty()
        val location = locationView.text?.toString()?.trim().orEmpty()
        val gender = genderView.text?.toString()?.trim().orEmpty()
        val dob = dobView.text?.toString()?.trim().orEmpty()

        lifecycleScope.launch {
            try {
                val res = ApiClient.apiService.updateProfile(
                    "Bearer $currentToken",
                    UpdateProfileRequest(
                        username = username.ifBlank { null },
                        email = email.ifBlank { null },
                        phoneNumber = phone.ifBlank { null },
                        location = location.ifBlank { null },
                        gender = gender.ifBlank { null },
                        dateOfBirth = dob.ifBlank { null }
                    )
                )

                if (res.isSuccessful) {
                    if (username.isNotBlank()) {
                        TokenManager.saveUsername(this@EditProfileActivity, username)
                        textName.text = username
                    }
                    if (email.isNotBlank()) TokenManager.saveEmail(this@EditProfileActivity, email)
                    if (phone.isNotBlank()) {
                        TokenManager.savePhone(this@EditProfileActivity, phone)
                        textPhone.text = phone
                    }
                    if (location.isNotBlank()) TokenManager.saveLocation(this@EditProfileActivity, location)
                    if (gender.isNotBlank()) TokenManager.saveGender(this@EditProfileActivity, gender)
                    if (dob.isNotBlank()) TokenManager.saveDob(this@EditProfileActivity, dob)

                    Toast.makeText(this@EditProfileActivity, getString(R.string.profile_updated), Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(this@EditProfileActivity, getString(R.string.failed_to_update_profile), Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(this@EditProfileActivity, getString(R.string.network_error), Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun showChangePasswordDialog() {
        val view = layoutInflater.inflate(R.layout.dialog_change_password, null)

        val oldPass = view.findViewById<TextInputEditText>(R.id.editOldPassword)
        val newPass = view.findViewById<TextInputEditText>(R.id.editNewPassword)

        val dialog = AlertDialog.Builder(this)
            .setTitle(R.string.change_password)
            .setView(view)
            .setPositiveButton(R.string.update) { _, _ ->
                val old = oldPass.text?.toString() ?: ""
                val new = newPass.text?.toString() ?: ""

                if (new.length < 6) {
                    Toast.makeText(this, getString(R.string.password_too_short), Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }

                changePassword(old, new)
            }
            .setNegativeButton(R.string.cancel, null)
            .show()

        dialog.window?.setSoftInputMode(
            WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE or
                WindowManager.LayoutParams.SOFT_INPUT_STATE_HIDDEN
        )
    }

    private fun activateRoleCode() {
        if (roleActivationInFlight) return

        val currentToken = TokenManager.getToken(this)
        if (currentToken.isNullOrBlank()) {
            Toast.makeText(this, getString(R.string.session_expired_login_again), Toast.LENGTH_SHORT).show()
            return
        }

        val code = roleUpgradeCodeView.text?.toString()?.trim()?.uppercase().orEmpty()
        if (code.isBlank()) {
            roleUpgradeCodeView.error = getString(R.string.enter_role_id)
            return
        }

        val expectedRoleKey = expectedRoleKeyFromCode(code)
        setRoleActivationLoading(true)

        ApiClient.apiService.activateRoleCode("Bearer $currentToken", ActivateRoleCodeRequest(code))
            .enqueue(object : Callback<ActivateRoleCodeResponse> {
                override fun onResponse(
                    call: Call<ActivateRoleCodeResponse>,
                    response: Response<ActivateRoleCodeResponse>
                ) {
                    val body = response.body()
                    if (response.isSuccessful && body?.success == true) {
                        handleRoleActivationSuccess(body)
                    } else {
                        verifyActivationState(
                            token = currentToken,
                            expectedRoleKey = expectedRoleKey,
                            fallbackError = body?.error ?: getString(R.string.role_activation_failed)
                        )
                    }
                }

                override fun onFailure(call: Call<ActivateRoleCodeResponse>, t: Throwable) {
                    verifyActivationState(
                        token = currentToken,
                        expectedRoleKey = expectedRoleKey,
                        fallbackError = getString(R.string.network_error)
                    )
                }
            })
    }

    private fun setRoleActivationLoading(isLoading: Boolean) {
        roleActivationInFlight = isLoading
        btnActivateRoleCode.isEnabled = !isLoading
        btnActivateRoleCode.alpha = if (isLoading) 0.65f else 1f
        btnActivateRoleCode.text = getString(if (isLoading) R.string.activating else R.string.activate)
    }

    private fun handleRoleActivationSuccess(body: ActivateRoleCodeResponse) {
        body.user?.let { saveActivatedUser(it) }
        roleUpgradeCodeView.setText("")
        setRoleActivationLoading(false)
        val roleLabel = body.roleLabel ?: body.roleKey ?: getString(R.string.upgrade_role)
        AlertDialog.Builder(this@EditProfileActivity)
            .setTitle(R.string.role_activated)
            .setMessage(body.message ?: getString(R.string.role_activated_message, roleLabel))
            .setPositiveButton(R.string.ok, null)
            .show()
    }

    private fun verifyActivationState(
        token: String,
        expectedRoleKey: String?,
        fallbackError: String
    ) {
        if (expectedRoleKey.isNullOrBlank()) {
            setRoleActivationLoading(false)
            Toast.makeText(this@EditProfileActivity, fallbackError, Toast.LENGTH_SHORT).show()
            return
        }

        ApiClient.apiService.getUserProfile("Bearer $token")
            .enqueue(object : Callback<User> {
                override fun onResponse(call: Call<User>, response: Response<User>) {
                    val user = response.body()
                    if (response.isSuccessful && user != null && userHasRole(user, expectedRoleKey)) {
                        saveActivatedUser(user)
                        handleRoleActivationSuccess(
                            ActivateRoleCodeResponse(
                                success = true,
                                roleKey = expectedRoleKey,
                                roleLabel = expectedRoleKey.replace('_', ' ').replaceFirstChar { it.titlecase() },
                                user = user
                            )
                        )
                    } else {
                        setRoleActivationLoading(false)
                        Toast.makeText(this@EditProfileActivity, fallbackError, Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<User>, t: Throwable) {
                    setRoleActivationLoading(false)
                    Toast.makeText(this@EditProfileActivity, fallbackError, Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun saveActivatedUser(user: User) {
        TokenManager.saveUserJson(this@EditProfileActivity, Gson().toJson(user))
        TokenManager.savePartialUserDetails(
            this@EditProfileActivity,
            user.username,
            user.email,
            user.phone,
            user.location,
            user.gender,
            user.dateOfBirth
        )
        TokenManager.saveProfilePicUrl(this@EditProfileActivity, user.profileImage)
    }

    private fun expectedRoleKeyFromCode(code: String): String? {
        val prefix = code.split("-").getOrNull(2)?.uppercase() ?: return null
        return when (prefix) {
            "MOD" -> "moderator"
            "ADM" -> "admin"
            "JDEV" -> "junior_developer"
            "SDEV" -> "senior_developer"
            "VER" -> "verified_creator"
            "RSTAR" -> "rising_star"
            "LEG" -> "legend"
            "VEND" -> "top_vendor"
            "BIZ" -> "business_account"
            "PREM" -> "premium_seller"
            "CAMP" -> "campus_influencer"
            "BRAND" -> "brand_ambassador"
            else -> null
        }
    }

    private fun userHasRole(user: User, expectedRoleKey: String): Boolean {
        val normalizedExpected = expectedRoleKey.lowercase()
        val directRoles = listOfNotNull(user.staffRole, user.roleName, user.accessRole)
            .map { it.lowercase() }
        return directRoles.contains(normalizedExpected) ||
            directRoles.contains(normalizedExpected.uppercase().lowercase()) ||
            user.publicRoles.any { it.equals(normalizedExpected, ignoreCase = true) } ||
            (normalizedExpected == "verified_creator" && user.verified)
    }

    private fun changePassword(oldPass: String, newPass: String) {
        lifecycleScope.launch {
            try {
                val token = TokenManager.getToken(this@EditProfileActivity) ?: return@launch

                val body = ChangePasswordRequest(
                    oldPassword = oldPass,
                    newPassword = newPass
                )

                val res = ApiClient.apiService.changePassword(
                    "Bearer $token",
                    body
                )

                if (res.isSuccessful) {
                    Toast.makeText(this@EditProfileActivity, getString(R.string.password_updated), Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(this@EditProfileActivity, getString(R.string.wrong_current_password), Toast.LENGTH_SHORT).show()
                }

            } catch (e: Exception) {
                Toast.makeText(this@EditProfileActivity, getString(R.string.network_error), Toast.LENGTH_SHORT).show()
            }
        }
    }
    private fun setupGenderPicker() {
        val genders = arrayOf("Male", "Female", "Other")

        genderView.setOnClickListener {
            AlertDialog.Builder(this)
                .setTitle(R.string.select_gender)
                .setItems(genders) { _, which ->
                    val selected = genders[which]
                    genderView.setText(selected)
                    saveSingleField("gender", selected.lowercase())
                }
                .show()
        }
    }

    private fun setupDobPicker() {
        dobView.setOnClickListener {

            val picker = MaterialDatePicker.Builder.datePicker()
                .setTitleText(getString(R.string.select_date_of_birth))
                .build()

            picker.addOnPositiveButtonClickListener { selection ->

                val calendar = Calendar.getInstance()
                calendar.timeInMillis = selection

                val year = calendar.get(Calendar.YEAR)
                val month = calendar.get(Calendar.MONTH) + 1
                val day = calendar.get(Calendar.DAY_OF_MONTH)

                val formattedDate = String.format(
                    "%04d-%02d-%02d",
                    year, month, day
                )

                dobView.setText(formattedDate)
                saveSingleField("dateOfBirth", formattedDate)
            }

            picker.show(supportFragmentManager, "DOB_PICKER")
        }
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
