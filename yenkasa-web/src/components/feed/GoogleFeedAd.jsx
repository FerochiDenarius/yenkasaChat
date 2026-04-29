import { useEffect, useRef, useState } from "react";
import { GOOGLE_ADS_CONFIG, hasGoogleFeedAdConfig } from "../../config/googleAds";
import { trackAdView } from "../../api/verification";

const ADSENSE_SCRIPT_ID = "yenkasa-google-adsense";

export default function GoogleFeedAd({ slotKey }) {
  const containerRef = useRef(null);
  const insRef = useRef(null);
  const pushedRef = useRef(false);
  const trackedRef = useRef(false);
  const [status, setStatus] = useState(hasGoogleFeedAdConfig() ? "loading" : "missing-config");

  useEffect(() => {
    if (!hasGoogleFeedAdConfig()) return undefined;

    let cancelled = false;
    loadAdsenseScript(GOOGLE_ADS_CONFIG.client)
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
    if (!hasGoogleFeedAdConfig() || !insRef.current) return undefined;

    const node = insRef.current;
    const syncStatus = () => {
      const adStatus = node.getAttribute("data-ad-status");
      if (adStatus === "filled") {
        setStatus("filled");
      } else if (adStatus === "unfilled") {
        setStatus("unfilled");
      }
    };

    const observer = new MutationObserver(syncStatus);
    observer.observe(node, { attributes: true, attributeFilter: ["data-ad-status"] });
    syncStatus();

    return () => observer.disconnect();
  }, [slotKey]);

  useEffect(() => {
    if (!hasGoogleFeedAdConfig() || status !== "filled" || trackedRef.current || !containerRef.current) {
      return undefined;
    }

    let visibleTimer = null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        window.clearTimeout(visibleTimer);
        if (entry?.isIntersecting && entry.intersectionRatio >= 0.55) {
          visibleTimer = window.setTimeout(() => {
            if (trackedRef.current) return;
            trackedRef.current = true;
            trackAdView().catch(() => {});
          }, 1000);
        }
      },
      { threshold: [0, 0.55, 1] }
    );

    observer.observe(containerRef.current);

    return () => {
      window.clearTimeout(visibleTimer);
      observer.disconnect();
    };
  }, [status]);

  if (!hasGoogleFeedAdConfig() && !import.meta.env.DEV) {
    return null;
  }

  return (
    <article
      ref={containerRef}
      className={`google-feed-ad google-feed-ad--${status}`}
      aria-label="Sponsored ad"
    >
      <div className="google-feed-ad__label">Sponsored</div>
      {hasGoogleFeedAdConfig() ? (
        <ins
          ref={insRef}
          key={slotKey}
          className="adsbygoogle google-feed-ad__slot"
          data-ad-client={GOOGLE_ADS_CONFIG.client}
          data-ad-slot={GOOGLE_ADS_CONFIG.feedSlot}
          data-ad-format={GOOGLE_ADS_CONFIG.feedFormat}
          data-full-width-responsive={GOOGLE_ADS_CONFIG.fullWidthResponsive}
        />
      ) : (
        <div className="google-feed-ad__placeholder">
          Configure <b>VITE_GOOGLE_AD_CLIENT</b> and <b>VITE_GOOGLE_FEED_AD_SLOT</b>.
        </div>
      )}
    </article>
  );
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
