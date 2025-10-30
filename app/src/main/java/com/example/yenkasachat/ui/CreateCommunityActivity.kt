package com.example.yenkasachat.ui

import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.example.yenkasachat.R

class CreateCommunityActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_create_community)

        Toast.makeText(this, "CreateCommunityActivity loaded!", Toast.LENGTH_SHORT).show()
    }
}
