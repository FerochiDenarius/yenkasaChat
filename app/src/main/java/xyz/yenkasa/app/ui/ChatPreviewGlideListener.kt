package xyz.yenkasa.app.ui

import com.bumptech.glide.load.DataSource
import com.bumptech.glide.load.engine.GlideException
import com.bumptech.glide.request.RequestListener
import com.bumptech.glide.request.target.Target

class ChatPreviewGlideListener(
    private val onSuccess: () -> Unit,
    private val onFailure: () -> Unit
) : RequestListener<android.graphics.drawable.Drawable> {
    override fun onLoadFailed(
        e: GlideException?,
        model: Any?,
        target: Target<android.graphics.drawable.Drawable>,
        isFirstResource: Boolean
    ): Boolean {
        onFailure()
        return false
    }

    override fun onResourceReady(
        resource: android.graphics.drawable.Drawable,
        model: Any,
        target: Target<android.graphics.drawable.Drawable>?,
        dataSource: DataSource,
        isFirstResource: Boolean
    ): Boolean {
        onSuccess()
        return false
    }
}
