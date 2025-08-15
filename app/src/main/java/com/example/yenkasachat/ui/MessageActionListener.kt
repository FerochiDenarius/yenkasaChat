package com.example.yenkasachat.ui

import com.example.yenkasachat.model.ChatMessage

interface OnMessageActionListener {
    fun onCopyText(message: ChatMessage)
    fun onDeleteMessage(message: ChatMessage, positionInAdapter: Int)
    fun onReplyToMessage(message: ChatMessage)
    fun onForwardMessage(message: ChatMessage)
    fun onEditMessage(message: ChatMessage, positionInAdapter: Int)
    fun onPinMessage(message: ChatMessage, positionInAdapter: Int)
    fun onReact(message: ChatMessage, reactionEmoji: String, positionInAdapter: Int)
    fun onReactWithImage(message: ChatMessage, positionInAdapter: Int)
    fun onMarkMessage(message: ChatMessage, positionInAdapter: Int)
    fun onShowMessageInfo(message: ChatMessage)
}
