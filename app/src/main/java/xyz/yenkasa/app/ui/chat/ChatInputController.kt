package xyz.yenkasa.app.ui.chat

import android.content.Context
import android.graphics.Rect
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.InputMethodManager
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.RelativeLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.bottomsheet.BottomSheetDialog
import xyz.yenkasa.app.R
import xyz.yenkasa.app.adapter.EmojiPickerAdapter
import xyz.yenkasa.app.adapter.MessageAdapter
import xyz.yenkasa.app.model.ChatMessage
import xyz.yenkasa.app.ui.RichContentEditText

class ChatInputController(
    private val activity: AppCompatActivity,
    private val chatRootLayout: FrameLayout,
    private val recyclerView: RecyclerView,
    private val messageAdapterProvider: () -> MessageAdapter,
    private val messageInput: RichContentEditText,
    private val attachMenu: LinearLayout,
    private val mediaPreviewLayout: View,
    private val replyPreviewLayout: RelativeLayout,
    private val textViewRepliedToName: TextView,
    private val textViewRepliedToMessage: TextView,
    private val receiverNameProvider: () -> String,
    private val senderIdProvider: () -> String
) {
    private var replyingToMessage: ChatMessage? = null

    fun showEmojiPicker() {
        hideKeyboard()
        attachMenu.visibility = View.GONE

        val bottomSheet = BottomSheetDialog(activity)
        val root = activity.layoutInflater.inflate(R.layout.activity_chat_media_picker, null)
        bottomSheet.setContentView(root)

        root.findViewById<ImageButton>(R.id.buttonPickerClose).setOnClickListener { bottomSheet.dismiss() }
        root.findViewById<TextView>(R.id.textSelectedCount).text = activity.getString(R.string.chat_emoji_recent_hint)
        root.findViewById<ImageButton>(R.id.buttonPickerNext).visibility = View.GONE
        root.findViewById<TextView>(R.id.tabAll).apply {
            text = activity.getString(R.string.chat_emoji_title)
            setBackgroundResource(R.drawable.bg_chat_media_tab_selected)
        }
        root.findViewById<TextView>(R.id.tabPhotos).visibility = View.GONE
        root.findViewById<TextView>(R.id.tabVideos).visibility = View.GONE
        root.findViewById<TextView>(R.id.viewPickerLoading).visibility = View.GONE
        root.findViewById<TextView>(R.id.textPickerEmptyState).visibility = View.GONE
        root.findViewById<RecyclerView>(R.id.recyclerSelectedMedia).visibility = View.GONE

        root.findViewById<RecyclerView>(R.id.recyclerMediaPicker).apply {
            layoutManager = GridLayoutManager(activity, 6)
            adapter = EmojiPickerAdapter(EMOJIS) { emoji ->
                insertEmoji(emoji)
                bottomSheet.dismiss()
            }
        }

        bottomSheet.show()
    }

    private fun insertEmoji(emoji: String) {
        val editable = messageInput.text ?: return
        val start = messageInput.selectionStart.coerceAtLeast(0)
        val end = messageInput.selectionEnd.coerceAtLeast(0)
        val min = minOf(start, end)
        val max = maxOf(start, end)
        editable.replace(min, max, emoji)
        messageInput.requestFocus()
    }

    fun setupKeyboardAwareChatInput() {
        val receiverHeaderLayout = activity.findViewById<View>(R.id.receiverHeaderLayout)
        val messageInputLayout = activity.findViewById<View>(R.id.messageInputLayout)
        val emojiShortcut = activity.findViewById<View>(R.id.buttonEmojiShortcut)
        val stickerShortcut = activity.findViewById<View>(R.id.buttonStickerShortcut)
        val laughShortcut = activity.findViewById<View>(R.id.buttonLaughReaction)
        val originalRecyclerStartPadding = recyclerView.paddingStart
        val originalRecyclerEndPadding = recyclerView.paddingEnd
        val originalRecyclerBottomPadding = recyclerView.paddingBottom
        val headerMargins = receiverHeaderLayout.marginSnapshot()
        val inputMargins = messageInputLayout.marginSnapshot()
        val replyMargins = replyPreviewLayout.marginSnapshot()
        val mediaPreviewMargins = mediaPreviewLayout.marginSnapshot()
        val attachMenuMargins = attachMenu.marginSnapshot()
        val emojiMargins = emojiShortcut.marginSnapshot()
        val stickerMargins = stickerShortcut.marginSnapshot()
        val laughMargins = laughShortcut.marginSnapshot()
        val sideComfort = dp(22)
        val headerTopComfort = dp(12)
        val bottomComfort = dp(14)
        var wasKeyboardVisible = false

        ViewCompat.setOnApplyWindowInsetsListener(chatRootLayout) { _, insets ->
            val statusBarTop = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top
            val navigationBars = insets.getInsets(WindowInsetsCompat.Type.navigationBars())
            val imeInsets = insets.getInsets(WindowInsetsCompat.Type.ime())
            val cutoutInsets = insets.getInsets(WindowInsetsCompat.Type.displayCutout())
            val safeLeft = maxOf(navigationBars.left, cutoutInsets.left)
            val safeRight = maxOf(navigationBars.right, cutoutInsets.right)
            val safeTop = maxOf(statusBarTop, cutoutInsets.top)
            val startSafeSpacing = sideComfort + safeLeft
            val endSafeSpacing = sideComfort + safeRight
            val bottomSafeSpacing = navigationBars.bottom + bottomComfort

            val isKeyboardVisible = insets.isVisible(WindowInsetsCompat.Type.ime())
            val legacyKeyboardOverlap = if (isKeyboardVisible) getKeyboardOverlapHeight() else 0
            val imeKeyboardOverlap = if (isKeyboardVisible) {
                (imeInsets.bottom - navigationBars.bottom).coerceAtLeast(0)
            } else {
                0
            }
            val keyboardOffset = maxOf(legacyKeyboardOverlap, imeKeyboardOverlap.takeIf { legacyKeyboardOverlap > 0 } ?: 0)
            val translationY = -keyboardOffset.toFloat()

            receiverHeaderLayout.updateMargins(
                start = maxOf(headerMargins.start, startSafeSpacing),
                top = headerMargins.top + safeTop + headerTopComfort,
                end = maxOf(headerMargins.end, endSafeSpacing)
            )
            messageInputLayout.updateMargins(
                start = maxOf(inputMargins.start, startSafeSpacing),
                end = maxOf(inputMargins.end, endSafeSpacing),
                bottom = maxOf(inputMargins.bottom, bottomSafeSpacing)
            )
            replyPreviewLayout.updateMargins(
                start = maxOf(replyMargins.start, startSafeSpacing),
                end = maxOf(replyMargins.end, endSafeSpacing)
            )
            mediaPreviewLayout.updateMargins(
                start = maxOf(mediaPreviewMargins.start, startSafeSpacing),
                end = maxOf(mediaPreviewMargins.end, endSafeSpacing)
            )
            attachMenu.updateMargins(
                start = maxOf(attachMenuMargins.start, startSafeSpacing),
                bottom = attachMenuMargins.bottom + navigationBars.bottom
            )
            emojiShortcut.updateMargins(
                start = maxOf(emojiMargins.start, startSafeSpacing),
                bottom = emojiMargins.bottom + navigationBars.bottom
            )
            stickerShortcut.updateMargins(
                end = maxOf(stickerMargins.end, endSafeSpacing),
                bottom = stickerMargins.bottom + navigationBars.bottom
            )
            laughShortcut.updateMargins(
                bottom = laughMargins.bottom + navigationBars.bottom
            )

            messageInputLayout.translationY = translationY
            replyPreviewLayout.translationY = translationY
            attachMenu.translationY = translationY
            emojiShortcut.translationY = translationY
            stickerShortcut.translationY = translationY
            laughShortcut.translationY = translationY
            recyclerView.setPaddingRelative(
                maxOf(originalRecyclerStartPadding, startSafeSpacing),
                recyclerView.paddingTop,
                maxOf(originalRecyclerEndPadding, endSafeSpacing),
                originalRecyclerBottomPadding + bottomSafeSpacing + keyboardOffset
            )

            if (isKeyboardVisible && !wasKeyboardVisible) {
                scrollMessagesToBottomSoon()
            }
            wasKeyboardVisible = isKeyboardVisible

            insets
        }
        ViewCompat.requestApplyInsets(chatRootLayout)

        messageInput.setOnFocusChangeListener { _, hasFocus ->
            if (hasFocus) {
                attachMenu.visibility = View.GONE
                scrollMessagesToBottomSoon()
            }
        }

        messageInput.setOnClickListener {
            attachMenu.visibility = View.GONE
            scrollMessagesToBottomSoon()
        }
    }

    fun showReplyPreview(message: ChatMessage) {
        replyingToMessage = message
        replyPreviewLayout.visibility = View.VISIBLE

        val senderName = if (message.sender?._id == senderIdProvider()) {
            activity.getString(R.string.you)
        } else {
            receiverNameProvider()
        }
        textViewRepliedToName.text = activity.getString(R.string.replying_to, senderName)
        textViewRepliedToMessage.text = message.text ?: activity.getString(R.string.media_message)

        messageInput.requestFocus()
        val imm = activity.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        imm.showSoftInput(messageInput, InputMethodManager.SHOW_IMPLICIT)
    }

    fun clearReplyingTo() {
        replyingToMessage = null
        replyPreviewLayout.visibility = View.GONE
    }

    fun replyingToMessageId(): String? {
        return replyingToMessage?.id
    }

    fun replyingToMessageForLog(): ChatMessage? {
        return replyingToMessage
    }

    fun showLaughReactionAnimation() {
        val rootWidth = chatRootLayout.width.takeIf { it > 0 } ?: return
        repeat(3) { index ->
            val bubble = TextView(activity).apply {
                text = activity.getString(R.string.laugh_reaction_emoji)
                textSize = 28f
                alpha = 0f
                gravity = Gravity.CENTER
            }
            val size = dp(48)
            val leftMargin = (rootWidth / 2) - (size / 2) + dp((index - 1) * 28)
            val bottomMargin = dp(142 + index * 12)
            val params = FrameLayout.LayoutParams(size, size, Gravity.BOTTOM or Gravity.START).apply {
                marginStart = leftMargin.coerceAtLeast(dp(12))
                setMargins(marginStart, 0, 0, bottomMargin)
            }
            chatRootLayout.addView(bubble, params)
            bubble.animate()
                .alpha(1f)
                .translationY(-dp(86 + index * 12).toFloat())
                .setStartDelay((index * 90).toLong())
                .setDuration(760L)
                .withEndAction { chatRootLayout.removeView(bubble) }
                .start()
        }
    }

    fun release() {
        ViewCompat.setOnApplyWindowInsetsListener(chatRootLayout, null)
        messageInput.onFocusChangeListener = null
        messageInput.setOnClickListener(null)
    }

    private fun hideKeyboard() {
        val imm = activity.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        imm.hideSoftInputFromWindow(messageInput.windowToken, 0)
    }

    private fun getKeyboardOverlapHeight(): Int {
        val visibleFrame = Rect()
        chatRootLayout.getWindowVisibleDisplayFrame(visibleFrame)

        val rootLocation = IntArray(2)
        chatRootLayout.getLocationOnScreen(rootLocation)
        val rootBottom = rootLocation[1] + chatRootLayout.height

        return (rootBottom - visibleFrame.bottom).coerceAtLeast(0)
    }

    private fun scrollMessagesToBottomSoon() {
        recyclerView.postDelayed({
            val lastIndex = messageAdapterProvider().itemCount - 1
            if (lastIndex >= 0) {
                recyclerView.smoothScrollToPosition(lastIndex)
            }
        }, 300)
    }

    private fun dp(value: Int): Int {
        return (value * activity.resources.displayMetrics.density).toInt()
    }

    private data class Margins(
        val start: Int,
        val top: Int,
        val end: Int,
        val bottom: Int
    )

    private fun View.marginSnapshot(): Margins {
        val params = layoutParams as? ViewGroup.MarginLayoutParams
        return Margins(
            start = params?.marginStart ?: 0,
            top = params?.topMargin ?: 0,
            end = params?.marginEnd ?: 0,
            bottom = params?.bottomMargin ?: 0
        )
    }

    private fun View.updateMargins(
        start: Int? = null,
        top: Int? = null,
        end: Int? = null,
        bottom: Int? = null
    ) {
        val params = layoutParams as? ViewGroup.MarginLayoutParams ?: return
        var changed = false
        start?.let {
            if (params.marginStart != it) {
                params.marginStart = it
                changed = true
            }
        }
        top?.let {
            if (params.topMargin != it) {
                params.topMargin = it
                changed = true
            }
        }
        end?.let {
            if (params.marginEnd != it) {
                params.marginEnd = it
                changed = true
            }
        }
        bottom?.let {
            if (params.bottomMargin != it) {
                params.bottomMargin = it
                changed = true
            }
        }
        if (changed) {
            layoutParams = params
        }
    }

    private companion object {
        val EMOJIS = listOf(
            "😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😎",
            "🥳", "😭", "😡", "🙏", "👍", "👏", "🔥", "💚",
            "❤️", "💯", "🎉", "✨", "👀", "🤝", "🙌", "🤍",
            "😅", "😴", "🤔", "😇", "😋", "🥹", "😢", "😬"
        )
    }
}
