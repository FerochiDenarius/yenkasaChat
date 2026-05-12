package xyz.yenkasa.app.ui

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.PopupMenu
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import xyz.yenkasa.app.R
import xyz.yenkasa.app.adapter.StaffRoleAdapter
import xyz.yenkasa.app.model.RoleActionRequest
import xyz.yenkasa.app.model.RoleActionResponse
import xyz.yenkasa.app.model.RoleUser
import xyz.yenkasa.app.model.RoleUsersResponse
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.TokenManager

class StaffRolesFragment : Fragment() {

    private lateinit var adapter: StaffRoleAdapter
    private lateinit var statusText: TextView
    private val handler = Handler(Looper.getMainLooper())
    private var lastSearch = ""

    private val staffRoles = arrayOf(
        "moderator" to "Moderator",
        "admin" to "Admin",
        "junior_developer" to "Junior Developer",
        "senior_developer" to "Senior Developer"
    )

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        return inflater.inflate(R.layout.fragment_staff_roles, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        statusText = view.findViewById(R.id.textRoleStatus)
        adapter = StaffRoleAdapter(::toggleSuspend, ::showMenu)
        view.findViewById<RecyclerView>(R.id.recyclerRoleUsers).apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = this@StaffRolesFragment.adapter
        }

        view.findViewById<EditText>(R.id.editRoleSearch).addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                lastSearch = s?.toString().orEmpty()
                handler.removeCallbacksAndMessages(null)
                handler.postDelayed({ loadUsers() }, 350)
            }
            override fun afterTextChanged(s: Editable?) = Unit
        })

        loadUsers()
    }

    private fun loadUsers() {
        val auth = "Bearer ${TokenManager.getToken(requireContext()) ?: return}"
        statusText.text = "Loading staff..."
        ApiClient.apiService.getRoleUsers(auth, scope = "staff", search = lastSearch.ifBlank { null })
            .enqueue(object : Callback<RoleUsersResponse> {
                override fun onResponse(call: Call<RoleUsersResponse>, response: Response<RoleUsersResponse>) {
                    val body = response.body()
                    if (response.isSuccessful && body?.success == true) {
                        adapter.submitList(body.users)
                        statusText.text = "Showing ${body.users.size} staff"
                    } else {
                        statusText.text = body?.error ?: "Unable to load staff"
                    }
                }

                override fun onFailure(call: Call<RoleUsersResponse>, t: Throwable) {
                    statusText.text = "Network unavailable. Try again."
                }
            })
    }

    private fun showMenu(anchor: View, user: RoleUser) {
        PopupMenu(requireContext(), anchor).apply {
            staffRoles.forEach { (key, label) -> menu.add("Grant $label").setOnMenuItemClickListener {
                grantRole(user, key)
                true
            } }
            menu.add("Remove staff role").setOnMenuItemClickListener {
                removeRole(user, user.staffRole ?: user.roleName ?: "moderator")
                true
            }
            show()
        }
    }

    private fun grantRole(user: RoleUser, roleKey: String) {
        val userId = user.resolvedId()
        if (userId.isBlank()) return
        val auth = "Bearer ${TokenManager.getToken(requireContext()) ?: return}"
        ApiClient.apiService.grantUserRole(auth, userId, RoleActionRequest(roleKey = roleKey))
            .enqueue(actionCallback("Role granted"))
    }

    private fun removeRole(user: RoleUser, roleKey: String) {
        val userId = user.resolvedId()
        if (userId.isBlank()) return
        val auth = "Bearer ${TokenManager.getToken(requireContext()) ?: return}"
        ApiClient.apiService.removeUserRole(auth, userId, RoleActionRequest(roleKey = roleKey))
            .enqueue(actionCallback("Role removed"))
    }

    private fun toggleSuspend(user: RoleUser) {
        val userId = user.resolvedId()
        if (userId.isBlank()) return
        val auth = "Bearer ${TokenManager.getToken(requireContext()) ?: return}"
        if (user.suspendedUntil.isNullOrBlank()) {
            AlertDialog.Builder(requireContext())
                .setTitle("Suspend user")
                .setMessage("Suspend ${user.username ?: "this user"} for 7 days?")
                .setPositiveButton("Suspend") { _, _ ->
                    ApiClient.apiService.suspendRoleUser(auth, userId, RoleActionRequest(days = 7))
                        .enqueue(actionCallback("User suspended"))
                }
                .setNegativeButton("Cancel", null)
                .show()
        } else {
            ApiClient.apiService.unsuspendRoleUser(auth, userId).enqueue(actionCallback("User unsuspended"))
        }
    }

    private fun actionCallback(successMessage: String): Callback<RoleActionResponse> {
        return object : Callback<RoleActionResponse> {
            override fun onResponse(call: Call<RoleActionResponse>, response: Response<RoleActionResponse>) {
                val body = response.body()
                if (response.isSuccessful && body?.success == true) {
                    Toast.makeText(requireContext(), body.message ?: successMessage, Toast.LENGTH_SHORT).show()
                    loadUsers()
                } else {
                    Toast.makeText(requireContext(), body?.error ?: "Action failed", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onFailure(call: Call<RoleActionResponse>, t: Throwable) {
                Toast.makeText(requireContext(), "Network error", Toast.LENGTH_SHORT).show()
            }
        }
    }
}
