package com.example.yenkasachat.ui

// import android.content.Context // No longer needed for direct SharedPreferences
import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.yenkasachat.R
import com.example.yenkasachat.adapter.ContactAdapter
import com.example.yenkasachat.model.Contact
import com.example.yenkasachat.model.CreateChatRoomRequest
import com.example.yenkasachat.model.CreateChatRoomResponse
import com.example.yenkasachat.util.TokenManager // Ensure this is imported
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

    // It's good practice to define a TAG for logging
    private companion object {
        private const val TAG = "ContactsActivity"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // --- Authentication Check using TokenManager ---
        val currentAccessToken = TokenManager.getToken(this)
        if (currentAccessToken.isNullOrEmpty()) {
            Log.w(TAG, "No valid access token found. Redirecting to login.")
            Toast.makeText(this, "Authentication required. Please log in again.", Toast.LENGTH_LONG).show()
            redirectToLogin()
            return // Stop further execution of onCreate
        }
        // --- End of Authentication Check ---

        setContentView(R.layout.activity_contacts)

        editAddContact = findViewById(R.id.editAddContact)
        btnAddContact = findViewById(R.id.btnAddContact)
        recyclerView = findViewById(R.id.recyclerViewContacts)

        contactAdapter = ContactAdapter(
            contacts,
            onDeleteClick = { contact -> deleteContact(contact) }, // Pass the whole contact for potential extra info
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

    private fun redirectToLogin() {
        TokenManager.clearAll(this) // Ensure all tokens are cleared centrally
        val intent = Intent(this, LoginActivity::class.java) // Replace LoginActivity if yours is named differently
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        finish() // Finish this activity
    }

    private fun handleApiError(responseCode: Int, errorMessage: String, actionDescription: String) {
        Log.e(TAG, "$actionDescription Failed: $errorMessage (Code: $responseCode)")
        Toast.makeText(this, "$actionDescription failed: $errorMessage", Toast.LENGTH_LONG).show()

        if (responseCode == 401 || responseCode == 403) {
            Log.w(TAG, "Authentication/Authorization error ($responseCode) during $actionDescription. Logging out.")
            Toast.makeText(this, "Session expired or access denied. Please log in again.", Toast.LENGTH_LONG).show()
            redirectToLogin()
        }
    }

    private fun handleApiFailure(t: Throwable, actionDescription: String) {
        Log.e(TAG, "$actionDescription Error: ${t.message}", t)
        Toast.makeText(this, "Error during $actionDescription: ${t.message}", Toast.LENGTH_SHORT).show()
        // For general network failures, you might not always want to log out,
        // but if it's persistent, the user might get stuck.
        // Consider a retry mechanism or more specific error handling.
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
                        // Use DiffUtil for better RecyclerView performance
                        contactAdapter.notifyDataSetChanged()
                    } else {
                        handleApiError(response.code(), parseError(response), "Load contacts")
                    }
                }

                override fun onFailure(call: Call<List<Contact>>, t: Throwable) {
                    handleApiFailure(t, "loading contacts")
                }
            })
    }

    private fun addContact(username: String) {
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
                        handleApiError(response.code(), parseError(response), "Add contact")
                    }
                }

                override fun onFailure(call: Call<Contact>, t: Throwable) {
                    handleApiFailure(t, "adding contact")
                }
            })
    }

    private fun deleteContact(contact: Contact) { // Changed to accept Contact object
        ApiClient.apiService.deleteContact(contact.id) // Assuming contact.id is the String ID
            .enqueue(object : Callback<Void> {
                override fun onResponse(call: Call<Void>, response: Response<Void>) {
                    if (response.isSuccessful) {
                        val index = contacts.indexOfFirst { it.id == contact.id }
                        if (index != -1) {
                            contacts.removeAt(index)
                            contactAdapter.notifyItemRemoved(index)
                            Toast.makeText(this@ContactsActivity, "Contact deleted", Toast.LENGTH_SHORT).show()
                        }
                    } else {
                        handleApiError(response.code(), parseError(response), "Delete contact")
                    }
                }

                override fun onFailure(call: Call<Void>, t: Throwable) {
                    handleApiFailure(t, "deleting contact")
                }
            })
    }

    private fun createChatRoom(contact: Contact) {
        val request = CreateChatRoomRequest(username = contact.username)
        ApiClient.apiService.createChatRoom(request)
            .enqueue(object : Callback<CreateChatRoomResponse> {
                override fun onResponse(
                    call: Call<CreateChatRoomResponse>,
                    response: Response<CreateChatRoomResponse>
                ) {
                    val responseBody = response.body()
                    if (response.isSuccessful && responseBody?.success == true) {
                        val roomId = responseBody.roomId
                        if (roomId.isNullOrEmpty()) {
                            Log.e(TAG, "Create ChatRoom successful but roomId is null or empty.")
                            Toast.makeText(this@ContactsActivity, "Failed to create chat room: Invalid room ID received.", Toast.LENGTH_LONG).show()
                            return
                        }
                        val intent = Intent(this@ContactsActivity, ChatActivity::class.java).apply {
                            putExtra("roomId", roomId)
                            putExtra("contactName", contact.username)
                        }
                        startActivity(intent)
                    } else {
                        val errorMsg = responseBody?.message ?: parseError(response)
                        // Use the new handler, which includes redirect for 401/403
                        handleApiError(response.code(), errorMsg, "Create chat room")
                    }
                }

                override fun onFailure(call: Call<CreateChatRoomResponse>, t: Throwable) {
                    handleApiFailure(t, "creating chat room")
                }
            })
    }

    private fun parseError(response: Response<*>): String {
        try {
            val errorBody = response.errorBody()?.string()
            if (errorBody.isNullOrEmpty()) {
                return "Error: ${response.code()} ${response.message()} (No specific error body)"
            }
            // Attempt to parse a "message" field from JSON
            if (errorBody.contains("\"message\"")) {
                try {
                    // Basic parsing, consider using a JSON library for robustness
                    return errorBody.split("\"message\":\"")[1].split("\"")[0]
                } catch (e: Exception) {
                    Log.w(TAG, "Could not parse 'message' from error JSON: $errorBody", e)
                }
            }
            // If no "message" field or parsing failed, return the whole error body (or a snippet)
            return if (errorBody.length > 200) errorBody.substring(0, 200) + "..." else errorBody
        } catch (e: IOException) {
            Log.e(TAG, "Error reading error response body", e)
            return "Error reading error response: ${e.message}"
        }
    }
}
