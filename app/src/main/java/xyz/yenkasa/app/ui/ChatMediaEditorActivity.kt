package xyz.yenkasa.app.ui

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.widget.EditText
import android.widget.ImageButton
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import com.bumptech.glide.Glide
import ja.burhanrashid52.photoeditor.PhotoEditor
import ja.burhanrashid52.photoeditor.PhotoEditorView
import ja.burhanrashid52.photoeditor.SaveSettings
import xyz.yenkasa.app.R
import java.io.File

class ChatMediaEditorActivity : AppCompatActivity() {

    private lateinit var photoEditorView: PhotoEditorView
    private lateinit var photoEditor: PhotoEditor
    private var sourceUri: Uri? = null
    private var isSaving = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_chat_media_editor)

        photoEditorView = findViewById(R.id.photoEditorView)
        sourceUri = intent.getStringExtra(EXTRA_SOURCE_URI)?.let(Uri::parse)
        if (sourceUri == null) {
            Toast.makeText(this, R.string.chat_media_edit_failed, Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        photoEditor = PhotoEditor.Builder(this, photoEditorView)
            .setPinchTextScalable(true)
            .build()

        Glide.with(this)
            .load(sourceUri)
            .placeholder(R.drawable.placeholder_image)
            .error(R.drawable.error_image)
            .into(photoEditorView.source)

        findViewById<ImageButton>(R.id.buttonEditorClose).setOnClickListener {
            if (!isSaving) finish()
        }
        findViewById<ImageButton>(R.id.buttonEditorUndo).setOnClickListener { photoEditor.undo() }
        findViewById<ImageButton>(R.id.buttonEditorRedo).setOnClickListener { photoEditor.redo() }
        findViewById<ImageButton>(R.id.buttonEditorDraw).setOnClickListener {
            photoEditor.setBrushDrawingMode(true)
            Toast.makeText(this, R.string.chat_media_draw_enabled, Toast.LENGTH_SHORT).show()
        }
        findViewById<ImageButton>(R.id.buttonEditorText).setOnClickListener { promptForText() }
        findViewById<ImageButton>(R.id.buttonEditorEmoji).setOnClickListener { promptForEmoji() }
        findViewById<ImageButton>(R.id.buttonEditorSave).setOnClickListener { saveEditedImage() }
    }

    private fun promptForText() {
        val input = EditText(this).apply {
            hint = getString(R.string.chat_media_add_text_hint)
            setTextColor(Color.WHITE)
            setHintTextColor(getColor(R.color.chat_picker_secondary_text))
        }

        AlertDialog.Builder(this)
            .setTitle(R.string.chat_media_add_text_title)
            .setView(input)
            .setPositiveButton(R.string.chat_media_apply) { _, _ ->
                val value = input.text?.toString().orEmpty().trim()
                if (value.isNotBlank()) {
                    photoEditor.addText(value, Color.WHITE)
                }
            }
            .setNegativeButton(android.R.string.cancel, null)
            .show()
    }

    private fun promptForEmoji() {
        val emojis = arrayOf("😀", "😂", "😍", "🔥", "💚", "👏", "🎉", "✨", "🙏", "👍")
        AlertDialog.Builder(this)
            .setTitle(R.string.chat_media_add_emoji_title)
            .setItems(emojis) { _, which ->
                photoEditor.addEmoji(emojis[which])
            }
            .setNegativeButton(android.R.string.cancel, null)
            .show()
    }

    private fun saveEditedImage() {
        if (isSaving) return
        isSaving = true

        val outputFile = File(cacheDir, "chat_edit_${System.currentTimeMillis()}.jpg")
        val saveSettings = SaveSettings.Builder()
            .setClearViewsEnabled(true)
            .setTransparencyEnabled(false)
            .build()

        Log.d("ChatMediaEditor", "Saving edited image to ${outputFile.absolutePath}")
        photoEditor.saveAsFile(
            outputFile.absolutePath,
            saveSettings,
            object : PhotoEditor.OnSaveListener {
                override fun onSuccess(imagePath: String) {
                    Log.d("ChatMediaEditor", "Edited image saved: $imagePath")
                    val result = Intent().apply {
                        putExtra(EXTRA_OUTPUT_URI, Uri.fromFile(File(imagePath)))
                    }
                    setResult(Activity.RESULT_OK, result)
                    finish()
                }

                override fun onFailure(exception: Exception) {
                    isSaving = false
                    Log.e("ChatMediaEditor", "Failed to save edited image", exception)
                    Toast.makeText(
                        this@ChatMediaEditorActivity,
                        R.string.chat_media_edit_failed,
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }
        )
    }

    companion object {
        const val EXTRA_SOURCE_URI = "chat_media_editor_source_uri"
        const val EXTRA_OUTPUT_URI = "chat_media_editor_output_uri"
    }
}
