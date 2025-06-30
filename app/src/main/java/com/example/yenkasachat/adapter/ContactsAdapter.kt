package com.example.yenkasachat.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.example.yenkasachat.R
import com.example.yenkasachat.model.Contact

class ContactAdapter(
    private val contacts: List<Contact>,
    private val onDeleteClick: (Contact) -> Unit,
    private val onChatClick: (Contact) -> Unit
) : RecyclerView.Adapter<ContactAdapter.ContactViewHolder>() {

    inner class ContactViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val contactName: TextView = itemView.findViewById(R.id.textContactName)
        val btnDelete: ImageButton = itemView.findViewById(R.id.btnDeleteContact)
        val profileImage: ImageView = itemView.findViewById(R.id.imageProfile)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ContactViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_contact, parent, false)
        return ContactViewHolder(view)
    }

    override fun onBindViewHolder(holder: ContactViewHolder, position: Int) {
        val contact = contacts[position]
        holder.contactName.text = contact.username

        Glide.with(holder.itemView.context)
            .load(contact.profileImage ?: "")
            .error(R.drawable.ic_profile_placeholder)
            .placeholder(R.drawable.ic_profile_placeholder)
            .into(holder.profileImage)


        holder.itemView.setOnClickListener { onChatClick(contact) }
        holder.btnDelete.setOnClickListener { onDeleteClick(contact) }
    }

    override fun getItemCount(): Int = contacts.size
}
