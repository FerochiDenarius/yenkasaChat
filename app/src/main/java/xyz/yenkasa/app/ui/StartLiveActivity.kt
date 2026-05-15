package xyz.yenkasa.app.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ProgressBar
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.CreateLiveStreamRequest
import xyz.yenkasa.app.model.LiveStreamResponse
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.TokenManager
import xyz.yenkasa.app.util.UserPermissions
import org.json.JSONObject
import java.io.IOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException

class StartLiveActivity : AppCompatActivity() {

    private lateinit var titleInput: EditText
    private lateinit var communityInput: EditText
    private lateinit var startButton: Button
    private lateinit var browseButton: Button
    private lateinit var progress: ProgressBar

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { result ->
        if (result[Manifest.permission.CAMERA] == true && result[Manifest.permission.RECORD_AUDIO] == true) {
            createLiveStream()
        } else {
            Toast.makeText(this, R.string.camera_mic_permissions_required, Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_start_live)

        titleInput = findViewById(R.id.editLiveTitle)
        communityInput = findViewById(R.id.editLiveCommunity)
        startButton = findViewById(R.id.buttonStartLive)
        browseButton = findViewById(R.id.buttonBrowseLive)
        progress = findViewById(R.id.progressStartLive)

        val canStart = UserPermissions.canStartLivestream(TokenManager.getUserRole(this))
        if (!canStart) {
            titleInput.visibility = View.GONE
            communityInput.visibility = View.GONE
            startButton.visibility = View.GONE
            Toast.makeText(this, R.string.livestream_staff_only_watch_allowed, Toast.LENGTH_LONG).show()
        }

        startButton.setOnClickListener { validateAndStart() }
        browseButton.setOnClickListener { startActivity(Intent(this, LiveStreamsActivity::class.java)) }
    }

    private fun validateAndStart() {
        val role = TokenManager.getUserRole(this)
        val canStart = UserPermissions.canStartLivestream(role)

        if (!canStart) {
            Toast.makeText(this, R.string.livestream_staff_only_watch_allowed, Toast.LENGTH_LONG).show()
            return
        }

        if (titleInput.text.toString().trim().isBlank()) {
            titleInput.error = getString(R.string.enter_live_title)
            return
        }

        val missing = arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO)
            .filter { ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED }
            .toTypedArray()

        if (missing.isNotEmpty()) {
            permissionLauncher.launch(missing)
        } else {
            createLiveStream()
        }
    }

    private fun createLiveStream() {
        setLoading(true)
        val request = CreateLiveStreamRequest(
            title = titleInput.text.toString().trim(),
            community = communityInput.text.toString().trim().takeIf { it.isNotBlank() },
            thumbnail = TokenManager.getProfilePicUrl(this)
        )

        ApiClient.apiService.createLiveStream(request).enqueue(object : Callback<LiveStreamResponse> {
            override fun onResponse(call: Call<LiveStreamResponse>, response: Response<LiveStreamResponse>) {
                setLoading(false)
                val body = response.body()
                val stream = body?.stream
                val agora = body?.agora
                if (!response.isSuccessful || body?.success != true || stream == null || agora == null) {
                    Toast.makeText(
                        this@StartLiveActivity,
                        liveStartErrorMessage(response, body),
                        Toast.LENGTH_LONG
                    ).show()
                    return
                }

                startActivity(LiveStreamActivity.intentForHost(this@StartLiveActivity, stream, agora))
                finish()
            }

            override fun onFailure(call: Call<LiveStreamResponse>, t: Throwable) {
                setLoading(false)
                Toast.makeText(
                    this@StartLiveActivity,
                    liveStartFailureMessage(t),
                    Toast.LENGTH_LONG
                ).show()
            }
        })
    }

    private fun setLoading(loading: Boolean) {
        progress.visibility = if (loading) View.VISIBLE else View.GONE
        startButton.isEnabled = !loading
    }

    private fun liveStartErrorMessage(
        response: Response<LiveStreamResponse>,
        body: LiveStreamResponse?
    ): String {
        body?.message?.takeIf { it.isNotBlank() }?.let { return it }

        val rawError = runCatching { response.errorBody()?.string().orEmpty() }.getOrDefault("")
        parseServerMessage(rawError)?.let { return it }

        if (response.code() == 503 || response.code() == 504 || rawError.contains("via_upstream", ignoreCase = true)) {
            return getString(R.string.live_service_temporarily_unavailable)
        }

        if (response.code() == 401) {
            return getString(R.string.session_expired_login_again)
        }

        if (response.code() == 403) {
            return getString(R.string.livestream_staff_only_watch_allowed)
        }

        if (rawError.trimStart().startsWith("<")) {
            return getString(R.string.could_not_start_live)
        }

        return rawError.takeIf { it.isNotBlank() }
            ?: getString(R.string.live_start_failed_with_code, response.code())
    }

    private fun parseServerMessage(rawError: String): String? {
        val trimmed = rawError.trim()
        if (!trimmed.startsWith("{")) return null
        return runCatching {
            val json = JSONObject(trimmed)
            json.optString("message")
                .takeIf { it.isNotBlank() }
                ?: json.optString("error").takeIf { it.isNotBlank() }
        }.getOrNull()
    }

    private fun liveStartFailureMessage(t: Throwable): String {
        return when (t) {
            is UnknownHostException -> getString(R.string.live_start_no_internet)
            is SocketTimeoutException -> getString(R.string.live_start_timeout)
            is IOException -> getString(R.string.live_start_connection_failed, t.message.orEmpty())
            else -> getString(R.string.could_not_start_live)
        }
    }
}
