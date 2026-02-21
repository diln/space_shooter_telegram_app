import { Link, Navigate, Route, Routes } from "react-router-dom";

import { RequireAdmin } from "./components/RequireAdmin";
import { RequireApproved } from "./components/RequireApproved";
import { useAuth } from "./contexts/AuthContext";
import { AdminPage } from "./pages/AdminPage";
import { GatePage } from "./pages/GatePage";
import { PlayPage } from "./pages/PlayPage";

export default function App(): JSX.Element {
  const { session, access } = useAuth();
  const currentStatus = access?.status ?? session?.status;

  return (
    <div className="layout">
      <header className="app-header">
        <div className="brand">
          <strong>SpaceShooter001</strong>
          <span>Telegram Mini App</span>
        </div>
        <div className="header-meta">
          {session?.user.first_name && <span className="chip">{session.user.first_name}</span>}
          {currentStatus && <span className={`chip status-pill status-${currentStatus.toLowerCase()}`}>{currentStatus}</span>}
        </div>
        <nav className="main-nav">
          <Link className="nav-link" to="/">
            Home
          </Link>
          <Link className="nav-link" to="/play">
            Play
          </Link>
          {session?.is_admin && (
            <Link className="nav-link" to="/admin">
              Admin
            </Link>
          )}
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<GatePage />} />
        <Route
          path="/play"
          element={
            <RequireApproved>
              <PlayPage />
            </RequireApproved>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminPage />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
