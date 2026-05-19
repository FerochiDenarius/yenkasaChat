package xyz.yenkasa.app.ui.chat

import android.Manifest
import android.content.pm.PackageManager
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

class ChatPermissionController(
    private val activity: AppCompatActivity,
    private val launchPermissions: (Array<String>) -> Unit
) {
    private var pendingPermissionAction: (() -> Unit)? = null

    fun hasPermission(permission: String): Boolean {
        return ContextCompat.checkSelfPermission(activity, permission) == PackageManager.PERMISSION_GRANTED
    }

    fun hasAnyPermission(vararg permissions: String): Boolean {
        return permissions.any { hasPermission(it) }
    }

    fun requestPermissions(vararg permissions: String, onGranted: (() -> Unit)? = null) {
        pendingPermissionAction = onGranted
        launchPermissions(permissions.toList().toTypedArray())
    }

    fun checkAndRequestPermission(permission: String): Boolean {
        if (!hasPermission(permission)) {
            requestPermissions(permission)
            return false
        }
        return true
    }

    fun handlePermissionsResult(permissions: Map<String, Boolean>) {
        val pendingAction = pendingPermissionAction
        pendingPermissionAction = null
        if (pendingAction != null && permissions.values.any { it }) {
            pendingAction.invoke()
        }
    }

    fun requestNeededPermissions() {
        if (!hasPermission(Manifest.permission.CAMERA)) {
            requestPermissions(Manifest.permission.CAMERA)
        }
    }

    fun release() {
        pendingPermissionAction = null
    }
}
