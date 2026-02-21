import { Navigate } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";

export function RequireAdmin({ children }: { children: JSX.Element }): JSX.Element {
  const { loading, session } = useAuth();

  if (loading) {
    return <p className="status">Loading...</p>;
  }

  if (!session?.is_admin) {
    return <Navigate to="/" replace />;
  }

  return children;
}
