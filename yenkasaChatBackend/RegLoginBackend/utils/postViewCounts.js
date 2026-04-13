const mongoose = require("mongoose");
const View = require("../models/view.model");

function toObjectId(id) {
  const value = id?.toString?.() || id;
  if (!value || !mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

async function attachAccurateViewCounts(postsOrPost) {
  const isArray = Array.isArray(postsOrPost);
  const posts = isArray ? postsOrPost : [postsOrPost].filter(Boolean);

  if (posts.length === 0) {
    return postsOrPost;
  }

  const postIds = posts
    .map(post => toObjectId(post._id))
    .filter(Boolean);

  if (postIds.length === 0) {
    return postsOrPost;
  }

  const viewCounts = await View.aggregate([
    { $match: { postId: { $in: postIds } } },
    { $group: { _id: "$postId", viewsCount: { $sum: 1 } } }
  ]);

  const countByPostId = new Map(
    viewCounts.map(row => [row._id.toString(), row.viewsCount || 0])
  );

  posts.forEach(post => {
    const id = post._id?.toString?.() || post._id;
    const countedViews = countByPostId.get(id) || 0;
    const storedViews = Number(post.viewCount) || 0;
    const referencedViews = Array.isArray(post.views) ? post.views.length : 0;

    post.viewCount = Math.max(storedViews, countedViews, referencedViews);
    delete post.views;
  });

  return postsOrPost;
}

module.exports = { attachAccurateViewCounts, toObjectId };
