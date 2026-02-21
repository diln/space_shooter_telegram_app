import { Navigate } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";

export function RequireApproved({ children }: { children: JSX.Element }): JSX.Element {
  const { access, loading } = useAuth();

  if (loading) {
    return <p className="status">Loading...</p>;
  }

  if (!access || access.status !== "APPROVED") {
    return <Navigate to="/" replace />;
  }

  return children;
}
