// routes/accountRoutes.js

const express = require('express');
const router = express.Router();
const User = require('../models/user.model'); // Adjust path as needed: ../models/user.model
const authenticate = require('../middleware/auth'); // Adjust path as needed: ../middleware/authenticate

// === FETCH ACCOUNT INFORMATION ===
// GET /api/account/info - Fetches details for the Account Info page for the authenticated user
router.get('/info', authenticate, async (req, res) => {
    try {
        // req.user.id is populated by the 'authenticate' middleware from the JWT
        const user = await User.findById(req.user.id).select(
            'username email emailVerified phone phoneVerified profilePicUrl createdAt' // Added createdAt
        );

        if (!user) {
            // This case should be rare if authenticate middleware is working correctly
            // and user hasn't been deleted since token issuance.
            console.warn(`User with ID ${req.user.id} not found in database for /info endpoint.`);
            return res.status(404).json({ message: 'User not found.' });
        }

        res.json({
            username: user.username,
            email: user.email || null, // Ensure consistent null if not present
            isEmailVerified: user.emailVerified || false,
            phoneNumber: user.phone || null, // Ensure consistent null if not present
            isPhoneVerified: user.phoneVerified || false,
            profilePictureUrl: user.profilePicUrl || null,
            memberSince: user.createdAt // Optional: display when the account was created
        });

    } catch (err) {
        console.error(`Error fetching account info for user ID ${req.user?.id}:`, err.message, err.stack);
        res.status(500).json({ message: 'Failed to retrieve account information. Please try again later.' });
    }
});

// === CHANGE PHONE NUMBER ===
// PUT /api/account/phone - Allows user to change their phone number
// This will likely require a multi-step process:
// 1. User requests to change phone, enters new number.
// 2. Backend sends verification code to NEW number (using your existing /api/verify/request-phone-code).
// 3. User submits code to a new endpoint (e.g., /api/verify/confirm-new-phone-code).
// 4. If confirmed, THIS endpoint is called to finalize the change.
router.put('/phone', authenticate, async (req, res) => {
    const { newPhoneNumber, verificationCode } = req.body; // Example: client sends new number and proof of verification

    if (!newPhoneNumber) {
        return res.status(400).json({ message: 'New phone number is required.' });
    }
    // Add validation for newPhoneNumber format (E.164)
    if (!/^\+[1-9]\d{1,14}$/.test(newPhoneNumber)) {
        return res.status(400).json({ message: 'Invalid new phone number format. Please use E.164 (e.g., +12223334444).' });
    }

    // IMPORTANT: Security - How do you verify the user is authorized to change to this new number?
    // Option A: Client handles verification flow and sends a short-lived token/verified flag from that flow.
    // Option B: This endpoint re-validates a verificationCode specifically for changing the number.
    // For now, let's assume the client has handled a verification step for the new number
    // and this endpoint is the final step.
    // In a real scenario, you might have `user.pendingNewPhoneNumber` and `user.newPhoneVerificationCode` fields.

    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Check if the new phone number is already in use by another active account
        const existingUserWithNewPhone = await User.findOne({ phone: newPhoneNumber, _id: { $ne: user._id } });
        if (existingUserWithNewPhone) {
            return res.status(409).json({ message: 'This phone number is already associated with another account.' });
        }

        // Update phone number and mark it as verified (assuming prior verification of the new number)
        user.phone = newPhoneNumber;
        user.phoneVerified = true; // Or false if you want them to re-verify it via a separate step
                                   // If setting to true, ensure the verification step was robust.
        await user.save();

        console.log(`User ID ${user._id} changed phone number to ${newPhoneNumber}.`);
        res.json({
            message: 'Phone number updated successfully.',
            phoneNumber: user.phone,
            isPhoneVerified: user.phoneVerified
        });

    } catch (err) {
        console.error(`Error changing phone number for user ID ${req.user?.id}:`, err.message, err.stack);
        res.status(500).json({ message: 'Failed to update phone number. Please try again later.' });
    }
});


// === DELETE ACCOUNT ===
// DELETE /api/account/delete - Allows authenticated user to delete their own account
router.delete('/delete', authenticate, async (req, res) => {
    // For added security, you might require password re-authentication here.
    // const { password } = req.body;
    // if (!password) return res.status(400).json({ message: 'Password is required for account deletion.' });

    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // // Optional: Verify password
        // const isMatch = await bcrypt.compare(password, user.password); // Assuming you use bcrypt
        // if (!isMatch) {
        //     return res.status(401).json({ message: 'Incorrect password. Account deletion failed.' });
        // }

        // Perform the deletion
        await User.findByIdAndDelete(req.user.id);

        // Optional: Perform any additional cleanup:
        // - Delete associated data (e.g., user's posts, messages - depends on your app's data relationships and policies)
        // - Invalidate sessions/tokens if you have a more complex session management system.
        // - Send a confirmation email (e.g., "Your Yenkasa account has been deleted.")

        console.log(`User account with ID ${req.user.id} and email ${user.email || 'N/A'} deleted successfully.`);
        res.status(200).json({ message: 'Account deleted successfully.' });

    } catch (err) {
        console.error(`Error deleting account for user ID ${req.user?.id}:`, err.message, err.stack);
        res.status(500).json({ message: 'Failed to delete account. Please try again later.' });
    }
});


// === Placeholder for "Add Account" ===
// This is typically handled client-side by logging out the current user
// and redirecting to the login/signup page. No specific backend endpoint
// is usually needed for "Add Account" itself unless you're implementing
// a multi-account switching feature within a single session.

// === Placeholder for "Verify Account" ===
// This action on the client will navigate to the appropriate verification flow
// (email or phone) which will use the existing endpoints in `verifyRoutes.js`:
// - POST /api/verify/request-email-code
// - POST /api/verify/confirm-email-code
// - POST /api/verify/request-phone-code
// - POST /api/verify/confirm-phone-code
// The client will determine which flow to initiate based on the `isEmailVerified`
// and `isPhoneVerified` flags received from the `/api/account/info` endpoint.

module.exports = router;
