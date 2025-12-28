import { useEffect, useRef, useState } from "react";
import { fetchDay, sendEvent, subscribeState } from "./api";

const CANVAS_BG = "#fffaf3"; // kırık beyaz
const STROKE_COLOR = "#f7a6c4"; // toz pembe
const STROKE_WIDTH = 4;

function resizeCanvas(canvas) {
  const { width, height } = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
}

function drawEvents(ctx, events) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = CANVAS_BG;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const event of events) {
    if (event.kind !== "stroke") continue;
    const { points = [] } = event.payload || {};
    if (!points.length) continue;
    ctx.strokeStyle = event.payload.color || STROKE_COLOR;
    ctx.lineWidth = event.payload.width || STROKE_WIDTH;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
  }
}

function App() {
  const canvasRef = useRef(null);
  const [events, setEvents] = useState([]);
  const [day, setDay] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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
    const canvas = canvasRef.current;
    if (!canvas) return;
    resizeCanvas(canvas);
    const ctx = canvas.getContext("2d");
    drawEvents(ctx, events);
  }, [events]);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      resizeCanvas(canvas);
      const ctx = canvas.getContext("2d");
      drawEvents(ctx, events);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [events]);

  const handlePointerDown = (e) => {
    if (!canDraw) return;
    const rect = canvasRef.current.getBoundingClientRect();
    drawingRef.current.active = true;
    drawingRef.current.points = [
      { x: e.clientX - rect.left, y: e.clientY - rect.top },
    ];
  };

  const handlePointerMove = (e) => {
    if (!canDraw || !drawingRef.current.active) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    drawingRef.current.points.push(point);

    const ctx = canvasRef.current.getContext("2d");
    const tempEvents = [
      ...events,
      { kind: "stroke", payload: { points: drawingRef.current.points } },
    ];
    drawEvents(ctx, tempEvents);
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

  return (
    <div className="shell">
      <div className="hero">
        <div className="hero__text">
          <p className="eyebrow">berfin için minnoş alan</p>
          <h1 className="hero__title">Minnoşum Berfin’in kalpli panosu</h1>
          <p className="hero__subtitle">
            Gün {day || "—"}; çizdiklerin ve notların anında bizde. Mod:{" "}
            <span className="badge">
              {canDraw ? "Çiz / Yaz (minnoş)" : "Sadece Gör (kalpli)"}
            </span>
          </p>
          <div className="hero__tip">Kırık beyaz zemin, toz pembe çizgiler; bu pano sadece minnoşum için.</div>
        </div>
        <div className="card">
          <div className="card__title">Berfin’e minik not</div>
          <ul className="card__list">
            <li>Parmağınla ya da mouse ile kalpli çizgiler çiz.</li>
            <li>View rolünde açarsan sadece izlemede kalır.</li>
            <li>Her gün yeni ve temiz bir sayfa, sadece minnoşuma özel.</li>
          </ul>
          {error && <div className="error">{error}</div>}
        </div>
      </div>

      <div className="board">
        {loading ? (
          <div className="empty">Yükleniyor…</div>
        ) : (
          <div className="canvas-shell">
                <div className="board-label">Berfin’in kalp dolu anları ✨</div>
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
                <div className="board-footer">Minnoşum, çizdiklerin burada saklı 💖</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

