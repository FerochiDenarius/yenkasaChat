package com.example.yenkasachat.ui.fragments

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.yenkasachat.R
import com.example.yenkasachat.model.VerificationDashboard
import com.example.yenkasachat.ui.metrics.MetricsAdapter


abstract class MetricListFragment : Fragment() {

    protected var dashboard: VerificationDashboard? = null

    private lateinit var recycler: RecyclerView
    private lateinit var imgBadge: ImageView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val json = arguments?.getString("data")
        dashboard = if (!json.isNullOrEmpty()) {
            com.google.gson.Gson().fromJson(json, VerificationDashboard::class.java)
        } else null
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        val v = inflater.inflate(R.layout.fragment_metrics, container, false)

        recycler = v.findViewById(R.id.recyclerMetrics)
        imgBadge = v.findViewById(R.id.imgBadge)

        recycler.layoutManager = LinearLayoutManager(requireContext())

        return v
    }

    protected fun setBadge(resId: Int) {
        imgBadge.setImageResource(resId)
        animateBadge()
    }

    private fun animateBadge() {
        imgBadge.alpha = 0f
        imgBadge.scaleX = 0.6f
        imgBadge.scaleY = 0.6f
        imgBadge.animate()
            .alpha(1f)
            .scaleX(1f)
            .scaleY(1f)
            .setDuration(300)
            .start()
    }

    protected fun applyMetrics(list: List<Triple<Int, String, String>>) {
        recycler.adapter = MetricsAdapter(list)
    }
}
