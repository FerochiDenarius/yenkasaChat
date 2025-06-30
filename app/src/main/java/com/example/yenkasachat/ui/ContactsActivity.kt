package com.example.yenkasachat.ui

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.yenkasachat.R
import com.example.yenkasachat.adapter.ContactAdapter
import com.example.yenkasachat.model.*
import com.example.yenkasachat.network.ApiClient
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class ContactsActivity : AppCompatActivity() {

    private lateinit var editAddContact: EditText
    private lateinit var btnAddContact: Button
    private lateinit var recyclerView: RecyclerView
    private lateinit var contactAdapter: ContactAdapter
    private val contacts: MutableList<Contact> = mutableListOf()

    private var userId: String? = null
    private var token: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_contacts)

        editAddContact = findViewById(R.id.editAddContact)
        btnAddContact = findViewById(R.id.btnAddContact)
        recyclerView = findViewById(R.id.recyclerViewContacts)

        val prefs = getSharedPreferences("auth", Context.MODE_PRIVATE)
        userId = prefs.getString("userId", null)
        token = prefs.getString("token", null)

        if (userId == null || token == null) {
            Toast.makeText(this, "Please log in again", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        contactAdapter = ContactAdapter(
            contacts,
            onDeleteClick = { contact -> deleteContact(contact.id) },
            onChatClick = { contact -> createChatRoom(contact) }
        )

        recyclerView.layoutManager = LinearLayoutManager(this)
        recyclerView.adapter = contactAdapter

        btnAddContact.setOnClickListener {
            val username = editAddContact.text.toString().trim()
            if (username.isNotEmpty()) {
                addContact(username)
            } else {
                Toast.makeText(this, "Enter username", Toast.LENGTH_SHORT).show()
            }
        }

        loadContacts()
    }

    private fun loadContacts() {
        ApiClient.apiService.getContacts("Bearer $token")
            .enqueue(object : Callback<List<Contact>> {
                override fun onResponse(
                    call: Call<List<Contact>>,
                    response: Response<List<Contact>>
                ) {
                    if (response.isSuccessful) {
                        contacts.clear()
                        contacts.addAll(response.body() ?: emptyList())
                        contactAdapter.notifyDataSetChanged()
                    } else {
                        val errorMsg = response.errorBody()?.string() ?: "Unknown error"
                        Toast.makeText(
                            this@ContactsActivity,
                            "Failed: $errorMsg",
                            Toast.LENGTH_LONG
                        ).show()
                    }
                }

                override fun onFailure(call: Call<List<Contact>>, t: Throwable) {
                    Toast.makeText(this@ContactsActivity, "Error: ${t.message}", Toast.LENGTH_SHORT)
                        .show()
                }
            })
    }

    private fun addContact(username: String) {
        val body = mapOf("username" to username)

        ApiClient.apiService.addContact("Bearer $token", body)
            .enqueue(object : Callback<Contact> {
                override fun onResponse(call: Call<Contact>, response: Response<Contact>) {
                    if (response.isSuccessful && response.body() != null) {
                        contacts.add(response.body()!!)
                        contactAdapter.notifyItemInserted(contacts.size - 1)
                        editAddContact.text.clear()
                        Toast.makeText(this@ContactsActivity, "Contact added", Toast.LENGTH_SHORT)
                            .show()
                    } else {
                        val errorMsg = response.errorBody()?.string() ?: "Unknown error"
                        Toast.makeText(
                            this@ContactsActivity,
                            "Failed: $errorMsg",
                            Toast.LENGTH_LONG
                        ).show()
                    }
                }

                override fun onFailure(call: Call<Contact>, t: Throwable) {
                    Toast.makeText(this@ContactsActivity, "Error: ${t.message}", Toast.LENGTH_SHORT)
                        .show()
                }
            })
    }

    private fun deleteContact(contactId: String) {
        ApiClient.apiService.deleteContact("Bearer $token", contactId)
            .enqueue(object : Callback<Void> {
                override fun onResponse(call: Call<Void>, response: Response<Void>) {
                    if (response.isSuccessful) {
                        val index = contacts.indexOfFirst { it.id == contactId }
                        if (index != -1) {
                            contacts.removeAt(index)
                            contactAdapter.notifyItemRemoved(index)
                            Toast.makeText(
                                this@ContactsActivity,
                                "Contact deleted",
                                Toast.LENGTH_SHORT
                            ).show()
                        }
                    } else {
                        Toast.makeText(
                            this@ContactsActivity,
                            "Failed to delete contact",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }

                override fun onFailure(call: Call<Void>, t: Throwable) {
                    Toast.makeText(this@ContactsActivity, "Error: ${t.message}", Toast.LENGTH_SHORT)
                        .show()
                }
            })
    }

    private fun createChatRoom(contact: Contact) {
        val body = mapOf("username" to contact.username)

        ApiClient.apiService.createChatRoom("Bearer $token", body)
            .enqueue(object : Callback<CreateChatRoomResponse> {
                override fun onResponse(
                    call: Call<CreateChatRoomResponse>,
                    response: Response<CreateChatRoomResponse>
                ) {
                    if (response.isSuccessful && response.body()?.success == true) {
                        val roomId = response.body()!!.roomId
                        val intent = Intent(this@ContactsActivity, ChatActivity::class.java)
                        intent.putExtra("roomId", roomId)
                        startActivity(intent)
                    } else {
                        val errorMsg = response.errorBody()?.string() ?: "Unknown error"
                        Toast.makeText(
                            this@ContactsActivity,
                            "Failed: $errorMsg",
                            Toast.LENGTH_LONG
                        ).show()
                    }
                }

                override fun onFailure(call: Call<CreateChatRoomResponse>, t: Throwable) {
                    Toast.makeText(this@ContactsActivity, "Error: ${t.message}", Toast.LENGTH_SHORT)
                        .show()
                }
            })
    }
}