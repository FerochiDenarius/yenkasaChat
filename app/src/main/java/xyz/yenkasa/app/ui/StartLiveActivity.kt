package xyz.yenkasa.app.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.ProgressBar
import android.widget.Spinner
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.Community
import xyz.yenkasa.app.model.CreateLiveStreamRequest
import xyz.yenkasa.app.model.JoinedCommunitiesResponse
import xyz.yenkasa.app.model.LiveStreamResponse
import xyz.yenkasa.app.model.UserPrimaryCommunityResponse
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.TokenManager
import xyz.yenkasa.app.util.UserPermissions
import org.json.JSONObject
import java.io.IOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException

class StartLiveActivity : AppCompatActivity() {
    private val tag = "StartLiveActivity"

    private lateinit var titleInput: EditText
    private lateinit var communitySpinner: Spinner
    private lateinit var startButton: Button
    private lateinit var browseButton: Button
    private lateinit var progress: ProgressBar
    private val selectableCommunities = mutableListOf<Community?>()

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
        communitySpinner = findViewById(R.id.spinnerLiveCommunity)
        startButton = findViewById(R.id.buttonStartLive)
        browseButton = findViewById(R.id.buttonBrowseLive)
        progress = findViewById(R.id.progressStartLive)

        val canStart = UserPermissions.canStartLivestream(TokenManager.getUserRole(this))
        if (!canStart) {
            titleInput.visibility = View.GONE
            findViewById<View>(R.id.textLiveCommunityLabel).visibility = View.GONE
            communitySpinner.visibility = View.GONE
            startButton.visibility = View.GONE
            Toast.makeText(this, R.string.livestream_staff_only_watch_allowed, Toast.LENGTH_LONG).show()
        } else {
            bindCommunityOptions(emptyList())
            loadLiveCommunities()
        }

        startButton.setOnClickListener { validateAndStart() }
        browseButton.setOnClickListener { startActivity(Intent(this, LiveStreamsActivity::class.java)) }
    }

    private fun loadLiveCommunities() {
        val token = TokenManager.getToken(this)
        if (token.isNullOrBlank()) {
            Log.w(tag, "Skipping livestream community load because auth token is blank.")
            bindCommunityOptions(emptyList())
            return
        }

        setCommunityLoading(true)
        ApiClient.apiService.getUserPrimaryCommunity("Bearer $token")
            .enqueue(object : Callback<UserPrimaryCommunityResponse> {
                override fun onResponse(
                    call: Call<UserPrimaryCommunityResponse>,
                    response: Response<UserPrimaryCommunityResponse>
                ) {
                    val primary = if (response.isSuccessful) response.body()?.community else null
                    loadJoinedLiveCommunities(token, primary)
                }

                override fun onFailure(call: Call<UserPrimaryCommunityResponse>, t: Throwable) {
                    Log.w(tag, "Primary community fetch failed: ${t.message}")
                    loadJoinedLiveCommunities(token, null)
                }
            })
    }

    private fun loadJoinedLiveCommunities(token: String, primary: Community?) {
        ApiClient.apiService.getJoinedCommunities("Bearer $token")
            .enqueue(object : Callback<JoinedCommunitiesResponse> {
                override fun onResponse(
                    call: Call<JoinedCommunitiesResponse>,
                    response: Response<JoinedCommunitiesResponse>
                ) {
                    setCommunityLoading(false)
                    if (!response.isSuccessful || response.body() == null) {
                        Log.w(tag, "Joined communities fetch failed: ${response.code()}")
                        bindCommunityOptions(primary?.let { listOf(it) }.orEmpty())
                        return
                    }

                    val communities = linkedMapOf<String, Community>()
                    primary?.id?.takeIf { it.isNotBlank() }?.let { communities[it] = primary }
                    response.body()?.communities.orEmpty().forEach { community ->
                        community.id?.takeIf { it.isNotBlank() }?.let { communities[it] = community }
                    }
                    bindCommunityOptions(communities.values.toList())
                }

                override fun onFailure(call: Call<JoinedCommunitiesResponse>, t: Throwable) {
                    setCommunityLoading(false)
                    Log.w(tag, "Joined communities fetch failed: ${t.message}")
                    bindCommunityOptions(primary?.let { listOf(it) }.orEmpty())
                }
            })
    }

    private fun bindCommunityOptions(communities: List<Community>) {
        selectableCommunities.clear()
        selectableCommunities.add(null)
        selectableCommunities.addAll(communities)

        val labels = selectableCommunities.map { community ->
            community?.displayName?.takeIf { it.isNotBlank() }
                ?: community?.name?.takeIf { it.isNotBlank() }
                ?: getString(R.string.no_community)
        }
        val adapter = ArrayAdapter(
            this,
            R.layout.item_live_community_spinner,
            labels
        )
        adapter.setDropDownViewResource(R.layout.item_live_community_spinner)
        communitySpinner.adapter = adapter
        communitySpinner.setSelection(0)
    }

    private fun selectedCommunity(): Community? {
        val index = communitySpinner.selectedItemPosition
        return selectableCommunities.getOrNull(index)
    }

    private fun setCommunityLoading(loading: Boolean) {
        communitySpinner.isEnabled = !loading
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
            community = selectedCommunity()?.let { community ->
                community.displayName?.takeIf { it.isNotBlank() } ?: community.name
            }?.takeIf { it.isNotBlank() },
            communityId = selectedCommunity()?.id?.takeIf { it.isNotBlank() },
            thumbnail = TokenManager.getProfilePicUrl(this)
        )

        ApiClient.apiService.createLiveStream(request).enqueue(object : Callback<LiveStreamResponse> {
            override fun onResponse(call: Call<LiveStreamResponse>, response: Response<LiveStreamResponse>) {
                setLoading(false)
                val body = response.body()
                val stream = body?.stream
                val agora = body?.agora
                val agoraUid = agora?.uid
                if (!response.isSuccessful || body?.success != true || stream == null || agora == null || !isValidAgoraUid(agoraUid)) {
                    Log.w(
                        tag,
                        "createLiveStream rejected. http=${response.code()} code=${body?.code} message=${body?.message} tokenUid=$agoraUid"
                    )
                    Toast.makeText(
                        this@StartLiveActivity,
                        if (body?.success == true && !isValidAgoraUid(agoraUid)) {
                            getString(R.string.live_video_credentials_invalid)
                        } else {
                            liveStartErrorMessage(response, body)
                        },
                        Toast.LENGTH_LONG
                    ).show()
                    return
                }

                Log.i(
                    tag,
                    "createLiveStream token received. streamId=${stream.id} channel=${stream.agoraChannel} uid=${agora.uid} role=${agora.role} expiresAt=${agora.expiresAt}"
                )
                startActivity(LiveStreamActivity.intentForHost(this@StartLiveActivity, stream, agora))
                finish()
            }

            override fun onFailure(call: Call<LiveStreamResponse>, t: Throwable) {
                setLoading(false)
                Log.e(tag, "createLiveStream transport failure: ${t.javaClass.simpleName}: ${t.message}", t)
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
        body?.code?.takeIf { it.isNotBlank() }?.let {
            Log.w(tag, "Backend returned livestream error code=$it without message.")
        }

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

    private fun isValidAgoraUid(uid: Int?): Boolean = uid != null && uid > 0
}
