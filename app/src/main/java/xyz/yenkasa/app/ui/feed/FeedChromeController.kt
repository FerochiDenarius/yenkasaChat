package xyz.yenkasa.app.ui.feed

import android.animation.ValueAnimator
import android.content.Intent
import android.view.View
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.floatingactionbutton.FloatingActionButton
import xyz.yenkasa.app.R
import xyz.yenkasa.app.ui.CoinWalletActivity
import xyz.yenkasa.app.ui.LiveStreamsActivity
import xyz.yenkasa.app.ui.PostActivity
import xyz.yenkasa.app.ui.YenkasaLiveSheetController
import xyz.yenkasa.app.util.TokenManager
import java.text.NumberFormat
import java.util.Locale

class FeedChromeController(
    private val fragment: Fragment
) {
    private var walletBalanceAnimator: ValueAnimator? = null
    private var liveSheetController: YenkasaLiveSheetController? = null
    var currentWalletBalance: Double = 0.0
        private set

    data class FloatingWalletViews(
        val walletCard: View,
        val coinContainer: View,
        val coinView: ImageView,
        val balanceView: TextView,
        val deltaView: TextView,
        val sparklesView: View,
        val dropViews: List<ImageView>
    )

    fun setupInitialChrome(
        walletViews: FloatingWalletViews,
        fabYenkasaLive: FloatingActionButton,
        communityStoryRecyclerView: RecyclerView,
        recyclerView: RecyclerView,
        communitiesBar: View,
        feedFilterBar: View,
        mainAppBar: View?,
        fabCreatePost: FloatingActionButton,
        usePlayerChrome: Boolean,
        userIdProvider: () -> String?,
        onFeedFocusRequested: () -> Unit
    ) {
        setupFloatingWallet(walletViews)
        setupYenkasaLive(
            fab = fabYenkasaLive,
            communityStoryRecyclerView = communityStoryRecyclerView,
            onFeedFocusRequested = onFeedFocusRequested
        )
        if (usePlayerChrome) {
            applyPlayerChrome(
                recyclerView = recyclerView,
                communitiesBar = communitiesBar,
                feedFilterBar = feedFilterBar,
                floatingWalletCard = walletViews.walletCard,
                fabYenkasaLive = fabYenkasaLive,
                fabCreatePost = fabCreatePost,
                mainAppBar = mainAppBar
            )
        }
        setupCreatePostButton(fabCreatePost, userIdProvider)
    }

    fun setupFloatingWallet(walletViews: FloatingWalletViews) {
        setupFloatingWallet(
            walletCard = walletViews.walletCard,
            coinContainer = walletViews.coinContainer,
            coinView = walletViews.coinView,
            balanceView = walletViews.balanceView,
            deltaView = walletViews.deltaView,
            sparklesView = walletViews.sparklesView,
            dropViews = walletViews.dropViews
        )
    }

    fun setupFloatingWallet(
        walletCard: View,
        coinContainer: View,
        coinView: ImageView,
        balanceView: TextView,
        deltaView: TextView,
        sparklesView: View,
        dropViews: List<ImageView>
    ) {
        currentWalletBalance = TokenManager.getCoinsPrecise(fragment.requireContext())
        renderFloatingWalletBalance(balanceView, currentWalletBalance)
        deltaView.visibility = View.GONE
        sparklesView.alpha = 0f
        walletCard.setOnClickListener {
            fragment.startActivity(Intent(fragment.requireContext(), CoinWalletActivity::class.java))
        }
        resetFloatingWalletPulse(
            walletCard,
            coinContainer,
            coinView,
            deltaView,
            sparklesView,
            dropViews
        )
    }

    fun setupYenkasaLive(
        fab: FloatingActionButton,
        communityStoryRecyclerView: RecyclerView,
        onFeedFocusRequested: () -> Unit
    ) {
        liveSheetController?.detach()
        liveSheetController = YenkasaLiveSheetController(fragment) { action ->
            when (action) {
                "comment", "view", "like" -> onFeedFocusRequested()
                "follow" -> {
                    onFeedFocusRequested()
                    communityStoryRecyclerView.smoothScrollToPosition(0)
                    Toast.makeText(
                        fragment.requireContext(),
                        R.string.explore_profiles_and_communities_to_follow,
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }
        }
        fab.setOnClickListener {
            fragment.startActivity(Intent(fragment.requireContext(), LiveStreamsActivity::class.java))
        }
    }

    fun applyPlayerChrome(
        recyclerView: RecyclerView,
        communitiesBar: View,
        feedFilterBar: View,
        floatingWalletCard: View,
        fabYenkasaLive: View,
        fabCreatePost: View,
        mainAppBar: View?
    ) {
        communitiesBar.visibility = View.GONE
        feedFilterBar.visibility = View.GONE
        floatingWalletCard.visibility = View.GONE
        fabYenkasaLive.visibility = View.GONE
        fabCreatePost.visibility = View.VISIBLE
        fabCreatePost.alpha = 1f
        fabCreatePost.bringToFront()
        mainAppBar?.visibility = View.GONE

        // Activate immersive fullscreen
        fragment.activity?.let { xyz.yenkasa.app.util.EdgeToEdgeInsets.hideSystemBars(it) }

        ViewCompat.setOnApplyWindowInsetsListener(recyclerView, null)
        recyclerView.setPadding(0, 0, 0, 0)
        recyclerView.clipToPadding = false
        recyclerView.overScrollMode = View.OVER_SCROLL_NEVER
        recyclerView.setBackgroundColor(ContextCompat.getColor(fragment.requireContext(), android.R.color.black))
    }

    fun renderFloatingWalletBalance(balanceView: TextView, balance: Double) {
        balanceView.text = formatYkc(balance)
    }

    fun updateFloatingWalletBalance(
        newBalance: Double,
        animate: Boolean,
        walletViews: FloatingWalletViews
    ) {
        updateFloatingWalletBalance(
            newBalance = newBalance,
            animate = animate,
            walletCard = walletViews.walletCard,
            coinContainer = walletViews.coinContainer,
            coinView = walletViews.coinView,
            balanceView = walletViews.balanceView,
            deltaView = walletViews.deltaView,
            sparklesView = walletViews.sparklesView,
            dropViews = walletViews.dropViews
        )
    }

    fun updateFloatingWalletBalance(
        newBalance: Int,
        animate: Boolean,
        walletViews: FloatingWalletViews
    ) = updateFloatingWalletBalance(newBalance.toDouble(), animate, walletViews)

    fun updateFloatingWalletBalance(
        newBalance: Double,
        animate: Boolean,
        walletCard: View,
        coinContainer: View,
        coinView: ImageView,
        balanceView: TextView,
        deltaView: TextView,
        sparklesView: View,
        dropViews: List<ImageView>
    ) {
        val oldBalance = currentWalletBalance
        TokenManager.saveCoinsPrecise(fragment.requireContext(), newBalance)

        if (!animate || newBalance <= oldBalance) {
            walletBalanceAnimator?.cancel()
            currentWalletBalance = newBalance
            renderFloatingWalletBalance(balanceView, newBalance)
            if (newBalance < oldBalance) {
                resetFloatingWalletPulse(walletCard, coinContainer, coinView, deltaView, sparklesView, dropViews)
            }
            return
        }

        walletBalanceAnimator?.cancel()
        ValueAnimator.ofFloat(oldBalance.toFloat(), newBalance.toFloat()).apply {
            duration = 700L
            addUpdateListener { animator ->
                currentWalletBalance = (animator.animatedValue as Float).toDouble()
                renderFloatingWalletBalance(balanceView, currentWalletBalance)
            }
            start()
            walletBalanceAnimator = this
        }

        animateFloatingWalletGain(
            delta = newBalance - oldBalance,
            walletCard = walletCard,
            coinContainer = coinContainer,
            coinView = coinView,
            deltaView = deltaView,
            sparklesView = sparklesView,
            dropViews = dropViews
        )
    }

    fun showLiveSheet() {
        liveSheetController?.show()
    }

    fun onHostResume(walletViews: FloatingWalletViews) {
        onHostResume(walletViews.balanceView)
    }

    fun onHostResume(balanceView: TextView) {
        currentWalletBalance = TokenManager.getCoinsPrecise(fragment.requireContext())
        renderFloatingWalletBalance(balanceView, currentWalletBalance)
        liveSheetController?.onHostResume()
    }

    fun onHostPause() {
        liveSheetController?.onHostPause()
    }

    fun detach() {
        walletBalanceAnimator?.cancel()
        liveSheetController?.detach()
        liveSheetController = null
    }

    fun restoreMainChrome(mainAppBar: View?, fabYenkasaLive: View, fabCreatePost: View) {
        mainAppBar?.visibility = View.VISIBLE
        fabYenkasaLive.visibility = View.VISIBLE
        fabCreatePost.visibility = View.VISIBLE
        fabCreatePost.alpha = 1f
        // Exit immersive fullscreen
        fragment.activity?.let { xyz.yenkasa.app.util.EdgeToEdgeInsets.showSystemBars(it) }
    }

    private fun setupCreatePostButton(
        fabCreatePost: FloatingActionButton,
        userIdProvider: () -> String?
    ) {
        fabCreatePost.isEnabled = true
        fabCreatePost.alpha = 1f
        fabCreatePost.setOnClickListener {
            val intent = Intent(fragment.requireContext(), PostActivity::class.java)
            intent.putExtra("userId", userIdProvider())
            fragment.startActivity(intent)
        }
    }

    private fun animateFloatingWalletGain(
        delta: Double,
        walletCard: View,
        coinContainer: View,
        coinView: ImageView,
        deltaView: TextView,
        sparklesView: View,
        dropViews: List<ImageView>
    ) {
        if (delta <= 0.0) return

        deltaView.animate().cancel()
        walletCard.animate().cancel()
        coinContainer.animate().cancel()
        coinView.animate().cancel()
        sparklesView.animate().cancel()
        dropViews.forEach { dropView -> dropView.animate().cancel() }

        deltaView.text = fragment.getString(R.string.ykc_reward_gain, formatYkc(delta))
        deltaView.visibility = View.VISIBLE
        deltaView.alpha = 1f
        deltaView.translationY = 12f

        sparklesView.alpha = 0f
        sparklesView.translationY = 8f

        animateFloatingWalletDrops(dropViews)

        walletCard.animate().scaleX(1.04f).scaleY(1.04f).setDuration(180L).withEndAction {
            walletCard.animate().scaleX(1f).scaleY(1f).setDuration(220L).start()
        }.start()

        coinContainer.animate().scaleX(1.12f).scaleY(1.12f).setDuration(180L).withEndAction {
            coinContainer.animate().scaleX(1f).scaleY(1f).setDuration(220L).start()
        }.start()

        coinView.animate().rotationBy(360f).setDuration(700L).start()

        sparklesView.animate().alpha(1f).translationY(0f).setDuration(180L).withEndAction {
            sparklesView.animate().alpha(0f).translationY(-10f).setDuration(620L).start()
        }.start()

        deltaView.animate().translationY(-18f).alpha(0f).setStartDelay(450L).setDuration(900L)
            .withEndAction {
                deltaView.visibility = View.GONE
                deltaView.translationY = 12f
                deltaView.alpha = 1f
            }.start()
    }

    private fun formatYkc(value: Double): String {
        val formatter = NumberFormat.getNumberInstance(Locale.getDefault()).apply {
            maximumFractionDigits = if (value % 1.0 == 0.0) 0 else 2
            minimumFractionDigits = 0
        }
        return formatter.format(value)
    }

    private fun animateFloatingWalletDrops(dropViews: List<ImageView>) {
        val offsetsX = listOf(0f, 12f, -10f)
        val startY = listOf(-28f, -18f, -24f)
        val endY = listOf(28f, 24f, 26f)

        dropViews.forEachIndexed { index, dropView ->
            dropView.animate().cancel()
            dropView.alpha = 0f
            dropView.translationX = offsetsX[index]
            dropView.translationY = startY[index]
            dropView.scaleX = 0.82f
            dropView.scaleY = 0.82f
            dropView.rotation = when (index) {
                0 -> -14f
                1 -> 9f
                else -> 16f
            }

            dropView.animate().alpha(1f).translationX(0f).translationY(endY[index]).rotationBy(220f)
                .scaleX(1f).scaleY(1f).setStartDelay((index * 90).toLong()).setDuration(420L)
                .withEndAction {
                    dropView.animate().alpha(0f).scaleX(0.72f).scaleY(0.72f).setDuration(120L)
                        .withEndAction {
                            dropView.alpha = 0f
                            dropView.translationX = 0f
                            dropView.translationY = 0f
                            dropView.scaleX = 1f
                            dropView.scaleY = 1f
                            dropView.rotation = 0f
                        }.start()
                }.start()
        }
    }

    private fun resetFloatingWalletPulse(
        walletCard: View,
        coinContainer: View,
        coinView: ImageView,
        deltaView: TextView,
        sparklesView: View,
        dropViews: List<ImageView>
    ) {
        walletCard.animate().cancel()
        coinContainer.animate().cancel()
        coinView.animate().cancel()
        sparklesView.animate().cancel()
        deltaView.animate().cancel()
        dropViews.forEach { dropView ->
            dropView.animate().cancel()
            dropView.alpha = 0f
            dropView.translationX = 0f
            dropView.translationY = 0f
            dropView.scaleX = 1f
            dropView.scaleY = 1f
            dropView.rotation = 0f
        }
        walletCard.scaleX = 1f
        walletCard.scaleY = 1f
        coinContainer.scaleX = 1f
        coinContainer.scaleY = 1f
        coinView.rotation = 0f
        sparklesView.alpha = 0f
        sparklesView.translationY = 8f
        deltaView.visibility = View.GONE
        deltaView.alpha = 1f
        deltaView.translationY = 12f
    }
}
