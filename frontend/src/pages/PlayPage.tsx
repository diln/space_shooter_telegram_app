import { useEffect, useRef, useState } from "react";

import { ApiError, api } from "../api/client";
import { SpaceShooterEngine } from "../game/engine";
import type { Difficulty, LeaderboardEntry } from "../types/domain";

const difficulties: Difficulty[] = ["easy", "normal", "hard"];

export function PlayPage(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<SpaceShooterEngine | null>(null);
  const scoreSubmittedRef = useRef(false);

  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [left, setLeft] = useState(false);
  const [right, setRight] = useState(false);
  const [shoot, setShoot] = useState(false);

  const loadLeaderboard = async (value: Difficulty): Promise<void> => {
    try {
      const data = await api.leaderboard(value);
      setLeaderboard(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load leaderboard");
      }
    }
  };

  useEffect(() => {
    void loadLeaderboard(difficulty);
  }, [difficulty]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.code === "ArrowLeft" || event.code === "KeyA") setLeft(true);
      if (event.code === "ArrowRight" || event.code === "KeyD") setRight(true);
      if (event.code === "Space") setShoot(true);
      if (event.code === "Escape") setPaused((p) => !p);
    };

    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.code === "ArrowLeft" || event.code === "KeyA") setLeft(false);
      if (event.code === "ArrowRight" || event.code === "KeyD") setRight(false);
      if (event.code === "Space") setShoot(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setControls({ left, right, shoot });
  }, [left, right, shoot]);

  useEffect(() => {
    engineRef.current?.setPaused(paused);
  }, [paused]);

  useEffect(() => {
    return () => {
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, []);

  const saveScore = async (value: number): Promise<void> => {
    try {
      await api.submitScore(difficulty, value);
      await loadLeaderboard(difficulty);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to save score");
      }
    }
  };

  const startGame = (): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    engineRef.current?.destroy();
    setError(null);

    setScore(0);
    setGameOver(false);
    setPaused(false);
    setStarted(true);
    scoreSubmittedRef.current = false;

    const engine = new SpaceShooterEngine(canvas, difficulty);
    engineRef.current = engine;
    engine.start((snapshot) => {
      setScore(snapshot.score);
      setPaused(snapshot.isPaused);
      if (snapshot.isGameOver) {
        setGameOver(true);
        engine.destroy();
        if (!scoreSubmittedRef.current) {
          scoreSubmittedRef.current = true;
          void saveScore(snapshot.score);
        }
      }
    });
  };

  return (
    <main className="card play">
      <section className="hero">
        <p className="eyebrow">Arcade Mode</p>
        <h1>Space Shooter</h1>
      </section>

      <section className="difficulty-grid">
        {difficulties.map((item) => (
          <button
            key={item}
            className={`btn ${difficulty === item ? "primary" : ""}`}
            onClick={() => setDifficulty(item)}
            disabled={started && !gameOver}
          >
            {item.toUpperCase()}
          </button>
        ))}
      </section>

      <div className="hud panel">
        <span>Score: {score}</span>
        {started && !gameOver && (
          <button className="btn" onClick={() => setPaused((value) => !value)}>
            {paused ? "Resume" : "Pause"}
          </button>
        )}
      </div>

      <section className="game-shell">
        <canvas ref={canvasRef} width={360} height={540} className="game-canvas" />
      </section>

      {!started && (
        <button className="btn primary" onClick={startGame}>
          Start
        </button>
      )}

      {gameOver && (
        <section className="panel">
          <h2>Game Over</h2>
          <p>Final score: {score}</p>
          <button className="btn primary" onClick={startGame}>
            Ещё раз
          </button>
        </section>
      )}

      <section className="touch-controls panel">
        <button
          className="btn"
          onTouchStart={() => setLeft(true)}
          onTouchEnd={() => setLeft(false)}
          onMouseDown={() => setLeft(true)}
          onMouseUp={() => setLeft(false)}
          onMouseLeave={() => setLeft(false)}
        >
          Left
        </button>
        <button
          className="btn"
          onTouchStart={() => setShoot(true)}
          onTouchEnd={() => setShoot(false)}
          onMouseDown={() => setShoot(true)}
          onMouseUp={() => setShoot(false)}
          onMouseLeave={() => setShoot(false)}
        >
          Fire
        </button>
        <button
          className="btn"
          onTouchStart={() => setRight(true)}
          onTouchEnd={() => setRight(false)}
          onMouseDown={() => setRight(true)}
          onMouseUp={() => setRight(false)}
          onMouseLeave={() => setRight(false)}
        >
          Right
        </button>
      </section>

      <section className="panel">
        <h2>Leaderboard ({difficulty})</h2>
        {error && <p className="error">{error}</p>}
        <ol className="leaderboard">
          {leaderboard.map((entry) => (
            <li key={`${entry.user_id}-${entry.score}`} className="leaderboard-item">
              <span>
                {entry.first_name}
                {entry.username ? ` (@${entry.username})` : ""}
              </span>
              <strong>{entry.score}</strong>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
