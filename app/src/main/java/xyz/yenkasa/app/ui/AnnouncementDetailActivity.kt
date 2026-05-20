package xyz.yenkasa.app.ui

import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Bundle
import android.text.method.LinkMovementMethod
import android.view.View
import android.widget.Button
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.text.HtmlCompat
import androidx.core.view.WindowCompat
import com.bumptech.glide.Glide
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.Announcement
import xyz.yenkasa.app.model.AnnouncementMedia
import xyz.yenkasa.app.model.AnnouncementReactionResponse
import xyz.yenkasa.app.model.AnnouncementResponse
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.AppLinkManager
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class AnnouncementDetailActivity : AppCompatActivity() {

    private lateinit var textChannel: TextView
    private lateinit var textBadge: TextView
    private lateinit var textTitle: TextView
    private lateinit var textAuthor: TextView
    private lateinit var imagePrimary: ImageView
    private lateinit var textBody: TextView
    private lateinit var textMetrics: TextView
    private lateinit var layoutAttachments: LinearLayout
    private lateinit var buttonLike: Button
    private lateinit var buttonOpenTarget: Button

    private var announcementId: String = ""
    private var currentAnnouncement: Announcement? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        configureSystemBars()
        setContentView(R.layout.activity_announcement_detail)

        announcementId = intent.getStringExtra("ANNOUNCEMENT_ID").orEmpty()
        if (announcementId.isBlank()) {
            Toast.makeText(this, R.string.announcement_detail_load_failed, Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        bindViews()
        findViewById<ImageButton>(R.id.buttonAnnouncementBack).setOnClickListener { finish() }
        buttonLike.setOnClickListener { likeAnnouncement() }
        buttonOpenTarget.setOnClickListener {
            currentAnnouncement?.targetUrl?.takeIf { url -> url.isNotBlank() }?.let { openTarget(it) }
        }

        loadAnnouncement()
    }

    private fun bindViews() {
        textChannel = findViewById(R.id.textAnnouncementChannel)
        textBadge = findViewById(R.id.textAnnouncementBadge)
        textTitle = findViewById(R.id.textAnnouncementTitle)
        textAuthor = findViewById(R.id.textAnnouncementAuthor)
        imagePrimary = findViewById(R.id.imageAnnouncementPrimary)
        textBody = findViewById(R.id.textAnnouncementBody)
        textMetrics = findViewById(R.id.textAnnouncementMetrics)
        layoutAttachments = findViewById(R.id.layoutAnnouncementAttachments)
        buttonLike = findViewById(R.id.buttonAnnouncementLike)
        buttonOpenTarget = findViewById(R.id.buttonAnnouncementOpenTarget)
    }

    private fun configureSystemBars() {
        val backgroundColor = ContextCompat.getColor(this, R.color.notification_page_background)
        window.statusBarColor = backgroundColor
        window.navigationBarColor = backgroundColor

        val nightMode = resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK
        val lightBars = nightMode != Configuration.UI_MODE_NIGHT_YES
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = lightBars
            isAppearanceLightNavigationBars = lightBars
        }
    }

    private fun loadAnnouncement() {
        ApiClient.apiService.getAnnouncement(announcementId)
            .enqueue(object : Callback<AnnouncementResponse> {
                override fun onResponse(call: Call<AnnouncementResponse>, response: Response<AnnouncementResponse>) {
                    val announcement = response.body()?.announcement
                    if (!response.isSuccessful || announcement == null) {
                        Toast.makeText(this@AnnouncementDetailActivity, R.string.announcement_detail_load_failed, Toast.LENGTH_LONG).show()
                        finish()
                        return
                    }
                    currentAnnouncement = announcement
                    renderAnnouncement(announcement)
                    markViewed()
                }

                override fun onFailure(call: Call<AnnouncementResponse>, t: Throwable) {
                    Toast.makeText(this@AnnouncementDetailActivity, R.string.announcement_detail_load_failed, Toast.LENGTH_LONG).show()
                    finish()
                }
            })
    }

    private fun renderAnnouncement(announcement: Announcement) {
        textChannel.text = announcement.channelName?.takeIf { it.isNotBlank() } ?: getString(R.string.yenkasa_updates)
        val badgeText = announcement.badge?.takeIf { it.isNotBlank() }
        if (badgeText == null) {
            textBadge.visibility = View.GONE
        } else {
            textBadge.visibility = View.VISIBLE
            textBadge.text = badgeText
        }
        textTitle.text = announcement.title
        val author = announcement.authorUsername?.takeIf { it.isNotBlank() } ?: getString(R.string.announcement_unknown_author)
        textAuthor.text = getString(
            R.string.announcement_detail_author_with_time,
            getString(R.string.announcement_detail_author, author),
            formatTime(announcement.createdAt)
        )
        textBody.text = HtmlCompat.fromHtml(announcement.message, HtmlCompat.FROM_HTML_MODE_LEGACY)
        textBody.movementMethod = LinkMovementMethod.getInstance()
        textMetrics.text = getString(R.string.announcements_metrics_format, announcement.viewsCount, announcement.likesCount)

        val primaryMedia = announcement.media.firstOrNull()
        if (primaryMedia != null && (primaryMedia.type == "image" || primaryMedia.type == "video")) {
            imagePrimary.visibility = View.VISIBLE
            Glide.with(imagePrimary)
                .load(primaryMedia.thumbnail?.takeIf { it.isNotBlank() } ?: primaryMedia.url)
                .placeholder(R.drawable.placeholder_image)
                .error(R.drawable.placeholder_image)
                .into(imagePrimary)
            imagePrimary.setOnClickListener { openExternal(primaryMedia.url) }
        } else {
            imagePrimary.visibility = View.GONE
        }

        buttonOpenTarget.visibility = if (announcement.targetUrl.isNullOrBlank()) View.GONE else View.VISIBLE
        renderAttachments(announcement.media.drop(if (primaryMedia != null && (primaryMedia.type == "image" || primaryMedia.type == "video")) 1 else 0))
    }

    private fun renderAttachments(attachments: List<AnnouncementMedia>) {
        layoutAttachments.removeAllViews()
        attachments.forEach { media ->
            val button = Button(this).apply {
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).also { params ->
                    params.topMargin = 12
                }
                background = ContextCompat.getDrawable(this@AnnouncementDetailActivity, R.drawable.bg_announcement_secondary_button)
                text = media.filename?.takeIf { it.isNotBlank() } ?: when (media.type) {
                    "audio" -> getString(R.string.announcement_audio_attachment)
                    "file" -> getString(R.string.announcement_file_attachment)
                    else -> getString(R.string.announcement_attachment)
                }
                isAllCaps = false
                setTextColor(ContextCompat.getColor(this@AnnouncementDetailActivity, R.color.menu_primary_text))
                setOnClickListener { openExternal(media.url) }
            }
            layoutAttachments.addView(button)
        }
    }

    private fun likeAnnouncement() {
        ApiClient.apiService.likeAnnouncement(announcementId)
            .enqueue(object : Callback<AnnouncementReactionResponse> {
                override fun onResponse(
                    call: Call<AnnouncementReactionResponse>,
                    response: Response<AnnouncementReactionResponse>
                ) {
                    val payload = response.body()
                    val updatedAnnouncement = payload?.announcement
                    if (!response.isSuccessful || payload == null) {
                        Toast.makeText(this@AnnouncementDetailActivity, R.string.announcement_publish_failed, Toast.LENGTH_SHORT).show()
                        return
                    }
                    currentAnnouncement = updatedAnnouncement ?: currentAnnouncement?.copy(likesCount = payload.likesCount)
                    currentAnnouncement?.let { renderAnnouncement(it) }
                    Toast.makeText(
                        this@AnnouncementDetailActivity,
                        if (payload.liked) R.string.announcement_detail_like_added else R.string.announcement_detail_like_removed,
                        Toast.LENGTH_SHORT
                    ).show()
                }

                override fun onFailure(call: Call<AnnouncementReactionResponse>, t: Throwable) {
                    Toast.makeText(this@AnnouncementDetailActivity, R.string.announcement_publish_failed, Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun markViewed() {
        ApiClient.apiService.viewAnnouncement(announcementId)
            .enqueue(object : Callback<AnnouncementReactionResponse> {
                override fun onResponse(
                    call: Call<AnnouncementReactionResponse>,
                    response: Response<AnnouncementReactionResponse>
                ) {
                    val payload = response.body() ?: return
                    currentAnnouncement = payload.announcement ?: currentAnnouncement?.copy(
                        viewsCount = payload.viewsCount
                    )
                    currentAnnouncement?.let { renderAnnouncement(it) }
                }

                override fun onFailure(call: Call<AnnouncementReactionResponse>, t: Throwable) = Unit
            })
    }

    private fun openTarget(targetUrl: String) {
        val appLinkUri = AppLinkManager.canonicalizeUri(targetUrl)
        if (appLinkUri != null && AppLinkManager.parseRoute(appLinkUri) != null) {
            startActivity(AppLinkManager.buildMainActivityIntent(this, appLinkUri))
            return
        }
        openExternal(targetUrl)
    }

    private fun openExternal(url: String) {
        runCatching {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        }.onFailure {
            Toast.makeText(this, R.string.announcement_detail_load_failed, Toast.LENGTH_SHORT).show()
        }
    }

    private fun formatTime(iso: String?): String {
        if (iso.isNullOrBlank()) return ""
        return runCatching {
            val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }
            val date = parser.parse(iso) ?: Date()
            SimpleDateFormat("dd MMM yyyy, hh:mm a", Locale.getDefault()).format(date)
        }.getOrDefault("")
    }
}
