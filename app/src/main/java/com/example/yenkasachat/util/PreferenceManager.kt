package com.example.yenkasachat.util

import android.content.Context

object PreferenceManager {

    private const val PREF_NAME = "yenkasa_prefs"
    private const val KEY_POLICIES_ACCEPTED = "policiesAccepted"

    fun setPoliciesAccepted(context: Context, accepted: Boolean) {
        context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_POLICIES_ACCEPTED, accepted)
            .apply()
    }

    fun hasAcceptedPolicies(context: Context): Boolean {
        return context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
            .getBoolean(KEY_POLICIES_ACCEPTED, false)
    }
}
