// UI for browsing and solving puzzles. Puzzle data lives in puzzles.js.

const STORAGE_KEY = "puzzles.solved";

const state = {
  currentId: PUZZLES[0]?.id,
  hintsShown: 0,
  showConstruction: false,
  showSolution: false,
  feedback: null, // { ok: boolean, text: string }
  solved: loadSolved(),
  draw: {
    enabled: false,
    tool: "pen", // pen | line | circle | text | eraser
    color: "#e11d48",
    width: 3,
  },
  drawings: loadDrawings(), // { [puzzleId]: Stroke[] }, points normalized to 0..1
};

const DRAW_COLORS = ["#e11d48", "#2563eb", "#16a34a", "#0f172a"];
const DRAW_TOOLS = [
  { id: "pen", label: "✎ Pen" },
  { id: "line", label: "╱ Line" },
  { id: "circle", label: "◯ Circle" },
  { id: "text", label: "T Text" },
  { id: "eraser", label: "⌫ Eraser" },
];

function loadSolved() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY)) || []);
  } catch {
    return new Set();
  }
}

function saveSolved() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.solved]));
  } catch {
    // Storage unavailable (private mode etc.) – progress just won't persist.
  }
}

const DRAWINGS_KEY = "puzzles.drawings";

function loadDrawings() {
  try {
    return JSON.parse(localStorage.getItem(DRAWINGS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveDrawings() {
  try {
    localStorage.setItem(DRAWINGS_KEY, JSON.stringify(state.drawings));
  } catch {
    // Storage unavailable – drawings last only for this session.
  }
}

function strokesFor(id) {
  return (state.drawings[id] ||= []);
}

// ---- Drawing layer --------------------------------------------------------
// A canvas sits on top of the SVG figure. Strokes are stored in normalized
// coordinates (0..1) so they survive re-renders and resizes.
//
// Stroke types:
//   path   – points: freehand or straight line (default for older saves)
//   circle – points: [centre, point on the circumference]
//   text   – points: [baseline start], text

const textFont = (w) => `600 ${Math.round(w * 0.06)}px ui-sans-serif, system-ui, sans-serif`;

function circleRadius(stroke, w, h) {
  const [[cx, cy], [ex, ey]] = stroke.points;
  return Math.hypot((ex - cx) * w, (ey - cy) * h);
}

function textBounds(ctx, stroke, w, h) {
  ctx.font = textFont(w);
  const width = ctx.measureText(stroke.text).width;
  const size = w * 0.06;
  const [x, y] = stroke.points[0];
  return { x: x * w, y: y * h - size, width, height: size * 1.2 };
}

function paintStroke(ctx, stroke, w, h) {
  const pts = stroke.points;
  if (!pts.length) return;
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (stroke.type === "text") {
    ctx.font = textFont(w);
    ctx.fillText(stroke.text, pts[0][0] * w, pts[0][1] * h);
    return;
  }
  if (stroke.type === "circle") {
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.arc(pts[0][0] * w, pts[0][1] * h, circleRadius(stroke, w, h), 0, Math.PI * 2);
    ctx.stroke();
    // Small dot marking the centre.
    ctx.beginPath();
    ctx.arc(pts[0][0] * w, pts[0][1] * h, stroke.width * 0.8, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0][0] * w, pts[0][1] * h, stroke.width / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(pts[0][0] * w, pts[0][1] * h);
  for (const [x, y] of pts.slice(1)) ctx.lineTo(x * w, y * h);
  ctx.stroke();
}

function distToSegment(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

let canvasObserver = null;

function setupCanvas(canvas, puzzleId) {
  const ctx = canvas.getContext("2d");
  const strokes = strokesFor(puzzleId);
  let current = null; // stroke being drawn

  function size() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
  }

  function redraw() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    for (const s of strokes) paintStroke(ctx, s, w, h);
    if (current) paintStroke(ctx, current, w, h);
  }

  function point(e) {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  }

  function hits(stroke, p) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const tolerance = 10 / w;
    const pts = stroke.points;
    if (stroke.type === "text") {
      const b = textBounds(ctx, stroke, w, h);
      const x = p[0] * w, y = p[1] * h;
      return x >= b.x - 6 && x <= b.x + b.width + 6 && y >= b.y - 6 && y <= b.y + b.height + 6;
    }
    if (stroke.type === "circle") {
      const d = Math.hypot((p[0] - pts[0][0]) * w, (p[1] - pts[0][1]) * h);
      return Math.abs(d - circleRadius(stroke, w, h)) < 10 || d < 10;
    }
    return pts.length === 1
      ? Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]) < tolerance
      : pts.some((pt, j) => j > 0 && distToSegment(p, pts[j - 1], pt) < tolerance);
  }

  function eraseAt(p) {
    for (let i = strokes.length - 1; i >= 0; i--) {
      if (hits(strokes[i], p)) strokes.splice(i, 1);
    }
    redraw();
  }

  // Shows an inline text box at the clicked point; Enter or blur commits it.
  function placeText(p, e) {
    const wrapper = canvas.parentElement;
    wrapper.querySelector(".draw-text-input")?.remove();
    const r = canvas.getBoundingClientRect();
    const size = Math.round(canvas.clientWidth * 0.06);
    const input = document.createElement("input");
    input.className = "draw-text-input absolute z-10 rounded border border-indigo-400 bg-white/90 px-1 font-semibold shadow focus:outline-none";
    Object.assign(input.style, {
      left: `${e.clientX - r.left}px`,
      top: `${e.clientY - r.top - size}px`,
      fontSize: `${size}px`,
      color: state.draw.color,
      width: "8em",
    });
    input.placeholder = "Text…";
    wrapper.appendChild(input);
    setTimeout(() => input.focus());

    let done = false;
    const commit = (keep) => {
      if (done) return;
      done = true;
      const text = input.value.trim();
      input.remove();
      if (keep && text) {
        strokes.push({ type: "text", color: state.draw.color, width: state.draw.width, points: [p], text });
        saveDrawings();
        redraw();
        updateDrawButtons();
      }
    };
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") commit(true);
      if (ev.key === "Escape") commit(false);
    });
    input.addEventListener("blur", () => commit(true));
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (!state.draw.enabled) return;
    canvas.setPointerCapture(e.pointerId);
    const p = point(e);
    if (state.draw.tool === "eraser") {
      current = { erasing: true };
      eraseAt(p);
      return;
    }
    if (state.draw.tool === "text") {
      e.preventDefault(); // keep focus on the new text box
      placeText(p, e);
      return;
    }
    const type = state.draw.tool === "circle" ? "circle" : "path";
    current = { type, color: state.draw.color, width: state.draw.width, points: [p] };
    redraw();
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!current) return;
    const p = point(e);
    if (current.erasing) eraseAt(p);
    else if (state.draw.tool === "line" || state.draw.tool === "circle") current.points = [current.points[0], p];
    else current.points.push(p);
    if (!current.erasing) redraw();
  });

  const finish = () => {
    if (!current) return;
    // A circle needs a drag to define its radius; ignore plain clicks.
    const emptyCircle = current.type === "circle" && current.points.length < 2;
    if (!current.erasing && !emptyCircle) strokes.push(current);
    current = null;
    saveDrawings();
    redraw();
    updateDrawButtons();
  };
  canvas.addEventListener("pointerup", finish);
  canvas.addEventListener("pointercancel", finish);

  canvasObserver?.disconnect();
  canvasObserver = new ResizeObserver(size);
  canvasObserver.observe(canvas);
}

function updateDrawButtons() {
  const empty = !strokesFor(state.currentId).length;
  document.querySelectorAll("[data-needs-strokes]").forEach((b) => (b.disabled = empty));
}

function renderDrawToolbar(btn) {
  const d = state.draw;
  if (!d.enabled) return "";
  const pill = (active) =>
    `rounded-lg border px-3 py-1.5 text-sm ${active ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 hover:bg-slate-100"}`;
  return `
    <div class="mt-3 flex flex-wrap items-center justify-center gap-2">
      ${DRAW_TOOLS.map((t) => `<button data-tool="${t.id}" class="${pill(d.tool === t.id)}">${t.label}</button>`).join("")}
      <span class="mx-1 h-6 w-px bg-slate-200"></span>
      ${DRAW_COLORS.map((c) => `
        <button data-color="${c}" aria-label="Color ${c}"
          class="h-7 w-7 rounded-full border-2 ${d.color === c ? "border-slate-900 ring-2 ring-slate-300" : "border-white shadow"}"
          style="background:${c}"></button>`).join("")}
      <span class="mx-1 h-6 w-px bg-slate-200"></span>
      <button id="undo-btn" data-needs-strokes class="${btn}">Undo</button>
      <button id="clear-btn" data-needs-strokes class="${btn}">Clear</button>
    </div>`;
}

// Parses answers like "11.657", "6+4√2", "6 + 4*sqrt(2)", "(2+√2)^2", "2pi".
// Returns a number, or NaN when the input is not a valid expression.
function evaluateAnswer(input) {
  let expr = input.trim().toLowerCase().replace(/,/g, ".").replace(/\s+/g, "");
  if (!expr) return NaN;

  expr = expr
    .replace(/π/g, "pi")
    .replace(/√(\d+(?:\.\d+)?)/g, "sqrt($1)") // √2 -> sqrt(2)
    .replace(/√\(/g, "sqrt(")                 // √(x) -> sqrt(x)
    .replace(/\^/g, "**")
    .replace(/(\d|\))(?=sqrt|pi|\()/g, "$1*")  // implicit multiplication: 4sqrt(2), 2pi, 2(3)
    .replace(/(pi)(?=\d|\(|sqrt)/g, "$1*");

  // Only allow numbers, operators, parentheses and the two known names.
  const stripped = expr.replace(/sqrt|pi/g, "");
  if (!/^[\d.+\-*/()]*$/.test(stripped)) return NaN;

  try {
    const value = Function("sqrt", "pi", `"use strict"; return (${expr});`)(Math.sqrt, Math.PI);
    return typeof value === "number" ? value : NaN;
  } catch {
    return NaN;
  }
}

function currentPuzzle() {
  return PUZZLES.find((p) => p.id === state.currentId);
}

function selectPuzzle(id) {
  Object.assign(state, {
    currentId: id,
    hintsShown: 0,
    showConstruction: false,
    showSolution: false,
    feedback: null,
  });
  render();
}

function checkAnswer(input) {
  const puzzle = currentPuzzle();
  const value = evaluateAnswer(input);
  if (Number.isNaN(value)) {
    state.feedback = { ok: false, text: "Couldn't read that. Try a number like 11.66 or an expression like 6+4√2." };
  } else if (Math.abs(value - puzzle.answer) <= puzzle.tolerance) {
    state.feedback = { ok: true, text: `Correct! The exact answer is ${puzzle.exact}.` };
    state.solved.add(puzzle.id);
    saveSolved();
  } else {
    state.feedback = { ok: false, text: `Not quite – your answer evaluates to ${value.toFixed(4)}. Try again or take a hint.` };
  }
  render();
}

function renderSidebar() {
  const sidebar = document.getElementById("sidebar");
  sidebar.innerHTML = CATEGORIES.map((cat) => {
    const items = PUZZLES.filter((p) => p.category === cat.id)
      .map((p) => {
        const active = p.id === state.currentId;
        const solved = state.solved.has(p.id);
        return `
          <li>
            <button data-id="${p.id}"
              class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition
                ${active ? "bg-indigo-600 text-white" : "hover:bg-slate-100"}">
              <span>${p.title}</span>
              ${solved ? `<span class="${active ? "text-white" : "text-emerald-600"}">✓</span>` : ""}
            </button>
          </li>`;
      })
      .join("");
    return `
      <div>
        <h2 class="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">${cat.name}</h2>
        <ul class="space-y-1">${items}</ul>
      </div>`;
  }).join("");

  sidebar.querySelectorAll("button[data-id]").forEach((btn) =>
    btn.addEventListener("click", () => selectPuzzle(btn.dataset.id))
  );

  document.getElementById("progress").textContent = `${state.solved.size} / ${PUZZLES.length} solved`;
}

function renderPuzzle() {
  const el = document.getElementById("puzzle");
  const p = currentPuzzle();
  if (!p) {
    el.innerHTML = `<p class="text-slate-500">No puzzles yet.</p>`;
    return;
  }

  const hints = p.hints
    .slice(0, state.hintsShown)
    .map((h, i) => `<li class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"><b>Hint ${i + 1}:</b> ${h}</li>`)
    .join("");

  const feedback = state.feedback
    ? `<p class="rounded-lg px-3 py-2 text-sm ${state.feedback.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}">${state.feedback.text}</p>`
    : "";

  const solution = state.showSolution
    ? `<ol class="list-decimal space-y-2 pl-5 text-sm leading-relaxed">${p.solution.map((s) => `<li>${s}</li>`).join("")}</ol>`
    : "";

  const btn = "rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent";

  el.innerHTML = `
    <div class="mb-4 flex items-center gap-3">
      <h2 class="text-lg font-semibold">${p.title}</h2>
      <span class="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">${p.difficulty}</span>
    </div>

    <p class="mb-6 leading-relaxed text-slate-700">${p.statement}</p>

    <div class="mb-6">
      <div class="relative mx-auto w-full max-w-xs">
        ${p.figure(state.showConstruction)}
        <canvas id="draw-canvas"
          class="absolute inset-0 h-full w-full ${state.draw.enabled ? "cursor-crosshair touch-none" : "pointer-events-none"}"></canvas>
      </div>
      <div class="mt-3 flex justify-center">
        <button id="draw-btn" class="${state.draw.enabled ? "rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700" : btn}">
          ${state.draw.enabled ? "Done drawing" : "✎ Draw on figure"}
        </button>
      </div>
      ${renderDrawToolbar(btn)}
    </div>

    <form id="answer-form" class="mb-4 flex flex-wrap gap-2">
      <input id="answer" autocomplete="off" placeholder="Your answer, e.g. 11.66 or 6+4√2"
        class="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
      <button class="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700">Check</button>
    </form>
    <div class="mb-4">${feedback}</div>

    <div class="mb-4 flex flex-wrap gap-2">
      <button id="hint-btn" class="${btn}" ${state.hintsShown >= p.hints.length ? "disabled" : ""}>
        Hint (${state.hintsShown}/${p.hints.length})
      </button>
      <button id="construction-btn" class="${btn}">${state.showConstruction ? "Hide" : "Show"} construction</button>
      <button id="solution-btn" class="${btn}">${state.showSolution ? "Hide" : "Show"} solution</button>
    </div>

    <ul class="mb-4 space-y-2">${hints}</ul>
    ${solution}
  `;

  el.querySelector("#answer-form").addEventListener("submit", (e) => {
    e.preventDefault();
    checkAnswer(el.querySelector("#answer").value);
  });
  setupCanvas(el.querySelector("#draw-canvas"), p.id);
  updateDrawButtons();
  el.querySelector("#draw-btn").addEventListener("click", () => { state.draw.enabled = !state.draw.enabled; render(); });
  el.querySelectorAll("[data-tool]").forEach((b) =>
    b.addEventListener("click", () => { state.draw.tool = b.dataset.tool; render(); })
  );
  el.querySelectorAll("[data-color]").forEach((b) =>
    b.addEventListener("click", () => {
      state.draw.color = b.dataset.color;
      if (state.draw.tool === "eraser") state.draw.tool = "pen";
      render();
    })
  );
  el.querySelector("#undo-btn")?.addEventListener("click", () => { strokesFor(p.id).pop(); saveDrawings(); render(); });
  el.querySelector("#clear-btn")?.addEventListener("click", () => { state.drawings[p.id] = []; saveDrawings(); render(); });

  el.querySelector("#hint-btn").addEventListener("click", () => { state.hintsShown++; render(); });
  el.querySelector("#construction-btn").addEventListener("click", () => { state.showConstruction = !state.showConstruction; render(); });
  el.querySelector("#solution-btn").addEventListener("click", () => {
    state.showSolution = !state.showSolution;
    if (state.showSolution) state.showConstruction = true;
    render();
  });
}

function render() {
  renderSidebar();
  renderPuzzle();
}

render();
