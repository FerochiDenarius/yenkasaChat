// helpers/community.helper.js (or in your route file)
const User = require('../models/user.model');
const Community = require('../models/community.model');

async function getUserCommunities(userId) {
  const user = await User.findById(userId).lean();
  if (!user) throw new Error('User not found');

  const communityIds = [
    ...(user.community ? [user.community] : []),
    ...(user.joinedCommunities || [])
  ];
  const createdCommunityIds = await Community.find({
    createdBy: userId,
    isActive: true,
    isApproved: true
  }).distinct('_id');
  const uniqueCommunityIds = [...new Set(
    [...communityIds, ...createdCommunityIds]
      .filter(Boolean)
      .map(id => id.toString())
  )];

  if (!uniqueCommunityIds.length) return [];

  const communities = await Community.find({
    _id: { $in: uniqueCommunityIds },
    isActive: true,
    isApproved: true
  })
    .select('_id name displayName memberCount postCount location categories icon coverImage country state city town communityLevel')
    .lean();

  return communities.map((community) => ({
    ...community,
    isRegistration: user.community?.toString() === community._id.toString(),
    isJoined: true,
    isMember: true
  }));
}

module.exports = { getUserCommunities };
