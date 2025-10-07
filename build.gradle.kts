// Root-level build.gradle.kts

plugins {
    // Assuming these are defined in your libs.versions.toml (version catalog)
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.android) apply false

    // For Google Services plugin, version is often managed by Google/Firebase BOM or specified in module
    id("com.google.gms.google-services") version "4.4.1" apply false // Example: Use a specific version

    // OneSignal Gradle Plugin - declared here to be available to modules
    // The version will be resolved from the Gradle Plugin Portal or Maven Central
    id("com.onesignal.androidsdk.onesignal-gradle-plugin") version "0.14.0" apply false // Or a more specific version like "0.14.0", ranges can sometimes be tricky
}

// The buildscript block is often not needed for plugin repositories if plugins are fetched from
// standard repositories like Gradle Plugin Portal or Maven Central declared in settings.gradle.kts
// However, if you have specific classpath dependencies for older plugins, it might still be used.
// For the plugins declared above in the `plugins {}` block, this buildscript isn't strictly necessary for them.
buildscript {
    repositories {
        google()
        mavenCentral()
        // maven { url = uri("https://jitpack.io") } // Keep if other dependencies need it
    }
    dependencies {
        // Classpath for Android Gradle Plugin is handled by the alias if using version catalog.
        // If not using version catalog for AGP, you'd have:
        // classpath("com.android.tools.build:gradle:8.1.1") // Example

        // Classpath for google-services plugin (often not needed here if version specified in plugins block)
        // classpath("com.google.gms:google-services:4.4.1") // Example

        // NO NEED for OneSignal plugin classpath here if declared in the `plugins {}` block above
    }
}

tasks.register("stage") {
    dependsOn("build")
}
