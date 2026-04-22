package xyz.yenkasa.app.ui

import android.app.NotificationManager
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Typeface
import android.net.Uri
import android.os.Bundle
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import xyz.yenkasa.app.MyApplication
import xyz.yenkasa.app.R
import xyz.yenkasa.app.adapter.TransactionAdapter
import xyz.yenkasa.app.model.TransactionUiModel
import xyz.yenkasa.app.model.CoinTransactionResponse
import xyz.yenkasa.app.model.CoinBalanceResponse
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.TokenManager
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.text.NumberFormat
import java.util.Locale


class CoinWalletActivity : AppCompatActivity() {

    private lateinit var tvTitle: TextView
    private lateinit var tvBalanceLabel: TextView
    private lateinit var tvBalance: TextView
    private lateinit var textWalletUsdValue: TextView
    private lateinit var textWalletTotalEarned: TextView
    private lateinit var textWalletTotalSpent: TextView
    private lateinit var textWalletTransactionsCount: TextView
    private lateinit var textWalletAddress: TextView
    private lateinit var textWalletExplorer: TextView
    private lateinit var btnWalletBack: ImageView
    private lateinit var btnWalletNotifications: ImageView
    private lateinit var imgWalletBalanceVisibility: ImageView
    private lateinit var btnWalletCopyAddress: ImageView
    private lateinit var btnTransaction: Button
    private lateinit var btnWalletReceive: TextView
    private lateinit var btnWalletConvert: TextView
    private lateinit var btnWalletScan: TextView
    private lateinit var tabRecentTransactions: TextView
    private lateinit var tabAllTransactions: TextView
    private lateinit var btnWalletFilter: TextView
    private lateinit var recyclerViewTransactions: RecyclerView
    private lateinit var transactionAdapter: TransactionAdapter

    private val transactionList = mutableListOf<TransactionUiModel>()
    private val allTransactions = mutableListOf<TransactionUiModel>()
    private var currentBalance: Int = 0
    private var currentWalletId: String? = null
    private var isBalanceHidden: Boolean = false
    private var selectedTransactionTab: TransactionTab = TransactionTab.RECENT

    // Track old transaction list to detect NEW rewards
    private var previousList: List<TransactionUiModel> = emptyList()

    private val TAG = "CoinWalletActivity"

    private companion object {
        const val PREFS_NAME = "settings"
        const val KEY_NOTIFICATIONS_ENABLED = "notifications_enabled"
        const val KEY_REWARD_NOTIFICATIONS_ENABLED = "reward_notifications_enabled"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_coin_wallet)

        // UI
        tvTitle = findViewById(R.id.tvTitle)
        tvBalanceLabel = findViewById(R.id.tvBalanceLabel)
        tvBalance = findViewById(R.id.tvBalance)
        textWalletUsdValue = findViewById(R.id.textWalletUsdValue)
        textWalletTotalEarned = findViewById(R.id.textWalletTotalEarned)
        textWalletTotalSpent = findViewById(R.id.textWalletTotalSpent)
        textWalletTransactionsCount = findViewById(R.id.textWalletTransactionsCount)
        textWalletAddress = findViewById(R.id.textWalletAddress)
        textWalletExplorer = findViewById(R.id.textWalletExplorer)
        btnWalletBack = findViewById(R.id.btnWalletBack)
        btnWalletNotifications = findViewById(R.id.btnWalletNotifications)
        imgWalletBalanceVisibility = findViewById(R.id.imgWalletBalanceVisibility)
        btnWalletCopyAddress = findViewById(R.id.btnWalletCopyAddress)
        btnTransaction = findViewById(R.id.btnTransaction)
        btnWalletReceive = findViewById(R.id.btnWalletReceive)
        btnWalletConvert = findViewById(R.id.btnWalletConvert)
        btnWalletScan = findViewById(R.id.btnWalletScan)
        tabRecentTransactions = findViewById(R.id.tabRecentTransactions)
        tabAllTransactions = findViewById(R.id.tabAllTransactions)
        btnWalletFilter = findViewById(R.id.btnWalletFilter)
        recyclerViewTransactions = findViewById(R.id.recyclerViewTransactions)

        tvTitle.text = "Yenkasa Coin Wallet"
        tvBalanceLabel.text = "Current Balance"
        refreshWalletHero()

        // RecyclerView
        transactionAdapter = TransactionAdapter(transactionList)
        recyclerViewTransactions.apply {
            layoutManager = LinearLayoutManager(this@CoinWalletActivity)
            adapter = transactionAdapter
        }

        btnTransaction.setOnClickListener {
            startActivity(Intent(this, CreateTransactionActivity::class.java))
        }

        btnWalletReceive.setOnClickListener {
            startActivity(Intent(this, CreateTransactionActivity::class.java).putExtra("action", "receive"))
        }

        btnWalletConvert.setOnClickListener {
            Toast.makeText(this, "Convert will be available when YKC exchange is ready", Toast.LENGTH_SHORT).show()
        }

        btnWalletScan.setOnClickListener {
            Toast.makeText(this, "Scan will be available when wallet QR payments are ready", Toast.LENGTH_SHORT).show()
        }

        btnWalletCopyAddress.setOnClickListener {
            copyWalletAddress()
        }

        textWalletAddress.setOnClickListener {
            copyWalletAddress()
        }

        textWalletExplorer.setOnClickListener {
            Toast.makeText(this, "Explorer will be available after blockchain integration", Toast.LENGTH_SHORT).show()
        }

        tabRecentTransactions.setOnClickListener {
            selectedTransactionTab = TransactionTab.RECENT
            applyTransactionTab()
        }

        tabAllTransactions.setOnClickListener {
            selectedTransactionTab = TransactionTab.ALL
            applyTransactionTab()
        }

        btnWalletFilter.setOnClickListener {
            Toast.makeText(this, "Transaction filters will be available after wallet categories are finalized", Toast.LENGTH_SHORT).show()
        }

        btnWalletBack.setOnClickListener { finish() }

        btnWalletNotifications.setOnClickListener {
            startActivity(Intent(this, UserNotificationsActivity::class.java))
        }

        imgWalletBalanceVisibility.setOnClickListener {
            isBalanceHidden = !isBalanceHidden
            refreshWalletHero()
        }

        loadWalletData()
    }

    private fun loadWalletData() {
        val token = TokenManager.getToken(this) ?: return

        // Load balance
        ApiClient.apiService.getCoinBalance("Bearer $token")
            .enqueue(object : Callback<CoinBalanceResponse> {
                override fun onResponse(call: Call<CoinBalanceResponse>, response: Response<CoinBalanceResponse>) {
                    if (response.isSuccessful && response.body() != null) {
                        val body = response.body()!!
                        currentBalance = body.balance
                        currentWalletId = body.walletId
                        textWalletAddress.text = body.walletId?.let { shortenWalletId(it) } ?: "Wallet pending"
                    } else {
                        currentBalance = 0
                        textWalletAddress.text = "Wallet pending"
                    }
                    refreshWalletHero()
                }

                override fun onFailure(call: Call<CoinBalanceResponse>, t: Throwable) {
                    currentBalance = 0
                    textWalletAddress.text = "Wallet unavailable"
                    refreshWalletHero()
                }
            })

        // Load cached transactions
        val cached = TokenManager.getTransactionHistory(this)
            .filter { !it.activityId.isNullOrEmpty() }

        if (cached.isNotEmpty()) {
            allTransactions.clear()
            allTransactions.addAll(cached)
            applyTransactionTab()
            previousList = cached // STORE previous list baseline
            refreshWalletHero()
        }

        // Fetch latest from server
        ApiClient.apiService.getCoinTransactionHistory("Bearer $token")
            .enqueue(object : Callback<CoinTransactionResponse> {
                override fun onResponse(
                    call: Call<CoinTransactionResponse>,
                    response: Response<CoinTransactionResponse>
                ) {
                    if (!response.isSuccessful || response.body() == null) {
                        Toast.makeText(this@CoinWalletActivity, "Failed to load transactions", Toast.LENGTH_SHORT).show()
                        return
                    }

                    val latest = response.body()!!.transactions
                        .filter { !it.activityId.isNullOrEmpty() }
                        .map {
                            TransactionUiModel(
                                transactionId = it.transactionId,
                                amount = it.amount,
                                from = it.fromWalletId ?: "",
                                to = it.toWalletId ?: "",
                                newBalance = 0,
                                senderUsername = it.fromUsername,
                                recipientUsername = it.toUsername,
                                description = it.description,
                                type = it.type,
                                createdAt = it.createdAt,
                                activityId = it.activityId
                            )
                        }

                    // Detect new rewards
                    val newItems = latest.filter { newTx ->
                        previousList.none { oldTx -> oldTx.transactionId == newTx.transactionId }
                    }

                    // Trigger sound notification for each reward
                    if (newItems.isNotEmpty()) {
                        newItems.forEach { tx ->
                            triggerRewardNotification(tx)
                        }
                    }

                    // Update UI
                    allTransactions.clear()
                    allTransactions.addAll(latest)
                    applyTransactionTab()
                    refreshWalletHero()

                    // Save to local cache
                    TokenManager.saveTransactionHistory(this@CoinWalletActivity, latest)

                    // Update previous list
                    previousList = latest
                }

                override fun onFailure(call: Call<CoinTransactionResponse>, t: Throwable) {
                    Toast.makeText(this@CoinWalletActivity, "Failed to load transactions", Toast.LENGTH_SHORT).show()
                    refreshWalletHero()
                }
            })
    }

    private fun refreshWalletHero() {
        tvBalance.text = if (isBalanceHidden) "••••" else formatCoinAmount(currentBalance)
        textWalletUsdValue.text = "~ $0.00 USD"

        val walletId = currentWalletId
        val totalEarned = allTransactions
            .filter { tx -> walletId == null || tx.to == walletId || tx.from != walletId }
            .sumOf { it.amount }
        val totalSpent = allTransactions
            .filter { tx -> walletId != null && tx.from == walletId }
            .sumOf { it.amount }

        textWalletTotalEarned.text = "Total Earned\n${formatWholeCoins(totalEarned)} YKC ↑"
        textWalletTotalSpent.text = "Total Spent\n${formatWholeCoins(totalSpent)} YKC ↓"
        textWalletTransactionsCount.text = "Transactions\n${formatWholeCoins(allTransactions.size)}"
    }

    private fun applyTransactionTab() {
        transactionList.clear()
        transactionList.addAll(
            when (selectedTransactionTab) {
                TransactionTab.RECENT -> allTransactions.take(10)
                TransactionTab.ALL -> allTransactions
            }
        )
        transactionAdapter.notifyDataSetChanged()
        refreshTransactionTabStyle()
    }

    private fun refreshTransactionTabStyle() {
        val accent = ContextCompat.getColor(this, R.color.wallet_accent_green)
        val muted = ContextCompat.getColor(this, R.color.wallet_secondary_text)
        val recentSelected = selectedTransactionTab == TransactionTab.RECENT

        tabRecentTransactions.setTextColor(if (recentSelected) accent else muted)
        tabRecentTransactions.setTypeface(null, if (recentSelected) Typeface.BOLD else Typeface.NORMAL)
        tabRecentTransactions.setBackgroundResource(if (recentSelected) R.drawable.bg_wallet_tab_selected else 0)

        tabAllTransactions.setTextColor(if (!recentSelected) accent else muted)
        tabAllTransactions.setTypeface(null, if (!recentSelected) Typeface.BOLD else Typeface.NORMAL)
        tabAllTransactions.setBackgroundResource(if (!recentSelected) R.drawable.bg_wallet_tab_selected else 0)
    }

    private fun formatCoinAmount(amount: Int): String {
        return NumberFormat.getNumberInstance(Locale.getDefault()).apply {
            minimumFractionDigits = 2
            maximumFractionDigits = 2
        }.format(amount)
    }

    private fun formatWholeCoins(amount: Int): String {
        return NumberFormat.getIntegerInstance(Locale.getDefault()).format(amount)
    }

    private fun shortenWalletId(walletId: String): String {
        return if (walletId.length <= 14) {
            walletId
        } else {
            "${walletId.take(7)}...${walletId.takeLast(4)}"
        }
    }

    private fun copyWalletAddress() {
        val walletId = currentWalletId
        if (walletId.isNullOrBlank()) {
            Toast.makeText(this, "Wallet address is not available yet", Toast.LENGTH_SHORT).show()
            return
        }

        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText("Yenkasa wallet address", walletId))
        Toast.makeText(this, "Wallet address copied", Toast.LENGTH_SHORT).show()
    }

    private enum class TransactionTab {
        RECENT,
        ALL
    }


    // 🔥 Play sound + show notification for rewards
    private fun triggerRewardNotification(tx: TransactionUiModel) {
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        if (!prefs.getBoolean(KEY_NOTIFICATIONS_ENABLED, true) ||
            !prefs.getBoolean(KEY_REWARD_NOTIFICATIONS_ENABLED, true)
        ) {
            return
        }

        val selectedSound = prefs.getString("notification_sound", "sound_default") ?: "sound_default"

        val rawRes = resources.getIdentifier(selectedSound, "raw", packageName)
        val soundUri = Uri.parse("android.resource://$packageName/$rawRes")

        val title = "Reward Earned!"
        val body = tx.description ?: "You received ${tx.amount} YKC"

        val builder = NotificationCompat.Builder(
            this,
            MyApplication.NEW_CHAT_MESSAGES_CHANNEL_ID
        )
            .setSmallIcon(R.drawable.ic_coin)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setSound(soundUri)

        val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(System.currentTimeMillis().toInt(), builder.build())
    }


    override fun onResume() {
        super.onResume()
        loadWalletData()
    }
}
