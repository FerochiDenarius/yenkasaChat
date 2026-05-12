package xyz.yenkasa.app.ui

import android.content.res.Configuration
import android.os.Bundle
import android.util.Log
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import xyz.yenkasa.app.R
import xyz.yenkasa.app.util.EdgeToEdgeInsets
import xyz.yenkasa.app.util.TokenManager
import xyz.yenkasa.app.util.UserPermissions

class UserRoleDashboardActivity : AppCompatActivity() {

    private val tag = "UserRoleDashboard"
    private lateinit var tabStaff: TextView
    private lateinit var tabGeneral: TextView
    private lateinit var tabGenerate: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_user_role_dashboard)

        val isNightMode = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
            Configuration.UI_MODE_NIGHT_YES
        EdgeToEdgeInsets.setLightSystemBars(
            window = window,
            lightStatusBars = !isNightMode,
            lightNavigationBars = !isNightMode
        )

        tabStaff = findViewById(R.id.tabStaff)
        tabGeneral = findViewById(R.id.tabGeneral)
        tabGenerate = findViewById(R.id.tabGenerate)
        findViewById<TextView>(R.id.buttonUserRoleBack).setOnClickListener { finish() }

        val role = TokenManager.getUserRole(this)
        val canOpen = UserPermissions.canManageRoles(role)
        Log.d(tag, "Current user rank=$role permissionsOpen=$canOpen")
        if (!canOpen) {
            finish()
            return
        }

        tabStaff.setOnClickListener { showTab(Tab.STAFF) }
        tabGeneral.setOnClickListener { showTab(Tab.GENERAL) }
        tabGenerate.setOnClickListener { showTab(Tab.GENERATE) }

        if (savedInstanceState == null) showTab(Tab.STAFF)
    }

    private fun showTab(tab: Tab) {
        val fragment: Fragment = when (tab) {
            Tab.STAFF -> StaffRolesFragment()
            Tab.GENERAL -> GeneralUsersRolesFragment()
            Tab.GENERATE -> GenerateRoleIdFragment()
        }
        supportFragmentManager.beginTransaction()
            .replace(R.id.userRoleFragmentContainer, fragment)
            .commit()
        updateTabState(tab)
    }

    private fun updateTabState(tab: Tab) {
        val active = ContextCompat.getColor(this, R.color.menu_accent)
        val inactive = ContextCompat.getColor(this, R.color.account_secondary_text)
        tabStaff.setTextColor(if (tab == Tab.STAFF) active else inactive)
        tabGeneral.setTextColor(if (tab == Tab.GENERAL) active else inactive)
        tabGenerate.setTextColor(if (tab == Tab.GENERATE) active else inactive)
    }

    private enum class Tab {
        STAFF,
        GENERAL,
        GENERATE
    }
}
