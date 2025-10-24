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
import kotlinx.coroutines.launch


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
    fun sendFollowNotification(followerId: String, followedId: String) {
        val jsonBody = org.json.JSONObject().apply {
            put("app_id", "165df9e6-a0ea-4a37-a40a-110af7e28ad2") // ✅ Your OneSignal App ID
            put("include_external_user_ids", org.json.JSONArray().put(followedId)) // 🎯 Target the followed user
            put("headings", org.json.JSONObject().put("en", "New Follower!"))
            put("contents", org.json.JSONObject().put("en", "$followerId started following you"))
            put("data", org.json.JSONObject().put("type", "follow").put("from_user", followerId))
        }

        kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.IO).launch {
            try {
                val url = java.net.URL("https://onesignal.com/api/v1/notifications")
                val conn = url.openConnection() as java.net.HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8")
                conn.setRequestProperty(
                    "Authorization",
                    "Basic YOUR_REST_API_KEY" // 🔑 Replace with your OneSignal REST API key
                )
                conn.doOutput = true
                conn.outputStream.use { it.write(jsonBody.toString().toByteArray()) }
                val responseCode = conn.responseCode
                android.util.Log.d("UserAdapter", "OneSignal follow notify: $responseCode")
            } catch (e: Exception) {
                android.util.Log.e("UserAdapter", "Follow notify failed: ${e.message}")
            }
        }
    }

}
