const assert = require("node:assert/strict");
const test = require("node:test");

const { calculateTrendingScore, compareByDateDescending } = require("../services/feedRanking.service");

test("latest comparator sorts newest posts first", () => {
  const newer = { _id: "newer", createdAt: "2026-06-03T12:00:00.000Z" };
  const older = { _id: "older", createdAt: "2026-06-01T12:00:00.000Z" };

  assert.ok(compareByDateDescending(older, newer) > 0);
  assert.ok(compareByDateDescending(newer, older) < 0);
});

test("trending favors fresh viewed and commented posts over old weak posts", () => {
  const now = Date.now();
  const freshStrongPost = {
    _id: "fresh-strong",
    createdAt: new Date(now - 60 * 60 * 1000).toISOString(),
    viewCount: 500,
    commentCount: 50,
    shareCount: 20,
    likeCount: 80,
  };
  const oldWeakPost = {
    _id: "old-weak",
    createdAt: new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString(),
    viewCount: 80,
    commentCount: 5,
    shareCount: 1,
    likeCount: 15,
  };

  assert.ok(calculateTrendingScore(freshStrongPost) > calculateTrendingScore(oldWeakPost));
});

test("trending uses views as the first signal and comments as the tie checker", () => {
  const createdAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const highViews = {
    _id: "high-views",
    createdAt,
    viewCount: 1000,
    commentCount: 5,
    shareCount: 1,
  };
  const highCommentsLowViews = {
    _id: "high-comments-low-views",
    createdAt,
    viewCount: 100,
    commentCount: 60,
    shareCount: 1,
  };

  assert.ok(calculateTrendingScore(highViews) > calculateTrendingScore(highCommentsLowViews));
});
