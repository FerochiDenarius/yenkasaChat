import { useMemo, useState } from "react";
import { getFeed } from "../api/feed";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import PostCard from "../components/PostCard";
import { useAsync } from "../hooks/useAsync";

export default function Home() {
  const [page] = useState(1);
  const { data, loading, error, setData } = useAsync(() => getFeed(page, 10), true);

  const posts = useMemo(() => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.posts)) return data.posts;
    return [];
  }, [data]);

  function handleOptimisticLike(postId, likedByUser, likeCount) {
    setData((prev) => {
      const prevPosts = Array.isArray(prev?.posts) ? prev.posts : [];
      return {
        ...(prev || {}),
        posts: prevPosts.map((post) =>
          post._id === postId ? { ...post, likedByUser, likeCount } : post
        )
      };
    });
  }

  return (
    <main className="page page--with-nav">
      <PageHeader
        eyebrow="Yenkasa Feed"
        title="Home"
        subtitle="Fresh posts from your communities and network."
        actionLabel="Ranking"
        actionTo="/verification"
      />

      {loading ? <div className="card shimmer-block">Loading feed...</div> : null}
      {error ? <div className="error-banner">Could not load feed right now.</div> : null}

      <section className="stack">
        {posts.length ? (
          posts.map((post) => (
            <PostCard
              key={post._id}
              post={post}
              onOptimisticLike={handleOptimisticLike}
            />
          ))
        ) : (
          !loading && (
            <EmptyState
              title="No posts yet"
              description="Your feed is empty for now. Follow more communities and users to fill it."
            />
          )
        )}
      </section>
    </main>
  );
}
