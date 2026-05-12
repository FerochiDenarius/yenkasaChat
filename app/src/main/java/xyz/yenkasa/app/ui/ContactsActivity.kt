package xyz.yenkasa.app.ui

import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.util.Log
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import xyz.yenkasa.app.R
import xyz.yenkasa.app.adapter.ContactAdapter
import xyz.yenkasa.app.model.Contact // Your existing Contact model
import xyz.yenkasa.app.model.CreateChatRoomRequest // IF you use this for the API
import xyz.yenkasa.app.model.CreateChatRoomResponse
import xyz.yenkasa.app.util.TokenManager
import xyz.yenkasa.app.network.ApiClient
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
    private val allContacts: MutableList<Contact> = mutableListOf()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_contacts)

        editAddContact = findViewById(R.id.editAddContact)
        btnAddContact = findViewById(R.id.btnAddContact)
        recyclerView = findViewById(R.id.recyclerViewContacts)

        val token =TokenManager.getToken(this)
        val userId = TokenManager.getUserId(this)

        if (token.isNullOrEmpty() || userId.isNullOrEmpty()) {
            Toast.makeText(this, "Session expired. Please log in again.", Toast.LENGTH_LONG).show()
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
            return
        }


        contactAdapter = ContactAdapter(
            contacts,
            onDeleteClick = {
                Toast.makeText(
                    this,
                    "Contacts stay saved after the first conversation.",
                    Toast.LENGTH_SHORT
                ).show()
            },
            onChatClick = { contact -> createChatRoom(contact) }
        )

        recyclerView.layoutManager = LinearLayoutManager(this)
        recyclerView.adapter = contactAdapter

        btnAddContact.setOnClickListener {
            startActivity(Intent(this, ChatRoomsActivity::class.java))
        }
        editAddContact.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun afterTextChanged(s: Editable?) = Unit
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                filterExistingContacts(s?.toString().orEmpty())
            }
        })

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
                        allContacts.clear()
                        allContacts.addAll(response.body().orEmpty())
                        contacts.clear()
                        contacts.addAll(allContacts)
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

    private fun filterExistingContacts(query: String) {
        val normalized = query.trim().lowercase()
        contacts.clear()
        contacts.addAll(
            if (normalized.isBlank()) allContacts
            else allContacts.filter { it.username.lowercase().contains(normalized) }
        )
        contactAdapter.notifyDataSetChanged()
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
                    } else if (response.code() == 202 && responseBody?.message != null) {
                        Toast.makeText(this@ContactsActivity, responseBody.message, Toast.LENGTH_LONG).show()
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
