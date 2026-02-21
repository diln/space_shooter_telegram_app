import type {
  AccessStatus,
  AdminRequestItem,
  AdminUserItem,
  AuthResponse,
  Difficulty,
  LeaderboardEntry,
} from "../types/domain";

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({ detail: "Request failed" }))) as { detail?: string };
    throw new ApiError(response.status, body.detail ?? "Request failed");
  }

  return (await response.json()) as T;
}

export const api = {
  authTelegram(initData: string): Promise<AuthResponse> {
    return request<AuthResponse>("/api/auth/telegram", {
      method: "POST",
      body: JSON.stringify({ initData }),
    });
  },

  accessStatus(): Promise<AccessStatus> {
    return request<AccessStatus>("/api/access/status");
  },

  requestAccess(comment?: string): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>("/api/access/request", {
      method: "POST",
      body: JSON.stringify({ comment }),
    });
  },

  submitScore(difficulty: Difficulty, score: number): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>("/api/game/score", {
      method: "POST",
      body: JSON.stringify({ difficulty, score }),
    });
  },

  leaderboard(difficulty: Difficulty): Promise<LeaderboardEntry[]> {
    return request<LeaderboardEntry[]>(`/api/game/leaderboard?difficulty=${difficulty}`);
  },

  adminRequests(): Promise<AdminRequestItem[]> {
    return request<AdminRequestItem[]>("/api/admin/requests");
  },

  adminUsers(): Promise<AdminUserItem[]> {
    return request<AdminUserItem[]>("/api/admin/users");
  },

  approveRequest(requestId: number, reason?: string): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>(`/api/admin/requests/${requestId}/approve`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },

  rejectRequest(requestId: number, reason?: string): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>(`/api/admin/requests/${requestId}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },
};

export { ApiError };
