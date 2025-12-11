package com.example.yenkasachat.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.example.yenkasachat.R
import com.example.yenkasachat.model.BlockedUserModel
import com.example.yenkasachat.model.UnblockUserRequest
import com.example.yenkasachat.model.ApiResponse
import com.example.yenkasachat.network.ApiClient
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import com.example.yenkasachat.model.BlockUserRequest


class BlockedUsersAdapter(
    private val items: MutableList<BlockedUserModel>
) : RecyclerView.Adapter<BlockedUsersAdapter.ViewHolder>() {

    inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val imgAvatar: ImageView = view.findViewById(R.id.imgAvatar)
        val txtUsername: TextView = view.findViewById(R.id.txtUsername)
        val txtRole: TextView = view.findViewById(R.id.txtUserRole)
        val txtDate: TextView = view.findViewById(R.id.txtDateBlocked)
        val iconUnblock: ImageView = view.findViewById(R.id.iconUnblock)  // <-- CORRECT ICON
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

        // Role — priority: roleName > role.name > "User"
        val finalRole = when {
            !user.roleName.isNullOrBlank() -> user.roleName!!
            !user.role?.name.isNullOrBlank() -> user.role!!.name!!
            else -> "User"
        }

        holder.txtRole.text = finalRole
            .replace("_", " ")
            .replaceFirstChar { it.uppercase() }

        // Blocked date
        holder.txtDate.text = user.dateBlocked?.let { "Blocked: $it" } ?: ""

        // UNBLOCK ICON click
        holder.iconUnblock.setOnClickListener {
            unblockUser(user.userId, holder)
        }
    }

    private fun unblockUser(userId: String, holder: ViewHolder) {

        ApiClient.apiService.unblockUser(UnblockUserRequest(userId))
            .enqueue(object : Callback<ApiResponse> {
                override fun onResponse(
                    call: Call<ApiResponse>,
                    response: Response<ApiResponse>
                ) {
                    if (response.isSuccessful) {

                        val pos = holder.bindingAdapterPosition
                        if (pos != RecyclerView.NO_POSITION) {
                            items.removeAt(pos)
                            notifyItemRemoved(pos)
                        }

                        Toast.makeText(
                            holder.itemView.context,
                            "User unblocked",
                            Toast.LENGTH_SHORT
                        ).show()
                    } else {
                        Toast.makeText(
                            holder.itemView.context,
                            "Failed to unblock",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }

                override fun onFailure(call: Call<ApiResponse>, t: Throwable) {
                    Toast.makeText(
                        holder.itemView.context,
                        "Network error: ${t.message}",
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
}
