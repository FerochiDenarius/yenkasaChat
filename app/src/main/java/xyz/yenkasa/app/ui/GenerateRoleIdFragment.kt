package xyz.yenkasa.app.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import xyz.yenkasa.app.R
import xyz.yenkasa.app.adapter.GeneratedRoleCodeAdapter
import xyz.yenkasa.app.model.GenerateRoleCodeRequest
import xyz.yenkasa.app.model.GenerateRoleCodeResponse
import xyz.yenkasa.app.model.GeneratedRoleCode
import xyz.yenkasa.app.model.GeneratedRoleCodesResponse
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.TokenManager
import xyz.yenkasa.app.util.UserPermissions

class GenerateRoleIdFragment : Fragment() {

    private lateinit var adapter: GeneratedRoleCodeAdapter
    private lateinit var statusText: TextView
    private var codes = emptyList<GeneratedRoleCode>()

    private val staffRoles = listOf(
        "moderator" to "Moderator ID",
        "admin" to "Admin ID",
        "junior_developer" to "Junior Developer ID",
        "senior_developer" to "Senior Developer ID"
    )

    private val generalRoles = listOf(
        "verified_creator" to "Verified Creator ID",
        "business_account" to "Business Account ID",
        "premium_seller" to "Premium Seller ID",
        "campus_influencer" to "Campus Influencer ID"
    )

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        return inflater.inflate(R.layout.fragment_generate_role_id, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        statusText = view.findViewById(R.id.textGenerateStatus)
        adapter = GeneratedRoleCodeAdapter(::copyCode)
        view.findViewById<RecyclerView>(R.id.recyclerGeneratedCodes).apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = this@GenerateRoleIdFragment.adapter
        }

        val role = TokenManager.getUserRole(requireContext())
        val staffContainer = view.findViewById<LinearLayout>(R.id.staffButtonContainer)
        val generalContainer = view.findViewById<LinearLayout>(R.id.generalButtonContainer)
        val staffSection = view.findViewById<LinearLayout>(R.id.sectionStaffIds)

        staffSection.visibility = if (UserPermissions.canAssignRoles(role)) View.VISIBLE else View.GONE
        staffRoles.forEach { (key, label) ->
            if (UserPermissions.canGenerateStaffRole(role, key)) {
                staffContainer.addView(actionButton(label) { generateCode(key) })
            }
        }
        generalRoles.forEach { (key, label) ->
            if (UserPermissions.canGenerateRoleCodes(role)) {
                generalContainer.addView(actionButton(label) { generateCode(key) })
            }
        }

        loadCodes()
    }

    private fun actionButton(label: String, onClick: () -> Unit): TextView {
        return TextView(requireContext()).apply {
            text = label
            textSize = 14f
            setTextColor(ContextCompat.getColor(requireContext(), android.R.color.white))
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            gravity = android.view.Gravity.CENTER
            setBackgroundResource(R.drawable.bg_account_primary_button)
            isClickable = true
            isFocusable = true
            setOnClickListener { onClick() }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(48)
            ).apply {
                topMargin = dp(8)
            }
        }
    }

    private fun loadCodes() {
        val auth = "Bearer ${TokenManager.getToken(requireContext()) ?: return}"
        ApiClient.apiService.getGeneratedRoleCodes(auth).enqueue(object : Callback<GeneratedRoleCodesResponse> {
            override fun onResponse(call: Call<GeneratedRoleCodesResponse>, response: Response<GeneratedRoleCodesResponse>) {
                val body = response.body()
                if (response.isSuccessful && body?.success == true) {
                    codes = body.codes
                    adapter.submitList(codes)
                    statusText.text = "Generated IDs expire in 7 days and work once only."
                } else {
                    statusText.text = body?.error ?: "Generated IDs unavailable."
                }
            }

            override fun onFailure(call: Call<GeneratedRoleCodesResponse>, t: Throwable) {
                statusText.text = "Network unavailable. Generated IDs could not be loaded."
            }
        })
    }

    private fun generateCode(roleKey: String) {
        val auth = "Bearer ${TokenManager.getToken(requireContext()) ?: return}"
        statusText.text = "Generating ID..."
        ApiClient.apiService.generateRoleCode(auth, GenerateRoleCodeRequest(roleKey))
            .enqueue(object : Callback<GenerateRoleCodeResponse> {
                override fun onResponse(call: Call<GenerateRoleCodeResponse>, response: Response<GenerateRoleCodeResponse>) {
                    val body = response.body()
                    if (response.isSuccessful && body?.success == true) {
                        val item = GeneratedRoleCode(
                            code = body.code,
                            roleKey = body.roleKey,
                            roleLabel = body.roleLabel,
                            roleCategory = body.roleCategory,
                            expiresAt = body.expiresAt
                        )
                        codes = listOf(item) + codes
                        adapter.submitList(codes)
                        statusText.text = "${body.roleLabel ?: "Role"} ID generated."
                    } else {
                        statusText.text = body?.error ?: "ID generation failed."
                    }
                }

                override fun onFailure(call: Call<GenerateRoleCodeResponse>, t: Throwable) {
                    statusText.text = "Network error generating ID."
                }
            })
    }

    private fun copyCode(item: GeneratedRoleCode) {
        val code = item.code ?: return
        val clipboard = requireContext().getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText("Yenkasa role ID", code))
        Toast.makeText(requireContext(), "Copied", Toast.LENGTH_SHORT).show()
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}
