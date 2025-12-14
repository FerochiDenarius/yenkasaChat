package xyz.yenkasa.app.adapter

import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.ImageView
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.User
import xyz.yenkasa.app.util.TokenManager
import kotlinx.coroutines.launch

class UserAdapter(
    private val users: List<User>,
    private val onFollowClick: (User, Boolean) -> Unit // ✅ Boolean instead of View
) : RecyclerView.Adapter<UserAdapter.UserViewHolder>() {

    inner class UserViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val textUsername: TextView = itemView.findViewById(R.id.textUsername)
        private val textLocation: TextView = itemView.findViewById(R.id.textLocation)
        private val imageProfile: ImageView = itemView.findViewById(R.id.imageProfile)
        private val btnFollow: TextView = itemView.findViewById(R.id.btnFollow) // 👈 ensure exists in layout

        fun bind(user: User) {
            textUsername.text = user.username
            textLocation.text = user.location ?: ""

            Glide.with(itemView.context)
                .load(user.profileImage)
                .placeholder(R.drawable.ic_profile_placeholder)
                .error(R.drawable.ic_profile_placeholder)
                .into(imageProfile)

            val currentUserId = TokenManager.getUserId(itemView.context)
            val isFollowing = user.followers?.contains(currentUserId) == true

            btnFollow.text = if (isFollowing) "Following" else "Follow"

            // 🔹 Clicking the button toggles follow state
            btnFollow.setOnClickListener {
                onFollowClick(user, isFollowing)
            }

            // 🔹 Optional: click anywhere to open profile later
            itemView.setOnClickListener {
                Log.d("UserAdapter", "Clicked user: ${user.username}")
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

    // Optional: move this notification logic out later
    fun sendFollowNotification(followerId: String, followedId: String) {
        val jsonBody = org.json.JSONObject().apply {
            put("app_id", "165df9e6-a0ea-4a37-a40a-110af7e28ad2")
            put("include_external_user_ids", org.json.JSONArray().put(followedId))
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
                    "Basic YOUR_REST_API_KEY"
                )
                conn.doOutput = true
                conn.outputStream.use { it.write(jsonBody.toString().toByteArray()) }
                val responseCode = conn.responseCode
                Log.d("UserAdapter", "OneSignal follow notify: $responseCode")
            } catch (e: Exception) {
                Log.e("UserAdapter", "Follow notify failed: ${e.message}")
            }
        }
    }
}
