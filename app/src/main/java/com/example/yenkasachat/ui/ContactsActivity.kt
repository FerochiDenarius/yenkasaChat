package com.example.yenkasachat.ui

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.yenkasachat.R
import com.example.yenkasachat.adapter.ContactAdapter
import com.example.yenkasachat.model.Contact // Your existing Contact model
import com.example.yenkasachat.model.CreateChatRoomRequest // IF you use this for the API
import com.example.yenkasachat.model.CreateChatRoomResponse
// Participant model is not directly used here, but its structure might influence Contact model
// import com.example.yenkasachat.model.Participant
import com.example.yenkasachat.network.ApiClient
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.io.IOException

class ContactsActivity : AppCompatActivity() {

    private lateinit var editAddContact: EditText
    private lateinit var btnAddContact: Button
    private lateinit var recyclerView: RecyclerView
    private lateinit var contactAdapter: ContactAdapter
    private val contacts: MutableList<Contact> = mutableListOf()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_contacts)

        editAddContact = findViewById(R.id.editAddContact)
        btnAddContact = findViewById(R.id.btnAddContact)
        recyclerView = findViewById(R.id.recyclerViewContacts)

        val prefs = getSharedPreferences("auth", Context.MODE_PRIVATE)
        val storedToken = prefs.getString("token", null)
        val storedUserId = prefs.getString("userId", null)

        if (storedToken.isNullOrEmpty() || storedUserId.isNullOrEmpty()) {
            Toast.makeText(this, "Authentication required. Please log in again.", Toast.LENGTH_LONG).show()
            finish()
            return
        }

        contactAdapter = ContactAdapter(
            contacts,
            // Assuming Contact has 'id' and 'username' fields as used.
            // If Contact's 'id' field was renamed (e.g. to '_id' for consistency with Participant),
            // this would need to change: { contact -> deleteContact(contact._id) }
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
        ApiClient.apiService.getContacts()
            .enqueue(object : Callback<List<Contact>> {
                override fun onResponse(
                    call: Call<List<Contact>>,
                    response: Response<List<Contact>>
                ) {
                    if (response.isSuccessful) {
                        contacts.clear()
                        response.body()?.let { contacts.addAll(it) }
                        contactAdapter.notifyDataSetChanged() // Consider DiffUtil for adapter efficiency
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
        // Assuming your addContact API endpoint still expects a simple map for username
        // If it was also changed to a typed request, update this accordingly.
        val body = mapOf("username" to username)

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
        // Assuming contactId is the correct field from your Contact model.
        ApiClient.apiService.deleteContact(contactId)
            .enqueue(object : Callback<Void> {
                override fun onResponse(call: Call<Void>, response: Response<Void>) {
                    if (response.isSuccessful) {
                        // Ensure 'id' is the correct identifier field in your Contact model.
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
        // **ADJUSTMENT POINT 1: Use CreateChatRoomRequest if your API service expects it.**
        val request = CreateChatRoomRequest(username = contact.username)
        // If your API service still expects Map<String, String> for this endpoint:
        // val request = mapOf("username" to contact.username)

        ApiClient.apiService.createChatRoom(request) // Pass the 'request' object
            .enqueue(object : Callback<CreateChatRoomResponse> {
                override fun onResponse(
                    call: Call<CreateChatRoomResponse>,
                    response: Response<CreateChatRoomResponse>
                ) {
                    val responseBody = response.body()
                    if (response.isSuccessful && responseBody?.success == true) {
                        val roomId = responseBody.roomId
                        val intent = Intent(this@ContactsActivity, ChatActivity::class.java).apply {
                            putExtra("roomId", roomId)
                            // Passing contact.username as contactName is fine.
                            // ChatActivity will likely fetch full room details using roomId.
                            putExtra("contactName", contact.username)
                        }
                        startActivity(intent)
                    } else {
                        val errorMsg = parseError(response)
                        val successFlag = responseBody?.success
                        val actualMessage = responseBody?.message ?: errorMsg // Try to get message from response body
                        Log.e("ContactsActivity", "Create ChatRoom Failed: $actualMessage (Code: ${response.code()}, Success Flag: $successFlag)")
                        Toast.makeText(this@ContactsActivity, "Failed to create chat room: $actualMessage", Toast.LENGTH_LONG).show()
                    }
                }

                override fun onFailure(call: Call<CreateChatRoomResponse>, t: Throwable) {
                    Log.e("ContactsActivity", "Create ChatRoom Error: ${t.message}", t)
                    Toast.makeText(this@ContactsActivity, "Error creating chat room: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun parseError(response: Response<*>): String {
        return try {
            response.errorBody()?.string()?.let { errorJson ->
                if (errorJson.contains("\"message\"")) {
                    try {
                        errorJson.split("\"message\":\"")[1].split("\"")[0]
                    } catch (e: Exception) { errorJson }
                } else { errorJson }
            } ?: "Error: ${response.code()} ${response.message()} (No specific error body)"
        } catch (e: IOException) {
            "Error reading error response: ${e.message}"
        }
    }
}

