package xyz.yenkasa.app.util

import android.content.Context
import androidx.annotation.StringRes
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
import xyz.yenkasa.app.R

object LocaleManager {
    private const val PREFS_NAME = "locale_settings"
    private const val KEY_LANGUAGE_TAG = "language_tag"
    const val DEFAULT_LANGUAGE_TAG = "en"

    data class SupportedLanguage(
        val tag: String,
        @StringRes val labelRes: Int
    )

    val supportedLanguages = listOf(
        SupportedLanguage("en", R.string.language_english),
        SupportedLanguage("fr", R.string.language_french),
        SupportedLanguage("tw", R.string.language_twi),
        SupportedLanguage("ha", R.string.language_hausa)
    )

    fun restoreSavedLocale(context: Context) {
        applyLocaleTag(getSavedLanguageTag(context))
    }

    fun setLocale(context: Context, tag: String) {
        val resolvedTag = normalizeSupportedTag(tag)
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_LANGUAGE_TAG, resolvedTag)
            .apply()
        applyLocaleTag(resolvedTag)
    }

    fun getSavedLanguageTag(context: Context): String {
        val saved = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_LANGUAGE_TAG, DEFAULT_LANGUAGE_TAG)
        return normalizeSupportedTag(saved)
    }

    fun getCurrentLanguage(context: Context): SupportedLanguage {
        val appLocale = AppCompatDelegate.getApplicationLocales()[0]?.toLanguageTag()
        val tag = normalizeSupportedTag(appLocale ?: getSavedLanguageTag(context))
        return supportedLanguages.firstOrNull { it.tag == tag } ?: supportedLanguages.first()
    }

    fun getLanguageLabel(context: Context, tag: String = getCurrentLanguage(context).tag): String {
        val language = supportedLanguages.firstOrNull { it.tag == normalizeSupportedTag(tag) }
            ?: supportedLanguages.first()
        return context.getString(language.labelRes)
    }

    private fun applyLocaleTag(tag: String) {
        AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(tag))
    }

    private fun normalizeSupportedTag(tag: String?): String {
        val clean = tag?.trim()?.lowercase().orEmpty()
        return supportedLanguages.firstOrNull { it.tag == clean }?.tag ?: DEFAULT_LANGUAGE_TAG
    }
}
