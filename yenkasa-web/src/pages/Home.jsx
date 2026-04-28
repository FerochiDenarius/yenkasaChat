import { useState } from "react";
import BottomNav from "../components/feed/BottomNav";
import CommunitiesBar from "../components/feed/CommunitiesBar";
import FeedTabs from "../components/feed/FeedTabs";
import FloatingButton from "../components/feed/FloatingButton";
import PostList from "../components/feed/PostList";
import TopBar from "../components/feed/TopBar";
import "../styles/feed.css";

export default function Home() {
  const [activeTab, setActiveTab] = useState("For You");
  const [activeSort, setActiveSort] = useState("Top");

  return (
    <main className="feed-home">
      <div className="feed-home__shell">
        <TopBar />
        <CommunitiesBar />
        <FeedTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          activeSort={activeSort}
          onSortChange={setActiveSort}
        />
        <PostList activeTab={activeTab} activeSort={activeSort} />
      </div>
      <FloatingButton />
      <BottomNav />
    </main>
  );
}
