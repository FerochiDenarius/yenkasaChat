import {
  Activity,
  Bell,
  BookOpen,
  BrainCircuit,
  ChartColumn,
  CircleAlert,
  Database,
  Eye,
  FolderOpen,
  Gauge,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Video,
} from "lucide-react";
import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/", label: "Overview", icon: Gauge },
  { to: "/user", label: "User Search", icon: Users },
  { to: "/events", label: "Live Events", icon: Video },
  { to: "/interests", label: "Interests", icon: BrainCircuit },
  { to: "/engagement", label: "Engagement Patterns", icon: Activity },
  { to: "/creator-affinity", label: "Creator Affinity", icon: Sparkles },
  { to: "/retrievals", label: "Retrieval Debugger", icon: Eye },
  { to: "/embeddings", label: "Embeddings", icon: Database },
  { to: "/queues", label: "Queues & Jobs", icon: FolderOpen },
  { to: "/analytics", label: "Analytics", icon: ChartColumn },
  { to: "/alerts", label: "Alerts", icon: CircleAlert },
  { to: "/system-health", label: "System Health", icon: ShieldCheck },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function YmeSidebar({ workspaceLabel = "Production" }) {
  return (
    <aside className="hidden h-[calc(100vh-2rem)] w-[290px] flex-col rounded-[34px] border border-white/10 bg-[rgba(10,12,22,0.86)] p-5 shadow-[0_28px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl lg:flex">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-gradient-to-br from-violet-500 via-fuchsia-500 to-amber-400 text-lg font-black text-white shadow-[0_18px_35px_rgba(139,92,246,0.35)]">
          Y
        </div>
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-400">Yenkasa</p>
          <h1 className="truncate text-lg font-semibold text-white">Memory Engine Inspector</h1>
        </div>
      </div>

      <div className="mt-6 rounded-[28px] border border-violet-400/15 bg-gradient-to-br from-violet-500/16 via-fuchsia-500/10 to-cyan-400/10 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-200/80">Internal tool</p>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          Inspect YME memory quality, retrieval relevance, queue health, and event signal strength without mutating the pipeline.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          {workspaceLabel}
        </div>
      </div>

      <nav className="mt-6 flex-1 space-y-1 overflow-y-auto pr-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-[20px] px-4 py-3 text-sm font-medium transition ${
                  isActive
                    ? "bg-gradient-to-r from-violet-500/28 to-fuchsia-500/18 text-white shadow-[0_16px_40px_rgba(124,58,237,0.18)]"
                    : "text-slate-300 hover:bg-white/[0.04] hover:text-white"
                }`
              }
            >
              <Icon className="h-4 w-4 text-violet-200/80 transition group-hover:text-violet-200" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-4 rounded-[26px] border border-white/10 bg-white/[0.03] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Runtime</p>
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Memory</span>
            <span className="font-semibold text-white">MongoDB</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Embedding</span>
            <span className="font-semibold text-white">Vertex AI</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Queue</span>
            <span className="font-semibold text-emerald-300">BullMQ</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
