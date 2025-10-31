package com.example.yenkasachat.ui

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
import com.example.yenkasachat.R
import com.example.yenkasachat.model.CreateCommunityRequest
import com.example.yenkasachat.model.CreateCommunityResponse
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
import com.google.android.material.imageview.ShapeableImageView
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.materialswitch.MaterialSwitch
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class CreateCommunityActivity : AppCompatActivity() {

    private lateinit var imageCommunityIcon: ShapeableImageView
    private lateinit var editCommunityDisplayName: TextInputEditText
    private lateinit var editCommunityDescription: TextInputEditText
    private lateinit var editCommunityLocation: TextInputEditText
    private lateinit var editCategories: TextInputEditText
    private lateinit var switchPrivate: MaterialSwitch
    private lateinit var switchActive: MaterialSwitch
    private lateinit var switchApproved: MaterialSwitch
    private lateinit var btnCreateCommunity: Button

    private var selectedImageUri: Uri? = null

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
        setupListeners()
    }

    private fun initViews() {
        imageCommunityIcon = findViewById(R.id.imageCommunityIcon)
        editCommunityDisplayName = findViewById(R.id.editCommunityDisplayName)
        editCommunityDescription = findViewById(R.id.editCommunityDescription)
        editCommunityLocation = findViewById(R.id.editCommunityLocation)
        editCategories = findViewById(R.id.editCategories)
        switchPrivate = findViewById(R.id.switchPrivate)
        switchActive = findViewById(R.id.switchActive)
        switchApproved = findViewById(R.id.switchApproved)
        btnCreateCommunity = findViewById(R.id.btnCreateCommunity)
    }

    private fun setupListeners() {
        imageCommunityIcon.setOnClickListener { openGallery() }
        btnCreateCommunity.setOnClickListener { createCommunity() }
    }

    private fun openGallery() {
        val intent = Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI)
        pickImageLauncher.launch(intent)
    }

    private fun createCommunity() {
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
        val isActive = switchActive.isChecked
        val isApproved = switchApproved.isChecked

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
            isActive = isActive,
            isApproved = isApproved
        )

        btnCreateCommunity.isEnabled = false
        btnCreateCommunity.text = "Creating..."

        ApiClient.apiService.createCommunity("Bearer $token", request)
            .enqueue(object : Callback<CreateCommunityResponse> {
                override fun onResponse(
                    call: Call<CreateCommunityResponse>,
                    response: Response<CreateCommunityResponse>
                ) {
                    btnCreateCommunity.isEnabled = true
                    btnCreateCommunity.text = "Create"

                    if (response.isSuccessful && response.body() != null) {
                        Toast.makeText(
                            this@CreateCommunityActivity,
                            "Community created successfully!",
                            Toast.LENGTH_LONG
                        ).show()
                        finish()
                    } else {
                        Toast.makeText(
                            this@CreateCommunityActivity,
                            "Error: ${response.errorBody()?.string() ?: "Unknown"}",
                            Toast.LENGTH_LONG
                        ).show()
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

    override fun onSupportNavigateUp(): Boolean {
        onBackPressedDispatcher.onBackPressed()
        return true
    }
}

