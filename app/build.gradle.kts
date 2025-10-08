plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    // ✅ ADD THE COMPOSE COMPILER PLUGIN HERE
    id("org.jetbrains.kotlin.plugin.compose") version "2.0.0" // Or the version compatible with your Kotlin version
    id("kotlin-kapt")
    id("com.google.gms.google-services")
    id("com.onesignal.androidsdk.onesignal-gradle-plugin")
}

android {
    namespace = "com.example.yenkasachat"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.example.yenkasachat"
        minSdk = 21
        targetSdk = 35
        versionCode = 5
        versionName = "0.1.8"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    buildFeatures {
        viewBinding = true
        compose = true // This still enables compose at the AGP level
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    kotlinOptions {
        jvmTarget = "11"
    }

    // ❌ REMOVE THIS ENTIRE BLOCK
    // composeOptions {
    //     kotlinCompilerExtensionVersion = "..."
    // }

    packagingOptions {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    // Your existing dependencies remain the same, including the Compose BOM and libraries

        implementation("androidx.security:security-crypto:1.1.0-alpha06") // Or the latest stable version

    // ✅ AndroidX Core + UI
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.activity:activity-compose:1.8.2")
    implementation("androidx.constraintlayout:constraintlayout:2.2.0-alpha13")

    // ✅ OneSignal SDK (v4.8.6 stable)
    implementation("com.onesignal:OneSignal:4.8.6")
    implementation("de.hdodenhof:circleimageview:3.1.0")

    // ✅ Retrofit + Gson + OkHttp
    implementation("com.squareup.retrofit2:retrofit:2.9.0")
    implementation("com.squareup.retrofit2:converter-gson:2.9.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.11.0")

    // ✅ Cloudinary
    implementation("com.cloudinary:cloudinary-android:2.3.1")

    // ✅ Google Maps + Location
    implementation("com.google.android.gms:play-services-location:21.0.1")
    implementation("com.google.android.gms:play-services-maps:18.2.0")

    // ✅ Firebase Cloud Messaging (needed by OneSignal under the hood)
    implementation("com.google.firebase:firebase-messaging:23.4.1")
    // google services for google login
    implementation("com.google.android.gms:play-services-auth:20.7.0")
    implementation("com.google.firebase:firebase-auth-ktx:22.3.1")

    // ✅ Glide for image loading
    implementation("com.github.bumptech.glide:glide:4.16.0")
    kapt("com.github.bumptech.glide:compiler:4.16.0")

    // ✅ Coroutines for background tasks
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")

    // --- ✅ JETPACK COMPOSE DEPENDENCIES ---
    val composeBom = platform("androidx.compose:compose-bom:2023.10.01") // Use latest stable
    implementation(composeBom)
    androidTestImplementation(composeBom)
    implementation("io.socket:socket.io-client:2.1.0")


    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui-tooling-preview")
    debugImplementation("androidx.compose.ui:ui-tooling")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.6.2")

    // ✅ Testing libraries
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-test-manifest")

    //video call and phone call

    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.6.2")
    implementation("androidx.lifecycle:lifecycle-common-java8:2.6.2")


// Check for the latest version
}
