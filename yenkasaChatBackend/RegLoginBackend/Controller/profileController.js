// controllers/profileController.js
const User = require('../models/user.model'); // Assuming this path is correct

// GET current user profile
const getProfile = async (req, res) => {
  try {
    // req.user should be populated by your authMiddleware and contain the user document (excluding password)
    // If authMiddleware only sets req.user.id, you'd need to fetch the user here:
    // const user = await User.findById(req.user.id).select('-password');
    // if (!user) return res.status(404).json({ message: "User not found" });
    // res.json(user);

    // Assuming req.user is the full user object (minus password) from authMiddleware:
    if (!req.user || !req.user._id) { // Added a check for req.user itself
        console.error("❌ getProfile error: User object not found in request after authMiddleware.");
        return res.status(401).json({ message: "Authentication error or user not found." });
    }
    res.json(req.user);

  } catch (error) {
    console.error("❌ getProfile error:", error.message);
    res.status(500).json({ message: "Error fetching profile" });
  }
};

// UPDATE profile
const updateProfile = async (req, res) => {
  try {
    // These are the field names your Android app's UpdateProfileRequest is likely sending
    const { username, email, phone, phoneNumber, location, preferredLanguage } = req.body;
    const userId = req.user._id; // Get user ID from the authenticated user object

    if (!userId) {
        console.error("❌ updateProfile error: User ID not found in request after authMiddleware.");
        return res.status(401).json({ message: "User not authenticated for update." });
    }

    const updates = {};
    if (username !== undefined) updates.username = username.trim();

    if (email !== undefined) {
        const newEmail = email.trim().toLowerCase();
        // Only proceed if the email is actually changing to avoid unnecessary DB checks/updates
        if (req.user.email !== newEmail) {
            // Optional: Check if the new email is already taken by another user
            const existingUserWithEmail = await User.findOne({ email: newEmail });
            if (existingUserWithEmail && existingUserWithEmail._id.toString() !== userId.toString()) {
                return res.status(400).json({ message: 'Email already in use by another account.' });
            }
            updates.email = newEmail;
            // If email change requires re-verification in your app logic:
            // updates.verified = false; // Add this if your User model has a 'verified' field
        }
    }

    // Changed 'phoneNumber' to 'phone' to match Android's UpdateProfileRequest
    if (phone !== undefined) updates.phoneNumber = phone.trim();
    if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber.trim();
    if (location !== undefined) updates.location = location.trim();
    if (preferredLanguage !== undefined) updates.preferredLanguage = preferredLanguage.trim();

    // If no valid fields were provided for update
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields provided for update." });
    }

    console.log(`Attempting to update profile for user ID: ${userId} with updates:`, updates);

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updates }, // Use $set to only update provided fields
      { new: true, runValidators: true } // new:true returns the updated doc, runValidators:true applies schema validation
    ).select('-password -refreshToken -emailVerificationCode -verificationCode -phoneVerificationCode -passwordResetToken -passwordResetExpires'); // Exclude sensitive auth fields from the response

    if (!updatedUser) {
      // This means the findByIdAndUpdate operation didn't find the user, which is unlikely if userId is correct
      console.error(`❌ updateProfile error: User not found with ID ${userId} during update operation.`);
      return res.status(404).json({ message: "User not found for update operation." });
    }

    console.log(`✅ Profile updated successfully for user: ${updatedUser.username} (ID: ${userId})`);
    res.json({
      message: "Profile updated successfully", // Keep consistent message
      user: updatedUser // Send back the updated user object
    });

  } catch (error) {
    console.error("❌ updateProfile error:", error.message);
    // Handle potential duplicate key errors (e.g., if username or email must be unique and the update violates this)
    if (error.code === 11000 || error.message.includes('duplicate key error')) {
      // Determine which field caused the duplicate error if possible (might require parsing error.message or error.keyValue)
      let field = "A unique field (like username or email)";
      if (error.keyValue) {
          field = Object.keys(error.keyValue)[0];
      }
      return res.status(400).json({ message: `${field} already exists. Please choose a different one.` });
    }
    res.status(500).json({ message: "Error updating profile. Please try again later." });
  }
};

module.exports = { getProfile, updateProfile };
