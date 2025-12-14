package xyz.yenkasa.app.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.CheckBox
import android.widget.ImageView
import android.widget.Switch
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.CommunityVisibilityModel
import xyz.yenkasa.app.model.BlockCommunityRequest
import xyz.yenkasa.app.network.ApiClient
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class CommunityVisibilityAdapter(
    private val items: MutableList<CommunityVisibilityModel>
) : RecyclerView.Adapter<CommunityVisibilityAdapter.ViewHolder>() {

    inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val icon = view.findViewById<ImageView>(R.id.imgCommunityIcon)
        val name = view.findViewById<TextView>(R.id.txtCommunityName)
        val status = view.findViewById<TextView>(R.id.txtVisibilityStatus)
        val switch = view.findViewById<Switch>(R.id.switchVisibility)

        val cbBlockUsers = view.findViewById<CheckBox>(R.id.cbBlockUsers)
        val cbExceptFollowers = view.findViewById<CheckBox>(R.id.cbExceptFollowers)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_community_visibility, parent, false)
        return ViewHolder(view)
    }

    override fun getItemCount() = items.size


    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = items[position]

        holder.name.text = item.communityName
        holder.cbBlockUsers.isChecked = item.blockUsers
        holder.cbExceptFollowers.isChecked = item.exceptFollowers
        holder.cbExceptFollowers.isEnabled = item.blockUsers

        updateStatusText(holder, item)

        // ---------------------------
        // 🔵 MAIN SWITCH (visibility)
        // ---------------------------
        holder.switch.isChecked = !item.blockUsers
        holder.switch.setOnCheckedChangeListener { _, isChecked ->
            item.blockUsers = !isChecked

            if (!isChecked) {
                // switch OFF → block users
                holder.cbBlockUsers.isChecked = true
                holder.cbExceptFollowers.isEnabled = true
            } else {
                // switch ON → allow users
                holder.cbBlockUsers.isChecked = false
                holder.cbExceptFollowers.isChecked = false
                holder.cbExceptFollowers.isEnabled = false
                item.exceptFollowers = false
            }

            updateStatusText(holder, item)
        }

        // ---------------------------
        // 🔵 BLOCK USERS CHECKBOX
        // ---------------------------
        holder.cbBlockUsers.setOnCheckedChangeListener { _, isChecked ->
            item.blockUsers = isChecked
            holder.switch.isChecked = !isChecked

            if (!isChecked) {
                // unblocked
                item.exceptFollowers = false
                holder.cbExceptFollowers.isChecked = false
                holder.cbExceptFollowers.isEnabled = false
            } else {
                // blocked
                holder.cbExceptFollowers.isEnabled = true
            }

            updateStatusText(holder, item)
        }

        // ---------------------------
        // 🔵 EXCEPT FOLLOWERS CHECKBOX
        // ---------------------------
        holder.cbExceptFollowers.setOnCheckedChangeListener { _, isChecked ->
            if (item.blockUsers) {
                item.exceptFollowers = isChecked
            } else {
                item.exceptFollowers = false
                holder.cbExceptFollowers.isChecked = false
            }

            updateStatusText(holder, item)
        }
    }


    // ---------------------------------------------------
    // 🔵 Update the small text under community name
    // ---------------------------------------------------
    private fun updateStatusText(holder: ViewHolder, item: CommunityVisibilityModel) {

        holder.status.text = when {
            !item.blockUsers ->
                "Can see your posts"

            item.blockUsers && !item.exceptFollowers ->
                "Blocked — nobody in this community can see your posts"

            item.blockUsers && item.exceptFollowers ->
                "Only your followers in this community can see your posts"

            else -> "Can see your posts"
        }
    }


    // ---------------------------------------------------
    // 🔵 Update list
    // ---------------------------------------------------
    fun update(newList: List<CommunityVisibilityModel>) {
        items.clear()
        items.addAll(newList)
        notifyDataSetChanged()
    }

    // ---------------------------------------------------
    // 🔵 Return all visibility settings
    // ---------------------------------------------------
    fun collectedVisibility(): List<CommunityVisibilityModel> = items


    // ---------------------------------------------------
    // 🔵 Example: Unblock API call (if needed)
    // ---------------------------------------------------
    private fun unblockCommunity(id: String, holder: ViewHolder) {
        ApiClient.apiService.unblockCommunity(BlockCommunityRequest(id))
            .enqueue(object : Callback<xyz.yenkasa.app.model.ApiResponse> {

                override fun onResponse(
                    call: Call<xyz.yenkasa.app.model.ApiResponse>,
                    response: Response<xyz.yenkasa.app.model.ApiResponse>
                ) {
                    holder.status.text = "Can see your posts"
                }

                override fun onFailure(
                    call: Call<xyz.yenkasa.app.model.ApiResponse>,
                    t: Throwable
                ) {}
            })
    }
}
