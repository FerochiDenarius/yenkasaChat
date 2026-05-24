import { Navigate, Route, Routes } from "react-router-dom";
import AiThemeLayout from "./layouts/AiThemeLayout";
import AiWorkspaceLayout from "./layouts/AiWorkspaceLayout";
import YmeWorkspaceLayout from "./layouts/YmeWorkspaceLayout";
import AiLandingPage from "./pages/ai/AiLandingPage";
import AiChatDashboardPage from "./pages/ai/AiChatDashboardPage";
import AiKnowledgeBasePage from "./pages/ai/AiKnowledgeBasePage";
import AiModerationConsolePage from "./pages/ai/AiModerationConsolePage";
import AiSystemAnalyticsPage from "./pages/ai/AiSystemAnalyticsPage";
import AiUploadIngestionPage from "./pages/ai/AiUploadIngestionPage";
import AiPageNotFound from "./pages/ai/AiPageNotFound";
import YmeOverviewPage from "./pages/yme/YmeOverviewPage";
import YmeUserPage from "./pages/yme/YmeUserPage";
import YmeEventsPage from "./pages/yme/YmeEventsPage";
import YmeRetrievalsPage from "./pages/yme/YmeRetrievalsPage";
import YmeQueuesPage from "./pages/yme/YmeQueuesPage";
import YmeAnalyticsPage from "./pages/yme/YmeAnalyticsPage";
import YmeNotFoundPage from "./pages/yme/YmeNotFoundPage";

export default function App() {
  const workspace = typeof window !== "undefined" ? window.__YENKASA_WORKSPACE__ || "ai" : "ai";

  if (workspace === "yme") {
    return (
      <Routes>
        <Route element={<YmeWorkspaceLayout />}>
          <Route path="/" element={<YmeOverviewPage />} />
          <Route path="/user/:userId" element={<YmeUserPage />} />
          <Route path="/events" element={<YmeEventsPage />} />
          <Route path="/interests" element={<YmeOverviewPage />} />
          <Route path="/engagement" element={<YmeOverviewPage />} />
          <Route path="/creator-affinity" element={<YmeOverviewPage />} />
          <Route path="/retrievals" element={<YmeRetrievalsPage />} />
          <Route path="/embeddings" element={<YmeOverviewPage />} />
          <Route path="/queues" element={<YmeQueuesPage />} />
          <Route path="/analytics" element={<YmeAnalyticsPage />} />
          <Route path="/alerts" element={<YmeOverviewPage />} />
          <Route path="/system-health" element={<YmeOverviewPage />} />
          <Route path="/settings" element={<YmeOverviewPage />} />
          <Route path="*" element={<YmeNotFoundPage />} />
        </Route>
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<AiThemeLayout />}>
        <Route path="/" element={<AiLandingPage />} />
        <Route element={<AiWorkspaceLayout />}>
          <Route path="/chat" element={<AiChatDashboardPage />} />
          <Route path="/knowledge" element={<AiKnowledgeBasePage />} />
          <Route path="/moderation" element={<AiModerationConsolePage />} />
          <Route path="/analytics" element={<AiSystemAnalyticsPage />} />
          <Route path="/ingestion" element={<AiUploadIngestionPage />} />
        </Route>
        <Route path="/404" element={<AiPageNotFound />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Route>
    </Routes>
  );
}
