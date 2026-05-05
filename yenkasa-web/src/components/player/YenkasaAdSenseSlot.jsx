import { useEffect, useRef, useState } from "react";

const ADSENSE_SCRIPT_ID = "yenkasa-player-adsense";

const ADSENSE_CLIENT =
  import.meta.env.REACT_APP_ADSENSE_CLIENT ||
  import.meta.env.VITE_REACT_APP_ADSENSE_CLIENT ||
  import.meta.env.VITE_GOOGLE_AD_CLIENT ||
  import.meta.env.VITE_ADSENSE_CLIENT ||
  "";

const ADSENSE_FEED_SLOT =
  import.meta.env.REACT_APP_ADSENSE_FEED_SLOT ||
  import.meta.env.VITE_REACT_APP_ADSENSE_FEED_SLOT ||
  import.meta.env.VITE_GOOGLE_FEED_AD_SLOT ||
  import.meta.env.VITE_ADSENSE_FEED_SLOT ||
  "";

export default function YenkasaAdSenseSlot({ slotKey }) {
  const insRef = useRef(null);
  const pushedRef = useRef(false);
  const [status, setStatus] = useState(hasAdsenseConfig() ? "loading" : "missing-config");

  useEffect(() => {
    if (!hasAdsenseConfig()) return undefined;
    let cancelled = false;

    loadAdsenseScript(ADSENSE_CLIENT)
      .then(() => {
        if (cancelled || pushedRef.current) return;
        try {
          window.adsbygoogle = window.adsbygoogle || [];
          window.adsbygoogle.push({});
          pushedRef.current = true;
        } catch {
          if (!cancelled) setStatus("failed");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("failed");
      });

    return () => {
      cancelled = true;
    };
  }, [slotKey]);

  useEffect(() => {
    if (!hasAdsenseConfig() || !insRef.current) return undefined;
    const node = insRef.current;
    const syncStatus = () => {
      const nextStatus = node.getAttribute("data-ad-status");
      if (nextStatus === "filled" || nextStatus === "unfilled") setStatus(nextStatus);
    };
    const observer = new MutationObserver(syncStatus);
    observer.observe(node, { attributes: true, attributeFilter: ["data-ad-status"] });
    syncStatus();
    return () => observer.disconnect();
  }, [slotKey]);

  if (!hasAdsenseConfig() && !import.meta.env.DEV) {
    return null;
  }

  return (
    <article className={`player-card player-card--ad player-ad player-ad--${status}`}>
      <div className="player-ad__shell">
        <span className="player-ad__eyebrow">Sponsored</span>
        <h2>Yenkasa Feed Ad</h2>
        {hasAdsenseConfig() ? (
          <ins
            ref={insRef}
            key={slotKey}
            className="adsbygoogle player-ad__slot"
            data-ad-client={ADSENSE_CLIENT}
            data-ad-slot={ADSENSE_FEED_SLOT}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        ) : (
          <p>AdSense placeholder. Configure the feed client and slot before production.</p>
        )}
      </div>
    </article>
  );
}

function hasAdsenseConfig() {
  return Boolean(ADSENSE_CLIENT && ADSENSE_FEED_SLOT);
}

function loadAdsenseScript(client) {
  if (typeof window === "undefined") return Promise.resolve();

  const existing = document.getElementById(ADSENSE_SCRIPT_ID);
  if (existing) {
    return existing.dataset.loaded === "true"
      ? Promise.resolve()
      : new Promise((resolve, reject) => {
          existing.addEventListener("load", resolve, { once: true });
          existing.addEventListener("error", reject, { once: true });
        });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = ADSENSE_SCRIPT_ID;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
