import { useEffect, useState } from "react";

import { ApiError, api } from "../api/client";
import type { AdminRequestItem, AdminUserItem } from "../types/domain";

export function AdminPage(): JSX.Element {
  const [requests, setRequests] = useState<AdminRequestItem[]>([]);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (): Promise<void> => {
    try {
      setLoading(true);
      const [reqData, userData] = await Promise.all([api.adminRequests(), api.adminUsers()]);
      setRequests(reqData);
      setUsers(userData);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load admin data");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const decide = async (requestId: number, action: "approve" | "reject"): Promise<void> => {
    const reason = window.prompt("Reason (optional):") ?? undefined;
    try {
      if (action === "approve") {
        await api.approveRequest(requestId, reason);
      } else {
        await api.rejectRequest(requestId, reason);
      }
      await loadData();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to process decision");
      }
    }
  };

  if (loading) {
    return <main className="card"><p className="status">Loading admin panel...</p></main>;
  }

  const pendingCount = requests.filter((item) => item.status === "PENDING").length;
  const approvedCount = users.filter((item) => item.status === "APPROVED").length;
  const rejectedCount = users.filter((item) => item.status === "REJECTED").length;

  return (
    <main className="card admin admin-grid">
      <h1>Admin Panel</h1>
      <section className="metric-grid">
        <article className="metric">
          <p>Pending Requests</p>
          <strong>{pendingCount}</strong>
        </article>
        <article className="metric">
          <p>Approved Users</p>
          <strong>{approvedCount}</strong>
        </article>
        <article className="metric">
          <p>Rejected Users</p>
          <strong>{rejectedCount}</strong>
        </article>
      </section>
      {error && <p className="error">{error}</p>}

      <section className="panel">
        <h2>Join Requests</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Telegram ID</th>
                <th>Username</th>
                <th>Name</th>
                <th>Status</th>
                <th>Comment</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((item) => (
                <tr key={item.request_id}>
                  <td>{new Date(item.created_at).toLocaleString()}</td>
                  <td>{item.telegram_id}</td>
                  <td>{item.username ? `@${item.username}` : "-"}</td>
                  <td>{`${item.first_name} ${item.last_name ?? ""}`.trim()}</td>
                  <td>
                    <span className={`status-pill status-${item.status.toLowerCase()}`}>{item.status}</span>
                  </td>
                  <td>{item.comment ?? item.decision_reason ?? "-"}</td>
                  <td>
                    {item.status === "PENDING" ? (
                      <div className="actions">
                        <button className="btn primary" onClick={() => void decide(item.request_id, "approve")}>
                          Approve
                        </button>
                        <button className="btn danger" onClick={() => void decide(item.request_id, "reject")}>
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span>-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>Users</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Telegram ID</th>
                <th>Username</th>
                <th>Name</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {users.map((item) => (
                <tr key={item.id}>
                  <td>{item.telegram_id}</td>
                  <td>{item.username ? `@${item.username}` : "-"}</td>
                  <td>{`${item.first_name} ${item.last_name ?? ""}`.trim()}</td>
                  <td>
                    <span className={`status-pill status-${item.status.toLowerCase()}`}>{item.status}</span>
                  </td>
                  <td>{new Date(item.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
