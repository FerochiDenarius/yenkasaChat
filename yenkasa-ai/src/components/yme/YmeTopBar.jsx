import { Bell, RefreshCw, Search, Shield, Sparkles, UserCircle2 } from "lucide-react";

export default function YmeTopBar({
  searchValue,
  onSearchChange,
  onSearchSubmit,
  searchResults = [],
  searchLoading = false,
  onSelectResult,
  environment = "Production",
  lastUpdated = "just now",
  onRefresh,
  adminName = "Admin",
}) {
  return (
    <header className="sticky top-0 z-20 mb-6 rounded-[30px] border border-white/10 bg-[rgba(12,14,24,0.86)] px-5 py-4 shadow-[0_20px_50px_rgba(0,0,0,0.22)] backdrop-blur-xl">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              Environment: {environment}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Live inspector
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={searchValue}
                onChange={(event) => onSearchChange?.(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onSearchSubmit?.();
                  }
                }}
                placeholder="Search user by ID, username, or email..."
                className="h-12 w-full rounded-[18px] border border-white/10 bg-white/[0.04] px-11 pr-28 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-400/30 focus:bg-white/[0.06]"
              />
              <button
                type="button"
                onClick={onSearchSubmit}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-[14px] border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-violet-200 transition hover:bg-white/[0.09]"
              >
                {searchLoading ? "Searching..." : "Search"}
              </button>
              {searchResults.length ? (
                <div className="absolute left-0 top-[calc(100%+10px)] z-30 w-full overflow-hidden rounded-[22px] border border-white/10 bg-[rgba(10,12,22,0.98)] shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
                  {searchResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectResult?.(item)}
                      className="flex w-full items-center justify-between gap-4 border-b border-white/[0.04] px-4 py-3 text-left transition last:border-b-0 hover:bg-white/[0.04]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">@{item.username || item.email || item.id}</p>
                        <p className="truncate text-xs text-slate-400">{item.email || item.walletId || item.id}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        {item.verified ? <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-emerald-300">Verified</span> : null}
                        {item.online ? <span className="rounded-full bg-violet-400/10 px-2 py-1 text-violet-200">Online</span> : null}
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 items-center gap-3 rounded-[18px] border border-white/10 bg-white/[0.04] px-4 text-sm text-slate-300">
                <RefreshCw className="h-4 w-4 text-violet-200" />
                <span>Last updated: {lastUpdated}</span>
              </div>
              <button
                type="button"
                onClick={onRefresh}
                className="inline-flex h-12 items-center gap-2 rounded-[18px] bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 text-sm font-semibold text-white shadow-[0_18px_35px_rgba(124,58,237,0.3)] transition hover:brightness-110"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start">
          <button
            type="button"
            className="inline-flex h-12 w-12 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.08]"
          >
            <Bell className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3 rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xs font-black text-white">
              {adminName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{adminName}</p>
              <p className="text-xs text-slate-400">Admin access</p>
            </div>
          </div>
          <div className="rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-300">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-300" />
              Protected
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
