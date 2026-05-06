import { useEffect, useRef, useState } from "react";

export const YENKASA_ADSENSE_CLIENT = "ca-pub-5051666473627498";
export const YENKASA_ADSENSE_FEED_SLOT = "7427783664";
export const YENKASA_ADSENSE_LAYOUT_KEY = "-6t+ed+2i-1n-4w";

const ADSENSE_SCRIPT_ID = "yenkasa-manual-adsense";

export default function YenkasaFeedAd({ slotKey, variant = "feed" }) {
  const rootRef = useRef(null);
  const insRef = useRef(null);
  const pushedRef = useRef(false);
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    pushedRef.current = false;
    setVisible(false);
    setStatus("loading");
  }, [slotKey]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setVisible(true);
      },
      { rootMargin: "640px 0px", threshold: 0.05 }
    );
    observer.observe(node);

    return () => observer.disconnect();
  }, [slotKey]);

  useEffect(() => {
    if (!visible) return undefined;
    let cancelled = false;

    console.debug("[YenkasaAdsWeb] ad mounted", { slotKey, variant });
    loadAdsenseScript()
      .then(() => {
        if (cancelled || pushedRef.current) return;
        try {
          window.adsbygoogle = window.adsbygoogle || [];
          window.adsbygoogle.push({});
          pushedRef.current = true;
          console.debug("[YenkasaAdsWeb] push executed", {
            slotKey,
            client: YENKASA_ADSENSE_CLIENT,
            slot: YENKASA_ADSENSE_FEED_SLOT,
          });
        } catch (error) {
          if (!cancelled) setStatus("failed");
          console.warn("[YenkasaAdsWeb] push failed", { slotKey, error });
        }
      })
      .catch((error) => {
        if (!cancelled) setStatus("failed");
        console.warn("[YenkasaAdsWeb] script load failed", { slotKey, error });
      });

    return () => {
      cancelled = true;
    };
  }, [slotKey, variant, visible]);

  useEffect(() => {
    const node = insRef.current;
    if (!node) return undefined;

    const syncStatus = () => {
      const adStatus = node.getAttribute("data-ad-status");
      if (adStatus === "filled" || adStatus === "unfilled") {
        setStatus(adStatus);
        console.debug("[YenkasaAdsWeb] ad status", { slotKey, status: adStatus });
      }
    };

    const observer = new MutationObserver(syncStatus);
    observer.observe(node, { attributes: true, attributeFilter: ["data-ad-status"] });
    syncStatus();

    return () => observer.disconnect();
  }, [slotKey]);

  const className =
    variant === "player"
      ? `player-card player-card--ad player-ad player-ad--${status}`
      : `yenkasa-feed-ad yenkasa-feed-ad--${status}`;

  return (
    <article ref={rootRef} className={className} aria-label="Sponsored ad">
      <div className={variant === "player" ? "player-ad__shell" : "yenkasa-feed-ad__shell"}>
        <span className={variant === "player" ? "player-ad__eyebrow" : "yenkasa-feed-ad__label"}>
          Sponsored
        </span>
        {variant === "player" ? <h2>Yenkasa Feed Ad</h2> : null}
        <ins
          ref={insRef}
          key={slotKey}
          className={`adsbygoogle ${variant === "player" ? "player-ad__slot" : "yenkasa-feed-ad__slot"}`}
          style={{ display: "block" }}
          data-ad-format="fluid"
          data-ad-layout-key={YENKASA_ADSENSE_LAYOUT_KEY}
          data-ad-client={YENKASA_ADSENSE_CLIENT}
          data-ad-slot={YENKASA_ADSENSE_FEED_SLOT}
        />
      </div>
    </article>
  );
}

function loadAdsenseScript() {
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
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(YENKASA_ADSENSE_CLIENT)}`;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
