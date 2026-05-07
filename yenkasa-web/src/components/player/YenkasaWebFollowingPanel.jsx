import { memo, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { formatRelativeTime } from "../../utils/format";
import { handleStaticImageError, staticImage } from "../../utils/images";

function YenkasaWebFollowingPanel({ posts = [] }) {
  const navigate = useNavigate();
  const people = useMemo(() => buildFollowingItems(posts), [posts]);

  if (!people.length) return null;

  return (
    <aside className="player-following-panel" aria-label="Following">
      <header>
        <strong>Following</strong>
        <span>⌄</span>
      </header>
      <div className="player-following-panel__list">
        {people.map((person) => (
          <button
            type="button"
            className="player-following-user"
            key={person.id}
            onClick={() => person.id && navigate(`/profile/${person.id}`)}
          >
            <img src={person.avatar || staticImage("default.png")} alt="" loading="lazy" onError={(event) => handleStaticImageError(event, "default.png")} />
            <span>
              <strong>@{person.username}</strong>
              <small><i />{person.time}</small>
            </span>
          </button>
        ))}
      </div>
      <button type="button" className="player-following-panel__view-all" onClick={() => navigate("/contacts")}>
        View All <span>›</span>
      </button>
    </aside>
  );
}

function buildFollowingItems(posts) {
  const seen = new Set();
  const items = [];

  posts.forEach((post) => {
    const author = post?.userId || post?.author || {};
    const id = author?._id || author?.id || post?.authorId || post?.username;
    if (!id || seen.has(String(id))) return;
    seen.add(String(id));
    items.push({
      id,
      username: author?.username || post?.username || "yenkasa",
      avatar: author?.profileImage || author?.profileImageUrl || author?.avatar,
      time: post?.createdAt ? formatRelativeTime(post.createdAt).replace(/^about /, "") : "Now",
      followed: author?.isFollowing || post?.isFollowing || post?.communityId?.isJoined,
    });
  });

  const followed = items.filter((item) => item.followed);
  return (followed.length ? followed : items).slice(0, 5);
}

export default memo(YenkasaWebFollowingPanel);
