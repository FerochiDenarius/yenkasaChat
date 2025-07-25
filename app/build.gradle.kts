plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
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
        versionName = "1.0.5"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildFeatures {
        viewBinding = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    kotlinOptions {
        jvmTarget = "11"
    }

    // Optional: Disable unit tests if not used
    tasks.withType<Test> {
        enabled = false
    }
}

dependencies {
    // ✅ AndroidX Core + UI
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.activity:activity-ktx:1.8.2")
    implementation("androidx.constraintlayout:constraintlayout:2.2.0-alpha13")

    // ✅ OneSignal SDK (v4.8.6 stable)
    implementation("com.onesignal:OneSignal:4.8.6")

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

    // ✅ Glide for image loading
    implementation("com.github.bumptech.glide:glide:4.16.0")
    kapt("com.github.bumptech.glide:compiler:4.16.0")

    // ✅ Coroutines for background tasks
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")

    // ✅ Testing libraries
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
}
