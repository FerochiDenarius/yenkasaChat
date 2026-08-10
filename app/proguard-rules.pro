# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

-keepattributes Signature,InnerClasses,EnclosingMethod,RuntimeVisibleAnnotations,RuntimeVisibleParameterAnnotations,AnnotationDefault,Exceptions

-keep class xyz.yenkasa.app.model.** { *; }
-keep class xyz.yenkasa.app.network.** { *; }
-keep class xyz.yenkasa.app.api.** { *; }
-keep class xyz.yenkasa.app.util.ChatCacheManager$MessagesEnvelope { *; }
-keep class xyz.yenkasa.app.util.ChatCacheManager$RoomsEnvelope { *; }
-keep interface xyz.yenkasa.app.network.** { *; }
-keep interface xyz.yenkasa.app.api.** { *; }

# Retrofit inspects generic return types and HTTP annotations at runtime.
-keep class retrofit2.** { *; }
-keep interface retrofit2.** { *; }
-keepclasseswithmembers interface * {
    @retrofit2.http.* <methods>;
}

-dontwarn javax.annotation.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
-dontwarn retrofit2.**
