package xyz.yenkasa.app.ui

import android.content.Intent
import android.os.Bundle
import android.util.Patterns
import android.view.View
import android.view.animation.AnimationUtils
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.RegisterRequest
import xyz.yenkasa.app.model.LoginResponse
import xyz.yenkasa.app.model.Community
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.AppLinkManager
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import org.json.JSONObject
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.io.IOException

class RegisterActivity : AppCompatActivity() {

    private lateinit var radioGroup: RadioGroup
    private lateinit var radioEmail: RadioButton
    private lateinit var radioPhone: RadioButton
    private lateinit var layoutEmail: TextInputLayout
    private lateinit var layoutPhone: TextInputLayout
    private lateinit var editEmail: EditText
    private lateinit var editPhone: EditText
    private lateinit var editUsername: EditText
    private lateinit var editLocation: EditText
    private lateinit var editPassword: TextInputEditText
    private lateinit var editConfirmPassword: TextInputEditText
    private lateinit var btnRegister: Button
    private lateinit var textLoginLink: TextView
    private lateinit var checkTerms: CheckBox
    private lateinit var textTermsLink: TextView
    private lateinit var spinnerCommunities: Spinner
    private lateinit var spinnerCountry: Spinner
    private lateinit var textRegisterError: TextView
    private lateinit var progressBar: ProgressBar

    // NEW — animated card + icon + stars
    private lateinit var registerCard: View
    private lateinit var starContainer: FrameLayout

    private var selectedCommunityId: String? = null
    private var communityList: List<Community> = emptyList()
    private val registrationCountryValues = listOf("Ghana", "Nigeria")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_register)

        // Original views
        radioGroup = findViewById(R.id.radioGroup)
        radioEmail = findViewById(R.id.radioEmail)
        radioPhone = findViewById(R.id.radioPhone)
        layoutEmail = findViewById(R.id.layoutEmail)
        layoutPhone = findViewById(R.id.layoutPhone)
        editEmail = findViewById(R.id.editEmail)
        editPhone = findViewById(R.id.editPhone)
        editUsername = findViewById(R.id.editUsername)
        editLocation = findViewById(R.id.editLocation)
        editPassword = findViewById(R.id.editPassword)
        editConfirmPassword = findViewById(R.id.editConfirmPassword)
        btnRegister = findViewById(R.id.btnRegister)
        textLoginLink = findViewById(R.id.textLoginLink)
        checkTerms = findViewById(R.id.checkTerms)
        textTermsLink = findViewById(R.id.textTermsLink)
        textRegisterError = findViewById(R.id.textRegisterError)
        spinnerCountry = findViewById(R.id.spinnerCountry)
        spinnerCommunities = findViewById(R.id.spinnerCommunities)
        progressBar = findViewById(R.id.progressBar)

        // NEW views for animation
        registerCard = findViewById(R.id.registerCard)
        starContainer = findViewById(R.id.starContainerRegister)

        // 🌟 Entrance Animations (Flutter-like)
        registerCard.startAnimation(AnimationUtils.loadAnimation(this, R.anim.slide_up_fade))

        // ✨ Star Sparkle
        addStarSparkle()

        // Email/phone switching
        radioGroup.setOnCheckedChangeListener { _, _ ->
            updateContactInputVisibility()
            clearContactFieldErrors()
        }
        updateContactInputVisibility()

        textTermsLink.setOnClickListener {
            startActivity(Intent(this, UserAgreementActivity::class.java))
        }

        btnRegister.setOnClickListener {
            handleRegister()
        }

        textLoginLink.setOnClickListener {
            // Add shared element transition back to login
            val intent = Intent(this, LoginActivity::class.java)
            AppLinkManager.copyPendingDeepLink(this.intent, intent)
            val options = androidx.core.app.ActivityOptionsCompat.makeSceneTransitionAnimation(
                this,
                androidx.core.util.Pair(findViewById(R.id.textRegisterTitle), "hero_title")
            )
            startActivity(intent, options.toBundle())
            finish()
        }

        setupCountrySpinner()
    }

    // ✨ STAR SPARKLE ANIMATION
    private fun addStarSparkle() {
        val sparkleAnim = AnimationUtils.loadAnimation(this, R.anim.star_sparkle)

        starContainer.post {
            for (i in 0 until starContainer.childCount) {
                val star: View = starContainer.getChildAt(i)
                star.startAnimation(sparkleAnim)
            }
        }
    }

    // ❗ SHAKE CARD ON ERROR
    private fun shakeCard() {
        registerCard.startAnimation(AnimationUtils.loadAnimation(this, R.anim.shake))
    }

    private fun updateContactInputVisibility() {
        layoutEmail.visibility = if (radioEmail.isChecked) View.VISIBLE else View.GONE
        layoutPhone.visibility = if (radioPhone.isChecked) View.VISIBLE else View.GONE
    }

    private fun clearContactFieldErrors() {
        editEmail.error = null
        editPhone.error = null
    }

    private fun clearValidationErrors() {
        textRegisterError.visibility = View.GONE
        textRegisterError.text = ""
        editEmail.error = null
        editPhone.error = null
        editUsername.error = null
        editLocation.error = null
        editPassword.error = null
        editConfirmPassword.error = null
    }

    private fun showFormError(message: String) {
        textRegisterError.text = message
        textRegisterError.visibility = View.VISIBLE
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    }

    private fun isValidPhone(phone: String): Boolean {
        val compact = phone.replace("\\s+".toRegex(), "")
        return compact.matches(Regex("^\\+?[0-9]{9,15}$"))
    }

    private fun parseApiErrorMessage(response: Response<*>): String? {
        val rawError = try {
            response.errorBody()?.string()
        } catch (_: IOException) {
            null
        } ?: return null

        if (rawError.isBlank()) return null

        return try {
            val json = JSONObject(rawError)
            val message = json.optString("message").takeIf { it.isNotBlank() }
            val error = json.optString("error").takeIf { it.isNotBlank() }
            message ?: error ?: rawError
        } catch (_: Exception) {
            rawError
        }
    }

    private fun getFriendlyRegistrationError(statusCode: Int, serverMessage: String?): String {
        val message = serverMessage?.trim().orEmpty()
        val lower = message.lowercase()

        return when {
            statusCode == 409 || lower.contains("already exists") || lower.contains("duplicate") -> {
                val contactLabel = if (radioEmail.isChecked) {
                    getString(R.string.email_address_lower)
                } else {
                    getString(R.string.phone_number_lower)
                }
                getString(R.string.register_error_duplicate_contact, contactLabel)
            }
            lower.contains("community") -> {
                getString(R.string.register_error_community_unavailable)
            }
            lower.contains("missing required") -> {
                getString(R.string.register_error_missing_required)
            }
            lower.contains("only in ghana") ||
                lower.contains("ghana and nigeria") ||
                lower.contains("invalid country") -> {
                getString(R.string.register_error_country_unavailable)
            }
            statusCode in 500..599 -> {
                getString(R.string.register_error_server)
            }
            message.isNotBlank() -> message
            else -> getString(R.string.register_failed_review_details)
        }
    }

    private fun getFriendlyNetworkError(t: Throwable): String {
        val error = t.message?.lowercase().orEmpty()
        return when {
            error.contains("unable to resolve host") ||
                error.contains("failed to connect") ||
                error.contains("network is unreachable") -> {
                getString(R.string.no_internet_try_again)
            }
            error.contains("timeout") -> {
                getString(R.string.register_request_timed_out)
            }
            else -> {
                getString(R.string.server_unreachable_try_again)
            }
        }
    }

    // ⬇️ YOUR ORIGINAL LOGIC (UNCHANGED)
    private fun fetchCommunities(country: String = selectedCountry()) {
        progressBar.visibility = View.VISIBLE
        selectedCommunityId = null
        communityList = emptyList()

        ApiClient.apiService.getPublicCommunities(country)
            .enqueue(object : Callback<List<Community>> {
                override fun onResponse(
                    call: Call<List<Community>>,
                    response: Response<List<Community>>
                ) {
                    progressBar.visibility = View.GONE

                    if (!response.isSuccessful) {
                        Toast.makeText(
                            this@RegisterActivity,
                            getString(R.string.failed_to_load_communities_server, response.code()),
                            Toast.LENGTH_SHORT
                        ).show()
                        shakeCard()
                        return
                    }

                    val communities = response.body().orEmpty()
                        .filter { community ->
                            community.country.equals(country, ignoreCase = true)
                        }

                    if (communities.isEmpty()) {
                        spinnerCommunities.adapter = ArrayAdapter(
                            this@RegisterActivity,
                            android.R.layout.simple_spinner_item,
                            listOf(getString(R.string.no_communities_available_for_country, country))
                        )
                        Toast.makeText(
                            this@RegisterActivity,
                            getString(R.string.no_approved_communities_for_country, country),
                            Toast.LENGTH_SHORT
                        ).show()
                        shakeCard()
                        return
                    }

                    // Save list
                    communityList = communities

                    val adapter = ArrayAdapter(
                        this@RegisterActivity,
                        android.R.layout.simple_spinner_item,
                        communities.map { formatCommunityOption(it) }
                    )

                    adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
                    spinnerCommunities.adapter = adapter
                    spinnerCommunities.setPopupBackgroundResource(R.color.white)

                    spinnerCommunities.onItemSelectedListener =
                        object : AdapterView.OnItemSelectedListener {
                            override fun onItemSelected(
                                parent: AdapterView<*>,
                                view: View?,
                                position: Int,
                                id: Long
                            ) {
                                val selectedCommunity = communityList.getOrNull(position)
                                selectedCommunityId = selectedCommunity?.id
                                selectedCommunity?.location?.takeIf { it.isNotBlank() }?.let { location ->
                                    if (editLocation.text.isNullOrBlank()) {
                                        editLocation.setText(location)
                                    }
                                }
                            }

                            override fun onNothingSelected(parent: AdapterView<*>) {
                                selectedCommunityId = null
                            }
                        }
                }

                override fun onFailure(call: Call<List<Community>>, t: Throwable) {
                    progressBar.visibility = View.GONE
                    shakeCard()
                    Toast.makeText(
                        this@RegisterActivity,
                        getString(R.string.error_loading_communities, t.message ?: ""),
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }

    private fun handleRegister() {
        clearValidationErrors()

        val email = editEmail.text.toString().trim()
        val phone = editPhone.text.toString().trim()
        val username = editUsername.text.toString().trim()
        val location = editLocation.text.toString().trim()
        val password = editPassword.text.toString()
        val confirmPassword = editConfirmPassword.text.toString()

        if (radioEmail.isChecked) {
            when {
                email.isEmpty() -> {
                    editEmail.error = getString(R.string.error_email_required)
                    shakeCard()
                    return
                }
                !Patterns.EMAIL_ADDRESS.matcher(email).matches() -> {
                    editEmail.error = getString(R.string.error_valid_email)
                    shakeCard()
                    return
                }
            }
        } else {
            when {
                phone.isEmpty() -> {
                    editPhone.error = getString(R.string.error_phone_required)
                    shakeCard()
                    return
                }
                !isValidPhone(phone) -> {
                    editPhone.error = getString(R.string.error_valid_phone)
                    shakeCard()
                    return
                }
            }
        }

        if (username.length < 3) {
            editUsername.error = getString(R.string.error_username_min_length)
            shakeCard()
            return
        }

        if (!username.matches(Regex("^[a-zA-Z0-9._]{3,30}$"))) {
            editUsername.error = getString(R.string.error_username_allowed_chars)
            shakeCard()
            return
        }

        if (location.length < 2) {
            editLocation.error = getString(R.string.error_location_required)
            shakeCard()
            return
        }


        if (password.length < 6) {
            editPassword.error = getString(R.string.error_password_min_length)
            shakeCard()
            return
        }

        if (password != confirmPassword) {
            editConfirmPassword.error = getString(R.string.error_passwords_do_not_match)
            shakeCard()
            return
        }

        if (!checkTerms.isChecked) {
            showFormError(getString(R.string.error_terms_required))
            shakeCard()
            return
        }

        if (selectedCommunityId.isNullOrBlank()) {
            showFormError(getString(R.string.error_select_community))
            shakeCard()
            return
        }

        val selectedCountry = selectedCountry()

        if (registrationCountryValues.none { it.equals(selectedCountry, ignoreCase = true) }) {
            showFormError(getString(R.string.register_error_country_unavailable))
            shakeCard()
            return
        }




        // ORIGINAL REQUEST
        val request = RegisterRequest(
            email = if (radioEmail.isChecked) email else null,
            phone = if (radioPhone.isChecked) phone else null,
            username = username,
            location = location,
            password = password,
            communityId = selectedCommunityId!!,
            communityIds = listOf(selectedCommunityId!!),
            country = selectedCountry
        )

        // SHOW EMERALD LOADING BAR
        progressBar.visibility = View.VISIBLE
        btnRegister.isEnabled = false

        ApiClient.authService.registerUser(request)
            .enqueue(object : Callback<LoginResponse> {
                override fun onResponse(call: Call<LoginResponse>, response: Response<LoginResponse>) {
                    progressBar.visibility = View.GONE
                    btnRegister.isEnabled = true

                    if (response.isSuccessful) {
                        textRegisterError.visibility = View.GONE
                        textRegisterError.text = ""
                        Toast.makeText(this@RegisterActivity, getString(R.string.registered_successfully), Toast.LENGTH_SHORT).show()

                        val intent = Intent(this@RegisterActivity, LoginActivity::class.java)
                        AppLinkManager.copyPendingDeepLink(this@RegisterActivity.intent, intent)
                        startActivity(intent)
                        finish()

                    } else {
                        val serverMessage = parseApiErrorMessage(response)
                        val friendlyMessage = getFriendlyRegistrationError(response.code(), serverMessage)

                        if (response.code() == 409) {
                            editUsername.error = getString(R.string.error_username_taken)
                            if (radioEmail.isChecked) {
                                editEmail.error = getString(R.string.error_email_registered)
                            } else {
                                editPhone.error = getString(R.string.error_phone_registered)
                            }
                        }

                        showFormError(friendlyMessage)
                        shakeCard()
                    }
                }

                override fun onFailure(call: Call<LoginResponse>, t: Throwable) {
                    progressBar.visibility = View.GONE
                    btnRegister.isEnabled = true
                    showFormError(getFriendlyNetworkError(t))
                    shakeCard()
                }
            })
    }

    private fun setupCountrySpinner() {
        val adapter = ArrayAdapter(
            this,
            android.R.layout.simple_spinner_item,
            localizedRegistrationCountries()
        )

        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)

        spinnerCountry.adapter = adapter
        spinnerCountry.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(
                parent: AdapterView<*>,
                view: View?,
                position: Int,
                id: Long
            ) {
                editLocation.setText("")
                fetchCommunities(registrationCountryValues[position])
            }

            override fun onNothingSelected(parent: AdapterView<*>) {
                selectedCommunityId = null
            }
        }
    }

    private fun selectedCountry(): String {
        val selectedIndex = spinnerCountry.selectedItemPosition
        return registrationCountryValues.getOrNull(selectedIndex) ?: "Ghana"
    }

    private fun formatCommunityOption(community: Community): String {
        val name = community.displayName ?: community.name ?: getString(R.string.unnamed)
        val details = listOfNotNull(
            community.town?.takeIf { it.isNotBlank() && !it.equals(name, ignoreCase = true) },
            community.city?.takeIf { it.isNotBlank() && !it.equals(name, ignoreCase = true) },
            community.state?.takeIf { it.isNotBlank() },
            community.country?.takeIf { it.isNotBlank() }
        ).distinct()

        return if (details.isEmpty()) name else "$name - ${details.joinToString(", ")}"
    }

    private fun localizedRegistrationCountries(): List<String> {
        return listOf(
            getString(R.string.country_ghana),
            getString(R.string.country_nigeria)
        )
    }
}
