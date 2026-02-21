import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { ApiError, api } from "../api/client";
import type { AccessStatus, AuthResponse } from "../types/domain";

interface AuthState {
  loading: boolean;
  error: string | null;
  session: AuthResponse | null;
  access: AccessStatus | null;
  refreshAccess: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

function getTelegramInitData(): string {
  const fromTelegram = window.Telegram?.WebApp?.initData;
  const fromQuery = new URLSearchParams(window.location.search).get("tgWebAppData");
  const fromEnv = import.meta.env.VITE_DEV_INIT_DATA;
  return fromTelegram || fromQuery || fromEnv || "";
}

export function AuthProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<AuthResponse | null>(null);
  const [access, setAccess] = useState<AccessStatus | null>(null);

  const refreshAccess = useCallback(async (): Promise<void> => {
    const accessStatus = await api.accessStatus();
    setAccess(accessStatus);
  }, []);

  useEffect(() => {
    const bootstrap = async (): Promise<void> => {
      try {
        const initData = getTelegramInitData();
        if (!initData) {
          setError("Telegram initData not found. Open this app from Telegram bot.");
          setLoading(false);
          return;
        }

        window.Telegram?.WebApp?.ready();
        window.Telegram?.WebApp?.expand();

        const auth = await api.authTelegram(initData);
        setSession(auth);
        const accessStatus = await api.accessStatus();
        setAccess(accessStatus);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Failed to authenticate");
        }
      } finally {
        setLoading(false);
      }
    };

    void bootstrap();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      error,
      session,
      access,
      refreshAccess,
    }),
    [loading, error, session, access, refreshAccess],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
