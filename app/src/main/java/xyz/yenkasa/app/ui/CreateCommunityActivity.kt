package xyz.yenkasa.app.ui

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
import android.widget.Button
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.bumptech.glide.Glide
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.CreateCommunityRequest
import xyz.yenkasa.app.model.CreateCommunityResponse
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.TokenManager
import com.google.android.material.imageview.ShapeableImageView
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.materialswitch.MaterialSwitch
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import org.json.JSONObject

class CreateCommunityActivity : AppCompatActivity() {

    private lateinit var imageCommunityIcon: ShapeableImageView
    private lateinit var editCommunityDisplayName: TextInputEditText
    private lateinit var editCommunityDescription: TextInputEditText
    private lateinit var editCommunityLocation: TextInputEditText
    private lateinit var editCategories: TextInputEditText
    private lateinit var switchPrivate: MaterialSwitch
    private lateinit var btnCreateCommunity: Button

    private var selectedImageUri: Uri? = null
    private var editMode = false
    private var editingCommunityId: String? = null

    private val pickImageLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            result.data?.data?.let { uri ->
                selectedImageUri = uri
                Glide.with(this)
                    .load(uri)
                    .into(imageCommunityIcon)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.create_community_activity)

        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.title = "Create Community"

        initViews()
        hydrateEditState()
        setupListeners()
    }

    private fun initViews() {
        imageCommunityIcon = findViewById(R.id.imageCommunityIcon)
        editCommunityDisplayName = findViewById(R.id.editCommunityDisplayName)
        editCommunityDescription = findViewById(R.id.editCommunityDescription)
        editCommunityLocation = findViewById(R.id.editCommunityLocation)
        editCategories = findViewById(R.id.editCategories)
        switchPrivate = findViewById(R.id.switchPrivate)
        btnCreateCommunity = findViewById(R.id.btnCreateCommunity)

    }

    private fun setupListeners() {
        imageCommunityIcon.setOnClickListener { openGallery() }
        btnCreateCommunity.setOnClickListener { submitCommunity() }
    }

    private fun hydrateEditState() {
        editingCommunityId = intent.getStringExtra("communityId")
        editMode = !editingCommunityId.isNullOrBlank()

        if (!editMode) {
            supportActionBar?.title = "Create Community"
            btnCreateCommunity.text = "Create Community"
            return
        }

        supportActionBar?.title = "Edit Community"
        btnCreateCommunity.text = "Save Changes"
        editCommunityDisplayName.setText(intent.getStringExtra("communityDisplayName").orEmpty())
        editCommunityDescription.setText(intent.getStringExtra("communityDescription").orEmpty())
        editCommunityLocation.setText(intent.getStringExtra("communityLocation").orEmpty())
        editCategories.setText(intent.getStringArrayListExtra("communityCategories")?.joinToString(", ").orEmpty())
        switchPrivate.isChecked = intent.getBooleanExtra("communityIsPrivate", false)
    }

    private fun openGallery() {
        val intent = Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI)
        pickImageLauncher.launch(intent)
    }

    private fun submitCommunity() {
        val token = TokenManager.getToken(this)
        if (token.isNullOrEmpty()) {
            Toast.makeText(this, "You are not logged in.", Toast.LENGTH_SHORT).show()
            return
        }

        val displayName = editCommunityDisplayName.text.toString().trim()
        val description = editCommunityDescription.text.toString().trim()
        val location = editCommunityLocation.text.toString().trim()
        val categories = editCategories.text.toString()
            .split(",").map { it.trim() }.filter { it.isNotEmpty() }
        val isPrivate = switchPrivate.isChecked

        if (displayName.isEmpty() || description.isEmpty()) {
            Toast.makeText(this, "Display Name and Description cannot be empty.", Toast.LENGTH_SHORT).show()
            return
        }

        // Generate a 'name' slug from displayName
        val name = displayName.lowercase().replace("\\s+".toRegex(), "_")

        val request = CreateCommunityRequest(
            name = name,
            displayName = displayName,
            description = description.ifEmpty { null },
            location = location.ifEmpty { null },
            categories = categories,
            isPrivate = isPrivate,
            isActive = true,
            isApproved = false
        )

        btnCreateCommunity.isEnabled = false
        btnCreateCommunity.text = if (editMode) "Saving..." else "Creating..."

        if (editMode) {
            updateCommunity(token, request)
        } else {
            createCommunity(token, request)
        }
    }

    private fun createCommunity(token: String, request: CreateCommunityRequest) {
        ApiClient.apiService.createCommunity("Bearer $token", request)
            .enqueue(object : Callback<CreateCommunityResponse> {
                override fun onResponse(
                    call: Call<CreateCommunityResponse>,
                    response: Response<CreateCommunityResponse>
                ) {
                    if (response.isSuccessful && response.body() != null) {
                        handleCommunitySubmitSuccess("Community created successfully!")
                    } else if (response.code() == 404 || response.code() == 405) {
                        retryCreateCommunityFallback(token, request)
                    } else {
                        resetCreateButton()
                        showCreateCommunityError(response)
                    }
                }

                override fun onFailure(call: Call<CreateCommunityResponse>, t: Throwable) {
                    btnCreateCommunity.isEnabled = true
                    btnCreateCommunity.text = "Create"
                    Toast.makeText(
                        this@CreateCommunityActivity,
                        "Network Error: ${t.message}",
                        Toast.LENGTH_LONG
                    ).show()
                }
            })
    }

    private fun retryCreateCommunityFallback(token: String, request: CreateCommunityRequest) {
        ApiClient.apiService.createCommunityFallback("Bearer $token", request)
            .enqueue(object : Callback<CreateCommunityResponse> {
                override fun onResponse(
                    call: Call<CreateCommunityResponse>,
                    response: Response<CreateCommunityResponse>
                ) {
                    if (response.isSuccessful && response.body() != null) {
                        handleCommunitySubmitSuccess("Community created successfully!")
                    } else {
                        resetCreateButton()
                        showCreateCommunityError(response)
                    }
                }

                override fun onFailure(call: Call<CreateCommunityResponse>, t: Throwable) {
                    resetCreateButton()
                    Toast.makeText(
                        this@CreateCommunityActivity,
                        "Network Error: ${t.message}",
                        Toast.LENGTH_LONG
                    ).show()
                }
            })
    }

    private fun updateCommunity(token: String, request: CreateCommunityRequest) {
        val communityId = editingCommunityId
        if (communityId.isNullOrBlank()) {
            resetCreateButton()
            Toast.makeText(this, "Invalid community", Toast.LENGTH_SHORT).show()
            return
        }

        ApiClient.apiService.updateCommunity("Bearer $token", communityId, request)
            .enqueue(object : Callback<CreateCommunityResponse> {
                override fun onResponse(
                    call: Call<CreateCommunityResponse>,
                    response: Response<CreateCommunityResponse>
                ) {
                    if (response.isSuccessful && response.body() != null) {
                        handleCommunitySubmitSuccess("Community updated successfully!")
                    } else {
                        resetCreateButton()
                        showCreateCommunityError(response)
                    }
                }

                override fun onFailure(call: Call<CreateCommunityResponse>, t: Throwable) {
                    resetCreateButton()
                    Toast.makeText(
                        this@CreateCommunityActivity,
                        "Network Error: ${t.message}",
                        Toast.LENGTH_LONG
                    ).show()
                }
            })
    }

    private fun handleCommunitySubmitSuccess(message: String) {
        resetCreateButton()
        Toast.makeText(
            this@CreateCommunityActivity,
            message,
            Toast.LENGTH_LONG
        ).show()
        setResult(Activity.RESULT_OK)
        finish()
    }

    private fun resetCreateButton() {
        btnCreateCommunity.isEnabled = true
        btnCreateCommunity.text = if (editMode) "Save Changes" else "Create Community"
    }

    private fun showCreateCommunityError(response: Response<CreateCommunityResponse>) {
        val message = readBackendError(response.errorBody()?.string())
        Toast.makeText(
            this@CreateCommunityActivity,
            "Community failed (${response.code()}): $message",
            Toast.LENGTH_LONG
        ).show()
    }

    private fun readBackendError(errorText: String?): String {
        if (errorText.isNullOrBlank()) return "Unknown server error"
        return runCatching {
            val json = JSONObject(errorText)
            json.optString("message").ifBlank {
                json.optString("error").ifBlank { errorText }
            }
        }.getOrDefault(errorText)
    }

    override fun onSupportNavigateUp(): Boolean {
        onBackPressedDispatcher.onBackPressed()
        return true
    }
}
