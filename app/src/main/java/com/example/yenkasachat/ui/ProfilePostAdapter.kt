package com.example.yenkasachat.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.example.yenkasachat.R
import com.example.yenkasachat.model.Post

// This is the new adapter for the profile post grid.
class ProfilePostAdapter(private val posts: List<Post>) :
    RecyclerView.Adapter<ProfilePostAdapter.PostViewHolder>() {

    // The ViewHolder holds a reference to the single ImageView in our grid item layout.
    inner class PostViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val postImage: ImageView = itemView.findViewById(R.id.imagePostPreview)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): PostViewHolder {
        // We will create this new layout file in the next step.
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_post_preview, parent, false)
        return PostViewHolder(view)
    }

    override fun onBindViewHolder(holder: PostViewHolder, position: Int) {
        val post = posts[position]
        // Load the post's media URL into the ImageView.
        Glide.with(holder.itemView.context)
            .load(post.mediaUrl)
            .placeholder(R.drawable.placeholder) // Make sure you have a 'placeholder.png' in your drawable folder
            .centerCrop()
            .into(holder.postImage)
    }

    override fun getItemCount(): Int = posts.size
}
