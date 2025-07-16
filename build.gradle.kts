// Root-level build.gradle.kts

plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.android) apply false
    id("com.google.gms.google-services") apply false
    id("com.onesignal.androidsdk.onesignal-gradle-plugin") version "0.14.0" apply false
}

buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        // ✅ Corrected version (was 8.11.1 — invalid)
        classpath("com.android.tools.build:gradle:8.1.1")
    }
}
