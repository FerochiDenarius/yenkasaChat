const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// POST /api/auth/login
const loginUser = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    const user = await User.findOne({
      $or: [{ email: identifier }, { phone: identifier }, { username: identifier }]
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || "secretKey",
      { expiresIn: "7d" }
    );

    const {
      _id,
      email,
      phone,
      username,
      location,
      verified,
      profileImage,
      playerId,
      createdAt,
      updatedAt
    } = user;

    res.status(200).json({
      user: {
        _id,
        email,
        phone,
        username,
        location,
        verified,
        profileImage,
        playerId,
        createdAt,
        updatedAt
      },
      token
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server error during login" });
  }
};

// PATCH /api/auth/update-player-id/:id
const updatePlayerId = async (req, res) => {
  try {
    const { playerId } = req.body;
    const { id } = req.params;

    if (!playerId) {
      return res.status(400).json({ error: "Player ID is required" });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { playerId },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const {
      _id,
      email,
      phone,
      username,
      location,
      verified,
      profileImage,
      playerId: updatedPlayerId,
      createdAt,
      updatedAt
    } = user;

    res.status(200).json({
      message: "Player ID updated",
      user: {
        _id,
        email,
        phone,
        username,
        location,
        verified,
        profileImage,
        playerId: updatedPlayerId,
        createdAt,
        updatedAt
      }
    });

  } catch (error) {
    console.error("Error updating playerId:", error);
    res.status(500).json({ error: "Server error updating playerId" });
  }
};

module.exports = {
  loginUser,
  updatePlayerId
};
