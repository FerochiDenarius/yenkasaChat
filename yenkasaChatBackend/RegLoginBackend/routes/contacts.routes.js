const router = require('express').Router(); // ✅ Fix: declare router
const Contact = require('../models/contact.model');
const User = require('../models/user.model');
const authMiddleware = require('../middleware/auth'); // Ensure this path is correct

// ✅ Add contact route
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { username } = req.body;
        const userId = req.user.id; // ✅ Use 'id' from JWT payload

        if (!username) {
            return res.status(400).json({ error: 'Username is required' });
        }

        const contactUser = await User.findOne({ username });
        if (!contactUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (contactUser._id.toString() === userId) {
            return res.status(400).json({ error: 'You cannot add yourself' });
        }

        const exists = await Contact.findOne({
            userId,
            contactId: contactUser._id
        });
        if (exists) {
            return res.status(400).json({ error: 'Contact already exists' });
        }

        const newContact = new Contact({
            userId,
            contactId: contactUser._id.toString(),
            contactUsername: contactUser.username
        });

        await newContact.save();
        res.status(201).json(newContact);
    } catch (err) {
        console.error("❌ Contact save error:", err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// ✅ Get all contacts for the authenticated user
router.get('/', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        const contactDocs = await Contact.find({ userId });

        // Convert contact documents into simplified objects
        const contacts = contactDocs.map(contact => ({
            id: contact._id,
            username: contact.contactUsername
        }));

        res.json(contacts);
    } catch (err) {
        console.error("❌ Failed to load contacts:", err.message);
        res.status(500).json({ error: 'Server error while loading contacts' });
    }
});


module.exports = router;
