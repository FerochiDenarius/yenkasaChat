import { useEffect, useMemo, useState } from "react";
import { createLiveDuel, getLiveMetrics, joinLiveDuel } from "../../api/live";
import { handleDynamicImageError } from "../../utils/images";

const WINDOWS = [
  { key: "5m", label: "5m" },
  { key: "1h", label: "1h" },
  { key: "today", label: "Today" }
];

const DUEL_OPTIONS = [
  { key: "comment", label: "Comment Duel" },
  { key: "view", label: "View Duel" },
  { key: "like", label: "Like Duel" }
];

export default function YenkasaLiveSheet({ open, onClose, onQuickAction }) {
  const [windowKey, setWindowKey] = useState("5m");
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [duelBusy, setDuelBusy] = useState(false);

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    let timerId = null;

    const run = async () => {
      if (document.hidden) {
        timerId = window.setTimeout(run, 5000);
        return;
      }

      if (!cancelled) setLoading((prev) => prev && payload === null);

      try {
        const data = await getLiveMetrics(windowKey);
        if (cancelled) return;
        setPayload(data);
        setError("");
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError?.response?.data?.error || "Live data unavailable. Pull to refresh.");
        }
      } finally {
        if (!cancelled) setLoading(false);
        timerId = window.setTimeout(run, 5000);
      }
    };

    setLoading(true);
    setError("");
    run();

    return () => {
      cancelled = true;
      if (timerId) window.clearTimeout(timerId);
    };
  }, [open, payload, windowKey]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const liveEvents = useMemo(() => {
    const feed = Array.isArray(payload?.activityFeed) ? payload.activityFeed : [];
    const rankEvents = Array.isArray(payload?.events)
      ? payload.events.map((text, index) => ({
          id: `rank-event-${index}-${text}`,
          text,
          createdAt: payload?.generatedAt || new Date().toISOString(),
          isCurrentUser: /you/i.test(text)
        }))
      : [];

    return [...rankEvents, ...feed]
      .filter(Boolean)
      .slice(0, 8);
  }, [payload]);

  if (!open) return null;

  async function handleCreateDuel(metricType) {
    setDuelBusy(true);
    try {
      const data = await createLiveDuel(metricType);
      setPayload((prev) => ({ ...(prev || {}), duel: data.duel || null }));
      setError("");
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Could not create a duel right now.");
    } finally {
      setDuelBusy(false);
    }
  }

  async function handleJoinDuel() {
    if (!payload?.duel?.duelId) return;
    setDuelBusy(true);
    try {
      const data = await joinLiveDuel(payload.duel.duelId);
      setPayload((prev) => ({ ...(prev || {}), duel: data.duel || null }));
      setError("");
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Could not join this duel.");
    } finally {
      setDuelBusy(false);
    }
  }

  return (
    <>
      <div className="feed-live-sheet__scrim" onClick={onClose} aria-hidden="true" />
      <section className="feed-live-sheet" role="dialog" aria-modal="true" aria-label="Yenkasa Live">
        <header className="feed-live-sheet__header">
          <div>
            <h2>⚡ Yenkasa Live</h2>
            <p>Real-time competition happening now</p>
          </div>
          <div className="feed-live-sheet__header-actions">
            <span className="feed-live-sheet__live-pill">
              <i />
              LIVE
            </span>
            <button className="feed-live-sheet__close" type="button" onClick={onClose} aria-label="Close Yenkasa Live">
              ×
            </button>
          </div>
        </header>

        <div className="feed-live-sheet__filters">
          {WINDOWS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`feed-live-chip${windowKey === item.key ? " feed-live-chip--active" : ""}`}
              onClick={() => setWindowKey(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {payload?.activeEvent ? (
          <div className="feed-live-banner">
            <strong>{payload.activeEvent.name} is ON</strong>
            <span>{payload.activeEvent.bonusMultiplier}x YKC rewards</span>
          </div>
        ) : null}

        {payload?.duel ? (
          <div className="feed-live-duel">
            <div className="feed-live-duel__heading">
              <span>⚔️ Live Duel</span>
              <small>{formatMetricLabel(payload.duel.metricType)} battle</small>
            </div>
            <div className="feed-live-duel__versus">
              <div>
                <strong>You</strong>
                <span>{payload.duel.yourScore}</span>
              </div>
              <div className="feed-live-duel__middle">
                <b>vs</b>
                <small>{formatCountdown(payload.duel.timeLeftSeconds)}</small>
              </div>
              <div>
                <strong>{payload.duel.opponentName || "Arena challenger"}</strong>
                <span>{payload.duel.opponentScore}</span>
              </div>
            </div>
            <button
              className="feed-live-duel__action"
              type="button"
              disabled={duelBusy || !payload.duel.canJoin}
              onClick={handleJoinDuel}
            >
              {payload.duel.canJoin ? (duelBusy ? "Joining..." : "Accept / Join Duel") : `${payload.duel.prizeYkc || 12} YKC prize`}
            </button>
          </div>
        ) : (
          <div className="feed-live-duel feed-live-duel--setup">
            <div className="feed-live-duel__heading">
              <span>⚔️ Live Duel</span>
              <small>Challenge a matched opponent for 5 minutes</small>
            </div>
            <div className="feed-live-duel__options">
              {DUEL_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  disabled={duelBusy}
                  onClick={() => handleCreateDuel(option.key)}
                >
                  {duelBusy ? "..." : option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {payload?.conversationStreak?.message ? (
          <div className="feed-live-streak">
            <strong>{payload.conversationStreak.message}</strong>
            <span>⚡ Stay active in Live to maintain it</span>
          </div>
        ) : null}

        {payload?.microReward ? (
          <div className="feed-live-reward">
            <strong>💰 Burst Reward</strong>
            <span>
              Top commenter earns +{payload.microReward.rewardAmount || 5} YKC.
              {payload.microReward.topCommenter ? ` ${payload.microReward.topCommenter.username} is leading now.` : ""}
            </span>
          </div>
        ) : null}

        {loading && !payload ? <div className="feed-live-status">Loading live data...</div> : null}
        {error ? (
          <div className="feed-live-error">
            <span>⚠️ {error}</span>
            <button type="button" onClick={() => { setPayload(null); setLoading(true); setError(""); }}>
              Retry
            </button>
          </div>
        ) : null}

        <div className="feed-live-cards">
          {[
            payload?.topCommenters,
            payload?.topViews,
            payload?.topConnectors,
            payload?.topYKC
          ].filter(Boolean).map((section) => (
            <LeaderboardCard
              key={section.metricKey || section.title}
              section={section}
              onQuickAction={onQuickAction}
            />
          ))}
        </div>

        <div className="feed-live-events">
          <div className="feed-live-section-title">Live activity</div>
          {liveEvents.length ? (
            <div className="feed-live-events__list">
              {liveEvents.map((event, index) => (
                <div
                  key={event.id || `${event.text}-${index}`}
                  className={`feed-live-event${event.isCurrentUser ? " feed-live-event--you" : ""}`}
                >
                  {event.profileImage ? (
                    <img
                      src={event.profileImage}
                      alt=""
                      loading="lazy"
                      onError={handleDynamicImageError}
                    />
                  ) : (
                    <span className="feed-live-event__marker" />
                  )}
                  <div>
                    <strong>{event.text}</strong>
                    <small>{formatRelativeTime(event.createdAt)}</small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="feed-live-status">No live moves yet. Start the rush.</div>
          )}
        </div>

        <div className="feed-live-quick-actions">
          {[
            { key: "comment", label: "Comment" },
            { key: "view", label: "View" },
            { key: "like", label: "Like" },
            { key: "follow", label: "Follow" }
          ].map((action) => (
            <button key={action.key} type="button" onClick={() => onQuickAction?.(action.key)}>
              {action.label}
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function LeaderboardCard({ section, onQuickAction }) {
  const leaders = Array.isArray(section?.leaders) ? section.leaders : [];
  const currentUser = section?.currentUser;
  const rows = leaders.some((row) => row.userId === currentUser?.userId)
    ? leaders
    : [...leaders, currentUser].filter(Boolean).slice(0, 4);

  return (
    <article className="feed-live-card">
      <div className="feed-live-card__head">
        <strong>{section.title}</strong>
        <span>Live</span>
      </div>
      <div className="feed-live-card__rows">
        {rows.map((row) => (
          <div key={`${section.metricKey}-${row.userId}-${row.rank}`} className={`feed-live-row${row.isCurrentUser ? " feed-live-row--you" : ""}`}>
            <span className={`feed-live-row__rank feed-live-row__rank--${Math.min(Number(row.rank || 4), 4)}`}>{row.rank || "•"}</span>
            {row.profileImage ? (
              <img src={row.profileImage} alt={row.username} loading="lazy" onError={handleDynamicImageError} />
            ) : (
              <span className="feed-live-row__avatar-fallback">{String(row.username || "Y").charAt(0)}</span>
            )}
            <div className="feed-live-row__body">
              <strong>{row.username}</strong>
              <small>{row.liveTitle || row.progressHint}</small>
            </div>
            <div className="feed-live-row__score">
              <strong>{row.count}</strong>
            </div>
          </div>
        ))}
      </div>
      {currentUser?.progressHint ? <div className="feed-live-card__hint">{currentUser.progressHint}</div> : null}
      <button className="feed-live-card__action" type="button" onClick={() => onQuickAction?.(section.action)}>
        Go {section.action}
      </button>
    </article>
  );
}

function formatMetricLabel(metricType) {
  if (metricType === "comment") return "Comments";
  if (metricType === "view") return "Views";
  if (metricType === "like") return "Likes";
  return "Live";
}

function formatCountdown(seconds) {
  const total = Math.max(0, Number(seconds || 0));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")} left`;
}

function formatRelativeTime(value) {
  if (!value) return "Just now";
  const diff = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diff) || diff < 0) return "Just now";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
