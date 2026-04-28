import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/client";
import BottomNav from "../components/feed/BottomNav";
import PostCard from "../components/feed/PostCard";
import "../styles/feed.css";

export default function PostDetails() {
  const navigate = useNavigate();
  const { postId } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    if (!postId) {
      setError("Post not found.");
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setError("");

    api
      .get(`/posts/${postId}`)
      .then(({ data }) => {
        if (!active) return;
        setPost(data || null);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError?.response?.data?.error || "Could not load this post.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [postId]);

  function handleUpdate(_, patch) {
    setPost((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  return (
    <main className="page page--with-nav">
      <header className="post-details-header">
        <button
          type="button"
          className="post-details-header__back"
          onClick={() => navigate(-1)}
        >
          ←
        </button>
        <div>
          <div className="page-header__eyebrow">Post</div>
          <h1>Post Details</h1>
          <p className="muted">View the full conversation around this post.</p>
        </div>
      </header>

      {loading ? <div className="feed-status-card">Loading post...</div> : null}
      {error ? <div className="feed-error-card">{error}</div> : null}
      {!loading && !error && post ? (
        <PostCard post={post} onUpdate={handleUpdate} detailMode />
      ) : null}

      <BottomNav />
    </main>
  );
}
