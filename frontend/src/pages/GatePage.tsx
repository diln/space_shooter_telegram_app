import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { ApiError, api } from "../api/client";
import { useAuth } from "../contexts/AuthContext";

export function GatePage(): JSX.Element {
  const { loading, error, session, access, refreshAccess } = useAuth();
  const [comment, setComment] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const status = useMemo(() => access?.status ?? session?.status, [access, session]);

  const onRequestAccess = async (): Promise<void> => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await api.requestAccess(comment || undefined);
      await refreshAccess();
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(err.message);
      } else {
        setSubmitError("Failed to submit request");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <main className="card"><p className="status">Loading...</p></main>;
  }

  if (error) {
    return (
      <main className="card">
        <h1>Authorization Error</h1>
        <p>{error}</p>
      </main>
    );
  }

  return (
    <main className="card gate-card">
      <section className="hero">
        <p className="eyebrow">Access Control</p>
        <h1>Space Shooter Command Deck</h1>
        <p className="muted">
          Pilot: <strong>{session?.user.first_name}</strong>
          {session?.user.username ? ` (@${session.user.username})` : ""}
        </p>
      </section>

      {status === "APPROVED" && (
        <section className="panel">
          <h2>Access granted</h2>
          <p className="muted">You are approved. Launch gameplay and compete on leaderboard.</p>
          <div className="actions">
            <Link className="btn primary" to="/play">
              Play
            </Link>
            {session?.is_admin && (
              <Link className="btn" to="/admin">
                Admin Panel
              </Link>
            )}
          </div>
        </section>
      )}

      {status === "NEW" && (
        <section className="panel">
          <h2>Доступ не выдан</h2>
          <p className="muted">Отправьте заявку администратору, чтобы получить доступ к игре.</p>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={1024}
            placeholder="Комментарий (опционально)"
          />
          <button className="btn primary" onClick={onRequestAccess} disabled={submitting}>
            {submitting ? "Отправка..." : "Запросить доступ"}
          </button>
        </section>
      )}

      {status === "REQUESTED" && (
        <section className="panel">
          <h2>Заявка отправлена</h2>
          <p className="muted">Ожидайте решения администратора. После апрува откроется режим игры.</p>
          <button className="btn" onClick={() => void refreshAccess()}>
            Обновить статус
          </button>
        </section>
      )}

      {status === "REJECTED" && (
        <section className="panel">
          <h2>Заявка отклонена</h2>
          <p className="muted">{access?.request?.decision_reason ?? "Причина не указана"}</p>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={1024}
            placeholder="Новый комментарий (опционально)"
          />
          <button className="btn primary" onClick={onRequestAccess} disabled={submitting}>
            {submitting ? "Отправка..." : "Подать заново"}
          </button>
        </section>
      )}

      {submitError && <p className="error">{submitError}</p>}
    </main>
  );
}
