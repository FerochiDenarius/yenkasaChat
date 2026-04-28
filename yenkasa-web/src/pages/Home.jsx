import { useState } from "react";
import BottomNav from "../components/feed/BottomNav";
import CommunitiesBar from "../components/feed/CommunitiesBar";
import FeedTabs from "../components/feed/FeedTabs";
import FloatingButton from "../components/feed/FloatingButton";
import PostList from "../components/feed/PostList";
import TopBar from "../components/feed/TopBar";
import "../styles/feed.css";

export default function Home({ onOpenMenu }) {
  const [activeTab, setActiveTab] = useState("For You");
  const [activeSort, setActiveSort] = useState("Top");
  const [selectedCommunity, setSelectedCommunity] = useState(null);

  return (
    <main className="feed-home">
      <div className="feed-home__shell">
        <TopBar onOpenMenu={onOpenMenu} />
        <CommunitiesBar
          selectedCommunityId={selectedCommunity?._id || selectedCommunity?.id || null}
          onSelectCommunity={setSelectedCommunity}
        />
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
      <FloatingButton />
      <BottomNav />
    </main>
  );
}
