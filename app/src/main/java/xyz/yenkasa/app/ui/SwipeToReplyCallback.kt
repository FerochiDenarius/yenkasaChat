package xyz.yenkasa.app.ui

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.ItemTouchHelper
import androidx.recyclerview.widget.RecyclerView
import xyz.yenkasa.app.R

class SwipeToReplyCallback(
    context: Context,
    private val onSwiped: (RecyclerView.ViewHolder) -> Unit
) : ItemTouchHelper.SimpleCallback(0, ItemTouchHelper.LEFT) {

    private val replyIcon = ContextCompat.getDrawable(context, R.drawable.ic_reply)
    private val background = ColorDrawable(Color.LTGRAY)

    override fun onMove(
        recyclerView: RecyclerView,
        viewHolder: RecyclerView.ViewHolder,
        target: RecyclerView.ViewHolder
    ): Boolean {
        return false // We don't want to handle move events, so we return false
    }

    override fun onSwiped(viewHolder: RecyclerView.ViewHolder, direction: Int) {
        onSwiped(viewHolder)
    }

    override fun onChildDraw(
        c: Canvas,
        recyclerView: RecyclerView,
        viewHolder: RecyclerView.ViewHolder,
        dX: Float,
        dY: Float,
        actionState: Int,
        isCurrentlyActive: Boolean
    ) {
        super.onChildDraw(c, recyclerView, viewHolder, dX, dY, actionState, isCurrentlyActive)

        val itemView = viewHolder.itemView
        val iconMargin = (itemView.height - (replyIcon?.intrinsicHeight ?: 0)) / 2
        val iconTop = itemView.top + iconMargin
        val iconBottom = iconTop + (replyIcon?.intrinsicHeight ?: 0)

        // Swiping to the left
        if (dX < 0) {
            val iconRight = itemView.right - iconMargin
            val iconLeft = iconRight - (replyIcon?.intrinsicWidth ?: 0)
            replyIcon?.setBounds(iconLeft, iconTop, iconRight, iconBottom)

            background.setBounds(
                itemView.right + dX.toInt(),
                itemView.top,
                itemView.right,
                itemView.bottom
            )
        } else { // view is unSwiped
            background.setBounds(0, 0, 0, 0)
        }

        background.draw(c)
        replyIcon?.draw(c)
    }
}