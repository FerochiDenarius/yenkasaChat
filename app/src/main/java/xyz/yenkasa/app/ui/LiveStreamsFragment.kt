package xyz.yenkasa.app.ui

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import xyz.yenkasa.app.R
import xyz.yenkasa.app.adapter.LiveStreamAdapter
import xyz.yenkasa.app.model.JoinLiveStreamRequest
import xyz.yenkasa.app.model.LiveStream
import xyz.yenkasa.app.model.LiveStreamResponse
import xyz.yenkasa.app.model.LiveStreamsResponse
import xyz.yenkasa.app.network.ApiClient

class LiveStreamsFragment : Fragment() {

    private lateinit var adapter: LiveStreamAdapter
    private lateinit var emptyText: TextView

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        return inflater.inflate(R.layout.fragment_live_streams, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        adapter = LiveStreamAdapter { joinStream(it) }
        emptyText = view.findViewById(R.id.textLiveEmpty)
        view.findViewById<RecyclerView>(R.id.recyclerLiveStreams).apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = this@LiveStreamsFragment.adapter
        }
        loadStreams()
    }

    private fun loadStreams() {
        ApiClient.apiService.getActiveLiveStreams().enqueue(object : Callback<LiveStreamsResponse> {
            override fun onResponse(call: Call<LiveStreamsResponse>, response: Response<LiveStreamsResponse>) {
                val streams = response.body()?.streams.orEmpty()
                adapter.submitList(streams)
                emptyText.visibility = if (streams.isEmpty()) View.VISIBLE else View.GONE
            }

            override fun onFailure(call: Call<LiveStreamsResponse>, t: Throwable) {
                emptyText.visibility = View.VISIBLE
                Toast.makeText(requireContext(), R.string.could_not_load_live_streams, Toast.LENGTH_SHORT).show()
            }
        })
    }

    private fun joinStream(stream: LiveStream) {
        ApiClient.apiService.joinLiveStream(stream.id, JoinLiveStreamRequest("audience"))
            .enqueue(object : Callback<LiveStreamResponse> {
                override fun onResponse(call: Call<LiveStreamResponse>, response: Response<LiveStreamResponse>) {
                    val body = response.body()
                    val joinedStream = body?.stream
                    val agora = body?.agora
                    if (!response.isSuccessful || body?.success != true || joinedStream == null || agora == null) {
                        Toast.makeText(requireContext(), body?.message ?: getString(R.string.live_stream_unavailable), Toast.LENGTH_SHORT).show()
                        return
                    }
                    startActivity(LiveStreamActivity.intentForAudience(requireContext(), joinedStream, agora))
                }

                override fun onFailure(call: Call<LiveStreamResponse>, t: Throwable) {
                    Toast.makeText(requireContext(), R.string.network_error_joining_live, Toast.LENGTH_SHORT).show()
                }
            })
    }
}
