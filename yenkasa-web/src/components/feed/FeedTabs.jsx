const tabs = ["For You", "Following", "Trending"];
const sortOptions = ["Top", "Latest", "Popular"];

export default function FeedTabs({ activeTab, onTabChange, activeSort, onSortChange }) {
  return (
    <section className="feed-tabs">
      <div className="feed-tabs__group" role="tablist" aria-label="Feed tabs">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={`feed-tabs__tab${activeTab === tab ? " feed-tabs__tab--active" : ""}`}
            onClick={() => onTabChange(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <label className="feed-tabs__sort">
        <span>{activeSort}</span>
        <select value={activeSort} onChange={(event) => onSortChange(event.target.value)} aria-label="Sort feed">
          {sortOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
