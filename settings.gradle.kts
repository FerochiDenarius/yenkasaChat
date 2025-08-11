// settings.gradle.kts

pluginManagement {
    repositories {
        gradlePluginPortal() // For plugins like OneSignal, AGP (if not using version catalog exclusively for its repo)
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral() // For general plugins and libraries
    }

    // Define versions of plugins that will be used across the project.
    // Modules can then apply them by ID without specifying the version again,
    // or they can override the version if needed (though discouraged for consistency).
    plugins {
        id("com.google.gms.google-services") version "4.4.1" apply false // Use latest stable
        id("com.onesignal.androidsdk.onesignal-gradle-plugin") version "0.14.0" apply false // Using specific version (e.g., 0.14.0 or latest)
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        // Add other repositories like JitPack here if any of your *libraries* (not plugins) require it.
        // e.g., maven { url = uri("https://jitpack.io") }
    }
}

rootProject.name = "yenkasaChat"
include(":app")
