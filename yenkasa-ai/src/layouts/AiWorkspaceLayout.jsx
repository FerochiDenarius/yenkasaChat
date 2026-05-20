import { Outlet, useOutletContext } from "react-router-dom";
import { useState } from "react";
import AiSidebar from "../components/ai/AiSidebar";
import AiTopBar from "../components/ai/AiTopBar";

export default function AiWorkspaceLayout() {
  const { theme, toggleTheme } = useOutletContext();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex max-w-[1600px] gap-4 px-4 py-4 lg:px-6">
        <AiSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

        <main className="min-w-0 flex-1 lg:pl-[306px]">
          <div className="ai-grid-surface rounded-[34px] p-4 sm:p-5 lg:min-h-[calc(100vh-2rem)] lg:p-6">
            <AiTopBar
              theme={theme}
              onToggleTheme={toggleTheme}
              onOpenSidebar={() => setMobileOpen(true)}
            />
            <Outlet context={{ theme, toggleTheme }} />
          </div>
        </main>
      </div>
    </div>
  );
}
