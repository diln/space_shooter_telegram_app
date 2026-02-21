export type UserStatus = "NEW" | "REQUESTED" | "APPROVED" | "REJECTED";
export type JoinRequestStatus = "PENDING" | "APPROVED" | "REJECTED";
export type Difficulty = "easy" | "normal" | "hard";

export interface User {
  id: number;
  telegram_id: number;
  username: string | null;
  first_name: string;
  last_name: string | null;
  photo_url: string | null;
  status: UserStatus;
}

export interface AuthResponse {
  user: User;
  status: UserStatus;
  is_admin: boolean;
}

export interface AccessRequestInfo {
  id: number;
  status: JoinRequestStatus;
  comment: string | null;
  decision_reason: string | null;
}

export interface AccessStatus {
  status: UserStatus;
  request: AccessRequestInfo | null;
}

export interface LeaderboardEntry {
  user_id: number;
  telegram_id: number;
  username: string | null;
  first_name: string;
  score: number;
  achieved_at: string;
}

export interface AdminRequestItem {
  request_id: number;
  created_at: string;
  status: JoinRequestStatus;
  comment: string | null;
  decision_reason: string | null;
  telegram_id: number;
  username: string | null;
  first_name: string;
  last_name: string | null;
}

export interface AdminUserItem {
  id: number;
  telegram_id: number;
  username: string | null;
  first_name: string;
  last_name: string | null;
  status: UserStatus;
  created_at: string;
}
