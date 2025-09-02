// controllers/profileController.js
const User = require('../models/user.model');

// GET current user profile
const getProfile = async (req, res) => {
  try {
    // req.user is already populated by middleware
    res.json(req.user);
  } catch (error) {
    console.error("❌ getProfile error:", error.message);
    res.status(500).json({ message: "Error fetching profile" });
  }
};

// UPDATE profile
const updateProfile = async (req, res) => {
  try {
    const { username, email, phoneNumber, location } = req.body;

    const updates = {};
    if (username) updates.username = username.trim();
    if (email) updates.email = email.trim().toLowerCase();
    if (phoneNumber) updates.phoneNumber = phoneNumber.trim();
    if (location) updates.location = location.trim();

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,   // ✅ comes from middleware
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      message: "✅ Profile updated successfully",
      user: updatedUser
    });
  } catch (error) {
    console.error("❌ updateProfile error:", error.message);
    res.status(500).json({ message: "Error updating profile" });
  }
};

module.exports = { getProfile, updateProfile };
