package com.example.yenkasachat.ui

import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.AttributeSet
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputConnection
import androidx.core.view.inputmethod.EditorInfoCompat
import androidx.core.view.inputmethod.InputConnectionCompat
import androidx.appcompat.widget.AppCompatEditText
import androidx.core.view.inputmethod.InputContentInfoCompat

/**
 * An EditText that can receive rich content (like stickers) from the keyboard.
 */
class RichContentEditText @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = androidx.appcompat.R.attr.editTextStyle
) : AppCompatEditText(context, attrs, defStyleAttr) {

    // A listener to inform the Activity that content (a sticker) has been received.
    var onRichContentListener: ((Uri) -> Unit)? = null

// ... (class definition)

// In RichContentEditText.kt

    override fun onCreateInputConnection(editorInfo: EditorInfo): InputConnection? {
        val ic = super.onCreateInputConnection(editorInfo) ?: return null

        EditorInfoCompat.setContentMimeTypes(editorInfo, arrayOf("image/png", "image/gif", "image/webp"))

        val callback = InputConnectionCompat.OnCommitContentListener { inputContentInfo, flags, _ ->
            // The 'inputContentInfo' parameter is ALREADY the 'InputContentInfoCompat' we need.
            // We do not need to wrap it again.

            val isFromKeyboard = (flags and InputConnectionCompat.INPUT_CONTENT_GRANT_READ_URI_PERMISSION) != 0

            if (isFromKeyboard) {
                try {
                    // Request permission directly on the provided object.
                    inputContentInfo.requestPermission()
                    // The content URI is now accessible. Pass it to the listener.
                    onRichContentListener?.invoke(inputContentInfo.contentUri)
                    // Return true to indicate that we have handled the content.
                    return@OnCommitContentListener true
                } catch (e: Exception) {
                    // Log the error or handle it as needed
                    return@OnCommitContentListener false
                } finally {
                    // Release permission directly on the provided object.
                    inputContentInfo.releasePermission()
                }
            }

            // Return false to let the default behavior happen for other cases.
            false
        }

        return InputConnectionCompat.createWrapper(ic, editorInfo, callback)
    }
}
