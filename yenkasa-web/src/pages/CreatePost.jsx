import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getJoinedCommunities, getPrimaryCommunity } from "../api/communities";
import { createPost } from "../api/posts";
import { handleDynamicImageError, staticImage } from "../utils/images";
import { getStoredUser } from "../utils/storage";
import "../styles/create-post.css";

const styles = [
  { id: "plain", label: "Aa", color: "#FFFFFF", text: "#080B22" },
  { id: "sun", label: "Aa", color: "#FFD447", text: "#FFFFFF" },
  { id: "green", label: "Aa", color: "#12B391", text: "#FFFFFF" },
  { id: "blue", label: "Aa", color: "#2E6CE8", text: "#FFFFFF" },
  { id: "pink", label: "Aa", color: "#E24395", text: "#FFFFFF" },
  { id: "purple", label: "Aa", color: "#8D43E8", text: "#FFFFFF" },
  { id: "red", label: "Aa", color: "#EF3131", text: "#FFFFFF" },
  { id: "night", label: "Aa", color: "#111827", text: "#FFFFFF" },
];

function getInitialTheme() {
  return "light";
}

export default function CreatePost() {
  const navigate = useNavigate();
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const user = useMemo(() => getStoredUser() || {}, []);
  const [theme] = useState(getInitialTheme);
  const [text, setText] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [selectedStyle, setSelectedStyle] = useState(styles[0]);
  const [communities, setCommunities] = useState([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState("");
  const [images, setImages] = useState([]);
  const [video, setVideo] = useState(null);
  const [audio, setAudio] = useState(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      getPrimaryCommunity().catch(() => ({ community: null })),
      getJoinedCommunities().catch(() => ({ communities: [] })),
    ])
      .then(([primaryData, joinedData]) => {
        if (!active) return;
        const items = mergeCommunities(
          primaryData?.community,
          Array.isArray(joinedData?.communities) ? joinedData.communities : []
        );
        setCommunities(items);
        setSelectedCommunityId(String(items[0]?._id || items[0]?.id || ""));
      })
      .catch(() => setCommunities([]));

    return () => {
      active = false;
    };
  }, [user]);

  const mediaPreview = useMemo(() => {
    const files = [...images, video, audio].filter(Boolean);
    return files.map((file) => ({
      name: file.name,
      type: file.type,
      url: URL.createObjectURL(file),
    }));
  }, [images, video, audio]);

  useEffect(() => {
    return () => {
      mediaPreview.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [mediaPreview]);

  const charsLeft = text.length;
  const selectedCommunity = communities.find(
    (community) => String(community?._id || community?.id || "") === selectedCommunityId
  );
  const communityName = selectedCommunity?.displayName || selectedCommunity?.name || "";
  const canPost = Boolean(text.trim() || images.length || video || audio) && Boolean(communityName);
  const avatar =
    user?.profileImage ||
    user?.profilePicUrl ||
    user?.avatar ||
    staticImage("default.png");
  const username = user?.username || "Yenkasa";
  const selectedCommunityImage =
    selectedCommunity?.image ||
    selectedCommunity?.icon ||
    selectedCommunity?.coverImage ||
    selectedCommunity?.avatar ||
    "";

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canPost || submitting) return;
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const response = await createPost({
        text,
        communityId: selectedCommunityId,
        communityName,
        visibility,
        textBackgroundColor: selectedStyle.id === "plain" ? "" : selectedStyle.color,
        postType: video ? "video" : audio ? "audio" : images.length ? "image" : "text",
        images,
        video,
        audio,
        location: locationEnabled ? user?.location || "" : "",
      });
      setMessage(response?.message || "Post submitted.");
      window.setTimeout(() => navigate("/", { replace: true }), 900);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error ||
          requestError?.response?.data?.message ||
          "Could not create post."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="create-post-page" data-theme={theme}>
      <form className="create-post-shell" onSubmit={handleSubmit}>
        <header className="create-post-top">
          <button type="button" className="create-post-icon" onClick={() => navigate(-1)} aria-label="Close">
            ×
          </button>
          <div className="create-post-title">
            <h1>Create Post</h1>
            <p>Share your vibe with the community ✨</p>
          </div>
          <div className="create-post-top__actions">
            <button type="button" className="create-post-pill create-post-pill--draft">
              Drafts
            </button>
          </div>
        </header>

        <section className="composer-card">
          <div className="composer-card__head">
            <div className="composer-author">
              <img
                src={avatar}
                alt={username}
                onError={handleDynamicImageError}
              />
              <div>
                <strong>{username}</strong>
                <label className="composer-community-inline">
                  <span>♙</span>
                  <select value={selectedCommunityId} onChange={(event) => setSelectedCommunityId(event.target.value)}>
                    {communities.length ? (
                      communities.map((community) => {
                        const id = String(community._id || community.id || "");
                        const name = community.displayName || community.name;
                        return (
                          <option value={id} key={id || name}>
                            {name}
                          </option>
                        );
                      })
                    ) : (
                      <option value="">Select community</option>
                    )}
                  </select>
                </label>
              </div>
            </div>

            <label className="visibility-select">
              <span>{visibility === "public" ? "◎" : "◌"}</span>
              <select value={visibility} onChange={(event) => setVisibility(event.target.value)}>
                <option value="public">Public</option>
                <option value="followers">Followers</option>
                <option value="private">Private</option>
              </select>
            </label>
          </div>

          <label
            className="composer-textarea-wrap"
            style={{
              "--post-bg": selectedStyle.color,
              "--post-text": selectedStyle.text,
            }}
          >
            <textarea
              value={text}
              maxLength={500}
              onChange={(event) => setText(event.target.value)}
              placeholder="What’s on your mind?"
            />
          </label>

          {mediaPreview.length ? (
            <div className="composer-media-preview">
              {mediaPreview.map((item) =>
                item.type.startsWith("image/") ? (
                  <img
                    src={item.url}
                    alt={item.name}
                    key={item.url}
                    onError={handleDynamicImageError}
                  />
                ) : item.type.startsWith("video/") ? (
                  <video
                    src={item.url}
                    key={item.url}
                    controls
                    muted
                    playsInline
                    preload="metadata"
                    aria-label={item.name}
                  />
                ) : (
                  <div className="composer-media-file" key={item.url}>
                    <span>♪</span>
                    <strong>{item.name}</strong>
                  </div>
                )
              )}
            </div>
          ) : null}

          <div className="composer-tools">
            <button type="button" className="composer-tool composer-tool--text" aria-label="Text style">
              Aa
            </button>
            <button type="button" className="composer-tool" aria-label="Emoji">
              ☺
            </button>
            <button type="button" className="composer-tool" aria-label="Tags">
              #
            </button>
            <button
              type="button"
              className={`composer-tool${locationEnabled ? " is-active" : ""}`}
              onClick={() => setLocationEnabled((value) => !value)}
              aria-label="Location"
            >
              ⌖
            </button>
            <span className="composer-count">{charsLeft}/500</span>
          </div>
        </section>

        <section className="post-style-card">
          <div className="section-heading">
            <h2>Post style</h2>
            <button type="button">See more</button>
          </div>
          <div className="style-strip">
            {styles.map((style) => (
              <button
                type="button"
                className={`style-swatch${selectedStyle.id === style.id ? " is-selected" : ""}`}
                style={{ "--swatch-bg": style.color, "--swatch-text": style.text }}
                onClick={() => setSelectedStyle(style)}
                key={style.id}
              >
                Aa
              </button>
            ))}
          </div>
        </section>

        <section className="add-post-card">
          <h2>Add to your post</h2>
          <div className="add-post-actions">
            <AddButton label="Photo" icon="▧" tone="green" onClick={() => imageInputRef.current?.click()} />
            <AddButton label="Video" icon="▶" tone="blue" onClick={() => videoInputRef.current?.click()} />
            <AddButton label="Audio" icon="♪" tone="pink" onClick={() => audioInputRef.current?.click()} />
            <AddButton label="Poll" icon="▥" tone="orange" disabled />
            <AddButton label="Event" icon="▦" tone="purple" disabled />
          </div>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => setImages(Array.from(event.target.files || []).slice(0, 10))}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            hidden
            onChange={(event) => setVideo(event.target.files?.[0] || null)}
          />
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            hidden
            onChange={(event) => setAudio(event.target.files?.[0] || null)}
          />
        </section>

        <section className="community-section">
          <h2>Select Community</h2>
          <label className="community-select-card">
            <span className="community-select-card__avatar">
              {selectedCommunityImage ? (
                <img src={selectedCommunityImage} alt="" onError={handleDynamicImageError} />
              ) : (
                (communityName || "Y").slice(0, 2).toUpperCase()
              )}
            </span>
            <span>
              <strong>{communityName || "Select Community"}</strong>
              <small>{selectedCommunityMeta(communities, communityName)}</small>
            </span>
            <b aria-hidden="true">⌄</b>
            <select value={selectedCommunityId} onChange={(event) => setSelectedCommunityId(event.target.value)}>
              {communities.map((community) => {
                const id = String(community._id || community.id || "");
                const name = community.displayName || community.name;
                return (
                  <option value={id} key={id || name}>
                    {name}
                  </option>
                );
              })}
            </select>
          </label>
        </section>

        <button type="button" className="kind-card">
          <span>★</span>
          <span>
            <strong>Be kind and respectful.</strong>
            <small>Let’s keep the community positive!</small>
          </span>
          <b>›</b>
        </button>

        {error ? <div className="create-post-error">{error}</div> : null}
        {message ? <div className="create-post-success">{message}</div> : null}

        <footer className="create-post-footer">
          <button type="submit" className="post-submit" disabled={!canPost || submitting}>
            <span>➤</span>
            {submitting ? "Posting..." : "Post"}
          </button>
          <button type="button" className="schedule-button" disabled>
            <span>◷</span>
            Schedule
          </button>
        </footer>
      </form>
    </main>
  );
}

function AddButton({ label, icon, tone, onClick, disabled = false }) {
  return (
    <button type="button" className={`add-button add-button--${tone}`} onClick={onClick} disabled={disabled}>
      <span>{icon}</span>
      <small>{label}</small>
    </button>
  );
}

function selectedCommunityMeta(communities, communityName) {
  const selected = communities.find(
    (community) => (community.displayName || community.name) === communityName
  );
  const members = Number(selected?.memberCount || 0);
  const count =
    members >= 1000 ? `${(members / 1000).toFixed(members >= 10000 ? 1 : 0)}K` : String(members);
  return `${count} members · ${selected?.communityType || "Public"}`;
}

function mergeCommunities(primary, joined) {
  const ordered = [];
  const seen = new Set();

  [primary, ...(joined || [])].forEach((community) => {
    if (!community) return;
    const id = String(community._id || community.id || community.name || "");
    if (!id || seen.has(id)) return;
    seen.add(id);
    ordered.push(community);
  });

  return ordered;
}
