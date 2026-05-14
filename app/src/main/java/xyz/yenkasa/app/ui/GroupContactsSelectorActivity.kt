package xyz.yenkasa.app.ui

import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.Contact
import xyz.yenkasa.app.model.GroupMembersRequest
import xyz.yenkasa.app.model.GroupResponse
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.EdgeToEdgeInsets

class GroupContactsSelectorActivity : AppCompatActivity() {
    private lateinit var adapter: GroupMembersAdapter
    private lateinit var selectedCount: TextView
    private lateinit var nextButton: Button
    private val allContacts = mutableListOf<Contact>()
    private val selectedIds = linkedSetOf<String>()
    private val isAddMembersMode: Boolean
        get() = intent.getStringExtra("mode") == "addMembers"
    private val groupId: String
        get() = intent.getStringExtra("groupId").orEmpty()
    private val existingMemberIds: Set<String>
        get() = intent.getStringArrayListExtra("existingMemberIds").orEmpty().toSet()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_group_contacts_selector)
        EdgeToEdgeInsets.setLightSystemBars(window, lightStatusBars = true, lightNavigationBars = false)
        EdgeToEdgeInsets.applySystemBarPadding(findViewById(R.id.groupSelectorHeader), top = true)

        selectedCount = findViewById(R.id.textSelectedCount)
        val search = findViewById<EditText>(R.id.inputSearchContacts)
        val recycler = findViewById<RecyclerView>(R.id.recyclerGroupContacts)
        nextButton = findViewById(R.id.buttonNextGroupSetup)
        nextButton.text = getString(if (isAddMembersMode) R.string.group_add_members else R.string.next)

        adapter = GroupMembersAdapter(selectedIds) { contact ->
            val id = contactMemberId(contact) ?: return@GroupMembersAdapter
            if (selectedIds.contains(id)) selectedIds.remove(id) else selectedIds.add(id)
            updateSelectedCount()
            adapter.notifyDataSetChanged()
        }
        recycler.layoutManager = LinearLayoutManager(this)
        recycler.adapter = adapter

        search.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun afterTextChanged(s: Editable?) = Unit
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                filterContacts(s?.toString().orEmpty())
            }
        })

        nextButton.setOnClickListener {
            if (selectedIds.isEmpty()) {
                Toast.makeText(this, getString(R.string.group_select_at_least_one_contact), Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            if (isAddMembersMode) {
                addSelectedMembers()
                return@setOnClickListener
            }
            startActivity(Intent(this, GroupSetupActivity::class.java).apply {
                putStringArrayListExtra("memberIds", ArrayList(selectedIds))
            })
        }

        updateSelectedCount()
        loadContacts()
    }

    private fun loadContacts() {
        ApiClient.apiService.getContacts().enqueue(object : Callback<List<Contact>> {
            override fun onResponse(call: Call<List<Contact>>, response: Response<List<Contact>>) {
                if (!response.isSuccessful) {
                    Toast.makeText(this@GroupContactsSelectorActivity, getString(R.string.group_could_not_load_contacts), Toast.LENGTH_LONG).show()
                    return
                }
                allContacts.clear()
                allContacts.addAll(
                    response.body().orEmpty()
                        .filter { it.username.isNotBlank() && contactMemberId(it) != null }
                        .filter { !existingMemberIds.contains(contactMemberId(it)) }
                        .distinctBy { contactMemberId(it) }
                )
                adapter.submitList(allContacts.toList())
            }

            override fun onFailure(call: Call<List<Contact>>, t: Throwable) {
                Toast.makeText(this@GroupContactsSelectorActivity, getString(R.string.group_could_not_load_contacts_with_error, t.message), Toast.LENGTH_LONG).show()
            }
        })
    }

    private fun filterContacts(query: String) {
        val normalized = query.trim().lowercase()
        adapter.submitList(
            if (normalized.isBlank()) allContacts.toList()
            else allContacts.filter { it.username.lowercase().contains(normalized) }
        )
    }

    private fun updateSelectedCount() {
        selectedCount.text = when {
            selectedIds.isNotEmpty() -> getString(R.string.group_selected_count, selectedIds.size)
            isAddMembersMode -> getString(R.string.group_add_members)
            else -> getString(R.string.group_create)
        }
    }

    private fun contactMemberId(contact: Contact): String? {
        return contact.contactId?.takeIf { it.isNotBlank() }
            ?: contact._id?.takeIf { it.isNotBlank() }
    }

    private fun addSelectedMembers() {
        if (groupId.isBlank()) {
            Toast.makeText(this, getString(R.string.group_details_unavailable), Toast.LENGTH_SHORT).show()
            return
        }

        nextButton.isEnabled = false
        ApiClient.apiService.addGroupMembers(groupId, GroupMembersRequest(selectedIds.toList()))
            .enqueue(object : Callback<GroupResponse> {
                override fun onResponse(call: Call<GroupResponse>, response: Response<GroupResponse>) {
                    nextButton.isEnabled = true
                    val body = response.body()
                    if (!response.isSuccessful || body?.success != true) {
                        Toast.makeText(
                            this@GroupContactsSelectorActivity,
                            body?.message ?: getString(R.string.group_could_not_add_members),
                            Toast.LENGTH_LONG
                        ).show()
                        return
                    }
                    Toast.makeText(this@GroupContactsSelectorActivity, getString(R.string.group_members_added), Toast.LENGTH_SHORT).show()
                    setResult(RESULT_OK)
                    finish()
                }

                override fun onFailure(call: Call<GroupResponse>, t: Throwable) {
                    nextButton.isEnabled = true
                    Toast.makeText(
                        this@GroupContactsSelectorActivity,
                        getString(R.string.group_could_not_add_members_with_error, t.message),
                        Toast.LENGTH_LONG
                    ).show()
                }
            })
    }
}
