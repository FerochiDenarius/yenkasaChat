package xyz.yenkasa.app.ui

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.view.animation.AnimationUtils
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.RegisterRequest
import xyz.yenkasa.app.model.LoginResponse
import xyz.yenkasa.app.model.Community
import xyz.yenkasa.app.network.ApiClient
import com.google.android.material.textfield.TextInputEditText
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class RegisterActivity : AppCompatActivity() {

    private lateinit var radioEmail: RadioButton
    private lateinit var radioPhone: RadioButton
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
    private lateinit var progressBar: ProgressBar

    // NEW — animated card + icon + stars
    private lateinit var registerCard: View
    private lateinit var starContainer: FrameLayout

    private var selectedCommunityId: String? = null
    private var communityList: List<Community> = emptyList()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_register)

        // Original views
        radioEmail = findViewById(R.id.radioEmail)
        radioPhone = findViewById(R.id.radioPhone)
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
        radioEmail.setOnCheckedChangeListener { _, isChecked ->
            editEmail.visibility = if (isChecked) View.VISIBLE else View.GONE
            editPhone.visibility = if (!isChecked) View.VISIBLE else View.GONE
        }

        textTermsLink.setOnClickListener {
            startActivity(Intent(this, UserAgreementActivity::class.java))
        }

        btnRegister.setOnClickListener {
            handleRegister()
        }

        textLoginLink.setOnClickListener {
            // Add shared element transition back to login
            val intent = Intent(this, LoginActivity::class.java)
            val options = androidx.core.app.ActivityOptionsCompat.makeSceneTransitionAnimation(
                this,
                androidx.core.util.Pair(findViewById(R.id.textRegisterTitle), "hero_title")
            )
            startActivity(intent, options.toBundle())
            finish()
        }

        setupCountrySpinner()
        fetchCommunities()
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

    // ⬇️ YOUR ORIGINAL LOGIC (UNCHANGED)
    private fun fetchCommunities() {
        progressBar.visibility = View.VISIBLE

        ApiClient.apiService.getPublicCommunities()
            .enqueue(object : Callback<List<Community>> {
                override fun onResponse(
                    call: Call<List<Community>>,
                    response: Response<List<Community>>
                ) {
                    progressBar.visibility = View.GONE

                    if (!response.isSuccessful) {
                        Toast.makeText(
                            this@RegisterActivity,
                            "Failed to load communities (Server ${response.code()})",
                            Toast.LENGTH_SHORT
                        ).show()
                        shakeCard()
                        return
                    }

                    val communities = response.body()

                    if (communities.isNullOrEmpty()) {
                        Toast.makeText(
                            this@RegisterActivity,
                            "No approved communities found",
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
                        communities.map { it.displayName ?: it.name ?: "Unnamed" }
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
                                // NOTE: Community model may use id or _id
                                selectedCommunityId = communityList[position].id
                                    ?: communityList[position].id
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
                        "Error loading communities: ${t.message}",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }

    private fun handleRegister() {

        // ORIGINAL VALIDATION LOGIC
        val email = editEmail.text.toString().trim()
        val phone = editPhone.text.toString().trim()
        val username = editUsername.text.toString().trim()
        val location = editLocation.text.toString().trim()
        val password = editPassword.text.toString()
        val confirmPassword = editConfirmPassword.text.toString()

        if (radioEmail.isChecked && email.isEmpty()) {
            editEmail.error = "Email is required"
            shakeCard()
            return
        }

        if (radioPhone.isChecked && phone.isEmpty()) {
            editPhone.error = "Phone is required"
            shakeCard()
            return
        }

        if (username.isEmpty()) {
            editUsername.error = "Username is required"
            shakeCard()
            return
        }

        if (location.isEmpty()) {
            editLocation.error = "Location is required"
            shakeCard()
            return
        }


        if (password.length < 6) {
            editPassword.error = "Password must be at least 6 characters"
            shakeCard()
            return
        }

        if (password != confirmPassword) {
            editConfirmPassword.error = "Passwords do not match"
            shakeCard()
            return
        }

        if (!checkTerms.isChecked) {
            Toast.makeText(this, "You must agree to the User Agreement before continuing.", Toast.LENGTH_LONG).show()
            shakeCard()
            return
        }

        if (selectedCommunityId == null) {
            Toast.makeText(this, "Please select a community", Toast.LENGTH_SHORT).show()
            shakeCard()
            return
        }

        val selectedCountry = findViewById<Spinner>(R.id.spinnerCountry).selectedItem.toString()

        if (!selectedCountry.equals("Ghana", ignoreCase = true)) {
            Toast.makeText(this, "Registration is only allowed for Ghanaians.", Toast.LENGTH_LONG).show()
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

                    if (response.isSuccessful && response.body() != null) {
                        Toast.makeText(this@RegisterActivity, "Registered successfully", Toast.LENGTH_SHORT).show()

                        val intent = Intent(this@RegisterActivity, LoginActivity::class.java)
                        startActivity(intent)
                        finish()

                    } else {
                        Toast.makeText(this@RegisterActivity, "Registration failed", Toast.LENGTH_SHORT).show()
                        shakeCard()
                    }
                }

                override fun onFailure(call: Call<LoginResponse>, t: Throwable) {
                    progressBar.visibility = View.GONE
                    btnRegister.isEnabled = true
                    shakeCard()
                    Toast.makeText(this@RegisterActivity, "Error: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun setupCountrySpinner() {
        val countries = listOf(
            "Ghana", "Nigeria", "Kenya", "South Africa", "Uganda", "Cameroon",
            "Tanzania", "Ethiopia", "Rwanda", "Senegal", "Ivory Coast", "Benin"
        )

        val adapter = ArrayAdapter(
            this,
            android.R.layout.simple_spinner_item,
            countries
        )

        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)

        findViewById<Spinner>(R.id.spinnerCountry).adapter = adapter
    }
}
