package xyz.yenkasa.app.util

import android.content.Context
import android.graphics.BitmapFactory
import android.net.Uri
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.ByteArrayOutputStream

object GroupImagePartFactory {
    fun create(context: Context, uri: Uri): MultipartBody.Part? {
        val compressedBytes = decodeAndCompress(context, uri)
        val bytes = compressedBytes ?: context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
        if (bytes == null || bytes.isEmpty()) return null

        val body = bytes.toRequestBody("image/jpeg".toMediaTypeOrNull())
        return MultipartBody.Part.createFormData(
            "image",
            "group_${System.currentTimeMillis()}.jpg",
            body
        )
    }

    private fun decodeAndCompress(context: Context, uri: Uri): ByteArray? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        context.contentResolver.openInputStream(uri)?.use {
            BitmapFactory.decodeStream(it, null, bounds)
        }
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null

        val sampleSize = calculateSampleSize(bounds.outWidth, bounds.outHeight, 1024)
        val decodeOptions = BitmapFactory.Options().apply { inSampleSize = sampleSize }
        val bitmap = context.contentResolver.openInputStream(uri)?.use {
            BitmapFactory.decodeStream(it, null, decodeOptions)
        } ?: return null

        return ByteArrayOutputStream().use { output ->
            bitmap.compress(android.graphics.Bitmap.CompressFormat.JPEG, 84, output)
            bitmap.recycle()
            output.toByteArray()
        }
    }

    private fun calculateSampleSize(width: Int, height: Int, maxSide: Int): Int {
        var sampleSize = 1
        var scaledWidth = width
        var scaledHeight = height
        while (scaledWidth > maxSide || scaledHeight > maxSide) {
            sampleSize *= 2
            scaledWidth /= 2
            scaledHeight /= 2
        }
        return sampleSize
    }
}
