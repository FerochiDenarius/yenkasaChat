package com.example.yenkasachat.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.example.yenkasachat.R
import com.example.yenkasachat.model.Community

class JoinedCommunityAdapter(
    private val communities: List<Community>,
    private val onCommunityClick: (Community) -> Unit
) : RecyclerView.Adapter<JoinedCommunityAdapter.JoinedCommunityViewHolder>() {

    inner class JoinedCommunityViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val textName: TextView = itemView.findViewById(R.id.textCommunityName)
        private val textMembers: TextView = itemView.findViewById(R.id.textMemberCount)

        fun bind(community: Community) {
            textName.text = community.displayName
            textMembers.text = "${community.memberCount} members"

            itemView.setOnClickListener { onCommunityClick(community) }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): JoinedCommunityViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_joined_community, parent, false)
        return JoinedCommunityViewHolder(view)
    }

    override fun onBindViewHolder(holder: JoinedCommunityViewHolder, position: Int) {
        holder.bind(communities[position])
    }

    override fun getItemCount(): Int = communities.size
}
