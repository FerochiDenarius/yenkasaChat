import { useEffect, useMemo, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import YmeSidebar from "../components/yme/YmeSidebar";
import YmeTopBar from "../components/yme/YmeTopBar";
import { searchYmeUsers } from "../services/yme/ymeApi";

const DEFAULT_ADMIN = "Admin";

function formatLastUpdated(timestamp) {
  if (!timestamp) return "just now";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp);
}

export default function YmeWorkspaceLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchValue, setSearchValue] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(() => formatLastUpdated(Date.now()));
  const [refreshSignal, setRefreshSignal] = useState(0);

  const workspaceLabel = import.meta.env.PROD ? "Production" : "Development";

  useEffect(() => {
    setLastUpdated(formatLastUpdated(Date.now()));
  }, [refreshSignal, location.pathname]);

  useEffect(() => {
    let active = true;
    const term = searchValue.trim();

    if (term.length < 3) {
      setSearchResults([]);
      setSearchLoading(false);
      return undefined;
    }

    setSearchLoading(true);
    const timeout = window.setTimeout(() => {
      searchYmeUsers(term)
        .then((payload) => {
          if (!active) return;
          setSearchResults(payload?.items || []);
        })
        .catch(() => {
          if (!active) return;
          setSearchResults([]);
        })
        .finally(() => {
          if (active) setSearchLoading(false);
        });
    }, 260);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [searchValue]);

  const onSearchSubmit = async () => {
    const term = searchValue.trim();
    if (!term) return;

    try {
      setSearchLoading(true);
      const payload = await searchYmeUsers(term, 1);
      const first = payload?.items?.[0];
      if (first?.id) {
        navigate(`/user/${first.id}`);
      }
    } catch (_error) {
      navigate(`/user/${encodeURIComponent(term)}`);
    } finally {
      setSearchLoading(false);
    }
  };

  const contextValue = useMemo(
    () => ({
      refreshSignal,
      triggerRefresh: () => setRefreshSignal((value) => value + 1),
      currentPath: location.pathname,
      searchValue,
      setSearchValue,
    }),
    [location.pathname, refreshSignal, searchValue],
  );

  return (
    <div className="min-h-screen bg-[#07090f] text-white">
      <div className="mx-auto flex min-h-screen max-w-[1720px] gap-4 px-4 py-4 lg:px-6">
        <YmeSidebar workspaceLabel={workspaceLabel} />

        <main className="min-w-0 flex-1">
          <div className="rounded-[34px] border border-white/5 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.15),transparent_24%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.08),transparent_20%),linear-gradient(180deg,rgba(8,10,16,0.92),rgba(9,11,18,0.98))] p-4 sm:p-5 lg:min-h-[calc(100vh-2rem)] lg:p-6">
            <YmeTopBar
              searchValue={searchValue}
              onSearchChange={setSearchValue}
              onSearchSubmit={onSearchSubmit}
              searchResults={searchResults}
              searchLoading={searchLoading}
              onSelectResult={(item) => navigate(`/user/${item.id}`)}
              environment={workspaceLabel}
              lastUpdated={lastUpdated}
              onRefresh={() => {
                setRefreshSignal((value) => value + 1);
                setLastUpdated(formatLastUpdated(Date.now()));
              }}
              adminName={window.localStorage.getItem("authUserName") || DEFAULT_ADMIN}
            />
            <Outlet context={contextValue} />
          </div>
        </main>
      </div>
    </div>
  );
}
