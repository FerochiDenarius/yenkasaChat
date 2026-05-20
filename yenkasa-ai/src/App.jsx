import { Navigate, Route, Routes } from "react-router-dom";
import AiThemeLayout from "./layouts/AiThemeLayout";
import AiWorkspaceLayout from "./layouts/AiWorkspaceLayout";
import AiLandingPage from "./pages/ai/AiLandingPage";
import AiChatDashboardPage from "./pages/ai/AiChatDashboardPage";
import AiKnowledgeBasePage from "./pages/ai/AiKnowledgeBasePage";
import AiModerationConsolePage from "./pages/ai/AiModerationConsolePage";
import AiSystemAnalyticsPage from "./pages/ai/AiSystemAnalyticsPage";
import AiUploadIngestionPage from "./pages/ai/AiUploadIngestionPage";
import AiPageNotFound from "./pages/ai/AiPageNotFound";

export default function App() {
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
