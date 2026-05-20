package xyz.yenkasa.app.ui

import android.content.res.Configuration
import android.os.Bundle
import android.text.InputFilter
import android.view.View
import android.widget.Button
import android.widget.ProgressBar
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.SwitchCompat
import androidx.core.view.WindowCompat
import com.google.android.material.textfield.TextInputEditText
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.CreateYenkasaUpdateRequest
import xyz.yenkasa.app.model.CreateYenkasaUpdateResponse
import xyz.yenkasa.app.network.ApiClient

class YenkasaUpdateComposerActivity : AppCompatActivity() {

    private lateinit var inputTitle: TextInputEditText
    private lateinit var inputBody: TextInputEditText
    private lateinit var inputLink: TextInputEditText
    private lateinit var switchPinned: SwitchCompat
    private lateinit var buttonPublish: Button
    private lateinit var progressPublish: ProgressBar

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        configureSystemBars()
        setContentView(R.layout.activity_yenkasa_update_composer)

        inputTitle = findViewById(R.id.inputUpdateTitle)
        inputBody = findViewById(R.id.inputUpdateBody)
        inputLink = findViewById(R.id.inputUpdateLink)
        switchPinned = findViewById(R.id.switchUpdatePinned)
        buttonPublish = findViewById(R.id.buttonPublishUpdate)
        progressPublish = findViewById(R.id.progressPublishUpdate)

        inputTitle.filters = arrayOf(InputFilter.LengthFilter(180))
        inputBody.filters = arrayOf(InputFilter.LengthFilter(1200))

        findViewById<View>(R.id.buttonUpdateBack).setOnClickListener { finish() }
        buttonPublish.setOnClickListener { publishUpdate() }
    }

    private fun configureSystemBars() {
        val backgroundColor = getColor(R.color.menu_background)
        window.statusBarColor = backgroundColor
        window.navigationBarColor = backgroundColor

        val nightMode = resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK
        val lightBars = nightMode != Configuration.UI_MODE_NIGHT_YES
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = lightBars
            isAppearanceLightNavigationBars = lightBars
        }
    }

    private fun publishUpdate() {
        val title = inputTitle.text?.toString()?.trim().orEmpty()
        val body = inputBody.text?.toString()?.trim().orEmpty()
        val normalizedLink = normalizeLink(inputLink.text?.toString()?.trim().orEmpty())
        val pinned = switchPinned.isChecked

        inputTitle.error = null
        inputBody.error = null

        if (title.isBlank()) {
            inputTitle.error = getString(R.string.update_title_required)
            inputTitle.requestFocus()
            return
        }

        if (body.isBlank()) {
            inputBody.error = getString(R.string.update_body_required)
            inputBody.requestFocus()
            return
        }

        setSubmitting(true)

        val targetType = when {
            normalizedLink.startsWith("/post/") -> "post"
            normalizedLink.startsWith("/user/") -> "profile"
            normalizedLink.startsWith("/community/") -> "community"
            normalizedLink.startsWith("/live/") -> "live"
            else -> "system"
        }

        val request = CreateYenkasaUpdateRequest(
            title = title,
            body = body,
            category = "announcement",
            targetType = targetType,
            targetUrl = normalizedLink.ifBlank { null },
            deepLinkUrl = normalizedLink.ifBlank { null },
            pinned = pinned
        )

        ApiClient.apiService.createAdminUpdate(request)
            .enqueue(object : Callback<CreateYenkasaUpdateResponse> {
                override fun onResponse(
                    call: Call<CreateYenkasaUpdateResponse>,
                    response: Response<CreateYenkasaUpdateResponse>
                ) {
                    setSubmitting(false)
                    if (!response.isSuccessful || response.body()?.success != true) {
                        Toast.makeText(
                            this@YenkasaUpdateComposerActivity,
                            getString(R.string.update_publish_failed),
                            Toast.LENGTH_LONG
                        ).show()
                        return
                    }

                    Toast.makeText(
                        this@YenkasaUpdateComposerActivity,
                        getString(R.string.update_publish_success),
                        Toast.LENGTH_LONG
                    ).show()
                    finish()
                }

                override fun onFailure(call: Call<CreateYenkasaUpdateResponse>, t: Throwable) {
                    setSubmitting(false)
                    Toast.makeText(
                        this@YenkasaUpdateComposerActivity,
                        getString(
                            R.string.network_error_with_message,
                            t.message ?: getString(R.string.unknown_error)
                        ),
                        Toast.LENGTH_LONG
                    ).show()
                }
            })
    }

    private fun setSubmitting(submitting: Boolean) {
        progressPublish.visibility = if (submitting) View.VISIBLE else View.GONE
        buttonPublish.isEnabled = !submitting
        buttonPublish.text = if (submitting) {
            getString(R.string.publishing_update)
        } else {
            getString(R.string.publish_update)
        }
    }

    private fun normalizeLink(raw: String): String {
        if (raw.isBlank()) return ""
        return when {
            raw.startsWith("/") -> raw
            raw.startsWith("https://") || raw.startsWith("http://") || raw.startsWith("market://") -> raw
            raw.startsWith("www.yenkasa.xyz/") -> "https://$raw"
            raw.startsWith("yenkasa.xyz/") -> "https://$raw"
            else -> "/${raw.trimStart('/')}"
        }
    }
}
