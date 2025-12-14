package xyz.yenkasa.app.ui.fragments

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.VerificationDashboard
import xyz.yenkasa.app.ui.metrics.MetricsAdapter
import com.google.gson.Gson

abstract class MetricListFragment : Fragment() {

    protected var dashboard: VerificationDashboard? = null

    private lateinit var recycler: RecyclerView
    private lateinit var imgBadge: ImageView

    // ⭐ Keep ONE adapter instance (fixes update flickering and resets)
    private lateinit var adapter: MetricsAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val json = arguments?.getString("data")
        dashboard = if (!json.isNullOrEmpty()) {
            Gson().fromJson(json, VerificationDashboard::class.java)
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

        // ⭐ Initialize empty adapter (we will update it later)
        adapter = MetricsAdapter(emptyList())
        recycler.adapter = adapter

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

    // ⭐ Updated: now properly updates adapter instead of replacing it
    protected fun applyMetrics(list: List<Triple<Int, String, String>>) {
        adapter.update(list)
    }
}
