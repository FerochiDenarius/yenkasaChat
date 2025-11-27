package com.example.yenkasachat.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.example.yenkasachat.R
import com.example.yenkasachat.model.BlockedUserModel

class BlockedUsersAdapter(
    private val users: MutableList<BlockedUserModel>
) : RecyclerView.Adapter<BlockedUsersAdapter.ViewHolder>() {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val name: TextView = view.findViewById(R.id.txtUsername)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val v = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_blocked_user, parent, false)
        return ViewHolder(v)
    }

    override fun getItemCount(): Int = users.size

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.name.text = users[position].username
    }

    fun update(list: List<BlockedUserModel>) {
        users.clear()
        users.addAll(list)
        notifyDataSetChanged()
    }
}
