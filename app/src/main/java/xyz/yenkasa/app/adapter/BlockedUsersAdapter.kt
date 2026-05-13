package xyz.yenkasa.app.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.BlockedUserModel
import xyz.yenkasa.app.model.UnblockUserRequest
import xyz.yenkasa.app.model.ApiResponse
import xyz.yenkasa.app.network.ApiClient
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone


class BlockedUsersAdapter(
    private val items: MutableList<BlockedUserModel>,
    private val onItemRemoved: ((BlockedUserModel) -> Unit)? = null
) : RecyclerView.Adapter<BlockedUsersAdapter.ViewHolder>() {

    inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val imgAvatar: ImageView = view.findViewById(R.id.imgAvatar)
        val txtUsername: TextView = view.findViewById(R.id.txtUsername)
        val txtRole: TextView = view.findViewById(R.id.txtUserRole)
        val txtDate: TextView = view.findViewById(R.id.txtDateBlocked)
        val layoutUnblock: LinearLayout = view.findViewById(R.id.layoutUnblock)
        val iconUnblock: ImageView = view.findViewById(R.id.iconUnblock)
        val textUnblock: TextView = view.findViewById(R.id.textUnblock)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_blocked_user, parent, false)
        return ViewHolder(view)
    }

    override fun getItemCount(): Int = items.size

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val user = items[position]

        // Load avatar
        Glide.with(holder.itemView.context)
            .load(user.avatar ?: R.drawable.ic_user_placeholder)
            .circleCrop()
            .into(holder.imgAvatar)

        // Username
        holder.txtUsername.text = user.username

        // Role priority: roleName > role.name > localized fallback.
        val finalRole = when {
            !user.roleName.isNullOrBlank() -> user.roleName!!
            !user.role?.name.isNullOrBlank() -> user.role!!.name!!
            else -> holder.itemView.context.getString(R.string.unverified)
        }

        holder.txtRole.text = finalRole
            .replace("_", " ")
            .replaceFirstChar { it.uppercase() }

        // Blocked date
        holder.txtDate.text = user.dateBlocked?.let {
            holder.itemView.context.getString(R.string.blocked_on_date, formatBlockedDate(it))
        } ?: ""

        // UNBLOCK ICON click
        val unblockClick = View.OnClickListener {
            unblockUser(user.userId, holder)
        }
        holder.layoutUnblock.setOnClickListener(unblockClick)
        holder.iconUnblock.setOnClickListener(unblockClick)
        holder.textUnblock.setOnClickListener(unblockClick)
    }

    private fun unblockUser(userId: String, holder: ViewHolder) {

        ApiClient.apiService.unblockUser(
            UnblockUserRequest(targetId = userId)
        ).enqueue(object : Callback<ApiResponse> {

            override fun onResponse(call: Call<ApiResponse>, response: Response<ApiResponse>) {
                if (response.isSuccessful) {

                    val pos = holder.bindingAdapterPosition
                    if (pos != RecyclerView.NO_POSITION) {
                        val removed = items[pos]
                        items.removeAt(pos)
                        notifyItemRemoved(pos)
                        onItemRemoved?.invoke(removed)
                    }

                    Toast.makeText(
                        holder.itemView.context,
                        R.string.user_unblocked,
                        Toast.LENGTH_SHORT
                    ).show()

                } else {
                    Toast.makeText(
                        holder.itemView.context,
                        R.string.failed_to_unblock,
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }

            override fun onFailure(call: Call<ApiResponse>, t: Throwable) {
                Toast.makeText(
                    holder.itemView.context,
                    holder.itemView.context.getString(
                        R.string.network_error_with_message,
                        t.message ?: holder.itemView.context.getString(R.string.unknown_error)
                    ),
                    Toast.LENGTH_SHORT
                ).show()
            }
        })
    }

    fun update(list: List<BlockedUserModel>) {
        items.clear()
        items.addAll(list)
        notifyDataSetChanged()
    }

    private fun formatBlockedDate(rawDate: String): String {
        val trimmed = rawDate.trim()
        if (trimmed.isBlank()) return trimmed

        val output = SimpleDateFormat("MMM d, yyyy", Locale.getDefault())
        val patterns = listOf(
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            "yyyy-MM-dd'T'HH:mm:ss'Z'",
            "yyyy-MM-dd"
        )

        for (pattern in patterns) {
            runCatching {
                val parser = SimpleDateFormat(pattern, Locale.US)
                parser.timeZone = TimeZone.getTimeZone("UTC")
                parser.parse(trimmed)?.let { return output.format(it) }
            }
        }

        return trimmed
    }
}
