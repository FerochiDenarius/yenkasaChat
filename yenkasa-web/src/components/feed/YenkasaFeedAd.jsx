import { useEffect, useRef, useState } from "react";

export const YENKASA_ADSENSE_CLIENT = "ca-pub-5051666473627498";
export const YENKASA_ADSENSE_FEED_SLOT = "7427783664";
export const YENKASA_ADSENSE_LAYOUT_KEY = "-6t+ed+2i-1n-4w";

const ADSENSE_SCRIPT_ID = "yenkasa-manual-adsense";
let adsTxtChecked = false;

export default function YenkasaFeedAd({ slotKey, variant = "feed", onEmpty }) {
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
    if (status === "unfilled" || status === "failed") {
      onEmpty?.(slotKey);
    }
  }, [onEmpty, slotKey, status]);

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
    validateAdsTxtOnce();
    loadAdsenseScript()
      .then(() => {
        if (cancelled || pushedRef.current) return;
        waitForVisibleSlot(insRef.current)
          .then((visibleInfo) => {
            if (cancelled || pushedRef.current) return;
            try {
              window.adsbygoogle = window.adsbygoogle || [];
              window.adsbygoogle.push({});
              pushedRef.current = true;
              console.debug("[YenkasaAdsWeb] push executed", {
                slotKey,
                client: YENKASA_ADSENSE_CLIENT,
                slot: YENKASA_ADSENSE_FEED_SLOT,
                visibleInfo,
              });
            } catch (error) {
              if (!cancelled) setStatus("failed");
              console.warn("[YenkasaAdsWeb] push failed", { slotKey, error });
            }
          })
          .catch((error) => {
            if (!cancelled) setStatus("failed");
            console.warn("[YenkasaAdsWeb] slot not visible for push", { slotKey, error });
          });
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
        if (adStatus === "unfilled") {
          console.warn("[YenkasaAdsWeb] AdSense returned unfilled. Check site approval, ads.txt, fill rate, and console policy messages.", {
            slotKey,
            client: YENKASA_ADSENSE_CLIENT,
            slot: YENKASA_ADSENSE_FEED_SLOT,
          });
        }
        return;
      }

      const iframe = node.querySelector("iframe");
      if (iframe && iframe.getBoundingClientRect().height > 0) {
        setStatus("filled");
        console.debug("[YenkasaAdsWeb] ad iframe rendered", { slotKey });
      }
    };

    const observer = new MutationObserver(syncStatus);
    observer.observe(node, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ["data-ad-status", "style"],
    });
    syncStatus();

    const timeout = window.setTimeout(() => {
      const adStatus = node.getAttribute("data-ad-status");
      const iframe = node.querySelector("iframe");
      const iframeHeight = iframe ? Math.round(iframe.getBoundingClientRect().height) : 0;
      if (!adStatus && iframeHeight <= 0) {
        setStatus("unfilled");
        console.warn("[YenkasaAdsWeb] AdSense stayed blank after push; collapsing empty slot", {
          slotKey,
          iframeHeight,
        });
      }
    }, 9000);

    return () => {
      window.clearTimeout(timeout);
      observer.disconnect();
    };
  }, [slotKey]);

  const className =
    variant === "player"
      ? `player-card player-card--ad player-ad player-ad--${status}`
      : `yenkasa-feed-ad yenkasa-feed-ad--${status}`;

  if (variant !== "player" && (status === "unfilled" || status === "failed")) {
    return null;
  }

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
          style={{ display: "block", width: "100%", minHeight: variant === "player" ? 280 : 140 }}
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
    if (existing.dataset.failed === "true") {
      return Promise.reject(new Error("AdSense script failed to load"));
    }
    if (existing.dataset.loaded === "true" || window.adsbygoogle) {
      existing.dataset.loaded = "true";
      return Promise.resolve();
    }
    return existing.dataset.loaded === "true"
      ? Promise.resolve()
      : new Promise((resolve, reject) => {
          existing.addEventListener("load", () => {
            existing.dataset.loaded = "true";
            resolve();
          }, { once: true });
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

function waitForVisibleSlot(node, attempt = 0) {
  return new Promise((resolve, reject) => {
    if (!node) {
      reject(new Error("Missing AdSense slot element"));
      return;
    }

    const rect = node.getBoundingClientRect();
    const style = window.getComputedStyle(node);
    const visibleInfo = {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      display: style.display,
      visibility: style.visibility,
    };
    console.debug("[YenkasaAdsWeb] ad container visible", visibleInfo);

    if (rect.width > 0 && style.display !== "none" && style.visibility !== "hidden") {
      resolve(visibleInfo);
      return;
    }

    if (attempt >= 12) {
      reject(new Error(`AdSense slot has no visible width: ${JSON.stringify(visibleInfo)}`));
      return;
    }

    window.requestAnimationFrame(() => {
      waitForVisibleSlot(node, attempt + 1).then(resolve).catch(reject);
    });
  });
}

function validateAdsTxtOnce() {
  if (typeof window === "undefined" || adsTxtChecked) return;
  adsTxtChecked = true;

  fetch("/ads.txt", { cache: "no-store" })
    .then((response) => (response.ok ? response.text() : ""))
    .then((text) => {
      if (!text.includes("pub-5051666473627498")) {
        console.warn("[YenkasaAdsWeb] ads.txt is missing publisher pub-5051666473627498. AdSense may show placeholders until this is fixed.");
      }
    })
    .catch((error) => {
      console.warn("[YenkasaAdsWeb] Could not verify /ads.txt", error);
    });
}
