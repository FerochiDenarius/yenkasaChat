const Post = require("../models/post.model");
const { attachAccurateViewCounts } = require("../utils/postViewCounts");

const MAX_CANDIDATE_POOL = 1000;
const FOR_YOU_BASE_WINDOW = 14 * 24 * 60 * 60 * 1000;
const TRENDING_WINDOW = 30 * 24 * 60 * 60 * 1000;

function safeNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function toDate(value) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function hoursSince(value) {
  const createdAt = toDate(value);
  if (!createdAt) return 24;
  const diff = Date.now() - createdAt.getTime();
  return Math.max(diff / (1000 * 60 * 60), 1);
}

function candidateLimit(page, limit) {
  return Math.min(Math.max(page * limit * 6, 120), MAX_CANDIDATE_POOL);
}

function recentBoostFor(post) {
  const ageHours = hoursSince(post.createdAt);
  if (ageHours <= 1) return 60;
  if (ageHours <= 6) return 42;
  if (ageHours <= 12) return 26;
  if (ageHours <= 24) return 16;
  if (ageHours <= 48) return 8;
  return 0;
}

function communityIdFor(post) {
  return post?.communityId?._id?.toString?.()
    || post?.communityId?.id?.toString?.()
    || post?.communityId?.toString?.()
    || "";
}

function userIdFor(post) {
  return post?.userId?._id?.toString?.()
    || post?.userId?.id?.toString?.()
    || post?.userId?.toString?.()
    || "";
}

function calculateForYouScore(post, context) {
  const viewCount = Number(post.viewCount || 0);
  const likeCount = Number(post.likeCount || 0);
  const commentCount = Number(post.commentCount || 0);
  const shareCount = Number(post.shareCount || 0);
  const joinedBoost = context.joinedCommunityIds.has(communityIdFor(post)) ? 18 : 0;
  const followingBoost = context.followingIds.has(userIdFor(post)) ? 9 : 0;
  const qualityBoost = Math.min(commentCount * 0.75 + shareCount * 1.2, 22);
  return (
    (viewCount * 0.25) +
    (likeCount * 0.30) +
    (commentCount * 0.35) +
    (shareCount * 0.40) +
    (recentBoostFor(post) * 0.50) +
    joinedBoost +
    followingBoost +
    qualityBoost
  );
}

function calculateTrendingScore(post) {
  const ageHours = hoursSince(post.createdAt);
  const ageDecay = Math.pow(Math.max(ageHours, 1), 0.65);
  const viewSignal = safeNumber(post.viewCount || post.viewsCount || post.totalViews) * 10;
  const commentSignal = safeNumber(post.commentCount || post.commentsCount || post.totalComments) * 6;
  const shareSignal = safeNumber(post.shareCount || post.sharesCount || post.totalShares) * 5;
  const saveSignal = safeNumber(post.saveCount || post.savesCount || post.totalSaves) * 5;
  const likeSignal = safeNumber(post.likeCount || post.likesCount || post.totalLikes) * 2;
  const watchTimeSignal = safeNumber(post.watchTimeSeconds || post.watchTime || 0) * 0.05;
  const profileVisitSignal = safeNumber(post.profileVisitCount || post.profileVisits || 0) * 3;

  return (
    viewSignal +
    commentSignal +
    shareSignal +
    saveSignal +
    likeSignal +
    watchTimeSignal +
    profileVisitSignal
  ) / ageDecay;
}

function calculateTopScore(post) {
  return (
    (Number(post.likeCount || 0) * 1.5) +
    (Number(post.commentCount || 0) * 3) +
    (Number(post.shareCount || 0) * 4.5) +
    (Number(post.viewCount || 0) * 0.15)
  );
}

function calculatePopularScore(post) {
  return calculateTopScore(post) + (recentBoostFor(post) * 0.35);
}

function compareByDateDescending(left, right) {
  return (toDate(right.createdAt)?.getTime() || 0) - (toDate(left.createdAt)?.getTime() || 0);
}

function rankCandidates(candidates, scoreFn, page, limit) {
  const scored = candidates.map((post) => ({
    post,
    score: scoreFn(post)
  }));

  scored.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    const viewDelta = safeNumber(right.post.viewCount || right.post.viewsCount) - safeNumber(left.post.viewCount || left.post.viewsCount);
    if (viewDelta !== 0) return viewDelta;
    const commentDelta = safeNumber(right.post.commentCount || right.post.commentsCount) - safeNumber(left.post.commentCount || left.post.commentsCount);
    if (commentDelta !== 0) return commentDelta;
    const shareDelta = safeNumber(right.post.shareCount || right.post.sharesCount) - safeNumber(left.post.shareCount || left.post.sharesCount);
    if (shareDelta !== 0) return shareDelta;
    return compareByDateDescending(left.post, right.post);
  });

  const skip = (page - 1) * limit;
  return {
    posts: scored.slice(skip, skip + limit).map((entry) => entry.post),
    topScores: scored.slice(0, Math.min(scored.length, 3)).map((entry) => ({
      postId: entry.post._id?.toString?.() || "",
      score: Number(entry.score.toFixed(2))
    }))
  };
}

async function loadPosts(postFilter, sort, limit, skip = 0) {
  return Post.find(postFilter)
    .populate("userId", "username profileImage verified roleName")
    .populate("communityId", "name displayName")
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean();
}

async function getFollowingFeed({ postFilter, page, limit }) {
  const skip = (page - 1) * limit;
  const [posts, totalPosts] = await Promise.all([
    loadPosts(postFilter, { createdAt: -1 }, limit, skip),
    Post.countDocuments(postFilter)
  ]);
  await attachAccurateViewCounts(posts);
  return { posts, totalPosts, rankingSummary: [] };
}

async function getLatestFeed({ postFilter, page, limit }) {
  const skip = (page - 1) * limit;
  const [posts, totalPosts] = await Promise.all([
    loadPosts(postFilter, { createdAt: -1 }, limit, skip),
    Post.countDocuments(postFilter)
  ]);
  await attachAccurateViewCounts(posts);
  return { posts, totalPosts, rankingSummary: [] };
}

async function getForYouFeed({ postFilter, page, limit, viewerContext }) {
  const forYouFilter = {
    ...postFilter,
    createdAt: {
      $gte: new Date(Date.now() - FOR_YOU_BASE_WINDOW)
    }
  };

  const [candidates, totalPosts] = await Promise.all([
    loadPosts(forYouFilter, { createdAt: -1 }, candidateLimit(page, limit)),
    Post.countDocuments(forYouFilter)
  ]);
  await attachAccurateViewCounts(candidates);

  const ranked = rankCandidates(
    candidates,
    (post) => calculateForYouScore(post, viewerContext),
    page,
    limit
  );

  return {
    posts: ranked.posts,
    totalPosts,
    rankingSummary: ranked.topScores
  };
}

async function getTrendingFeed({ postFilter, page, limit }) {
  const trendingFilter = {
    ...postFilter,
    createdAt: {
      $gte: new Date(Date.now() - TRENDING_WINDOW)
    }
  };

  const [candidates, totalPosts] = await Promise.all([
    loadPosts(
      trendingFilter,
      { viewCount: -1, commentCount: -1, shareCount: -1, saveCount: -1, likeCount: -1, createdAt: -1 },
      candidateLimit(page, limit)
    ),
    Post.countDocuments(trendingFilter)
  ]);
  await attachAccurateViewCounts(candidates);

  const ranked = rankCandidates(candidates, calculateTrendingScore, page, limit);
  return {
    posts: ranked.posts,
    totalPosts,
    rankingSummary: ranked.topScores
  };
}

async function getTopFeed({ postFilter, page, limit }) {
  const [candidates, totalPosts] = await Promise.all([
    loadPosts(
      postFilter,
      { shareCount: -1, commentCount: -1, likeCount: -1, viewCount: -1, createdAt: -1 },
      candidateLimit(page, limit)
    ),
    Post.countDocuments(postFilter)
  ]);
  await attachAccurateViewCounts(candidates);

  const ranked = rankCandidates(candidates, calculateTopScore, page, limit);
  return {
    posts: ranked.posts,
    totalPosts,
    rankingSummary: ranked.topScores
  };
}

async function getPopularFeed({ postFilter, page, limit }) {
  const [candidates, totalPosts] = await Promise.all([
    loadPosts(
      postFilter,
      { shareCount: -1, commentCount: -1, likeCount: -1, viewCount: -1, createdAt: -1 },
      candidateLimit(page, limit)
    ),
    Post.countDocuments(postFilter)
  ]);
  await attachAccurateViewCounts(candidates);

  const ranked = rankCandidates(candidates, calculatePopularScore, page, limit);
  return {
    posts: ranked.posts,
    totalPosts,
    rankingSummary: ranked.topScores
  };
}

async function getRankedFeed({ feedMode, postFilter, page, limit, viewerContext }) {
  switch (feedMode) {
    case "following":
      return getFollowingFeed({ postFilter, page, limit });
    case "trending":
      return getTrendingFeed({ postFilter, page, limit });
    case "latest":
      return getLatestFeed({ postFilter, page, limit });
    case "top":
      return getTopFeed({ postFilter, page, limit });
    case "popular":
      return getPopularFeed({ postFilter, page, limit });
    case "for-you":
    default:
      return getForYouFeed({ postFilter, page, limit, viewerContext });
  }
}

module.exports = {
  getRankedFeed,
  calculateTrendingScore,
  compareByDateDescending
};
