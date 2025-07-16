pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
        maven("https://plugins.gradle.org/m2/") // ✅ Required for OneSignal plugin
    }

    plugins {
        id("com.google.gms.google-services") version "4.4.1" apply false
        id("com.onesignal.androidsdk.onesignal-gradle-plugin") version "0.14.0" apply false
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "yenkasaChat"
include(":app")
