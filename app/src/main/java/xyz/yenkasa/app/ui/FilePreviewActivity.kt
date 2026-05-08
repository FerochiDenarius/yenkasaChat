package xyz.yenkasa.app.ui

import android.net.Uri
import android.os.Bundle
import android.webkit.WebSettings
import android.webkit.WebView
import android.widget.ImageButton
import android.widget.TextView
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import xyz.yenkasa.app.R
import xyz.yenkasa.app.util.EdgeToEdgeInsets

class FilePreviewActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_file_preview)

        val fileUrl = intent.getStringExtra(EXTRA_FILE_URL).orEmpty()
        val fileName = intent.getStringExtra(EXTRA_FILE_NAME).orEmpty()
            .ifBlank { fileUrl.substringAfterLast('/').substringBefore('?').ifBlank { "Document" } }
        val mimeType = intent.getStringExtra(EXTRA_MIME_TYPE).orEmpty()
        val topBar = findViewById<android.view.View>(R.id.layoutFilePreviewTopBar)
        val title = findViewById<TextView>(R.id.textFilePreviewTitle)
        val webView = findViewById<WebView>(R.id.webViewFilePreview)

        EdgeToEdgeInsets.setLightSystemBars(window, lightStatusBars = false, lightNavigationBars = false)
        EdgeToEdgeInsets.applySystemBarPadding(topBar, top = true, left = true, right = true)
        findViewById<ImageButton>(R.id.buttonFilePreviewBack).setOnClickListener { finish() }
        title.text = fileName

        webView.settings.apply {
            javaScriptEnabled = true
            builtInZoomControls = true
            displayZoomControls = false
            loadWithOverviewMode = true
            useWideViewPort = true
            cacheMode = WebSettings.LOAD_DEFAULT
        }

        val encoded = Uri.encode(fileUrl)
        val lowerName = fileName.lowercase()
        val lowerMime = mimeType.lowercase()
        val previewUrl = when {
            lowerMime.contains("pdf") || lowerName.endsWith(".pdf") ->
                "https://docs.google.com/gview?embedded=1&url=$encoded"
            lowerMime.contains("word") || lowerName.endsWith(".docx") || lowerName.endsWith(".doc") ->
                "https://view.officeapps.live.com/op/embed.aspx?src=$encoded"
            else -> fileUrl
        }
        webView.loadUrl(previewUrl)
    }

    companion object {
        const val EXTRA_FILE_URL = "extra_file_url"
        const val EXTRA_FILE_NAME = "extra_file_name"
        const val EXTRA_MIME_TYPE = "extra_mime_type"
    }
}
