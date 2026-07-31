package xyz.yenkasa.app.util

import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import android.util.Log
import android.webkit.MimeTypeMap
import com.bumptech.glide.Glide
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream

object UploadMediaOptimizer {
    private const val TAG = "UploadMediaOptimizer"

    fun prepareForUpload(
        context: Context,
        uri: Uri,
        type: String,
        maxImageDimension: Int = 1600,
        jpegQuality: Int = 82
    ): File? {
        val mimeType = context.contentResolver.getType(uri).orEmpty()
        return if (type == "image" || mimeType.startsWith("image/")) {
            compressImage(context, uri, maxImageDimension, jpegQuality) ?: copyToCache(context, uri, type)
        } else {
            val file = copyToCache(context, uri, type)
            logLargeUpload(type, file)
            file
        }
    }

    private fun compressImage(
        context: Context,
        uri: Uri,
        maxDimension: Int,
        jpegQuality: Int
    ): File? {
        return runBlocking {
            withContext(Dispatchers.IO) {
                compressImageWithGlide(context, uri, maxDimension, jpegQuality)
            }
        }
    }

    private fun compressImageWithGlide(
        context: Context,
        uri: Uri,
        maxDimension: Int,
        jpegQuality: Int
    ): File? {
        val requestManager = Glide.with(context.applicationContext)
        val target = requestManager
            .asBitmap()
            .load(uri)
            .submit(maxDimension, maxDimension)

        return try {
            val bitmap = target.get()
            val outputFile = File(context.cacheDir, "upload_${System.currentTimeMillis()}.jpg")
            FileOutputStream(outputFile).use { output ->
                bitmap.compress(Bitmap.CompressFormat.JPEG, jpegQuality.coerceIn(55, 92), output)
            }

            Log.d(TAG, "compressed_image bytes=${outputFile.length()} maxDimension=$maxDimension quality=$jpegQuality")
            outputFile
        } catch (error: Exception) {
            Log.w(TAG, "Image compression failed; falling back to original copy: ${error.message}")
            null
        } finally {
            requestManager.clear(target)
        }
    }

    private fun copyToCache(context: Context, uri: Uri, type: String): File? {
        return try {
            val extension = resolveExtension(context, uri, type)
            val outputFile = File(context.cacheDir, "upload_${System.currentTimeMillis()}$extension")
            context.contentResolver.openInputStream(uri)?.use { input ->
                outputFile.outputStream().use { output -> input.copyTo(output) }
            } ?: return null
            outputFile
        } catch (error: Exception) {
            Log.e(TAG, "Failed to copy upload file: ${error.message}", error)
            null
        }
    }

    private fun resolveExtension(context: Context, uri: Uri, type: String): String {
        val mimeExtension = context.contentResolver.getType(uri)
            ?.let { MimeTypeMap.getSingleton().getExtensionFromMimeType(it) }
            ?.takeIf { it.isNotBlank() && it.length <= 8 }
        if (!mimeExtension.isNullOrBlank()) return ".$mimeExtension"

        return when (type) {
            "image" -> ".jpg"
            "audio" -> ".m4a"
            "video" -> ".mp4"
            else -> ""
        }
    }

    private fun logLargeUpload(type: String, file: File?) {
        val bytes = file?.length() ?: return
        val megabytes = bytes / (1024.0 * 1024.0)
        if (megabytes >= 20.0) {
            Log.w(TAG, "large_upload type=$type megabytes=${"%.2f".format(megabytes)}")
        }
    }
}
