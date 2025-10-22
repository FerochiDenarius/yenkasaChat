package com.example.yenkasachat.adapter

import android.media.MediaPlayer
import android.net.Uri
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.TextView
import android.widget.VideoView
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.example.yenkasachat.R
import com.example.yenkasachat.model.Post
import com.bumptech.glide.request.RequestOptions


class PostAdapter(private val posts: List<Post>) :
    RecyclerView.Adapter<PostAdapter.PostViewHolder>() {

    inner class PostViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val imageUser: ImageView = itemView.findViewById(R.id.imageUser)
        val textUser: TextView = itemView.findViewById(R.id.textUser)
        val textCaption: TextView = itemView.findViewById(R.id.textCaption)

        // Post media views
        val imagePost: ImageView = itemView.findViewById(R.id.imagePost)
        val videoPost: VideoView = itemView.findViewById(R.id.videoPost)
        val audioPlayButton: ImageButton = itemView.findViewById(R.id.audioPlayButton)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): PostViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_post, parent, false)
        return PostViewHolder(view)
    }

    override fun onBindViewHolder(holder: PostViewHolder, position: Int) {
        val post = posts[position]

        // Bind user info
        holder.textUser.text = post.user?.username ?: "Anonymous"
        Glide.with(holder.itemView.context)
            .load(post.user?.profileImage ?: R.drawable.ic_user_placeholder)
            .placeholder(R.drawable.ic_user_placeholder)
            .circleCrop()
            .into(holder.imageUser)

        // Reset visibility
        holder.imagePost.visibility = View.GONE
        holder.videoPost.visibility = View.GONE
        holder.audioPlayButton.visibility = View.GONE
        holder.textCaption.visibility = View.GONE

        // Show according to media type
        when (post.mediaType) {
            "text" -> {
                holder.textCaption.visibility = View.VISIBLE
                holder.textCaption.text = post.caption ?: ""
            }

            "image" -> {
                holder.imagePost.visibility = View.VISIBLE
                Glide.with(holder.itemView.context)
                    .load(post.mediaUrl)
                    .apply(RequestOptions()
                        .placeholder(R.drawable.placeholder)
                        .error(R.drawable.placeholder))
                    .into(holder.imagePost)


                holder.textCaption.text = post.caption ?: ""
                holder.textCaption.visibility = if (!post.caption.isNullOrBlank()) View.VISIBLE else View.GONE
            }

            "video" -> {
                holder.videoPost.visibility = View.VISIBLE
                holder.videoPost.setVideoURI(Uri.parse(post.mediaUrl))
                holder.videoPost.setOnPreparedListener { it.isLooping = true }
                holder.videoPost.start()
                holder.textCaption.text = post.caption ?: ""
                holder.textCaption.visibility = if (!post.caption.isNullOrBlank()) View.VISIBLE else View.GONE
            }

            "audio" -> {
                holder.audioPlayButton.visibility = View.VISIBLE
                holder.textCaption.text = post.caption ?: ""
                holder.textCaption.visibility = if (!post.caption.isNullOrBlank()) View.VISIBLE else View.GONE

                holder.audioPlayButton.setOnClickListener {
                    val mediaPlayer = MediaPlayer().apply {
                        setDataSource(post.mediaUrl)
                        prepare()
                        start()
                    }
                    holder.audioPlayButton.setImageResource(R.drawable.ic_pause)
                    mediaPlayer.setOnCompletionListener {
                        holder.audioPlayButton.setImageResource(R.drawable.ic_play)
                        mediaPlayer.release()
                    }
                }
            }
        }
    }

    override fun getItemCount(): Int = posts.size
}
