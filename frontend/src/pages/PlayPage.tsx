import { type PointerEvent, useEffect, useMemo, useRef, useState } from "react";

import { ApiError, api } from "../api/client";
import { loadGameAssets, type GameAssets } from "../game/assets";
import { SpaceShooterEngine } from "../game/engine";
import type { Difficulty, LeaderboardEntry } from "../types/domain";

const difficulties: Difficulty[] = ["easy", "normal", "hard"];
const JOYSTICK_RADIUS = 42;
const CANVAS_WIDTH = 390;
const CANVAS_HEIGHT = 640;

export function PlayPage(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<SpaceShooterEngine | null>(null);
  const scoreSubmittedRef = useRef(false);
  const joystickRef = useRef<HTMLDivElement | null>(null);
  const joystickPointerIdRef = useRef<number | null>(null);
  const firePointerIdRef = useRef<number | null>(null);

  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<GameAssets | null>(null);
  const [assetsLoading, setAssetsLoading] = useState(true);

  const [keyboardLeft, setKeyboardLeft] = useState(false);
  const [keyboardRight, setKeyboardRight] = useState(false);
  const [keyboardShoot, setKeyboardShoot] = useState(false);
  const [touchMoveX, setTouchMoveX] = useState(0);
  const [touchShoot, setTouchShoot] = useState(false);
  const [joystickOffset, setJoystickOffset] = useState({ x: 0, y: 0, active: false });

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
    setAssetsLoading(true);
    loadGameAssets()
      .then((loadedAssets) => {
        setAssets(loadedAssets);
      })
      .catch(() => {
        setError("Failed to load game assets");
      })
      .finally(() => setAssetsLoading(false));
  }, []);

  const moveX = useMemo(() => {
    const keyboardAxis = (keyboardLeft ? -1 : 0) + (keyboardRight ? 1 : 0);
    return Math.max(-1, Math.min(1, keyboardAxis + touchMoveX));
  }, [keyboardLeft, keyboardRight, touchMoveX]);

  const shoot = keyboardShoot || touchShoot;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.code === "ArrowLeft" || event.code === "KeyA") {
        setKeyboardLeft(true);
        event.preventDefault();
      }
      if (event.code === "ArrowRight" || event.code === "KeyD") {
        setKeyboardRight(true);
        event.preventDefault();
      }
      if (event.code === "Space") {
        setKeyboardShoot(true);
        event.preventDefault();
      }
      if ((event.code === "Escape" || event.code === "KeyP") && !event.repeat) {
        setPaused((p) => !p);
      }
    };

    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.code === "ArrowLeft" || event.code === "KeyA") setKeyboardLeft(false);
      if (event.code === "ArrowRight" || event.code === "KeyD") setKeyboardRight(false);
      if (event.code === "Space") setKeyboardShoot(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setControls({ moveX, shoot });
  }, [moveX, shoot]);

  useEffect(() => {
    engineRef.current?.setPaused(paused);
  }, [paused]);

  useEffect(() => {
    if (!started || paused || gameOver) {
      setTouchMoveX(0);
      setTouchShoot(false);
      setJoystickOffset({ x: 0, y: 0, active: false });
    }
  }, [started, paused, gameOver]);

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
    if (!canvas || !assets) return;

    engineRef.current?.destroy();
    setError(null);

    setScore(0);
    setGameOver(false);
    setPaused(false);
    setStarted(true);
    scoreSubmittedRef.current = false;

    const engine = new SpaceShooterEngine(canvas, difficulty, assets);
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

  const onJoystickPointerMove = (clientX: number, clientY: number): void => {
    const joystick = joystickRef.current;
    if (!joystick) return;
    const rect = joystick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    let dx = clientX - cx;
    let dy = clientY - cy;
    const distance = Math.hypot(dx, dy);

    if (distance > JOYSTICK_RADIUS) {
      const factor = JOYSTICK_RADIUS / distance;
      dx *= factor;
      dy *= factor;
    }

    setJoystickOffset({ x: dx, y: dy, active: true });
    setTouchMoveX(dx / JOYSTICK_RADIUS);
  };

  const onJoystickDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (!started || paused || gameOver) return;
    joystickPointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    onJoystickPointerMove(event.clientX, event.clientY);
  };

  const onJoystickMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (joystickPointerIdRef.current !== event.pointerId) return;
    onJoystickPointerMove(event.clientX, event.clientY);
  };

  const resetJoystick = (pointerId: number): void => {
    if (joystickPointerIdRef.current !== pointerId) return;
    joystickPointerIdRef.current = null;
    setJoystickOffset({ x: 0, y: 0, active: false });
    setTouchMoveX(0);
  };

  const onFireDown = (event: PointerEvent<HTMLButtonElement>): void => {
    if (!started || paused || gameOver) return;
    firePointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    setTouchShoot(true);
  };

  const resetFire = (pointerId: number): void => {
    if (firePointerIdRef.current !== pointerId) return;
    firePointerIdRef.current = null;
    setTouchShoot(false);
  };

  return (
    <main className="card play play-upgraded">
      <section className="hero">
        <p className="eyebrow">Tactical Flight</p>
        <h1>Space Shooter</h1>
      </section>

      <section className="panel difficulty-panel">
        <div className="difficulty-grid">
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
        </div>
        <p className="muted desktop-hint">
          Desktop: <kbd>A</kbd>/<kbd>D</kbd> или <kbd>&larr;</kbd>/<kbd>&rarr;</kbd>, огонь <kbd>Space</kbd>, пауза{" "}
          <kbd>Esc</kbd>/<kbd>P</kbd>.
        </p>
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
        <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="game-canvas" />
        {assetsLoading && <div className="game-overlay">Loading visual pack...</div>}
        {paused && !gameOver && <div className="game-overlay">Paused</div>}
      </section>

      {!started && (
        <button className="btn primary" onClick={startGame} disabled={assetsLoading || !assets}>
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

      <section className="panel control-deck">
        <div
          ref={joystickRef}
          className={`joystick-pad ${joystickOffset.active ? "active" : ""}`}
          onPointerDown={onJoystickDown}
          onPointerMove={onJoystickMove}
          onPointerUp={(event) => resetJoystick(event.pointerId)}
          onPointerCancel={(event) => resetJoystick(event.pointerId)}
          onLostPointerCapture={(event) => resetJoystick(event.pointerId)}
        >
          <div className="joystick-base" />
          <div
            className="joystick-knob"
            style={{ transform: `translate(${joystickOffset.x}px, ${joystickOffset.y}px)` }}
          />
        </div>

        <button
          className={`fire-pad ${touchShoot ? "active" : ""}`}
          onPointerDown={onFireDown}
          onPointerUp={(event) => resetFire(event.pointerId)}
          onPointerCancel={(event) => resetFire(event.pointerId)}
          onLostPointerCapture={(event) => resetFire(event.pointerId)}
        >
          FIRE
        </button>
        <p className="touch-hint">Движение: левый стик. Огонь: удерживайте FIRE.</p>
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
