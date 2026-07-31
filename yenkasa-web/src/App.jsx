import { useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import Verification from "./pages/Verification";
import Notifications from "./pages/Notifications";
import VerifyAccount from "./pages/VerifyAccount";
import Wallet from "./pages/Wallet";
import Ads from "./pages/Ads";
import Communities from "./pages/Communities";
import CreatePost from "./pages/CreatePost";
import PostDetails from "./pages/PostDetails";
import EditProfile from "./pages/EditProfile";
import ChatPage from "./pages/ChatPage";
import Settings from "./pages/Settings";
import PostApprovals from "./pages/PostApprovals";
import AdminEconomy from "./pages/AdminEconomy";
import LiveStream from "./pages/LiveStream";
import PlaceholderPage from "./pages/PlaceholderPage";
import Backdrop from "./components/layout/Backdrop";
import SideDrawer from "./components/layout/SideDrawer";
import NotificationSoundBridge from "./components/notifications/NotificationSoundBridge";
import { getToken } from "./utils/storage";

function ProtectedRoute({ children }) {
  const location = useLocation();
  const token = getToken();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="app-shell">
      {getToken() ? <NotificationSoundBridge /> : null}
      {menuOpen ? <Backdrop onClick={closeMenu} /> : null}
      <SideDrawer open={menuOpen} onClose={closeMenu} />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home onOpenMenu={() => setMenuOpen(true)} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ads"
          element={
            <ProtectedRoute>
              <Ads />
            </ProtectedRoute>
          }
        />
        <Route
          path="/communities"
          element={
            <ProtectedRoute>
              <Communities />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/:userId"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/wallet"
          element={
            <ProtectedRoute>
              <Wallet />
            </ProtectedRoute>
          }
        />
        <Route
          path="/verification"
          element={
            <ProtectedRoute>
              <Verification />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-post"
          element={
            <ProtectedRoute>
              <CreatePost />
            </ProtectedRoute>
          }
        />
        <Route
          path="/post/:postId"
          element={
            <ProtectedRoute>
              <PostDetails />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <Notifications />
            </ProtectedRoute>
          }
        />
        <Route
          path="/live"
          element={
            <ProtectedRoute>
              <LiveStream />
            </ProtectedRoute>
          }
        />
        <Route
          path="/live/:streamId"
          element={
            <ProtectedRoute>
              <LiveStream />
            </ProtectedRoute>
          }
        />
        <Route
          path="/contacts"
          element={
            <ProtectedRoute>
              <PlaceholderPage title="Contacts" subtitle="Manage saved contacts." />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chatrooms"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chatrooms/:roomId"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/edit-profile"
          element={
            <ProtectedRoute>
              <EditProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/verify-account"
          element={
            <ProtectedRoute>
              <VerifyAccount />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-communities"
          element={
            <ProtectedRoute>
              <PlaceholderPage title="My Communities" subtitle="Communities you created or manage." />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/post-approvals"
          element={
            <ProtectedRoute>
              <PostApprovals />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/economy"
          element={
            <ProtectedRoute>
              <AdminEconomy />
            </ProtectedRoute>
          }
        />
        <Route
          path="/approve-ads"
          element={
            <ProtectedRoute>
              <PlaceholderPage title="Approve Ads" subtitle="Review sponsored ad submissions." />
            </ProtectedRoute>
          }
        />
        <Route
          path="/approve-communities"
          element={
            <ProtectedRoute>
              <PlaceholderPage title="Approve Communities" subtitle="Review community creation requests." />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
