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
            Toast.makeText(this, "Camera and microphone permissions are required to go live.", Toast.LENGTH_LONG).show()
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

        startButton.setOnClickListener { validateAndStart() }
        browseButton.setOnClickListener { startActivity(Intent(this, LiveStreamsActivity::class.java)) }
    }

    private fun validateAndStart() {
        val role = TokenManager.getUserRole(this)
        val canStart = UserPermissions.canStartLivestream(role)

        if (!canStart) {
            Toast.makeText(this, "Livestreaming is currently available to senior developers only.", Toast.LENGTH_LONG).show()
            return
        }

        if (titleInput.text.toString().trim().isBlank()) {
            titleInput.error = "Enter a live title"
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
                    Toast.makeText(this@StartLiveActivity, body?.message ?: "Could not start live.", Toast.LENGTH_LONG).show()
                    return
                }

                startActivity(LiveStreamActivity.intentForHost(this@StartLiveActivity, stream, agora))
                finish()
            }

            override fun onFailure(call: Call<LiveStreamResponse>, t: Throwable) {
                setLoading(false)
                Toast.makeText(this@StartLiveActivity, "Network error starting live: ${t.message}", Toast.LENGTH_LONG).show()
            }
        })
    }

    private fun setLoading(loading: Boolean) {
        progress.visibility = if (loading) View.VISIBLE else View.GONE
        startButton.isEnabled = !loading
    }
}
