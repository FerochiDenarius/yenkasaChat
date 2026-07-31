import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getActiveLivestreams,
  getLivestreamMetrics,
  giftLivestream,
  joinLivestream,
} from "../api/live";
import { handleDynamicImageError, staticImage } from "../utils/images";
import "../styles/live.css";

const AGORA_WEB_SDK_URL = "https://download.agora.io/sdk/release/AgoraRTC_N-4.24.5.js";
const GIFTS = [
  { key: "love", label: "Love", amount: 5 },
  { key: "fire", label: "Fire", amount: 10 },
  { key: "crown", label: "Crown", amount: 50 },
  { key: "rocket", label: "Rocket", amount: 100 },
];

let agoraSdkPromise = null;

export default function LiveStream() {
  const { streamId } = useParams();
  const navigate = useNavigate();
  const [streams, setStreams] = useState([]);
  const [stream, setStream] = useState(null);
  const [agora, setAgora] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [giftBusy, setGiftBusy] = useState("");
  const [shareStatus, setShareStatus] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    setStatus("");

    if (!streamId) {
      getActiveLivestreams()
        .then((data) => {
          if (!mounted) return;
          setStreams(Array.isArray(data?.streams) ? data.streams : []);
        })
        .catch((requestError) => {
          if (!mounted) return;
          setError(requestError?.response?.data?.message || "Could not load live streams.");
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
      return () => {
        mounted = false;
      };
    }

    Promise.all([
      joinLivestream(streamId, "audience"),
      getLivestreamMetrics(streamId).catch(() => null),
    ])
      .then(([joinData, metricsData]) => {
        if (!mounted) return;
        setStream(joinData?.stream || null);
        setAgora(joinData?.agora ? {
          ...joinData.agora,
          channelName: joinData?.stream?.agoraChannel || joinData.agora.channelName || ""
        } : null);
        setMetrics(metricsData?.metrics || null);
        setStatus("Connecting to live video...");
      })
      .catch((requestError) => {
        if (!mounted) return;
        setError(
          requestError?.response?.data?.message ||
            requestError?.response?.data?.error ||
            "Could not join this livestream."
        );
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [streamId]);

  const shareUrl = useMemo(
    () => (streamId ? `https://www.yenkasa.xyz/live/${streamId}` : "https://www.yenkasa.xyz/live"),
    [streamId]
  );

  async function handleGift(giftKey) {
    if (!streamId || giftBusy) return;
    setGiftBusy(giftKey);
    setError("");
    try {
      await giftLivestream(streamId, giftKey);
      setStatus("Gift sent.");
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Could not send gift.");
    } finally {
      setGiftBusy("");
    }
  }

  async function handleShare() {
    const title = stream?.title || "Yenkasa Live";
    try {
      if (navigator.share) {
        await navigator.share({ title, text: title, url: shareUrl });
      } else {
        await navigator.clipboard?.writeText(shareUrl);
      }
      setShareStatus("Live link copied");
    } catch {
      setShareStatus("");
    } finally {
      window.setTimeout(() => setShareStatus(""), 2200);
    }
  }

  return (
    <main className="live-page">
      <header className="live-topbar">
        <button type="button" onClick={() => navigate(-1)} aria-label="Back">
          Back
        </button>
        <strong>Yenkasa Live</strong>
        <button type="button" onClick={() => navigate("/")} aria-label="Feed">
          Feed
        </button>
      </header>

      {!streamId ? (
        <LiveDirectory
          streams={streams}
          loading={loading}
          error={error}
          onOpen={(id) => navigate(`/live/${id}`)}
        />
      ) : (
        <section className="live-watch">
          <div className="live-watch__stage">
            {loading ? <LiveState title="Joining livestream..." /> : null}
            {!loading && error ? <LiveState title={error} /> : null}
            {!loading && !error && stream && agora ? (
              <AgoraAudiencePlayer agora={agora} onStatus={setStatus} onError={setError} />
            ) : null}
            {!loading && !error && stream && !agora ? (
              <LiveState title="Live video token unavailable." />
            ) : null}
          </div>

          <section className="live-watch__info">
            <div className="live-host-row">
              <img
                src={stream?.hostAvatar || staticImage("default.png")}
                alt=""
                onError={handleDynamicImageError}
              />
              <div>
                <strong>@{stream?.hostUsername || "Yenkasa"}</strong>
                <span>{stream?.community || "Yenkasa Live Arena"}</span>
              </div>
              <span className="live-pill">LIVE</span>
            </div>

            <h1>{stream?.title || "Livestream"}</h1>
            <div className="live-stats">
              <span>{Number(stream?.viewerCount || metrics?.totalViewers || 0)} watching</span>
              <span>{Number(stream?.likeCount || metrics?.engagementCount || 0)} reactions</span>
              {stream?.scheduledEndAt ? <span>Ends {formatClock(stream.scheduledEndAt)}</span> : null}
            </div>

            {status ? <p className="live-status-line">{status}</p> : null}
            {shareStatus ? <p className="live-status-line">{shareStatus}</p> : null}

            <div className="live-actions">
              <button type="button" onClick={handleShare}>Share</button>
              <button type="button" onClick={() => navigate("/live")}>More live</button>
            </div>

            <div className="live-gifts">
              {GIFTS.map((gift) => (
                <button
                  type="button"
                  key={gift.key}
                  disabled={giftBusy === gift.key}
                  onClick={() => handleGift(gift.key)}
                >
                  <strong>{gift.label}</strong>
                  <span>{gift.amount} YKC</span>
                </button>
              ))}
            </div>
          </section>
        </section>
      )}
    </main>
  );
}

function LiveDirectory({ streams, loading, error, onOpen }) {
  return (
    <section className="live-directory">
      <div className="live-directory__hero">
        <span className="live-pill">LIVE ARENA</span>
        <h1>Live streams happening now</h1>
      </div>

      {loading ? <LiveState title="Loading live streams..." /> : null}
      {!loading && error ? <LiveState title={error} /> : null}
      {!loading && !error && !streams.length ? (
        <LiveState title="No one is live right now." />
      ) : null}

      <div className="live-stream-grid">
        {streams.map((item) => (
          <button
            type="button"
            className="live-stream-card"
            key={item._id}
            onClick={() => onOpen(item._id)}
          >
            <img
              src={item.thumbnail || item.hostAvatar || staticImage("logo.png")}
              alt=""
              onError={handleDynamicImageError}
            />
            <span className="live-pill">LIVE</span>
            <strong>{item.title || `${item.hostUsername} is live`}</strong>
            <small>@{item.hostUsername} · {Number(item.viewerCount || 0)} watching</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function AgoraAudiencePlayer({ agora, onStatus, onError }) {
  const containerRef = useRef(null);

  useEffect(() => {
    let client = null;
    let mounted = true;

    async function connect() {
      try {
        const AgoraRTC = await loadAgoraSdk();
        if (!mounted) return;
        client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
        await client.setClientRole("audience");

        client.on("user-published", async (user, mediaType) => {
          await client.subscribe(user, mediaType);
          if (mediaType === "video" && user.videoTrack && containerRef.current) {
            containerRef.current.innerHTML = "";
            user.videoTrack.play(containerRef.current);
            onStatus?.("Live video connected.");
          }
          if (mediaType === "audio" && user.audioTrack) {
            user.audioTrack.play();
          }
        });

        client.on("user-unpublished", () => {
          onStatus?.("Host paused the live video.");
        });

        await client.join(agora.appId, agora.channelName || agora.channel || "", agora.token || null, Number(agora.uid));
        onStatus?.("Waiting for host video...");

        await Promise.all(
          (client.remoteUsers || []).map(async (user) => {
            if (user.hasVideo) {
              await client.subscribe(user, "video");
              user.videoTrack?.play(containerRef.current);
              onStatus?.("Live video connected.");
            }
            if (user.hasAudio) {
              await client.subscribe(user, "audio");
              user.audioTrack?.play();
            }
          })
        );
      } catch (error) {
        console.error("Agora web live join failed", error);
        onError?.("Could not connect to the live video in this browser.");
      }
    }

    connect();

    return () => {
      mounted = false;
      if (client) {
        client.leave().catch(() => {});
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [agora, onError, onStatus]);

  return <div ref={containerRef} className="live-agora-video" />;
}

function loadAgoraSdk() {
  if (window.AgoraRTC) return Promise.resolve(window.AgoraRTC);
  if (agoraSdkPromise) return agoraSdkPromise;

  agoraSdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = AGORA_WEB_SDK_URL;
    script.async = true;
    script.onload = () => (window.AgoraRTC ? resolve(window.AgoraRTC) : reject(new Error("AgoraRTC unavailable")));
    script.onerror = () => reject(new Error("Failed to load Agora Web SDK"));
    document.head.appendChild(script);
  });

  return agoraSdkPromise;
}

function LiveState({ title }) {
  return <div className="live-state">{title}</div>;
}

function formatClock(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
