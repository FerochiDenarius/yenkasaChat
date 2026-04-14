package xyz.yenkasa.app.util

import xyz.yenkasa.app.network.ApiClient

object AppUrls {
    private fun siteBaseUrl(): String = ApiClient.BASE_URL.removeSuffix("api/")

    private fun siteUrl(path: String): String {
        return siteBaseUrl() + path.trimStart('/')
    }

    val privacyPolicy: String
        get() = siteUrl("privacy-policy.html")

    val userAgreement: String
        get() = siteUrl("user-agreement.html")

    val communityGuidelines: String
        get() = siteUrl("community-guidelines.html")

    val safetyPolicy: String
        get() = siteUrl("safety-policy.html")

    val adsDisclosure: String
        get() = siteUrl("ads-disclosure.html")

    val deleteAccount: String
        get() = siteUrl("delete-account")

    val deleteData: String
        get() = siteUrl("delete-data")

    val moderationDashboard: String
        get() = siteUrl("moderation")
}
