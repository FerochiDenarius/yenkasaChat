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
const { getUserCommunities } = require('../helpers/community.helper');
const allowCommunityCreation = require('../middleware/allowCommunityCreation');
const { sendNotification } = require('../services/notification.service');

function escapeRegex(value) {
  return value.toString().trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeCountry(value) {
  return (value || 'Ghana').toString().trim().toLowerCase();
}

function countryRegex(value) {
  return new RegExp(`^${escapeRegex(value || 'Ghana')}$`, 'i');
}

function countryScopedQuery(value) {
  const country = value || 'Ghana';
  if (normalizeCountry(country) === 'ghana') {
    return {
      $or: [
        { country: countryRegex(country) },
        { country: { $in: [null, ''] } }
      ]
    };
  }

  return { country: countryRegex(country) };
}

const COMMUNITY_REVIEWER_ROLES = new Set([
  'admin',
  'moderator',
  'developer',
  'junior_developer',
  'senior_developer',
]);

function normalizedRoleName(user) {
  return Permission.normalize(
    user?.roleName || user?.role?.name || user?.role || ''
  );
}

function canReviewCommunity(user) {
  return COMMUNITY_REVIEWER_ROLES.has(normalizedRoleName(user));
}

async function getCommunityReviewers() {
  return User.find({
    roleName: { $in: Array.from(COMMUNITY_REVIEWER_ROLES) }
  }).select('_id username playerId');
}



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

router.get('/public', async (req, res) => {
  try {
    const { country } = req.query;
    const query = { isApproved: true, isActive: true };

    if (country) {
      query.country = new RegExp(`^${escapeRegex(country)}$`, 'i');
    }

    const communities = await Community.find(query)
      .sort({ country: 1, state: 1, city: 1, town: 1, displayName: 1 })
      .select('_id name displayName description location categories country state city town communityLevel communityType memberCount postCount');

    res.json(communities);
  } catch (err) {
    console.error('Community fetch error:', err);
    res.status(500).json({ message: 'Server error loading communities' });
  }
});


// ✅ Get communities for the authenticated user's country
router.get('/', authMiddleware, async (req, res) => {
  try {
    const {
      search,
      state,
      city,
      town,
      sort = 'memberCount',
      order = 'desc'
    } = req.query;

    const userCountry = req.user?.country || 'Ghana';
    let query = {
      isActive: true,
      isApproved: true,
      $and: [countryScopedQuery(userCountry)]
    };

    if (state) query.state = new RegExp(`^${escapeRegex(state)}$`, 'i');
    if (city) query.city = new RegExp(`^${escapeRegex(city)}$`, 'i');
    if (town) query.town = new RegExp(`^${escapeRegex(town)}$`, 'i');

    // Optional search filter
    if (search) {
      query.$and.push({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { displayName: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { state: { $regex: search, $options: 'i' } },
          { city: { $regex: search, $options: 'i' } },
          { town: { $regex: search, $options: 'i' } }
        ]
      });
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

// ✅ Get pending communities for review
router.get('/pending', authMiddleware, async (req, res) => {
  try {
    if (!canReviewCommunity(req.user)) {
      return res.status(403).json({ error: 'Not authorized to review communities' });
    }

    const pendingCommunities = await Community.find({
      isApproved: false,
      isActive: true,
      ...countryScopedQuery(req.user.country || 'Ghana')
    })
      .populate('createdBy', 'username profileImage verified roleName')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      communities: pendingCommunities.map((community) => ({
        ...community,
        creator: community.createdBy || null,
      })),
      count: pendingCommunities.length,
    });
  } catch (err) {
    console.error('❌ Failed to fetch pending communities:', err);
    res.status(500).json({ error: 'Failed to retrieve pending communities' });
  }
});

// ✅ Get single community details
router.get('/:communityId', async (req, res, next) => {
  try {
    if (req.params.communityId === 'user') return next();

    const community = await Community.findById(req.params.communityId)
      .populate('moderators', 'username profileImage')
      .populate('createdBy', 'username profileImage verified roleName')
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

    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({ error: 'Community not found' });
    }

    if (!community.isApproved) {
      return res.status(403).json({ error: 'This community is pending approval' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (normalizeCountry(community.country) !== normalizeCountry(user.country)) {
      return res.status(403).json({
        error: `This community is not available for ${user.country || 'your country'}`
      });
    }

    if (user.joinedCommunities.includes(communityId)) {
      return res.status(400).json({ error: 'Already a member of this community' });
    }

    if (user.community?.toString() === communityId) {
      return res.status(400).json({ error: 'This is already your primary community' });
    }

    if (user.joinedCommunities.length >= 5) {
      return res.status(403).json({
        error: 'You can only join up to 5 communities',
        message: 'You can select 2 communities at signup and join 3 more in the app.'
      });
    }

    // ---- UPDATE USER ----
    if (!user.joinedCommunities.includes(communityId)) {
      user.joinedCommunities.push(communityId);
    }
    await user.save();

    // ---- UPDATE COMMUNITY ----
    if (!community.members.includes(userId)) {
      community.members.push(userId);
      community.memberCount = community.members.length;
      community.markModified('members');
      await community.save();
    }

    // ⭐ Reward user 5 YKC for joining
    const activityId = `join_community_${userId}_${communityId}_${Date.now()}`;

    const rewardTx = await rewardService.reward(userId, 5, {
      type: "REWARD_JOIN_COMMUNITY",
      description: `Joined community: ${community.displayName}`,
      relatedCommunityId: communityId,
      activityId,
    });

    return res.json({
      success: true,
      message: `Joined ${community.displayName} successfully`,
      community: {
        id: community._id,
        name: community.name,
        displayName: community.displayName,
        memberCount: community.memberCount
      },
      joinedCommunities: user.joinedCommunities,
      reward: {
        coins: 5,
        transaction: rewardTx
      }
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

    // Proper membership check
    const isMember = community.members.some(m => m.toString() === userId);
    if (!isMember) {
      return res.status(400).json({ error: 'You are not a member of this community' });
    }

    // ---- UPDATE COMMUNITY ----
    community.members = community.members.filter(m => m.toString() !== userId);
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

    // ⭐ ADD ACTIVITY ID (no reward)
    const activityId = `leave_community_${userId}_${communityId}_${Date.now()}`;

    return res.json({
      success: true,
      message: 'Left community successfully',
      communityId,
      memberCount: community.memberCount,
      joinedCommunities: user.joinedCommunities,
      activityId // 👉 included in response
    });

  } catch (err) {
    console.error('❌ Failed to leave community:', err);
    res.status(500).json({ error: 'Failed to leave community' });
  }
});



function normalizeRole(value) {
  return (value || '').toString().trim().toLowerCase().replace(/\s+/g, '_');
}

function canManageCommunity(user, community) {
  const roleName = normalizeRole(user.roleName || user.role?.role || user.role);
  const privilegedRoles = new Set([
    'admin',
    'moderator',
    'developer',
    'junior_developer',
    'senior_developer',
  ]);

  if (privilegedRoles.has(roleName)) return true;
  if (community.createdBy?.toString() === user.id?.toString()) return true;
  return Array.isArray(community.moderators) &&
    community.moderators.some((id) => id.toString() === user.id?.toString());
}

// -----------------------------
// CREATE COMMUNITY (FINAL FIXED VERSION)
// -----------------------------
async function createCommunityHandler(req, res) {
  try {
    const {
      name,
      displayName,
      description,
      location,
      categories,
      country: requestedCountry,
      state,
      city,
      town,
      communityLevel
    } = req.body;
    const userId = req.user.id;

    if (!name || !displayName) {
      return res.status(400).json({ error: "Name and display name are required" });
    }

    // Ensure unique community name
    const existingCommunity = await Community.findOne({ name: name.toLowerCase().trim() });
    if (existingCommunity) {
      return res.status(400).json({ error: "Community with this name already exists" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const userCountry = user.country || "Ghana";
    if (requestedCountry && normalizeCountry(requestedCountry) !== normalizeCountry(userCountry)) {
      return res.status(403).json({
        error: `You can only create communities in ${userCountry} for now`
      });
    }

    const roleName = normalizedRoleName(user);
    const autoApprove = COMMUNITY_REVIEWER_ROLES.has(roleName);

    // Create new community
    const community = await Community.create({
      name: name.toLowerCase().trim(),
      displayName: displayName.trim(),
      description: description || "",
      location: location || "",
      categories: categories || [],
      country: userCountry,
      state: state || "",
      city: city || "",
      town: town || "",
      communityLevel: communityLevel || (location ? "town" : "interest"),
      createdBy: userId,
      moderators: [userId],
      isApproved: autoApprove,
    });

    // ---------------------------------------------
    // ⭐ FIXED — Use rewardService + unique activityId
    // ---------------------------------------------
    const activityId = `create_community_${userId}_${community._id}_${Date.now()}`;

    const tx = await rewardService.reward(userId, COMMUNITY_CREATION_REWARD, {
      type: "REWARD_CREATE_COMMUNITY",
      description: `Created community: ${community.displayName}`,
      relatedCommunityId: community._id,
      activityId,
    });

    if (!autoApprove) {
      const reviewers = await getCommunityReviewers();
      for (const reviewer of reviewers) {
        if (String(reviewer._id) === String(userId)) continue;
        await sendNotification({
          type: 'community_pending',
          senderId: userId,
          receiverId: reviewer._id,
          activityId: `community_pending_${community._id}`,
          targetType: 'community',
          targetId: community._id.toString(),
          message: 'A new community is awaiting approval.',
          push: true,
          pushTitle: 'Pending Community',
          pushBody: 'A new community is waiting for approval.',
          pushData: { communityId: community._id.toString() }
        });
      }
    }

    return res.status(201).json({
      success: true,
      message: autoApprove
        ? "Community created and approved successfully."
        : "Community created! Pending admin approval.",
      community: {
        id: community._id,
        name: community.name,
        displayName: community.displayName,
        isApproved: community.isApproved,
      },
      reward: {
        coins: COMMUNITY_CREATION_REWARD,
        transaction: tx,
      },
      note: autoApprove
        ? "Your community is live and visible now."
        : "Your community will be visible once approved by an admin",
    });

  } catch (err) {
    console.error("❌ Failed to create community:", err);
    return res.status(500).json({ error: "Failed to create community" });
  }
}

router.post("/", authMiddleware, allowCommunityCreation, createCommunityHandler);
router.post("/create", authMiddleware, allowCommunityCreation, createCommunityHandler);

router.put("/:communityId", authMiddleware, async (req, res) => {
  try {
    const { communityId } = req.params;
    const community = await Community.findById(communityId);

    if (!community) {
      return res.status(404).json({ error: "Community not found" });
    }

    if (!canManageCommunity(req.user, community)) {
      return res.status(403).json({
        error: "Permission denied",
        message: "Only admins, moderators, developers, the creator, or assigned moderators can edit this community"
      });
    }

    const {
      name,
      displayName,
      description,
      location,
      categories,
      state,
      city,
      town,
      communityLevel,
      isPrivate,
      isActive,
    } = req.body;

    if (displayName !== undefined && displayName.toString().trim() === "") {
      return res.status(400).json({ error: "Display name cannot be empty" });
    }

    if (name !== undefined) {
      const normalizedName = name.toString().toLowerCase().trim();
      const existingCommunity = await Community.findOne({
        _id: { $ne: communityId },
        name: normalizedName
      });
      if (existingCommunity) {
        return res.status(400).json({ error: "Community with this name already exists" });
      }
      community.name = normalizedName;
    }

    if (displayName !== undefined) community.displayName = displayName.toString().trim();
    if (description !== undefined) community.description = description || "";
    if (location !== undefined) community.location = location || "";
    if (Array.isArray(categories)) community.categories = categories;
    if (state !== undefined) community.state = state || "";
    if (city !== undefined) community.city = city || "";
    if (town !== undefined) community.town = town || "";
    if (communityLevel !== undefined) community.communityLevel = communityLevel || null;
    if (typeof isPrivate === "boolean") community.isPrivate = isPrivate;
    if (typeof isActive === "boolean" && canManageCommunity(req.user, community)) {
      community.isActive = isActive;
    }

    await community.save();

    return res.json({
      success: true,
      message: "Community updated successfully",
      community: {
        id: community._id,
        name: community.name,
        displayName: community.displayName,
        description: community.description,
        location: community.location,
        categories: community.categories,
        isPrivate: community.isPrivate,
        isActive: community.isActive,
        isApproved: community.isApproved,
      }
    });
  } catch (err) {
    console.error("❌ Failed to update community:", err);
    return res.status(500).json({ error: "Failed to update community" });
  }
});

// ✅ Approve community (ADMIN ONLY)
router.post('/:communityId/approve', authMiddleware, async (req, res) => {
  try {
    if (!canReviewCommunity(req.user)) {
      return res.status(403).json({ error: 'Not authorized to approve communities' });
    }

    const adminId = req.user.id;
    const { communityId } = req.params;

    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({ error: 'Community not found' });
    }

    // Prevent double approvals
    if (community.isApproved) {
      return res.status(400).json({ error: 'Community already approved' });
    }

    community.isApproved = true;
    await community.save();

    // ⭐ Reward community creator (10 YKC)
    const activityId = `approve_community_${adminId}_${communityId}_${Date.now()}`;

    const rewardTx = await rewardService.reward(community.createdBy, 10, {
      type: "REWARD_COMMUNITY_APPROVED",
      description: `Your community '${community.displayName}' was approved`,
      relatedCommunityId: communityId,
      activityId,
    });

    await sendNotification({
      type: 'community_approved',
      senderId: adminId,
      receiverId: community.createdBy,
      activityId,
      targetType: 'community',
      targetId: community._id.toString(),
      message: `Your community '${community.displayName}' has been approved and is now visible.`,
      push: true,
      pushTitle: 'Community Approved',
      pushBody: `Your community '${community.displayName}' is now live.`,
      pushData: { communityId: community._id.toString() }
    });

    return res.json({
      success: true,
      message: 'Community approved successfully',
      community: {
        id: community._id,
        name: community.name,
        displayName: community.displayName,
        isApproved: true
      },
      reward: {
        coins: 10,
        transaction: rewardTx
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
    if (!canReviewCommunity(req.user)) {
      return res.status(403).json({ error: 'Not authorized to reject communities' });
    }

    const adminId = req.user.id;
    const { communityId } = req.params;
    const { reason } = req.body;

    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({ error: 'Community not found' });
    }

    // Soft delete - mark inactive
    community.isActive = false;
    await community.save();

    // ⭐ Add activity ID for metrics tracking
    const activityId = `delete_community_${adminId}_${communityId}_${Date.now()}`;

    await sendNotification({
      type: 'community_rejected',
      senderId: adminId,
      receiverId: community.createdBy,
      activityId,
      targetType: 'community',
      targetId: community._id.toString(),
      message: reason
        ? `Your community '${community.displayName}' was rejected: ${reason}`
        : `Your community '${community.displayName}' was rejected.`,
      push: true,
      pushTitle: 'Community Rejected',
      pushBody: reason
        ? `Reason: ${reason}`
        : `Your community '${community.displayName}' was rejected.`,
      pushData: { communityId: community._id.toString() }
    });

    return res.json({
      success: true,
      message: 'Community deleted successfully',
      reason: reason || 'No reason provided',
      activityId // ← added here
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
    const userCountry = req.user.country || 'Ghana';

    // Fetch communities where user is a member and community is active
    const joinedCommunities = await Community.find({
      members: userId,
      isActive: true,
      isApproved: true,
      ...countryScopedQuery(userCountry)
    })
      .sort({ name: 1 })
      .select('_id name displayName memberCount postCount location categories icon coverImage country state city town communityLevel') // ADDED fields
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

// Fetch the user's primary (registration) community
router.get('/user/community', authMiddleware, async (req, res) => {
    console.log("📌 [GET /user/community] Request received");
    console.log("👉 Authenticated user ID:", req.user.id);

    try {
        const user = await User.findById(req.user.id).lean();
        console.log("🔍 Loaded user:", user);

        if (!user) {
            console.log("❌ User not found in DB");
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        if (!user.community) {
            console.log("⚠️ User has NO primary community set (user.community is null)");
            return res.json({ success: true, community: null });
        }

        console.log("➡️ User primary community ID:", user.community);

        const community = await Community.findOne({
            _id: user.community,
            isActive: true,
            isApproved: true,
            ...countryScopedQuery(user.country || "Ghana")
        })
            .select('_id name displayName memberCount location country state city town communityLevel')
            .lean();

        console.log("🏛️ Loaded primary community:", community);

        if (!community) {
            console.log("❌ Primary community not found in DB for ID:", user.community);
            return res.status(404).json({ success: false, error: 'Community not found' });
        }

        console.log("✅ Returning primary community to client");
        res.json({ success: true, community });
        
    } catch (err) {
        console.error("💥 ERROR in /user/community:", err);
        res.status(500).json({ success: false, error: 'Failed to fetch community' });
    }
});

router.get('/user/all-communities', authMiddleware, async (req, res) => {
  console.log("📌 [GET /user/all-communities] Request received");
  const userId = req.user.id;
  console.log("👉 Authenticated user ID:", userId);

  try {
    const user = await User.findById(userId).lean();
    console.log("🔍 Loaded user:", user);

    if (!user) {
      console.log("❌ User not found in DB");
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const userCountry = user.country || 'Ghana';
    const finalCommunities = [];

    // 1️⃣ Registration community
    if (user.community) {
      console.log("➡️ Fetching registration community:", user.community);

      const primary = await Community.findOne({
        _id: user.community,
        isActive: true,
        isApproved: true,
        ...countryScopedQuery(userCountry)
      })
        .select('_id name displayName memberCount postCount location categories icon coverImage country state city town communityLevel')
        .lean();

      console.log("🏛️ Loaded primary:", primary);

      if (primary) {
        finalCommunities.push({
          ...primary,
          isRegistration: true,
          isJoined: true
        });
        console.log("✅ Added primary community to finalCommunities");
      } else {
        console.log("⚠️ Primary community reference exists but not found in DB");
      }
    } else {
      console.log("⚠️ User has NO primary community assigned");
    }

    // 2️⃣ Joined communities
    console.log("➡️ Fetching joined communities for user:", userId);

    const joined = await Community.find({
      members: userId,
      isActive: true,
      isApproved: true,
      ...countryScopedQuery(userCountry)
    })
      .sort({ name: 1 })
      .select('_id name displayName memberCount postCount location categories icon coverImage country state city town communityLevel')
      .lean();

    console.log(`📦 Joined communities found: ${joined.length}`);
    console.log("🔍 Joined list:", joined);

    // 3️⃣ Add joined communities except primary
    joined.forEach(c => {
      if (c._id.toString() !== user.community?.toString()) {
        console.log("➕ Adding joined community:", c._id);
        finalCommunities.push({
          ...c,
          isRegistration: false,
          isJoined: true
        });
      } else {
        console.log("⏭️ Skipping primary (already added):", c._id);
      }
    });

    console.log("✅ Final communities prepared:", finalCommunities);

    return res.json({
      success: true,
      count: finalCommunities.length,
      communities: finalCommunities
    });

  } catch (err) {
    console.error("💥 ERROR in /user/all-communities:", err);
    res.status(500).json({ success: false, error: 'Failed to fetch user communities' });
  }
});


// ✅ Get user's created communities
router.get('/user/my-communities', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const myCommunities = await Community.find({ 
      createdBy: userId,
      isActive: true,
      ...countryScopedQuery(req.user.country || 'Ghana')
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
