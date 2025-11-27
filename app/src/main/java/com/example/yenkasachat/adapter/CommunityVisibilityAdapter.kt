package com.example.yenkasachat.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.Switch
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.example.yenkasachat.R
import com.example.yenkasachat.model.CommunityVisibilityModel
import com.example.yenkasachat.model.BlockCommunityRequest
import com.example.yenkasachat.network.ApiClient
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class CommunityVisibilityAdapter(
    private val items: MutableList<CommunityVisibilityModel>,
    private val showBlockedOnly: Boolean = false
) : RecyclerView.Adapter<CommunityVisibilityAdapter.ViewHolder>() {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val icon: ImageView = view.findViewById(R.id.imgCommunityIcon)
        val name: TextView = view.findViewById(R.id.txtCommunityName)
        val status: TextView = view.findViewById(R.id.txtVisibilityStatus)
        val toggle: Switch = view.findViewById(R.id.switchVisibility)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val v = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_community_visibility, parent, false)
        return ViewHolder(v)
    }

    override fun getItemCount(): Int = items.size

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = items[position]

        holder.name.text = item.name
        holder.toggle.isChecked = !item.isBlocked

        holder.status.text =
            if (item.isBlocked) "Cannot see your posts" else "Can see your posts"

        holder.toggle.setOnCheckedChangeListener { _, isChecked ->
            if (isChecked) {
                unblockCommunity(item.communityId, holder)
            } else {
                blockCommunity(item.communityId, holder)
            }
        }
    }

    private fun blockCommunity(id: String, holder: ViewHolder) {
        ApiClient.apiService.blockCommunity(BlockCommunityRequest(id))
            .enqueue(object : Callback<com.example.yenkasachat.model.ApiResponse> {
                override fun onResponse(
                    call: Call<com.example.yenkasachat.model.ApiResponse>,
                    response: Response<com.example.yenkasachat.model.ApiResponse>
                ) {
                    holder.status.text = "Cannot see your posts"
                }

                override fun onFailure(call: Call<com.example.yenkasachat.model.ApiResponse>, t: Throwable) {}
            })
    }

    private fun unblockCommunity(id: String, holder: ViewHolder) {
        ApiClient.apiService.unblockCommunity(BlockCommunityRequest(id))
            .enqueue(object : Callback<com.example.yenkasachat.model.ApiResponse> {
                override fun onResponse(
                    call: Call<com.example.yenkasachat.model.ApiResponse>,
                    response: Response<com.example.yenkasachat.model.ApiResponse>
                ) {
                    holder.status.text = "Can see your posts"
                }

                override fun onFailure(call: Call<com.example.yenkasachat.model.ApiResponse>, t: Throwable) {}
            })
    }

    fun update(list: List<CommunityVisibilityModel>) {
        items.clear()
        items.addAll(list)
        notifyDataSetChanged()
    }
}
