// routes/community.routes.js - UPDATED WITH VERIFIED USER CREATION
const express = require('express');
const router = express.Router();
const Community = require('../models/community.model');
const User = require('../models/user.model');
const authMiddleware = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const CoinTransaction = require('../models/cointransaction.model');
const CoinSupply = require('../models/coinSupply');

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

// ✅ Get all communities (filter depends on user role)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { search, sort = 'memberCount', order = 'desc' } = req.query;

    const userId = req.user?.id;
    const user = userId ? await User.findById(userId) : null;

    let query = { isActive: true };

    /**  ✅ If not admin/developer, only show approved
    if (!user || !['admin', 'developer'].includes(user.role)) {
      query.isApproved = true;
    }
*/
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { displayName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
  
    const sortOrder = order === 'asc' ? 1 : -1;
    const sortObj = { [sort]: sortOrder };

    const communities = await Community.find(query)
      .sort(sortObj)
      .select('-moderators -rules')
      .lean();

    res.json(communities);
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

// ✅ Join a community// ✅ Join a community (up to 3)
router.post('/:communityId/join', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { communityId } = req.params;

    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({ error: 'Community not found' });
    }

    if (!community.isApproved) {
      return res.status(403).json({ error: 'This community is pending approval' });
    }

    const user = await User.findById(userId);

    // Check if already a member
    if (user.joinedCommunities.includes(communityId)) {
      return res.status(400).json({ error: 'Already a member of this community' });
    }

    // Enforce max 3 communities
    if (user.joinedCommunities.length >= 3) {
      return res.status(403).json({ error: 'You can only join up to 3 communities' });
    }

    // Add to joined list
    user.joinedCommunities.push(communityId);
    user.community = communityId; // optional: set last joined as current
    await user.save();

    // Add user to community
    if (!community.members) community.members = [];
    if (!community.members.includes(userId)) {
      community.members.push(userId);
      await community.incrementMemberCount();
      await community.save();
    }

    res.json({
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


// ✅ Leave a community
router.post('/:communityId/leave', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { communityId } = req.params;

    const user = await User.findById(userId);

    // Ensure user is in this community
    if (!user.joinedCommunities.includes(communityId)) {
      return res.status(400).json({ error: 'Not a member of this community' });
    }

    // Remove from joined list
    user.joinedCommunities = user.joinedCommunities.filter(
      id => id.toString() !== communityId
    );

    // If the user’s current community is this one, reset it
    if (user.community && user.community.toString() === communityId) {
      user.community = null;
    }

    await user.save();

    // Update community stats
    const community = await Community.findById(communityId);
    if (community) {
      if (community.members) {
        community.members = community.members.filter(id => id.toString() !== userId);
      }
      await community.decrementMemberCount();
      await community.save();
    }

    res.json({
      success: true,
      message: 'Successfully left community',
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
    await ensureSupply();
    const supply = await CoinSupply.findOneAndUpdate(
      { _id: "YENKASA_SUPPLY", totalMinted: { $lte: 100_000_000 - COMMUNITY_CREATION_REWARD } },
      { $inc: { totalMinted: COMMUNITY_CREATION_REWARD } },
      { new: true, upsert: true }
    );

    const beforeBalance = user.coinsBalance || 0;
    const afterBalance = beforeBalance + COMMUNITY_CREATION_REWARD;
    user.coinsBalance = afterBalance;
    await user.save();

    const activityId = uuidv4();
    const transaction = await CoinTransaction.create({
      transactionId: uuidv4(),
      activityId,
      fromUserId: null, // system
      toUserId: user._id,
      fromUsername: 'System',
      toUsername: user.username,
      fromWalletId: null,
      toWalletId: user.walletId,
      amount: COMMUNITY_CREATION_REWARD,
      type: 'REWARD_CREATE_COMMUNITY',
      description: `Reward for creating community ${community.displayName}`,
      fromUserBalanceBefore: null,
      fromUserBalanceAfter: null,
      toUserBalanceBefore: beforeBalance,
      toUserBalanceAfter: afterBalance,
      status: 'completed',
      referenceModel: 'Community',
      referenceId: community._id
    });

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


// ✅ Get pending communities (ADMIN ONLY - add admin middleware later)
router.get('/admin/pending', authMiddleware, async (req, res) => {
  try {
    // TODO: Add admin check middleware
    // For now, any authenticated user can see (change this in production!)
    
    const pendingCommunities = await Community.find({ 
      isApproved: false,
      isActive: true 
    })
      .populate('createdBy', 'username email profileImage verified')
      .sort({ createdAt: -1 })
      .lean();
    
    res.json({
      pendingCommunities,
      count: pendingCommunities.length
    });
  } catch (err) {
    console.error('❌ Failed to fetch pending communities:', err);
    res.status(500).json({ error: 'Failed to retrieve pending communities' });
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
router.get('/user/joined-communities', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Assuming each Community has a field like "members: [userId]"
    const joinedCommunities = await Community.find({
      members: userId,
      isActive: true
    })
      .sort({ name: 1 })
      .select('_id name description')
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