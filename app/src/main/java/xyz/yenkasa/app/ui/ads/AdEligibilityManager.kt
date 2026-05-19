package xyz.yenkasa.app.ui.ads

import android.content.Context
import android.content.SharedPreferences
import androidx.core.content.edit
import kotlin.math.max
import kotlin.random.Random

object AdEligibilityManager {
    private const val PREF_NAME = "yenkasa_monetization_prefs"
    private const val KEY_SESSION_START = "session_start_ms"
    private const val KEY_LAST_AD = "last_ad_ms"
    private const val KEY_LAST_INTERSTITIAL = "last_interstitial_ms"
    private const val KEY_VIDEOS_WATCHED = "videos_watched"
    private const val KEY_VIDEOS_SINCE_AD = "videos_since_ad"
    private const val KEY_MONETIZED_SESSION = "monetized_session_logged"
    private const val KEY_REWARDED_OPT_IN = "rewarded_opt_in"
    private const val KEY_APP_FOREGROUND = "app_foreground"
    private const val KEY_TYPING = "typing_blocked"
    private const val KEY_INTERSTITIAL_THRESHOLD = "interstitial_threshold"
    private const val KEY_SHOWN_MIDROLL_POSTS = "midroll_shown_posts"
    private const val KEY_SHOWN_INTERSTITIAL_POSTS = "interstitial_shown_posts"
    private const val KEY_WATCHED_POSTS = "watched_posts"
    private const val KEY_LAST_BACKGROUND = "last_background_ms"

    private const val MIN_INTERSTITIAL_GAP_MS = 5 * 60 * 1000L
    private const val SESSION_INTERSTITIAL_MIN_MS = 2 * 60 * 1000L
    private const val SESSION_RESET_AFTER_BACKGROUND_MS = 30 * 60 * 1000L
    private const val MAX_TRACKED_POST_IDS = 120
    private const val FEED_AD_MIN_GAP = 4
    private const val FEED_AD_MAX_GAP = 5

    @Volatile
    private var prefs: SharedPreferences? = null
    @Volatile
    private var sessionSeed: Int = Random.nextInt()

    private fun prefs(context: Context): SharedPreferences {
        prefs?.let { return it }
        return context.applicationContext.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE).also {
            prefs = it
        }
    }

    fun init(context: Context) {
        val shared = prefs(context)
        ensureSession(shared)
    }

    fun onAppForeground(context: Context) {
        val shared = prefs(context)
        val now = System.currentTimeMillis()
        val lastBackground = shared.getLong(KEY_LAST_BACKGROUND, 0L)
        if (lastBackground > 0L && now - lastBackground >= SESSION_RESET_AFTER_BACKGROUND_MS) {
            resetSession(shared, now)
        } else {
            ensureSession(shared, now)
        }
        shared.edit {
            putBoolean(KEY_APP_FOREGROUND, true)
        }
    }

    fun onAppBackground(context: Context) {
        prefs(context).edit {
            putBoolean(KEY_APP_FOREGROUND, false)
            putBoolean(KEY_TYPING, false)
            putLong(KEY_LAST_BACKGROUND, System.currentTimeMillis())
        }
    }

    fun setTyping(context: Context, typing: Boolean) {
        prefs(context).edit {
            putBoolean(KEY_TYPING, typing)
        }
    }

    fun canShowInterstitial(context: Context): Boolean {
        return canShowInterstitial(context, null)
    }

    fun canShowInterstitial(context: Context, postId: String? = null): Boolean {
        val shared = prefs(context)
        val now = System.currentTimeMillis()
        val sessionStart = shared.getLong(KEY_SESSION_START, now)
        val watchedVideos = shared.getInt(KEY_VIDEOS_WATCHED, 0)
        val videosSinceAd = shared.getInt(KEY_VIDEOS_SINCE_AD, 0)
        val lastInterstitial = shared.getLong(KEY_LAST_INTERSTITIAL, 0L)
        val foreground = shared.getBoolean(KEY_APP_FOREGROUND, true)
        val typing = shared.getBoolean(KEY_TYPING, false)
        val threshold = shared.getInt(KEY_INTERSTITIAL_THRESHOLD, 4 + (absSeed() % 3))
        val shownPosts = shared.getStringSet(KEY_SHOWN_INTERSTITIAL_POSTS, emptySet()).orEmpty()
        val sessionEligible = now - sessionStart >= SESSION_INTERSTITIAL_MIN_MS
        val watchCountEligible = watchedVideos >= threshold

        return foreground &&
            !typing &&
            (watchCountEligible || sessionEligible) &&
            videosSinceAd >= 4 &&
            now - lastInterstitial >= MIN_INTERSTITIAL_GAP_MS &&
            (postId.isNullOrBlank() || !shownPosts.contains(postId))
    }

    fun canShowMidRoll(context: Context, postId: String, videoDurationSeconds: Int): Boolean {
        if (videoDurationSeconds <= 60) return false
        val shared = prefs(context)
        val foreground = shared.getBoolean(KEY_APP_FOREGROUND, true)
        val typing = shared.getBoolean(KEY_TYPING, false)
        val seenPosts = shared.getStringSet(KEY_SHOWN_MIDROLL_POSTS, emptySet()).orEmpty()
        val alreadyShown = seenPosts.contains(postId)
        return foreground && !typing && !alreadyShown
    }

    fun canShowRewarded(context: Context): Boolean {
        val shared = prefs(context)
        return shared.getBoolean(KEY_APP_FOREGROUND, true) && !shared.getBoolean(KEY_TYPING, false)
    }

    fun canShowFeedAd(organicCount: Int, lastAdOrganicCount: Int, adSlot: Int = 0): Boolean {
        val gap = feedAdGapForSlot(adSlot)
        return organicCount >= gap && (organicCount - lastAdOrganicCount) >= gap
    }

    fun feedAdGapForSlot(adSlot: Int): Int {
        val range = FEED_AD_MAX_GAP - FEED_AD_MIN_GAP + 1
        return FEED_AD_MIN_GAP + ((adSlot + absSeed()) % range)
    }

    fun registerVideoWatched(context: Context, postId: String) {
        val shared = prefs(context)
        val watchedPosts = shared.getStringSet(KEY_WATCHED_POSTS, emptySet()).orEmpty().toMutableSet()
        if (!watchedPosts.add(postId)) return

        shared.edit {
            putStringSet(KEY_WATCHED_POSTS, watchedPosts)
            putInt(KEY_VIDEOS_WATCHED, shared.getInt(KEY_VIDEOS_WATCHED, 0) + 1)
            putInt(KEY_VIDEOS_SINCE_AD, shared.getInt(KEY_VIDEOS_SINCE_AD, 0) + 1)
        }
    }

    fun registerAdShown(context: Context, type: MonetizationAdType, postId: String? = null) {
        val shared = prefs(context)
        val now = System.currentTimeMillis()
        val edits = shared.edit()
        edits.putLong(KEY_LAST_AD, now)
        when (type) {
            MonetizationAdType.INTERSTITIAL -> {
                edits.putLong(KEY_LAST_INTERSTITIAL, now)
                postId?.let { appendStringSet(shared, edits, KEY_SHOWN_INTERSTITIAL_POSTS, it) }
            }
            MonetizationAdType.MIDROLL -> {
                postId?.let { appendStringSet(shared, edits, KEY_SHOWN_MIDROLL_POSTS, it) }
            }
            MonetizationAdType.REWARDED -> Unit
            MonetizationAdType.FEED -> Unit
        }
        edits.putInt(KEY_VIDEOS_SINCE_AD, 0)
        if (!shared.getBoolean(KEY_MONETIZED_SESSION, false)) {
            edits.putBoolean(KEY_MONETIZED_SESSION, true)
        }
        edits.apply()
    }

    fun registerAdSkipped(context: Context, type: MonetizationAdType, postId: String? = null) {
        val shared = prefs(context)
        val edit = shared.edit()
        when (type) {
            MonetizationAdType.MIDROLL -> postId?.let {
                appendStringSet(shared, edit, KEY_SHOWN_MIDROLL_POSTS, it)
            }
            MonetizationAdType.INTERSTITIAL -> postId?.let {
                appendStringSet(shared, edit, KEY_SHOWN_INTERSTITIAL_POSTS, it)
            }
            else -> Unit
        }
        edit.apply()
    }

    fun shouldRegisterMonetizedSession(context: Context): Boolean {
        return !prefs(context).getBoolean(KEY_MONETIZED_SESSION, false)
    }

    fun registerMonetizedSession(context: Context) {
        prefs(context).edit {
            putBoolean(KEY_MONETIZED_SESSION, true)
        }
    }

    fun resetForTesting(context: Context) {
        prefs(context).edit().clear().apply()
    }

    fun currentInterstitialThreshold(context: Context): Int {
        return prefs(context).getInt(KEY_INTERSTITIAL_THRESHOLD, 4 + (absSeed() % 3))
    }

    private fun appendStringSet(
        shared: SharedPreferences,
        edit: SharedPreferences.Editor,
        key: String,
        value: String
    ): SharedPreferences.Editor {
        val current = shared.getStringSet(key, emptySet()).orEmpty().toMutableSet()
        current.add(value)
        while (current.size > MAX_TRACKED_POST_IDS) {
            current.remove(current.first())
        }
        return edit.putStringSet(key, current)
    }

    private fun ensureSession(shared: SharedPreferences, now: Long = System.currentTimeMillis()) {
        if (shared.getLong(KEY_SESSION_START, 0L) <= 0L) {
            resetSession(shared, now)
        }
    }

    private fun resetSession(shared: SharedPreferences, now: Long) {
        shared.edit {
            putLong(KEY_SESSION_START, now)
            putLong(KEY_LAST_BACKGROUND, 0L)
            putInt(KEY_INTERSTITIAL_THRESHOLD, 4 + (absSeed() % 3))
            putBoolean(KEY_MONETIZED_SESSION, false)
            putInt(KEY_VIDEOS_WATCHED, 0)
            putInt(KEY_VIDEOS_SINCE_AD, 0)
            putStringSet(KEY_WATCHED_POSTS, emptySet<String>())
            putStringSet(KEY_SHOWN_MIDROLL_POSTS, emptySet<String>())
            putStringSet(KEY_SHOWN_INTERSTITIAL_POSTS, emptySet<String>())
        }
    }

    private fun absSeed(): Int = max(0, sessionSeed)
}

enum class MonetizationAdType {
    FEED,
    MIDROLL,
    INTERSTITIAL,
    REWARDED
}
