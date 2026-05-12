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
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.EdgeToEdgeInsets

class GroupContactsSelectorActivity : AppCompatActivity() {
    private lateinit var adapter: GroupMembersAdapter
    private lateinit var selectedCount: TextView
    private val allContacts = mutableListOf<Contact>()
    private val selectedIds = linkedSetOf<String>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_group_contacts_selector)
        EdgeToEdgeInsets.setLightSystemBars(window, lightStatusBars = true, lightNavigationBars = false)
        EdgeToEdgeInsets.applySystemBarPadding(findViewById(R.id.groupSelectorHeader), top = true)

        selectedCount = findViewById(R.id.textSelectedCount)
        val search = findViewById<EditText>(R.id.inputSearchContacts)
        val recycler = findViewById<RecyclerView>(R.id.recyclerGroupContacts)
        val next = findViewById<Button>(R.id.buttonNextGroupSetup)

        adapter = GroupMembersAdapter(selectedIds) { contact ->
            val id = contact.contactId ?: contact.userId
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

        next.setOnClickListener {
            if (selectedIds.isEmpty()) {
                Toast.makeText(this, "Select at least one contact", Toast.LENGTH_SHORT).show()
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
                    Toast.makeText(this@GroupContactsSelectorActivity, "Could not load contacts", Toast.LENGTH_LONG).show()
                    return
                }
                allContacts.clear()
                allContacts.addAll(response.body().orEmpty())
                adapter.submitList(allContacts.toList())
            }

            override fun onFailure(call: Call<List<Contact>>, t: Throwable) {
                Toast.makeText(this@GroupContactsSelectorActivity, "Could not load contacts: ${t.message}", Toast.LENGTH_LONG).show()
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
        selectedCount.text = if (selectedIds.isEmpty()) "Create Group" else "${selectedIds.size} selected"
    }
}
