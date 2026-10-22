// Shared by the bulletin (index.html) and the admin page (admin.html).
import { firebaseConfig } from "./firebase-config.js";

const SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
export const configured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let fb = null;
export async function connect() {
  if (!configured) return null;
  if (fb) return fb;
  const [appMod, fs, auth] = await Promise.all([
    import(SDK + "firebase-app.js"),
    import(SDK + "firebase-firestore.js"),
    import(SDK + "firebase-auth.js")
  ]);
  const app = appMod.initializeApp(firebaseConfig);
  fb = { fs, authMod: auth, db: fs.getFirestore(app), auth: auth.getAuth(app) };
  return fb;
}

// Shown before Firebase is connected, so the page never looks broken.
export const STARTER = {
  board: { agenda: ["Continue the MacBook discussion", "Review suggestion box ideas"] },
  announce: "",
  topics: [{
    id: "macbooks", title: "MacBooks", status: "current",
    summary: "The council is currently talking about MacBooks. Key points and open questions get added here as the discussion goes.",
    points: [], questions: [], outcome: ""
  }],
  meetings: [], todos: [], signups: [], sugs: []
};

// Live copy of everything on the bulletin. Calls onChange(state) after every update.
export function watchAll({ db, fs }, onChange, onError) {
  const state = { board: {}, topics: [], meetings: [], todos: [], signups: [], sugs: [] };
  const err = e => { console.error(e); onError && onError(e); };
  fs.onSnapshot(fs.doc(db, "site", "board"), s => { state.board = s.exists() ? s.data() : {}; onChange(state); }, err);
  for (const [col, key] of [["topics", "topics"], ["meetings", "meetings"], ["todos", "todos"], ["signups", "signups"], ["suggestions", "sugs"]]) {
    fs.onSnapshot(fs.collection(db, col), q => { state[key] = q.docs.map(d => ({ id: d.id, ...d.data() })); onChange(state); }, err);
  }
  return state;
}

/* ---------- small helpers ---------- */
export const $ = s => document.querySelector(s);
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const iso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
export const todayISO = () => iso(new Date());
export const parse = s => { if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null; const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parse(s) || new Date(); d.setDate(d.getDate() + n); return iso(d); };
export const daysUntil = s => { const d = parse(s); return d ? Math.round((d - parse(todayISO())) / 86400000) : null; };
export const fmt = (s, o) => { const d = parse(s); return d ? d.toLocaleDateString("en-US", o) : ""; };
export const fmtTime = t => { if (!t || !/^\d{1,2}:\d{2}/.test(t)) return t || ""; const [h, m] = t.split(":").map(Number); return ((h % 12) || 12) + ":" + String(m).padStart(2, "0") + " " + (h >= 12 ? "PM" : "AM"); };
export const safeUrl = u => /^https?:\/\//i.test(u || "") ? u : (u ? "https://" + u : "");
export const ago = ms => { const d = Math.floor((Date.now() - ms) / 86400000); return d <= 0 ? "today" : d === 1 ? "yesterday" : d + " days ago"; };

// SCLC meets every other Wednesday. The board stores the next meeting date;
// if that date has passed, keep stepping forward two weeks so the bulletin
// stays right even if nobody updates it.
export function upcomingDates(board, count = 3) {
  let d = board && board.nextDate;
  if (!parse(d)) return [];
  const today = todayISO();
  while (d < today) d = addDays(d, 14);
  return Array.from({ length: count }, (_, i) => addDays(d, 14 * i));
}

export const STATUS = { current: ["Now discussing", "now"], open: ["Coming up", ""], done: ["Wrapped up", "done"] };
const rank = { current: 0, open: 1, done: 2 };
const ms = v => (v && typeof v.toMillis === "function") ? v.toMillis() : (v || 0);
export const millis = ms;
export const sortedTopics = list => [...list].sort((a, b) => (rank[a.status] ?? 1) - (rank[b.status] ?? 1) || ms(b.updatedAt) - ms(a.updatedAt));
export const pill = st => { const [l, c] = STATUS[st] || STATUS.open; return '<span class="pill ' + c + '">' + l + "</span>"; };
export const SUG = { new: ["New", ""], agenda: ["On the agenda", "now"], discussed: ["Discussed", "done"] };
export const sortedSugs = list => [...list].sort((a, b) => ms(b.at) - ms(a.at));

export function toast(msg) {
  const t = $("#toast"); if (!t) return;
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("show"), 2000);
}
