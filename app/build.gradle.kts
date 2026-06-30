plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose") version "2.0.0"
    id("kotlin-kapt")
    id("com.google.gms.google-services")
    id("com.onesignal.androidsdk.onesignal-gradle-plugin")
}

android {
    namespace = "xyz.yenkasa.app"

    compileSdk = 35
    ndkVersion = "28.2.13676358"

    defaultConfig {
        applicationId = "xyz.yenkasa.app"
        minSdk = 21
        targetSdk = 35
        versionCode = 64
        versionName = "5.7"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables { useSupportLibrary = true }
    }

    buildFeatures {
        viewBinding = true
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    kotlinOptions { jvmTarget = "11" }

    lint {
        abortOnError = false
        checkReleaseBuilds = false
        disable += "DuplicatePlatformClasses"
    }

    // ✅ SIGNING CONFIG MUST BE INSIDE ANDROID {} IN KOTLIN DSL
    signingConfigs {
        create("release") {
            storeFile = rootProject.file(project.property("RELEASE_STORE_FILE") as String)
            storePassword = project.property("RELEASE_STORE_PASSWORD") as String
            keyAlias = project.property("RELEASE_KEY_ALIAS") as String
            keyPassword = project.property("RELEASE_KEY_PASSWORD") as String
        }
    }

    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
    }



    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
        jniLibs {
            useLegacyPackaging = false
        }
    }
}

dependencies {
    configurations.all {
        //noinspection DuplicatePlatformClasses
        exclude(group = "org.json", module = "json")
        exclude(group = "commons-logging", module = "commons-logging")
        exclude(group = "org.apache.httpcomponents")
    }


    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    implementation("androidx.core:core-ktx:1.16.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.constraintlayout:constraintlayout:2.2.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("androidx.fragment:fragment-ktx:1.6.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.4")
    implementation("androidx.work:work-runtime-ktx:2.9.1")

    implementation("com.github.chrisbanes:PhotoView:2.3.0")
    implementation("com.github.yalantis:ucrop:2.2.8")
    implementation("com.burhanrashid52:photoeditor:3.0.2")
    implementation("com.onesignal:OneSignal:4.8.6")
    implementation("de.hdodenhof:circleimageview:3.1.0")

    implementation("com.squareup.okhttp3:okhttp:4.11.0")
    implementation("com.squareup.retrofit2:retrofit:2.9.0")
    implementation("com.squareup.retrofit2:converter-gson:2.9.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.11.0")

    implementation("com.cloudinary:cloudinary-android:3.1.2") {
        exclude(group = "com.facebook.fresco")
        exclude(group = "com.facebook.soloader")
    }
    implementation("com.facebook.fresco:fresco:3.6.0")
    implementation("com.facebook.fresco:nativeimagefilters:3.6.0")
    implementation("com.facebook.fresco:nativeimagetranscoder:3.6.0")

    implementation("com.google.android.gms:play-services-location:21.0.1")
    implementation("com.google.android.gms:play-services-maps:18.2.0")
    implementation("com.google.android.play:app-update:2.1.0")
    implementation("com.google.android.play:app-update-ktx:2.1.0")

    implementation("com.google.firebase:firebase-messaging:23.4.1")
    implementation("com.google.android.gms:play-services-auth:20.7.0")
    implementation("com.google.firebase:firebase-auth-ktx:22.3.1")
    implementation ("com.google.firebase:firebase-bom:32.7.3")
    implementation ("com.google.firebase:firebase-messaging")


    implementation("com.github.bumptech.glide:glide:4.16.0")
    kapt("com.github.bumptech.glide:compiler:4.16.0")


    val composeBom = platform("androidx.compose:compose-bom:2023.10.01")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui-tooling-preview")
    debugImplementation("androidx.compose.ui:ui-tooling")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.6.2")

    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-test-manifest")

    implementation("androidx.media3:media3-exoplayer:1.4.1")
    implementation("androidx.media3:media3-ui:1.4.1")
    implementation("androidx.media3:media3-exoplayer-dash:1.4.1")
    implementation("androidx.media3:media3-session:1.4.1")
    implementation("io.agora.rtc:full-sdk:4.5.2")

    implementation("com.jakewharton.threetenabp:threetenabp:1.4.6")

    implementation("com.google.android.gms:play-services-ads:23.0.0")
    implementation("com.facebook.soloader:soloader:0.12.1")
    implementation("com.facebook.soloader:nativeloader:0.12.1")

    implementation("io.socket:socket.io-client:2.1.1") {
        exclude(group = "org.json", module = "json")


    }

    val roomVersion = "2.6.1"
    implementation("androidx.room:room-runtime:$roomVersion")
    implementation("androidx.room:room-ktx:$roomVersion")
    kapt("androidx.room:room-compiler:$roomVersion")


    // Add the dependency for the Firebase Phone Number Verification library
    implementation(platform("com.google.firebase:firebase-bom:32.7.4"))
    implementation("com.google.firebase:firebase-auth-ktx")

    configurations.all {
        resolutionStrategy {
            force("com.google.android.material:material:1.12.0")
            force("com.facebook.soloader:soloader:0.12.1")
            force("com.facebook.soloader:nativeloader:0.12.1")
        }
    }

}
