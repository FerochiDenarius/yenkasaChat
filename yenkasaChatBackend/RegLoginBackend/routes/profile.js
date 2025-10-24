const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const User = require('../models/user.model');
const Message = require('../models/message.model');

// ✅ Controllers
const { getProfile, updateProfile } = require('../Controller/profileController');

// ===============================
// GET /api/profile  (current user)
// ===============================
router.get('/', authMiddleware, getProfile);

// ===============================
// PUT /api/profile
// ===============================
router.put('/', authMiddleware, updateProfile);

// ===============================
// GET /api/users/:userId/profile
// used by UserProfileActivity
// ===============================
router.get('/users/:userId/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate('followers', 'username profileImage')
      .populate('following', 'username profileImage');

    if (!user) return res.status(404).json({ message: 'User not found' });

    // Include whether current user follows this profile
    const isFollowing = user.followers.some(f => f._id.toString() === req.user.id);

    res.json({
      _id: user._id,
      username: user.username,
      bio: user.bio || '',
      profileImage: user.profileImage,
      followers: user.followers,
      following: user.following,
      isFollowing
    });
  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ===============================
// POST /api/follow/:targetUserId
// toggle follow/unfollow
// ===============================
router.post('/follow/:targetUserId', authMiddleware, async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const currentUserId = req.user.id;

    if (targetUserId === currentUserId) {
      return res.status(400).json({ message: "You can't follow yourself" });
    }

    const targetUser = await User.findById(targetUserId);
    const currentUser = await User.findById(currentUserId);

    if (!targetUser || !currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isFollowing = currentUser.following.includes(targetUserId);

    if (isFollowing) {
      // Unfollow
      currentUser.following.pull(targetUserId);
      targetUser.followers.pull(currentUserId);
    } else {
      // Follow
      currentUser.following.push(targetUserId);
      targetUser.followers.push(currentUserId);
    }

    await currentUser.save();
    await targetUser.save();

    res.json({
      success: true,
      following: !isFollowing,
      message: isFollowing ? 'Unfollowed user' : 'Followed user'
    });
  } catch (error) {
    console.error('Error toggling follow:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ===============================
// POST /api/block/:targetUserId
// ===============================
router.post('/block/:targetUserId', authMiddleware, async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const currentUser = await User.findById(req.user.id);

    if (!currentUser.blockedUsers.includes(targetUserId)) {
      currentUser.blockedUsers.push(targetUserId);
      await currentUser.save();
    }

    res.json({ success: true, message: 'User blocked successfully' });
  } catch (err) {
    console.error('Error blocking user:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ===============================
// POST /api/unblock/:targetUserId
// ===============================
router.post('/unblock/:targetUserId', authMiddleware, async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const currentUser = await User.findById(req.user.id);

    currentUser.blockedUsers.pull(targetUserId);
    await currentUser.save();

    res.json({ success: true, message: 'User unblocked successfully' });
  } catch (err) {
    console.error('Error unblocking user:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ===============================
// POST /api/message/:receiverId
// send message directly (optional)
// ===============================
router.post('/message/:receiverId', authMiddleware, async (req, res) => {
  try {
    const { receiverId } = req.params;
    const { text } = req.body;

    const newMessage = new Message({
      roomId: null, // Or your logic to find/create room
      senderId: req.user.id,
      text,
    });

    await newMessage.save();

    res.json({ success: true, message: 'Message sent', data: newMessage });
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
