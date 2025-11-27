package com.example.yenkasachat.adapter

import android.content.Intent
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.example.yenkasachat.R
import com.example.yenkasachat.model.BlockedUserModel
import com.example.yenkasachat.ui.UserProfileActivity

class BlockedUsersAdapter(
    private val users: MutableList<BlockedUserModel>
) : RecyclerView.Adapter<BlockedUsersAdapter.ViewHolder>() {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val avatar: ImageView = view.findViewById(R.id.imgAvatar)
        val name: TextView = view.findViewById(R.id.txtUsername)
        val role: TextView = view.findViewById(R.id.txtUserRole)
        val dateBlocked: TextView = view.findViewById(R.id.txtDateBlocked)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val v = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_blocked_user, parent, false)
        return ViewHolder(v)
    }

    override fun getItemCount(): Int = users.size

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val user = users[position]

        holder.name.text = user.username

        // ROLE logic
        val finalRole = user.roleName ?: user.role?.name ?: "User"
        holder.role.text = finalRole.replaceFirstChar { it.uppercase() }

        // DATE BLOCKED
        holder.dateBlocked.text = user.dateBlocked ?: ""

        // Avatar
        val imgUrl =
            if (user.avatar?.startsWith("http") == true) user.avatar
            else "https://yenkasa.xyz/${user.avatar}"

        Glide.with(holder.itemView.context)
            .load(imgUrl)
            .placeholder(R.drawable.ic_user_placeholder)
            .circleCrop()
            .into(holder.avatar)

        // Click → open profile
        holder.itemView.setOnClickListener {
            val ctx = holder.itemView.context
            val intent = Intent(ctx, UserProfileActivity::class.java)
            intent.putExtra("USER_ID", user.userId)
            ctx.startActivity(intent)
        }
    }

    fun update(list: List<BlockedUserModel>) {
        users.clear()
        users.addAll(list)
        notifyDataSetChanged()
    }
}
