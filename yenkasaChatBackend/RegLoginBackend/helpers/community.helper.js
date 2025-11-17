// helpers/community.helper.js (or in your route file)
const User = require('../models/user.model');
const Community = require('../models/community.model');

async function getUserCommunities(userId) {
  const user = await User.findById(userId).lean();
  if (!user) throw new Error('User not found');

  const communities = [];

  // Primary (registration) community
  if (user.community) {
    const primary = await Community.findById(user.community)
      .select('_id name displayName memberCount location')
      .lean();
    if (primary) {
      communities.push({
        ...primary,
        isRegistration: true
      });
    }
  }

  // Other joined communities
  if (user.joinedCommunities?.length) {
    const otherIds = user.joinedCommunities.filter(
      cId => cId.toString() !== user.community?.toString()
    );

    if (otherIds.length) {
      const joined = await Community.find({ _id: { $in: otherIds }, isActive: true })
        .select('_id name displayName memberCount location')
        .lean();

      joined.forEach(c => communities.push({ ...c, isRegistration: false }));
    }
  }

  return communities;
}

module.exports = { getUserCommunities };
