package com.example.yenkasachat.util


import org.threeten.bp.LocalDate
import org.threeten.bp.temporal.ChronoUnit


object AdminQualification {

    /**
     * Determines if a user qualifies to be an admin.
     * The app or backend can use this to promote verified users.
     */
    fun meetsRequirements(
        accountCreatedAt: String,
        approvedPosts: Int,
        followers: Int,
        totalLikes: Int,
        totalComments: Int
    ): Boolean {
        val createdDate = LocalDate.parse(accountCreatedAt.substring(0, 10))
        val monthsOld = ChronoUnit.MONTHS.between(createdDate, LocalDate.now())

        return monthsOld >= 3 &&
                approvedPosts >= 30 &&
                followers >= 500 &&
                (totalLikes + totalComments) >= 100
    }
}
