import { useEffect, useRef, useState } from "react";
import { fetchDay, sendEvent, subscribeState, clearEvents } from "./api";
import "./styles.css";

const CANVAS_BG = "#fffaf3";
const STROKE_COLOR = "#f7a6c4";
const STROKE_WIDTH = 4;

function resizeCanvas(canvas) {
  const { width, height } = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  canvas._displayWidth = width;
  canvas._displayHeight = height;
}

function drawEvents(ctx, events, canvas) {
  const displayWidth = canvas._displayWidth || canvas.width;
  const displayHeight = canvas._displayHeight || canvas.height;
  
  ctx.clearRect(0, 0, displayWidth, displayHeight);
  ctx.fillStyle = CANVAS_BG;
  ctx.fillRect(0, 0, displayWidth, displayHeight);

  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const event of events) {
    if (event.kind !== "stroke") continue;
    const { points = [] } = event.payload || {};
    if (!points.length) continue;
    
    const normalizedPoints = points.map(p => {
      if (p.x <= 1 && p.y <= 1 && typeof p.x === 'number' && typeof p.y === 'number') {
        return {
          x: p.x * displayWidth,
          y: p.y * displayHeight
        };
      }
      return p;
    });
    
    ctx.strokeStyle = event.payload.color || STROKE_COLOR;
    ctx.lineWidth = event.payload.width || STROKE_WIDTH;
    ctx.beginPath();
    ctx.moveTo(normalizedPoints[0].x, normalizedPoints[0].y);
    for (let i = 1; i < normalizedPoints.length; i += 1) {
      ctx.lineTo(normalizedPoints[i].x, normalizedPoints[i].y);
    }
    ctx.stroke();
  }
}

function Heart({ delay, duration, left }) {
  return (
    <div
      className="heart-fall"
      style={{
        left: `${left}%`,
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`,
      }}
    >
      💖
    </div>
  );
}

function LandingScreen({ onEnter }) {
  const [hearts, setHearts] = useState([]);

  useEffect(() => {
    const newHearts = [];
    for (let i = 0; i < 20; i++) {
      newHearts.push({
        id: i,
        delay: Math.random() * 3,
        duration: 3 + Math.random() * 2,
        left: Math.random() * 100,
      });
    }
    setHearts(newHearts);
  }, []);

  return (
    <div className="landing" onClick={onEnter}>
      <div className="landing-content">
        <div className="landing-title">Minnoşum Berfin 💖</div>
        <div className="landing-subtitle">Kalpli panona hoş geldin</div>
        <div className="landing-hint">Tıkla ve başla ✨</div>
      </div>
      <div className="hearts-container">
        {hearts.map((heart) => (
          <Heart key={heart.id} {...heart} />
        ))}
      </div>
    </div>
  );
}

function App() {
  const canvasRef = useRef(null);
  const [events, setEvents] = useState([]);
  const [day, setDay] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showLanding, setShowLanding] = useState(true);
  const drawingRef = useRef({
    active: false,
    points: [],
  });
  const params = new URLSearchParams(window.location.search);
  const role = params.get("role") || "write";
  const canDraw = role !== "view";

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      try {
        const { day: d } = await fetchDay();
        setDay(d);
        unsub = subscribeState(({ day: dd, events: evts }) => {
          setDay(dd);
          setEvents(evts || []);
          setLoading(false);
        });
        setError("");
      } catch (err) {
        setError(err.message || "Bağlantı hatası");
        setLoading(false);
      }
    })();
    return () => unsub && unsub();
  }, []);

  useEffect(() => {
    if (showLanding) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    resizeCanvas(canvas);
    const ctx = canvas.getContext("2d");
    drawEvents(ctx, events, canvas);
  }, [events, showLanding]);

  useEffect(() => {
    if (showLanding) return;
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      resizeCanvas(canvas);
      const ctx = canvas.getContext("2d");
      drawEvents(ctx, events, canvas);
    };
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, [events, showLanding]);

  const handlePointerDown = (e) => {
    if (!canDraw) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const displayWidth = canvas._displayWidth || rect.width;
    const displayHeight = canvas._displayHeight || rect.height;
    
    const x = (e.clientX - rect.left) / displayWidth;
    const y = (e.clientY - rect.top) / displayHeight;
    
    drawingRef.current.active = true;
    drawingRef.current.points = [{ x, y }];
  };

  const handlePointerMove = (e) => {
    if (!canDraw || !drawingRef.current.active) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const displayWidth = canvas._displayWidth || rect.width;
    const displayHeight = canvas._displayHeight || rect.height;
    
    const x = (e.clientX - rect.left) / displayWidth;
    const y = (e.clientY - rect.top) / displayHeight;
    
    drawingRef.current.points.push({ x, y });

    const ctx = canvas.getContext("2d");
    const tempEvents = [
      ...events,
      { kind: "stroke", payload: { points: drawingRef.current.points } },
    ];
    drawEvents(ctx, tempEvents, canvas);
  };

  const handlePointerUp = async () => {
    if (!canDraw) return;
    if (!drawingRef.current.active || drawingRef.current.points.length < 2) {
      drawingRef.current.active = false;
      drawingRef.current.points = [];
      return;
    }
    const stroke = {
      kind: "stroke",
      payload: {
        points: drawingRef.current.points,
        color: STROKE_COLOR,
        width: STROKE_WIDTH,
      },
    };
    drawingRef.current.active = false;
    drawingRef.current.points = [];
    setEvents((prev) => [...prev, stroke]);

    try {
      await sendEvent(stroke);
      setError("");
    } catch (err) {
      setError(err.message || "Gönderilemedi");
    }
  };

  const handleClear = async () => {
    if (!canDraw) return;
    if (!window.confirm("Tüm çizimleri silmek istediğinden emin misin?")) {
      return;
    }
    try {
      await clearEvents();
      setEvents([]);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        const displayWidth = canvas._displayWidth || canvas.width;
        const displayHeight = canvas._displayHeight || canvas.height;
        ctx.clearRect(0, 0, displayWidth, displayHeight);
        ctx.fillStyle = CANVAS_BG;
        ctx.fillRect(0, 0, displayWidth, displayHeight);
      }
      setError("");
    } catch (err) {
      setError(err.message || "Silinemedi");
    }
  };

  if (showLanding) {
    return <LandingScreen onEnter={() => setShowLanding(false)} />;
  }

  return (
    <div className="app">
      <div className="header">
        <div className="header-left">
          <div className="header-title">Minnoşum Berfin 💖</div>
          <div className="header-day">Gün {day || "—"}</div>
        </div>
        <div className="header-right">
          {canDraw && (
            <button className="clear-button" onClick={handleClear} title="Tümünü Sil">
              🗑️ Sil
            </button>
          )}
          {!canDraw && <div className="view-badge">Sadece Görüntüleme</div>}
        </div>
      </div>

      <div className="canvas-container">
        {loading ? (
          <div className="loading">Yükleniyor...</div>
        ) : (
          <canvas
            ref={canvasRef}
            className="canvas"
            style={{
              pointerEvents: canDraw ? "auto" : "none",
              cursor: canDraw ? "crosshair" : "not-allowed",
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
        )}
      </div>

      {error && <div className="error-message">{error}</div>}
    </div>
  );
}

export default App;
