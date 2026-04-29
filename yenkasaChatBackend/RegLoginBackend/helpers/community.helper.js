// helpers/community.helper.js (or in your route file)
const User = require('../models/user.model');
const Community = require('../models/community.model');

function escapeRegex(value) {
  return value.toString().trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countryRegex(value) {
  return new RegExp(`^${escapeRegex(value || 'Ghana')}$`, 'i');
}

async function getUserCommunities(userId) {
  const user = await User.findById(userId).lean();
  if (!user) throw new Error('User not found');
  const userCountry = user.country || 'Ghana';

  const communityIds = [
    ...(user.community ? [user.community] : []),
    ...(user.joinedCommunities || [])
  ];
  const createdCommunityIds = await Community.find({
    createdBy: userId,
    isActive: true,
    isApproved: true,
    country: countryRegex(userCountry)
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
    isApproved: true,
    country: countryRegex(userCountry)
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
