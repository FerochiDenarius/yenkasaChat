import { useEffect, useRef, useState } from "react";
import BottomNav from "../components/feed/BottomNav";
import CommunitiesBar from "../components/feed/CommunitiesBar";
import FeedTabs from "../components/feed/FeedTabs";
import FloatingButton from "../components/feed/FloatingButton";
import YenkasaLiveButton from "../components/feed/YenkasaLiveButton";
import YenkasaLiveSheet from "../components/feed/YenkasaLiveSheet";
import FloatingWalletBalance from "../components/feed/FloatingWalletBalance";
import PostList from "../components/feed/PostList";
import TopBar from "../components/feed/TopBar";
import YenkasaWebPlayerFeed from "../components/player/YenkasaWebPlayerFeed";
import { USE_YENKASA_WEB_PLAYERVIEW_FEED } from "../config/featureFlags";
import "../styles/feed.css";

export default function Home({ onOpenMenu }) {
  const [activeTab, setActiveTab] = useState("For You");
  const [activeSort, setActiveSort] = useState("Top");
  const [selectedCommunity, setSelectedCommunity] = useState(null);
  const [showCommunities, setShowCommunities] = useState(true);
  const [showLive, setShowLive] = useState(false);
  const lastScrollY = useRef(0);
  const showCommunitiesRef = useRef(true);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      const nextShowCommunities =
        currentY < 50 || currentY <= lastScrollY.current;

      if (showCommunitiesRef.current !== nextShowCommunities) {
        showCommunitiesRef.current = nextShowCommunities;
        setShowCommunities(nextShowCommunities);
      }

      lastScrollY.current = currentY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (USE_YENKASA_WEB_PLAYERVIEW_FEED) {
    return <YenkasaWebPlayerFeed onOpenMenu={onOpenMenu} />;
  }

  return (
    <main className="feed-home">
      <div className="feed-home__shell">
        <TopBar onOpenMenu={onOpenMenu} />
        <div className={`communities-wrapper ${showCommunities ? "show" : "hide"}`}>
          <CommunitiesBar
            selectedCommunityId={selectedCommunity?._id || selectedCommunity?.id || null}
            onSelectCommunity={setSelectedCommunity}
          />
        </div>
        <FeedTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          activeSort={activeSort}
          onSortChange={setActiveSort}
        />
        <PostList
          activeTab={activeTab}
          activeSort={activeSort}
          selectedCommunity={selectedCommunity}
        />
      </div>
      <YenkasaLiveSheet
        open={showLive}
        onClose={() => setShowLive(false)}
        onQuickAction={(actionKey) => {
          setShowLive(false);
          setActiveTab(actionKey === "follow" ? "Following" : "For You");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
      <FloatingWalletBalance />
      <YenkasaLiveButton onClick={() => setShowLive(true)} />
      <FloatingButton />
      <BottomNav />
    </main>
  );
}
