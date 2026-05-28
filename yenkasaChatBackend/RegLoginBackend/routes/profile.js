const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const User = require('../models/user.model');
const Message = require('../models/message.model');
const Follow = require('../models/follow.model');
const { publishYmeEvent } = require('../src/yme/services/eventPublisher.service');

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
    const profileUserId = req.params.userId;
    const viewerId = req.user.id;

    const user = await User.findById(profileUserId)
      .select('_id username bio profileImage verified followersCount followingCount')
      .lean();

    if (!user) return res.status(404).json({ message: 'User not found' });

    const [followersDocs, followingDocs, isFollowingDoc, followersCount, followingCount] =
      await Promise.all([
        Follow.find({ following: profileUserId, status: 'active' })
          .populate('follower', 'username profileImage')
          .sort({ followedAt: -1 })
          .lean(),
        Follow.find({ follower: profileUserId, status: 'active' })
          .populate('following', 'username profileImage')
          .sort({ followedAt: -1 })
          .lean(),
        Follow.findOne({
          follower: viewerId,
          following: profileUserId,
          status: 'active'
        }).lean(),
        Follow.countDocuments({ following: profileUserId, status: 'active' }),
        Follow.countDocuments({ follower: profileUserId, status: 'active' })
      ]);

    const followers = followersDocs.map(doc => doc.follower).filter(Boolean);
    const following = followingDocs.map(doc => doc.following).filter(Boolean);

    if (viewerId.toString() !== profileUserId.toString()) {
      publishYmeEvent({
        userId: viewerId,
        sourceApp: 'social_app',
        eventType: 'profile_viewed',
        relatedUserId: profileUserId,
        creatorId: profileUserId,
        contentId: `user:${profileUserId}`,
        payload: {
          profileUsername: user.username,
          followersCount,
          followingCount,
          isFollowing: !!isFollowingDoc,
        },
      });
    }

    res.json({
      _id: user._id,
      username: user.username,
      bio: user.bio || '',
      profileImage: user.profileImage,
      verified: Boolean(user.verified),
      followers,
      following,
      followersCount,
      followingCount,
      isFollowing: !!isFollowingDoc
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

    if (!isFollowing) {
      publishYmeEvent({
        userId: currentUserId,
        sourceApp: 'social_app',
        eventType: 'follow_user',
        creatorId: targetUser._id,
        relatedUserId: targetUser._id,
        contentId: `user:${targetUserId}`,
        payload: {
          targetUsername: targetUser.username,
          followerUsername: currentUser.username,
          route: 'profile_toggle_follow',
        },
      });
    }

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
