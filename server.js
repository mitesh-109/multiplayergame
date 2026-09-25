const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const rooms = new Map();
const PORT = process.env.PORT || 3000;

const questions = [
  ["Next number: 2,4,8,16,?", ["20", "24", "32", "36"], 2],
  ["Which keyword creates a constant in JavaScript?", ["var", "let", "const", "fixed"], 2],
  ["What does HTML mainly define?", ["Page structure", "Database", "Server memory", "Network speed"], 0],
  ["Next number: 3,6,12,24,?", ["36", "42", "48", "60"], 2],
  ["Which is a JavaScript array?", ['{"a":1}', "[1,2,3]", '"hello"', "true"], 1],
  ["What does CSS control?", ["Page styling", "Passwords", "Hardware", "Database security"], 0],
  ["What is 15% of 200?", ["15", "20", "30", "45"], 2],
  ["Which structure follows FIFO?", ["Stack", "Queue", "Tree", "Graph"], 1],
  ["What does API stand for?", ["Application Programming Interface", "Advanced Program Internet", "Application Process Input", "Applied Programming Instruction"], 0],
  ["Next number: 1,1,2,3,5,?", ["6", "7", "8", "10"], 2]
];

// Serves the public folder or root folder safely
app.use(express.static(__dirname + "/public"));
app.use(express.static(__dirname));

app.get("/health", (req, res) => res.json({ ok: true }));

function name(x) {
  return String(x || "Player").replace(/[<>]/g, "").trim().slice(0, 18) || "Player";
}

function code() {
  let s = "";
  do {
    s = Array.from({ length: 5 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
  } while (rooms.has(s));
  return s;
}

function view(r) {
  return { ...r, players: r.players.map(p => ({ id: p.id, name: p.name, score: p.score, answered: p.answered })) };
}

function send(r) {
  if (r) io.to(r.code).emit("room", view(r));
}

function stop(r) {
  if (r && r.timer) clearTimeout(r.timer);
  if (r) r.timer = null;
}

function next(r) {
  if (!r) return;
  stop(r);
  if (r.round >= r.total || r.round >= r.questions.length) {
    r.status = "finished";
    r.question = null;
    send(r);
    return;
  }
  r.status = "playing";
  r.question = r.questions[r.round];
  r.round++;
  r.started = Date.now();
  r.players.forEach(p => (p.answered = false));
  send(r);
  r.timer = setTimeout(() => finish(r), 15000);
}

function finish(r) {
  if (!r || r.status !== "playing") return;
  stop(r);
  r.status = "result";
  send(r);
  r.timer = setTimeout(() => next(r), 2500);
}

io.on("connection", s => {
  s.on("create", ({ name: n }, cb) => {
    let c = code();
    let r = {
      code: c,
      host: s.id,
      status: "waiting",
      players: [{ id: s.id, name: name(n), score: 0, answered: false }],
      round: 0,
      total: 8,
      questions: [...questions].sort(() => Math.random() - 0.5),
      question: null,
      started: null,
      timer: null
    };
    rooms.set(c, r);
    s.join(c);
    s.data.room = c;
    if (cb) cb({ ok: true, code: c });
    send(r);
  });

  s.on("join", ({ code: c, name: n }, cb) => {
    let r = rooms.get(String(c).toUpperCase());
    if (!r) return cb && cb({ ok: false, error: "Room not found" });
    if (r.status !== "waiting") return cb && cb({ ok: false, error: "Game already started" });
    if (r.players.length >= 4) return cb && cb({ ok: false, error: "Room full" });
    r.players.push({ id: s.id, name: name(n), score: 0, answered: false });
    s.join(r.code);
    s.data.room = r.code;
    if (cb) cb({ ok: true });
    send(r);
  });

  s.on("start", (_, cb) => {
    let r = rooms.get(s.data.room);
    if (!r) return cb && cb({ ok: false, error: "Room missing" });
    if (r.host !== s.id) return cb && cb({ ok: false, error: "Only host can start" });
    if (r.players.length < 2) return cb && cb({ ok: false, error: "Need at least two players" });
    r.round = 0;
    r.players.forEach(p => (p.score = 0));
    next(r);
    if (cb) cb({ ok: true });
  });

  s.on("answer", ({ answer }, cb) => {
    let r = rooms.get(s.data.room);
    let p = r && r.players && r.players.find(x => x.id === s.id);
    if (!r || r.status !== "playing" || !p || p.answered || !r.question) {
      return cb && cb({ ok: false, error: "Answer unavailable" });
    }
    p.answered = true;
    let correct = Number(answer) === r.question[2];
    if (correct) {
      p.score += 100 + Math.max(0, 100 - Math.floor((Date.now() - r.started) / 500));
    }
    if (cb) cb({ ok: true, correct });
    send(r);
    if (r.players.every(x => x.answered)) finish(r);
  });

  s.on("restart", (_, cb) => {
    let r = rooms.get(s.data.room);
    if (!r || r.host !== s.id) return cb && cb({ ok: false, error: "Only host can restart" });
    stop(r);
    r.status = "waiting";
    r.round = 0;
    r.question = null;
    r.players.forEach(p => {
      p.score = 0;
      p.answered = false;
    });
    send(r);
    if (cb) cb({ ok: true });
  });

  s.on("disconnect", () => {
    let r = rooms.get(s.data.room);
    if (!r) return;
    r.players = r.players.filter(p => p.id !== s.id);
    if (!r.players.length) {
      stop(r);
      rooms.delete(r.code);
      return;
    }
    if (r.host === s.id) r.host = r.players[0].id;
    if (r.players.length < 2 && r.status === "playing") {
      stop(r);
      r.status = "waiting";
      r.round = 0;
      r.question = null;
    }
    send(r);
  });
});

// Prevents random crashes from stopping the server
process.on("uncaughtException", err => console.error("Caught error:", err));

server.listen(PORT, () => console.log("CodeRush running on port " + PORT));
