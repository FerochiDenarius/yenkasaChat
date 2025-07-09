package com.example.yenkasachat.adapter

import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.ImageView
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.example.yenkasachat.R
import com.example.yenkasachat.model.User

class UserAdapter(
    private val users: List<User>,
    private val onUserClick: (User, View) -> Unit // 🔄 Accept View as well
) : RecyclerView.Adapter<UserAdapter.UserViewHolder>() {

    inner class UserViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val textUsername: TextView = itemView.findViewById(R.id.textUsername)
        private val textLocation: TextView = itemView.findViewById(R.id.textLocation)
        private val imageProfile: ImageView = itemView.findViewById(R.id.imageProfile)

        fun bind(user: User) {
            textUsername.text = user.username
            textLocation.text = user.location ?: ""

            Log.d("UserAdapter", "Loading image: ${user.profileImage}")

            Glide.with(itemView.context)
                .load(user.profileImage)
                .placeholder(R.drawable.ic_profile_placeholder)
                .error(R.drawable.ic_profile_placeholder)
                .into(imageProfile)

            // 👇 Pass the clicked view to the callback
            itemView.setOnClickListener {
                onUserClick(user, itemView)
            }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): UserViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_user, parent, false)
        return UserViewHolder(view)
    }

    override fun getItemCount(): Int = users.size

    override fun onBindViewHolder(holder: UserViewHolder, position: Int) {
        holder.bind(users[position])
    }
}
