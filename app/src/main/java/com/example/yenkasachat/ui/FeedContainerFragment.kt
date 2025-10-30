package com.example.yenkasachat.ui

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import com.example.yenkasachat.R

class FeedContainerFragment : Fragment() {

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        // Inflate FeedActivity layout directly for now
        return inflater.inflate(R.layout.activity_feed, container, false)
    }

    override fun onResume() {
        super.onResume()
        // Optionally refresh the feed if needed
    }
}
