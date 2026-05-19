package xyz.yenkasa.app.ui.chat

import android.content.Intent
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.util.Log
import android.view.Gravity
import android.widget.FrameLayout
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import xyz.yenkasa.app.R
import xyz.yenkasa.app.util.ChatBackgroundManager

class ChatThemeController(
    private val activity: AppCompatActivity,
    private val chatRootLayout: FrameLayout
) {
    private data class ChatThemePreset(
        val key: String,
        val labelRes: Int,
        val colors: IntArray?,
        val orientation: GradientDrawable.Orientation = GradientDrawable.Orientation.TL_BR,
        val solidColor: Int? = null,
        val drawableRes: Int? = null
    )

    private val chatThemePresets = listOf(
        ChatThemePreset("default", R.string.chat_theme_yenkasa_default, null),
        ChatThemePreset("africa_skyline_dark", R.string.chat_theme_africa_skyline_dark, null, drawableRes = R.drawable.chat_theme_africa_skyline_dark),
        ChatThemePreset("softotech_light", R.string.chat_theme_softotech_light, null, drawableRes = R.drawable.chat_theme_softotech_light),
        ChatThemePreset("yenkasa_cream", R.string.chat_theme_yenkasa_cream, null, drawableRes = R.drawable.chat_theme_yenkasa_cream),
        ChatThemePreset("africa_network_blue", R.string.chat_theme_africa_network_blue, null, drawableRes = R.drawable.chat_theme_africa_network_blue),
        ChatThemePreset("ykc_gold_dark", R.string.chat_theme_ykc_gold_dark, null, drawableRes = R.drawable.chat_theme_ykc_gold_dark),
        ChatThemePreset("savanna_green", R.string.chat_theme_savanna_green, null, drawableRes = R.drawable.chat_theme_savanna_green),
        ChatThemePreset("whatsapp_light", R.string.chat_theme_whatsapp_light, intArrayOf(Color.parseColor("#EFE7DC"), Color.parseColor("#DDEEDB")), GradientDrawable.Orientation.TL_BR),
        ChatThemePreset("whatsapp_dark", R.string.chat_theme_whatsapp_dark, intArrayOf(Color.parseColor("#0B141A"), Color.parseColor("#1F2C34")), GradientDrawable.Orientation.TL_BR),
        ChatThemePreset("cool_mint", R.string.chat_theme_cool_mint, intArrayOf(Color.parseColor("#D9F7E8"), Color.parseColor("#EAF8FF")), GradientDrawable.Orientation.TOP_BOTTOM),
        ChatThemePreset("ocean", R.string.chat_theme_ocean, intArrayOf(Color.parseColor("#D8F3F5"), Color.parseColor("#BFD7EA")), GradientDrawable.Orientation.TL_BR),
        ChatThemePreset("sunset", R.string.chat_theme_sunset, intArrayOf(Color.parseColor("#FDE2D2"), Color.parseColor("#F7D6E0")), GradientDrawable.Orientation.TL_BR),
        ChatThemePreset("graphite", R.string.chat_theme_graphite, intArrayOf(Color.parseColor("#202124"), Color.parseColor("#3C4043")), GradientDrawable.Orientation.TOP_BOTTOM)
    )

    fun showBackgroundPicker(openCustomImage: () -> Unit) {
        val customImageLabel = activity.getString(R.string.choose_picture_from_device)
        val labels = listOf(customImageLabel) + chatThemePresets.map { activity.getString(it.labelRes) }
        val currentPreset = ChatBackgroundManager.getPreset(activity) ?: DEFAULT_PRESET
        val checkedIndex = if (ChatBackgroundManager.getBackgroundUri(activity) != null) {
            0
        } else {
            val presetIndex = chatThemePresets.indexOfFirst { it.key == currentPreset }
                .takeIf { it >= 0 } ?: 0
            presetIndex + 1
        }

        AlertDialog.Builder(activity)
            .setTitle(R.string.change_chat_background)
            .setSingleChoiceItems(labels.toTypedArray(), checkedIndex) { dialog, which ->
                if (which == 0) {
                    dialog.dismiss()
                    openCustomImage()
                    return@setSingleChoiceItems
                }

                val selectedPreset = chatThemePresets[which - 1]
                if (selectedPreset.key == DEFAULT_PRESET) {
                    ChatBackgroundManager.clearBackground(activity)
                } else {
                    ChatBackgroundManager.savePreset(activity, selectedPreset.key)
                }
                applyBackground(selectedPreset.key)
                dialog.dismiss()
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    fun applySavedBackground() {
        ChatBackgroundManager.getBackgroundUri(activity)?.let { uri ->
            if (applyCustomBackground(uri)) {
                return
            }
            Log.w(TAG, "Saved custom chat background could not be loaded: $uri")
            ChatBackgroundManager.clearBackground(activity)
        }

        applyBackground(ChatBackgroundManager.getPreset(activity) ?: DEFAULT_PRESET)
    }

    fun handleCustomImageSelected(uri: Uri) {
        try {
            activity.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        } catch (ex: Exception) {
            Log.w(TAG, "Could not persist chat background image permission", ex)
        }

        ChatBackgroundManager.saveBackgroundUri(activity, uri)
        if (applyCustomBackground(uri)) {
            Toast.makeText(activity, R.string.chat_background_updated, Toast.LENGTH_SHORT).show()
        } else {
            ChatBackgroundManager.clearBackground(activity)
            applyBackground(DEFAULT_PRESET)
            Toast.makeText(activity, R.string.chat_background_image_unusable, Toast.LENGTH_SHORT).show()
        }
    }

    private fun applyCustomBackground(uri: Uri): Boolean {
        return try {
            val bitmap = activity.contentResolver.openInputStream(uri)?.use { input ->
                BitmapFactory.decodeStream(input)
            } ?: return false

            chatRootLayout.background = BitmapDrawable(activity.resources, bitmap).apply {
                gravity = Gravity.FILL
            }
            true
        } catch (ex: Exception) {
            Log.e(TAG, "Failed to apply custom chat background", ex)
            false
        }
    }

    private fun applyBackground(presetKey: String) {
        val preset = chatThemePresets.firstOrNull { it.key == presetKey }
            ?: chatThemePresets.first()

        if (preset.key == DEFAULT_PRESET) {
            chatRootLayout.background = ContextCompat.getDrawable(activity, R.drawable.bg_chat_conversation_surface)
            return
        }

        val drawable = when {
            preset.drawableRes != null -> ContextCompat.getDrawable(activity, preset.drawableRes)
            preset.colors != null -> GradientDrawable(preset.orientation, preset.colors)
            else -> GradientDrawable().apply { setColor(preset.solidColor ?: Color.WHITE) }
        }

        chatRootLayout.background = drawable
    }

    private companion object {
        const val TAG = "ChatThemeController"
        const val DEFAULT_PRESET = "default"
    }
}
