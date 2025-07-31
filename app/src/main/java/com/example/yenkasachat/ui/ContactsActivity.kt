package com.example.yenkasachat.ui

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log // It's good practice to use Log for errors
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.yenkasachat.R
import com.example.yenkasachat.adapter.ContactAdapter
import com.example.yenkasachat.model.*
import com.example.yenkasachat.network.ApiClient
// Assuming you have a TokenManager, if not, direct SharedPreferences access is also fine
// import com.example.yenkasachat.util.TokenManager
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.io.IOException // For reading error body

class ContactsActivity : AppCompatActivity() {

    private lateinit var editAddContact: EditText
    private lateinit var btnAddContact: Button
    private lateinit var recyclerView: RecyclerView
    private lateinit var contactAdapter: ContactAdapter
    private val contacts: MutableList<Contact> = mutableListOf()

    // You might not need these class-level variables for token and userId anymore
    // if your interceptor handles token retrieval, and if userId isn't used elsewhere in this specific way.
    // However, the initial check for their existence is still valid to ensure the user is logged in.
    // private var userId: String? = null
    // private var token: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_contacts)

        editAddContact = findViewById(R.id.editAddContact)
        btnAddContact = findViewById(R.id.btnAddContact)
        recyclerView = findViewById(R.id.recyclerViewContacts)

        // It's still crucial to check if the user is logged in.
        // If using TokenManager:
        // val token = TokenManager.getToken(this)
        // val userId = TokenManager.getUserId(this) // Assuming TokenManager can also store/retrieve userId
        // if (token.isNullOrEmpty() || userId.isNullOrEmpty()) {

        // Using direct SharedPreferences as you were:
        val prefs = getSharedPreferences("auth", Context.MODE_PRIVATE)
        val storedToken = prefs.getString("token", null)
        val storedUserId = prefs.getString("userId", null) // Assuming userId is also needed

        if (storedToken.isNullOrEmpty() || storedUserId.isNullOrEmpty()) {
            Toast.makeText(this, "Authentication required. Please log in again.", Toast.LENGTH_LONG).show()
            // Optionally, navigate to LoginActivity
            // startActivity(Intent(this, LoginActivity::class.java))
            finish()
            return
        }
        // If you still need token or userId for other non-API logic in this activity,
        // you can assign them to class variables here, but they are NOT passed to ApiService calls anymore.
        // this.token = storedToken
        // this.userId = storedUserId


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
                Toast.makeText(this, "Enter username to add contact", Toast.LENGTH_SHORT).show()
            }
        }

        loadContacts()
    }

    private fun loadContacts() {
        // Token is no longer passed here; interceptor handles it.
        ApiClient.apiService.getContacts()
            .enqueue(object : Callback<List<Contact>> {
                override fun onResponse(
                    call: Call<List<Contact>>,
                    response: Response<List<Contact>>
                ) {
                    if (response.isSuccessful) {
                        contacts.clear()
                        response.body()?.let { contacts.addAll(it) }
                        contactAdapter.notifyDataSetChanged()
                    } else {
                        val errorMsg = parseError(response)
                        Log.e("ContactsActivity", "Load Contacts Failed: $errorMsg (Code: ${response.code()})")
                        Toast.makeText(this@ContactsActivity, "Failed to load contacts: $errorMsg", Toast.LENGTH_LONG).show()
                    }
                }

                override fun onFailure(call: Call<List<Contact>>, t: Throwable) {
                    Log.e("ContactsActivity", "Load Contacts Error: ${t.message}", t)
                    Toast.makeText(this@ContactsActivity, "Error loading contacts: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun addContact(username: String) {
        val body = mapOf("username" to username)

        // Token is no longer passed here; interceptor handles it.
        ApiClient.apiService.addContact(body)
            .enqueue(object : Callback<Contact> {
                override fun onResponse(call: Call<Contact>, response: Response<Contact>) {
                    if (response.isSuccessful && response.body() != null) {
                        contacts.add(response.body()!!)
                        contactAdapter.notifyItemInserted(contacts.size - 1)
                        editAddContact.text.clear()
                        Toast.makeText(this@ContactsActivity, "Contact added successfully", Toast.LENGTH_SHORT).show()
                    } else {
                        val errorMsg = parseError(response)
                        Log.e("ContactsActivity", "Add Contact Failed: $errorMsg (Code: ${response.code()})")
                        Toast.makeText(this@ContactsActivity, "Failed to add contact: $errorMsg", Toast.LENGTH_LONG).show()
                    }
                }

                override fun onFailure(call: Call<Contact>, t: Throwable) {
                    Log.e("ContactsActivity", "Add Contact Error: ${t.message}", t)
                    Toast.makeText(this@ContactsActivity, "Error adding contact: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun deleteContact(contactId: String) {
        // Token is no longer passed here; interceptor handles it.
        ApiClient.apiService.deleteContact(contactId)
            .enqueue(object : Callback<Void> {
                override fun onResponse(call: Call<Void>, response: Response<Void>) {
                    if (response.isSuccessful) {
                        val index = contacts.indexOfFirst { it.id == contactId }
                        if (index != -1) {
                            contacts.removeAt(index)
                            contactAdapter.notifyItemRemoved(index)
                            Toast.makeText(this@ContactsActivity, "Contact deleted", Toast.LENGTH_SHORT).show()
                        }
                    } else {
                        val errorMsg = parseError(response)
                        Log.e("ContactsActivity", "Delete Contact Failed: $errorMsg (Code: ${response.code()})")
                        Toast.makeText(this@ContactsActivity, "Failed to delete contact: $errorMsg", Toast.LENGTH_LONG).show()
                    }
                }

                override fun onFailure(call: Call<Void>, t: Throwable) {
                    Log.e("ContactsActivity", "Delete Contact Error: ${t.message}", t)
                    Toast.makeText(this@ContactsActivity, "Error deleting contact: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun createChatRoom(contact: Contact) {
        val body = mapOf("username" to contact.username)

        // Token is no longer passed here; interceptor handles it.
        ApiClient.apiService.createChatRoom(body)
            .enqueue(object : Callback<CreateChatRoomResponse> {
                override fun onResponse(
                    call: Call<CreateChatRoomResponse>,
                    response: Response<CreateChatRoomResponse>
                ) {
                    if (response.isSuccessful && response.body()?.success == true) {
                        val roomId = response.body()!!.roomId
                        val intent = Intent(this@ContactsActivity, ChatActivity::class.java).apply {
                            putExtra("roomId", roomId)
                            // You might want to pass contact name or other details too
                            putExtra("contactName", contact.username)
                        }
                        startActivity(intent)
                    } else {
                        val errorMsg = parseError(response)
                        val actualSuccessValue = response.body()?.success // For debugging
                        Log.e("ContactsActivity", "Create ChatRoom Failed: $errorMsg (Code: ${response.code()}, Success Flag: $actualSuccessValue)")
                        Toast.makeText(this@ContactsActivity, "Failed to create chat room: $errorMsg", Toast.LENGTH_LONG).show()
                    }
                }

                override fun onFailure(call: Call<CreateChatRoomResponse>, t: Throwable) {
                    Log.e("ContactsActivity", "Create ChatRoom Error: ${t.message}", t)
                    Toast.makeText(this@ContactsActivity, "Error creating chat room: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    // Helper function to parse error messages from responses
    private fun parseError(response: Response<*>): String {
        return try {
            response.errorBody()?.string() ?: "Unknown error (empty error body)"
        } catch (e: IOException) {
            "Error reading error response: ${e.message}"
        }
    }
}
