package xyz.yenkasa.app.ui.ads

import android.app.Activity
import android.content.Context
import android.util.Log
import androidx.fragment.app.Fragment
import com.google.android.gms.ads.AdError
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.rewardedinterstitial.RewardedInterstitialAd
import com.google.android.gms.ads.rewardedinterstitial.RewardedInterstitialAdLoadCallback
import xyz.yenkasa.app.BuildConfig

class AdMobRewardedInterstitialController(context: Context) {
    private val appContext = context.applicationContext
    private var rewardedInterstitialAd: RewardedInterstitialAd? = null
    private var loading = false

    fun preload() {
        if (loading || rewardedInterstitialAd != null) return

        loading = true
        val adUnitId = if (BuildConfig.DEBUG) TEST_REWARDED_INTERSTITIAL_UNIT_ID else REWARDED_INTERSTITIAL_UNIT_ID
        Log.d(TAG, "Loading rewarded interstitial unit=$adUnitId")

        RewardedInterstitialAd.load(
            appContext,
            adUnitId,
            AdRequest.Builder().build(),
            object : RewardedInterstitialAdLoadCallback() {
                override fun onAdLoaded(ad: RewardedInterstitialAd) {
                    loading = false
                    rewardedInterstitialAd = ad
                    Log.d(TAG, "Rewarded interstitial loaded")
                }

                override fun onAdFailedToLoad(error: LoadAdError) {
                    loading = false
                    rewardedInterstitialAd = null
                    Log.e(TAG, "Rewarded interstitial failed to load code=${error.code} domain=${error.domain} message=${error.message}")
                }
            }
        )
    }

    fun showIfReady(
        fragment: Fragment,
        onClosed: (MonetizationAdOutcome) -> Unit
    ): Boolean {
        val activity = fragment.activity ?: return false
        if (!fragment.isAdded) return false

        val ad = rewardedInterstitialAd ?: run {
            preload()
            return false
        }

        rewardedInterstitialAd = null
        var shown = false
        var rewarded = false
        val startedAt = System.currentTimeMillis()

        ad.fullScreenContentCallback = object : FullScreenContentCallback() {
            override fun onAdShowedFullScreenContent() {
                shown = true
                Log.d(TAG, "Rewarded interstitial shown")
            }

            override fun onAdDismissedFullScreenContent() {
                Log.d(TAG, "Rewarded interstitial dismissed rewarded=$rewarded")
                preload()
                onClosed(
                    MonetizationAdOutcome(
                        completed = rewarded,
                        skipped = shown && !rewarded,
                        failed = false,
                        durationMs = System.currentTimeMillis() - startedAt
                    )
                )
            }

            override fun onAdFailedToShowFullScreenContent(error: AdError) {
                Log.e(TAG, "Rewarded interstitial failed to show code=${error.code} domain=${error.domain} message=${error.message}")
                preload()
                onClosed(
                    MonetizationAdOutcome(
                        completed = false,
                        skipped = false,
                        failed = true,
                        durationMs = System.currentTimeMillis() - startedAt
                    )
                )
            }
        }

        ad.show(activity as Activity) {
            rewarded = true
            Log.d(TAG, "Rewarded interstitial reward earned type=${it.type} amount=${it.amount}")
        }
        return true
    }

    fun release() {
        rewardedInterstitialAd = null
        loading = false
    }

    companion object {
        private const val TAG = "AdMobRewardedInt"
        private const val REWARDED_INTERSTITIAL_UNIT_ID = "ca-app-pub-5051666473627498/2648546349"
        private const val TEST_REWARDED_INTERSTITIAL_UNIT_ID = "ca-app-pub-3940256099942544/5354046379"
    }
}
