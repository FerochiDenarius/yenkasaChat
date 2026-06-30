package xyz.yenkasa.app.ui

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import org.json.JSONObject
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import xyz.yenkasa.app.R
import xyz.yenkasa.app.adapter.LiveStreamAdapter
import xyz.yenkasa.app.model.FollowListResponse
import xyz.yenkasa.app.model.JoinLiveStreamRequest
import xyz.yenkasa.app.model.LiveStream
import xyz.yenkasa.app.model.LiveStreamResponse
import xyz.yenkasa.app.model.LiveStreamsResponse
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.network.SocketManager
import xyz.yenkasa.app.util.TokenManager
import xyz.yenkasa.app.util.UserPermissions
import java.io.IOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException

class LiveStreamsFragment : Fragment() {
    private val tag = "LiveStreamsFragment"

    private lateinit var adapter: LiveStreamAdapter
    private lateinit var emptyText: TextView
    private lateinit var tabs: Map<LiveDiscoveryTab, TextView>
    private var socketListenersAttached = false
    private var selectedCommunity: String? = null
    private var selectedTab = LiveDiscoveryTab.TRENDING
    private var latestStreams: List<LiveStream> = emptyList()
    private var followingHostIds: Set<String>? = null

    private enum class LiveDiscoveryTab {
        TRENDING,
        FOLLOWING,
        NEARBY,
        FASHION,
        COMMUNITIES
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        return inflater.inflate(R.layout.fragment_live_streams, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        adapter = LiveStreamAdapter { joinStream(it) }
        emptyText = view.findViewById(R.id.textLiveEmpty)
        val startLiveButton = view.findViewById<View>(R.id.buttonStartLiveFromDiscovery)
        val canStartLive = UserPermissions.canStartLivestream(TokenManager.getUserRole(requireContext()))
        startLiveButton.visibility = if (canStartLive) View.VISIBLE else View.GONE
        startLiveButton.setOnClickListener {
            startActivity(Intent(requireContext(), StartLiveActivity::class.java))
        }

        setupTabs(view)

        view.findViewById<RecyclerView>(R.id.recyclerLiveStreams).apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = this@LiveStreamsFragment.adapter
        }
        loadStreams()
        attachLiveStreamSocketUpdates()
    }

    override fun onResume() {
        super.onResume()
        if (::adapter.isInitialized) {
            loadStreams()
            attachLiveStreamSocketUpdates()
        }
    }

    override fun onDestroyView() {
        detachLiveStreamSocketUpdates()
        super.onDestroyView()
    }

    fun setCommunity(community: String?) {
        selectedCommunity = community
        selectedTab = LiveDiscoveryTab.COMMUNITIES
        if (::tabs.isInitialized) updateTabState()
        loadStreams()
    }

    private fun setupTabs(view: View) {
        tabs = mapOf(
            LiveDiscoveryTab.TRENDING to view.findViewById(R.id.tabLiveTrending),
            LiveDiscoveryTab.FOLLOWING to view.findViewById(R.id.tabLiveFollowing),
            LiveDiscoveryTab.NEARBY to view.findViewById(R.id.tabLiveNearby),
            LiveDiscoveryTab.FASHION to view.findViewById(R.id.tabLiveFashion),
            LiveDiscoveryTab.COMMUNITIES to view.findViewById(R.id.tabLiveCommunities)
        )
        tabs.forEach { (tab, tabView) ->
            tabView.isClickable = true
            tabView.isFocusable = true
            tabView.setOnClickListener {
                if (selectedTab == tab) return@setOnClickListener
                selectedTab = tab
                updateTabState()
                if (tab == LiveDiscoveryTab.FOLLOWING && followingHostIds == null) {
                    loadFollowingThenApply()
                } else {
                    applySelectedTab(latestStreams)
                }
            }
        }
        updateTabState()
    }

    private fun updateTabState() {
        tabs.forEach { (tab, tabView) ->
            val selected = tab == selectedTab
            tabView.setBackgroundResource(
                if (selected) R.drawable.bg_live_chip_active else R.drawable.bg_live_chip_inactive
            )
            tabView.setTextColor(
                ContextCompat.getColor(
                    requireContext(),
                    if (selected) android.R.color.white else R.color.feed_secondary_text
                )
            )
        }
    }

    private fun loadStreams() {
        val community = selectedCommunity
        ApiClient.apiService.getActiveLiveStreams(community = community).enqueue(object : Callback<LiveStreamsResponse> {
            override fun onResponse(call: Call<LiveStreamsResponse>, response: Response<LiveStreamsResponse>) {
                if (!isAdded) return
                if (!response.isSuccessful) {
                    adapter.submitList(emptyList())
                    emptyText.visibility = View.VISIBLE
                    Toast.makeText(
                        requireContext(),
                        parseServerMessage(response.errorBody()?.string())
                            ?: getString(R.string.live_streams_load_failed_with_code, response.code()),
                        Toast.LENGTH_SHORT
                    ).show()
                    return
                }
                val streams = response.body()?.streams.orEmpty()
                latestStreams = streams
                if (selectedTab == LiveDiscoveryTab.FOLLOWING && followingHostIds == null) {
                    loadFollowingThenApply()
                } else {
                    applySelectedTab(streams)
                }
            }

            override fun onFailure(call: Call<LiveStreamsResponse>, t: Throwable) {
                if (!isAdded) return
                emptyText.visibility = View.VISIBLE
                Toast.makeText(requireContext(), liveLoadFailureMessage(t), Toast.LENGTH_SHORT).show()
            }
        })
    }

    private fun loadFollowingThenApply() {
        val currentUserId = TokenManager.getUserId(requireContext())
        val authToken = TokenManager.getToken(requireContext())
        if (currentUserId.isNullOrBlank() || authToken.isNullOrBlank()) {
            followingHostIds = emptySet()
            applySelectedTab(latestStreams)
            return
        }

        ApiClient.apiService.getFollowing(currentUserId, "Bearer $authToken")
            .enqueue(object : Callback<FollowListResponse> {
                override fun onResponse(
                    call: Call<FollowListResponse>,
                    response: Response<FollowListResponse>
                ) {
                    if (!isAdded) return
                    followingHostIds = response.body()
                        ?.following
                        ?.map { it._id }
                        ?.toSet()
                        .orEmpty()
                    applySelectedTab(latestStreams)
                }

                override fun onFailure(call: Call<FollowListResponse>, t: Throwable) {
                    if (!isAdded) return
                    followingHostIds = emptySet()
                    applySelectedTab(latestStreams)
                }
            })
    }

    private fun applySelectedTab(streams: List<LiveStream>) {
        val filtered = when (selectedTab) {
            LiveDiscoveryTab.TRENDING -> streams.sortedWith(
                compareByDescending<LiveStream> { it.viewerCount }
                    .thenByDescending { it.likeCount }
                    .thenByDescending { it.peakViewerCount }
            )
            LiveDiscoveryTab.FOLLOWING -> streams.filter { stream ->
                followingHostIds.orEmpty().contains(stream.hostId)
            }
            LiveDiscoveryTab.NEARBY -> emptyList()
            LiveDiscoveryTab.FASHION -> streams.filter { stream ->
                stream.community.contains("fashion", ignoreCase = true) ||
                    stream.title.contains("fashion", ignoreCase = true)
            }
            LiveDiscoveryTab.COMMUNITIES -> streams.filter { stream ->
                selectedCommunity?.let { selected ->
                    stream.community.equals(selected, ignoreCase = true) ||
                        stream.communityId.equals(selected, ignoreCase = true)
                } ?: stream.community.isNotBlank()
            }
        }
        adapter.submitList(filtered)
        emptyText.visibility = if (filtered.isEmpty()) View.VISIBLE else View.GONE
    }

    private fun joinStream(stream: LiveStream) {
        ApiClient.apiService.joinLiveStream(stream.id, JoinLiveStreamRequest("audience"))
            .enqueue(object : Callback<LiveStreamResponse> {
                override fun onResponse(call: Call<LiveStreamResponse>, response: Response<LiveStreamResponse>) {
                    if (!isAdded) return
                    val body = response.body()
                    val joinedStream = body?.stream
                    val agora = body?.agora
                    val agoraUid = agora?.uid
                    if (!response.isSuccessful || body?.success != true || joinedStream == null || agora == null || !isValidAgoraUid(agoraUid)) {
                        Log.w(
                            tag,
                            "joinLiveStream rejected. http=${response.code()} code=${body?.code} message=${body?.message} streamId=${stream.id} tokenUid=$agoraUid"
                        )
                        val message = if (body?.success == true && !isValidAgoraUid(agoraUid)) {
                            getString(R.string.live_video_credentials_invalid)
                        } else {
                            body?.message
                                ?: parseServerMessage(response.errorBody()?.string())
                                ?: getString(R.string.live_join_failed_with_code, response.code())
                        }
                        Toast.makeText(requireContext(), message, Toast.LENGTH_SHORT).show()
                        return
                    }
                    Log.i(
                        tag,
                        "joinLiveStream token received. streamId=${joinedStream.id} channel=${joinedStream.agoraChannel} uid=${agora.uid} role=${agora.role} expiresAt=${agora.expiresAt}"
                    )
                    startActivity(LiveStreamActivity.intentForAudience(requireContext(), joinedStream, agora))
                }

                override fun onFailure(call: Call<LiveStreamResponse>, t: Throwable) {
                    if (!isAdded) return
                    Log.e(tag, "joinLiveStream transport failure: ${t.javaClass.simpleName}: ${t.message}", t)
                    Toast.makeText(requireContext(), liveJoinFailureMessage(t), Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun attachLiveStreamSocketUpdates() {
        if (socketListenersAttached) return
        SocketManager.ensureConnected(TokenManager.getUserId(requireContext()))
        listOf(
            "live_started",
            "live_ended",
            "live_removed"
        ).forEach { event ->
            SocketManager.on(event) {
                activity?.runOnUiThread {
                    if (isAdded && view != null) {
                        loadStreams()
                    }
                }
            }
        }
        socketListenersAttached = true
    }

    private fun detachLiveStreamSocketUpdates() {
        if (!socketListenersAttached) return
        listOf(
            "live_started",
            "live_ended",
            "live_removed"
        ).forEach(SocketManager::off)
        socketListenersAttached = false
    }

    private fun liveLoadFailureMessage(t: Throwable): String {
        return when (t) {
            is UnknownHostException -> getString(R.string.live_streams_no_internet)
            is SocketTimeoutException -> getString(R.string.live_streams_timeout)
            is IOException -> getString(R.string.live_streams_connection_failed, t.localizedMessage ?: t.javaClass.simpleName)
            else -> getString(R.string.could_not_load_live_streams)
        }
    }

    private fun liveJoinFailureMessage(t: Throwable): String {
        return when (t) {
            is UnknownHostException -> getString(R.string.live_join_no_internet)
            is SocketTimeoutException -> getString(R.string.live_join_timeout)
            is IOException -> getString(R.string.live_join_connection_failed, t.localizedMessage ?: t.javaClass.simpleName)
            else -> getString(R.string.live_stream_unavailable)
        }
    }

    private fun isValidAgoraUid(uid: Int?): Boolean = uid != null && uid > 0

    private fun parseServerMessage(rawError: String?): String? {
        val raw = rawError?.trim().orEmpty()
        if (raw.isBlank() || raw.startsWith("<")) return null
        return runCatching {
            val json = JSONObject(raw)
            json.optString("message").ifBlank { json.optString("error") }.ifBlank { null }
        }.getOrNull()
    }
}
