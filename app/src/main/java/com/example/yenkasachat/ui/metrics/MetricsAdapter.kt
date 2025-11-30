package com.example.yenkasachat.ui.metrics

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.example.yenkasachat.R

class MetricsAdapter(
    private var list: List<Triple<Int, String, String>>
) : RecyclerView.Adapter<MetricsAdapter.MetricViewHolder>() {

    class MetricViewHolder(v: View) : RecyclerView.ViewHolder(v) {
        val icon: ImageView = v.findViewById(R.id.iconMetric)
        val value: TextView = v.findViewById(R.id.textMetricValue)
        val label: TextView = v.findViewById(R.id.textMetricLabel)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): MetricViewHolder {
        val v = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_metric_row, parent, false)
        return MetricViewHolder(v)
    }

    override fun onBindViewHolder(holder: MetricViewHolder, position: Int) {
        val (iconRes, value, label) = list[position]
        holder.icon.setImageResource(iconRes)
        holder.value.text = value
        holder.label.text = label
    }

    override fun getItemCount(): Int = list.size

    // ⭐ This is the missing piece: dynamic updating
    fun update(newList: List<Triple<Int, String, String>>) {
        list = newList
        notifyDataSetChanged()
    }
}
