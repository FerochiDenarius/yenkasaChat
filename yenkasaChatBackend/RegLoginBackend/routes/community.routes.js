// routes/community.routes.js - UPDATED WITH VERIFIED USER CREATION
const express = require('express');
const router = express.Router();
const Community = require('../models/community.model');
const User = require('../models/user.model');
const authMiddleware = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const CoinTransaction = require('../models/cointransaction.model');
const CoinSupply = require('../models/coinSupply');
const Permission = require('../models/permissions.model');
const rewardService = require('../services/reward.service');


// Reward configuration
const COMMUNITY_CREATION_REWARD = 100; // YKC

// Utility to ensure supply exists
async function ensureSupply() {
  await CoinSupply.findByIdAndUpdate(
    "YENKASA_SUPPLY",
    { $setOnInsert: { totalMinted: 0 } },
    { upsert: true }
  );
}


// Middleware to check if user is verified (Details Verification)
const requireVerified = (req, res, next) => {
  if (!req.user.verified) {
    return res.status(403).json({ 
      error: 'You must be verified to create a community',
      message: 'Complete email or phone verification to unlock this feature'
    });
  }
  next();
};

// ✅ Get all communities (PUBLIC)
router.get('/', async (req, res) => {
  try {
    const { search, sort = 'memberCount', order = 'desc' } = req.query;

    let query = { isActive: true }; // Only active ones

    // Optional search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { displayName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const sortOrder = order === 'asc' ? 1 : -1;
    const sortObj = { [sort]: sortOrder };

    let communities = await Community.find(query)
      .sort(sortObj)
      .select('-moderators -rules')
      .lean();

    // ---------------------------------------------------------
    // ✅ FIX: Recalculate memberCount for each community
    // ---------------------------------------------------------
    communities = communities.map(c => ({
      ...c,
      memberCount: Array.isArray(c.members) ? c.members.length : 0
    }));

    res.status(200).json(communities);
  } catch (err) {
    console.error('❌ Failed to fetch communities:', err);
    res.status(500).json({ error: 'Failed to retrieve communities' });
  }
});

// ✅ Get single community details
router.get('/:communityId', async (req, res) => {
  try {
    const community = await Community.findById(req.params.communityId)
      .populate('moderators', 'username profileImage')
      .populate('createdBy', 'username profileImage verified')
      .lean();
    
    if (!community) {
      return res.status(404).json({ error: 'Community not found' });
    }
    
    res.json(community);
  } catch (err) {
    console.error('❌ Failed to fetch community:', err);
    res.status(500).json({ error: 'Failed to retrieve community' });
  }
});

// JOIN COMMUNITY (Max 2)
router.post('/:communityId/join', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { communityId } = req.params;

    // Fetch community
    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({ error: 'Community not found' });
    }

    if (!community.isApproved) {
      return res.status(403).json({ error: 'This community is pending approval' });
    }

    // Fetch user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Already joined?
    if (user.joinedCommunities.includes(communityId)) {
      return res.status(400).json({ error: 'Already a member of this community' });
    }

    // Limit: 2 communities
    if (user.joinedCommunities.length >= 2) {
      return res.status(403).json({
        error: 'You can only join up to 2 communities',
        message: 'You have reached your limit'
      });
    }

    // ---- UPDATE USER ----
    user.joinedCommunities.push(communityId);
    user.community = communityId;
    await user.save();

    // ---- UPDATE COMMUNITY ----
    if (!community.members.includes(userId)) {
      community.members.push(userId);
      community.memberCount = community.members.length;
      community.markModified('members');
      await community.save();
    }

    return res.json({
      success: true,
      message: `Joined ${community.displayName} successfully`,
      community: {
        id: community._id,
        name: community.name,
        displayName: community.displayName,
        memberCount: community.memberCount
      },
      joinedCommunities: user.joinedCommunities
    });

  } catch (err) {
    console.error('❌ Failed to join community:', err);
    res.status(500).json({ error: 'Failed to join community' });
  }
});

// LEAVE COMMUNITY
router.post('/:id/leave', authMiddleware, async (req, res) => {
  try {
    const communityId = req.params.id;
    const userId = req.user.id;

    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({ error: 'Community not found' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Not a member?
    if (!community.members.includes(userId)) {
      return res.status(400).json({ error: 'You are not a member of this community' });
    }

    // ---- UPDATE COMMUNITY ----
    community.members.pull(userId);
    community.memberCount = community.members.length;
    await community.save();

    // ---- UPDATE USER ----
    user.joinedCommunities = user.joinedCommunities.filter(
      id => id.toString() !== communityId
    );

    if (user.community?.toString() === communityId) {
      user.community = null; // Remove primary community
    }

    await user.save();

    return res.json({
      success: true,
      message: 'Left community successfully',
      communityId,
      memberCount: community.memberCount,
      joinedCommunities: user.joinedCommunities
    });

  } catch (err) {
    console.error('❌ Failed to leave community:', err);
    res.status(500).json({ error: 'Failed to leave community' });
  }
});


// -----------------------------
// CREATE COMMUNITY WITH REWARD
// -----------------------------
router.post('/', authMiddleware, requireVerified, async (req, res) => {
  try {
    const { name, displayName, description, location, categories } = req.body;
    const userId = req.user.id;

    if (!name || !displayName) {
      return res.status(400).json({ error: 'Name and display name are required' });
    }

    const existingCommunity = await Community.findOne({ name: name.toLowerCase().trim() });
    if (existingCommunity) {
      return res.status(400).json({ error: 'Community with this name already exists' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Create community
    const community = new Community({
      name: name.toLowerCase().trim(),
      displayName: displayName.trim(),
      description: description || '',
      location: location || '',
      categories: categories || [],
      createdBy: userId,
      moderators: [userId],
      isApproved: false
    });

    await community.save();
// -----------------------------
// Reward user for community creation
// -----------------------------
    const activityId = `community_${userId}_${community._id}`;
    const tx = await reward(userId, COMMUNITY_CREATION_REWARD, {
      type: 'REWARD_CREATE_COMMUNITY',
      description: `Earned ${COMMUNITY_CREATION_REWARD} YKC for creating community "${community.displayName}"`,
      relatedCommunityId: community._id,
      activityId, // ensures deduplication
    });

// ✅ Now safely respond
res.status(201).json({
  success: true,
  message: 'Community created! Pending admin approval.',
  community: {
    id: community._id,
    name: community.name,
    displayName: community.displayName,
    isApproved: community.isApproved
  },
  reward: {
    coins: COMMUNITY_CREATION_REWARD,
    transaction
  },
  note: 'Your community will be visible once approved by an admin'
});

} catch (err) {
  console.error('❌ Failed to create community:', err);
  res.status(500).json({ error: 'Failed to create community' });
}
});


// ✅ Approve community (ADMIN ONLY)
router.post('/:communityId/approve', authMiddleware, async (req, res) => {
  try {
    // TODO: Add admin check middleware
    const { communityId } = req.params;
    
    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({ error: 'Community not found' });
    }
    
    community.isApproved = true;
    await community.save();
    
    res.json({
      success: true,
      message: 'Community approved successfully',
      community: {
        id: community._id,
        name: community.name,
        displayName: community.displayName,
        isApproved: true
      }
    });
  } catch (err) {
    console.error('❌ Failed to approve community:', err);
    res.status(500).json({ error: 'Failed to approve community' });
  }
});

// ✅ Reject/Delete community (ADMIN ONLY)
router.delete('/:communityId', authMiddleware, async (req, res) => {
  try {
    // TODO: Add admin check middleware
    const { communityId } = req.params;
    const { reason } = req.body;
    
    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({ error: 'Community not found' });
    }
    
    // Soft delete - just mark as inactive
    community.isActive = false;
    await community.save();
    
    res.json({
      success: true,
      message: 'Community deleted successfully',
      reason: reason || 'No reason provided'
    });
  } catch (err) {
    console.error('❌ Failed to delete community:', err);
    res.status(500).json({ error: 'Failed to delete community' });
  }
});

// ✅ Get communities the user has joined
// ✅ Get communities the user has joined
router.get('/user/joined-communities', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch communities where user is a member and community is active
    const joinedCommunities = await Community.find({
      members: userId,
      isActive: true
    })
      .sort({ name: 1 })
      .select('_id name displayName memberCount postCount location categories icon coverImage') // ADDED fields
      .lean();

    res.json({
      success: true,
      count: joinedCommunities.length,
      communities: joinedCommunities
    });
  } catch (err) {
    console.error('❌ Failed to fetch joined communities:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch joined communities' });
  }
});




// ✅ Get user's created communities
router.get('/user/my-communities', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const myCommunities = await Community.find({ 
      createdBy: userId,
      isActive: true 
    })
      .sort({ createdAt: -1 })
      .lean();
    
    res.json({
      communities: myCommunities,
      count: myCommunities.length
    });
  } catch (err) {
    console.error('❌ Failed to fetch user communities:', err);
    res.status(500).json({ error: 'Failed to retrieve your communities' });
  }
});

module.exports = router;