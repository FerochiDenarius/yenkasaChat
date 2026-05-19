package xyz.yenkasa.app.adapter

import android.view.LayoutInflater
import android.view.SurfaceView
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import io.agora.rtc2.RtcEngine
import io.agora.rtc2.video.VideoCanvas
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.LiveGuest

class LiveGuestAdapter(
    private val rtcEngineProvider: () -> RtcEngine?,
    private val localUidProvider: () -> Int,
    private val isHost: Boolean,
    private val onGuestAction: (LiveGuest, Action) -> Unit
) : ListAdapter<LiveGuest, LiveGuestAdapter.GuestViewHolder>(DiffCallback) {

    enum class Action { MUTE, UNMUTE, KICK }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): GuestViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_live_guest, parent, false)
        return GuestViewHolder(view)
    }

    override fun onBindViewHolder(holder: GuestViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class GuestViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        private val videoContainer: FrameLayout = view.findViewById(R.id.guestVideoContainer)
        private val avatarImage: ImageView = view.findViewById(R.id.imageGuestAvatar)
        private val nameText: TextView = view.findViewById(R.id.textGuestName)
        private val muteIcon: ImageView = view.findViewById(R.id.iconGuestMute)
        private var videoView: SurfaceView? = null

        fun bind(guest: LiveGuest) {
            nameText.text = guest.username
            Glide.with(avatarImage).load(guest.avatar).placeholder(R.drawable.ic_default_avatar).into(avatarImage)
            muteIcon.visibility = if (guest.isMuted) View.VISIBLE else View.GONE

            if (guest.isVideoStopped) {
                videoContainer.visibility = View.GONE
                avatarImage.visibility = View.VISIBLE
            } else {
                videoContainer.visibility = View.VISIBLE
                avatarImage.visibility = View.GONE
                setupVideo(guest.agoraUid)
            }

            if (isHost) {
                itemView.setOnClickListener {
                    onGuestAction(guest, if (guest.isMuted) Action.UNMUTE else Action.MUTE)
                }
                itemView.setOnLongClickListener {
                    onGuestAction(guest, Action.KICK)
                    true
                }
            } else {
                itemView.setOnClickListener(null)
                itemView.setOnLongClickListener(null)
            }
        }

        private fun setupVideo(uid: Int) {
            if (videoView == null) {
                videoView = SurfaceView(itemView.context)
                videoContainer.addView(
                    videoView,
                    FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT
                    )
                )
            }
            val engine = rtcEngineProvider() ?: return
            val canvas = VideoCanvas(videoView, VideoCanvas.RENDER_MODE_HIDDEN, uid)
            if (uid == localUidProvider()) {
                engine.setupLocalVideo(canvas)
            } else {
                engine.setupRemoteVideo(canvas)
            }
        }
    }

    object DiffCallback : DiffUtil.ItemCallback<LiveGuest>() {
        override fun areItemsTheSame(oldItem: LiveGuest, newItem: LiveGuest): Boolean = oldItem.userId == newItem.userId
        override fun areContentsTheSame(oldItem: LiveGuest, newItem: LiveGuest): Boolean = oldItem == newItem
    }
}
