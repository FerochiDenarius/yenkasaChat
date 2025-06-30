const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    contactId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    contactUsername: { 
        type: String, 
        required: true 
    },
    profilePicUrl: { 
        type: String, 
        default: '' 
    }
}, { timestamps: true });

// Prevent duplicate contacts
contactSchema.index({ userId: 1, contactId: 1 }, { unique: true });

module.exports = mongoose.model('Contact', contactSchema);
