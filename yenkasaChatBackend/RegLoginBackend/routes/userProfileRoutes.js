// File: routes/userProfileRoutes.js

const express = require('express');
const router = express.Router();
const User = require('../models/User'); // Assuming your User model is in 'models/User.js'
const authMiddleware = require('../middleware/authMiddleware'); // Your authentication middleware

/**
 * @route   PUT /api/profile/player-id
 * @desc    Add or Update the OneSignal Player ID for the authenticated user
 * @access  Private (requires authentication)
 */
router.put('/player-id', authMiddleware, async (req, res) => {
    const { playerId } = req.body;
    const userId = req.user.id; // Extracted from the token by authMiddleware

    // Basic validation
    if (!playerId || typeof playerId !== 'string') {
        return res.status(400).json({ msg: 'Valid Player ID is required in the request body.' });
    }

    if (!userId) {
        // This should ideally be caught by authMiddleware, but as a safeguard:
        return res.status(401).json({ msg: 'User not authenticated.' });
    }

    try {
        // Find the user by their MongoDB _id and update their playerId field
        // The { new: true } option returns the modified document rather than the original.
        // The { upsert: false } is implied but good to be aware of; we're updating, not creating a user here.
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { 
                $set: { 
                    playerId: playerId, 
                    // It's also good practice to update an 'updatedAt' timestamp
                    updatedAt: new Date() 
                } 
            },
            { new: true } // Returns the updated document
        );

        if (!updatedUser) {
            // This case might happen if the token is valid but the user was deleted
            // from the DB after the token was issued.
            return res.status(404).json({ msg: 'User not found.' });
        }

        console.log(`Successfully updated/added Player ID '${playerId}' for user '${userId}'`);
        res.json({ 
            msg: 'Player ID updated successfully.',
            user: { // Send back relevant parts of the user, not the whole thing necessarily
                id: updatedUser._id,
                username: updatedUser.username,
                playerId: updatedUser.playerId,
                updatedAt: updatedUser.updatedAt
            }
        });

    } catch (err) {
        console.error('Error updating Player ID:', err.message);
        // More specific error handling can be added here (e.g., for validation errors from Mongoose)
        res.status(500).json({ msg: 'Server error while updating Player ID.' });
    }
});

module.exports = router;
