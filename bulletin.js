import { $, esc, fmt, fmtTime, daysUntil, todayISO, safeUrl, ago, upcomingDates, sortedTopics, pill, SUG, sortedSugs, millis, toast, configured, connect, watchAll, STARTER } from "./common.js";

let S = STARTER;
let topicSel = null, showAllMin = false, fb = null;

function renderNext() {
  const b = S.board || {};
  const dates = upcomingDates(b);
  const date = dates[0];
  if (date) {
    $("#nextDate").textContent = fmt(date, { month: "long", day: "numeric" });
    const du = daysUntil(date);
    const chip = du === 0 ? '<span class="count today">Today</span>' : du === 1 ? '<span class="count">Tomorrow</span>' : '<span class="count">In ' + du + " days</span>";
    const bits = ["<b>" + esc(fmt(date, { weekday: "long" })) + "</b>"];
    if (b.time) bits.push("<b>" + esc(fmtTime(b.time)) + "</b>");
    if (b.room) bits.push(esc(b.room));
    $("#nextMeta").innerHTML = bits.join('<span class="dot" aria-hidden="true"></span>') + " " + chip;
    $("#cycle").innerHTML = '<span class="cycle-label">Every other Wednesday:</span>' + dates.map((d, i) =>
      '<span class="d' + (i === 0 ? " on" : "") + '"><small>' + esc(fmt(d, { month: "short" })) + "</small><b>" + esc(fmt(d, { day: "numeric" })) + "</b></span>").join("");
  } else {
    $("#nextDate").textContent = "Date coming soon";
    $("#nextMeta").innerHTML = "<b>Wednesday</b>" + (b.time ? '<span class="dot" aria-hidden="true"></span><b>' + esc(fmtTime(b.time)) + "</b>" : "") + (b.room ? '<span class="dot" aria-hidden="true"></span>' + esc(b.room) : "");
    $("#cycle").innerHTML = '<span class="cycle-label">We meet every other Wednesday</span>';
  }
  const t = $("#nextTitle"); t.hidden = !b.title; t.textContent = b.title || "";
  const n = $("#nextNotes"); n.hidden = !b.notes; n.textContent = b.notes || "";
  const ag = (b.agenda || []).filter(Boolean);
  $("#agenda").innerHTML = ag.length
    ? '<ol class="agenda">' + ag.map(a => "<li><span>" + esc(a) + "</span></li>").join("") + "</ol>"
    : '<p class="notice-empty">The agenda for the next meeting hasn\'t been posted yet.</p>';
  $("#announce").hidden = !b.announce;
  $("#announceText").textContent = b.announce || "";
}

function renderTopics() {
  const list = sortedTopics(S.topics);
  if (!list.length) {
    $("#portal").innerHTML = '<div class="empty"><b>No topics yet</b>When the council starts a discussion, it shows up here with key points and open questions.</div>';
    return;
  }
  if (!list.some(t => t.id === topicSel)) topicSel = list[0].id;
  const t = list.find(x => x.id === topicSel);
  const ul = arr => (arr || []).filter(Boolean).map(x => "<li>" + esc(x) + "</li>").join("");
  const pts = ul(t.points), qs = ul(t.questions);
  const updated = millis(t.updatedAt);
  $("#portal").innerHTML =
    '<div class="panel portal"><div class="tabs" role="tablist" aria-label="Topics">' +
    list.map(x => '<button class="tab" role="tab" type="button" data-topic="' + esc(x.id) + '" aria-selected="' + (x.id === t.id) + '"><b>' + esc(x.title || "Untitled") + "</b>" + pill(x.status) + "</button>").join("") +
    '</div><div class="topic" role="tabpanel">' + pill(t.status) +
    "<h3>" + esc(t.title || "Untitled") + "</h3>" +
    (t.summary ? '<p class="topic-sum">' + esc(t.summary) + "</p>" : "") +
    ((pts || qs) ? '<div class="topic-cols">' +
      (pts ? '<div class="box"><h4>What we know</h4><ul>' + pts + "</ul></div>" : "") +
      (qs ? '<div class="box"><h4>Open questions</h4><ul>' + qs + "</ul></div>" : "") + "</div>" : "") +
    (t.outcome ? '<div class="box landed"><h4>Where we landed</h4><p>' + esc(t.outcome) + "</p></div>" : "") +
    (updated ? '<p class="topic-foot">Updated ' + esc(new Date(updated).toLocaleDateString("en-US", { month: "short", day: "numeric" })) + "</p>" : "") +
    "</div></div>";
}

function dueChip(d, done) {
  if (!d) return "";
  const n = daysUntil(d), short = fmt(d, { month: "short", day: "numeric" });
  if (done) return "<span>Due " + esc(short) + "</span>";
  if (n < 0) return '<span class="pill warn">Overdue · ' + esc(short) + "</span>";
  if (n <= 2) return '<span class="pill warn">Due ' + esc(short) + "</span>";
  return "<span>Due " + esc(short) + "</span>";
}
function renderTodos() {
  const open = S.todos.filter(t => !t.done).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
  const done = S.todos.filter(t => t.done).sort((a, b) => millis(b.doneAt) - millis(a.doneAt)).slice(0, 4);
  $("#todoTally").textContent = S.todos.length ? open.length + " open" : "";
  if (!S.todos.length) { $("#todoList").innerHTML = '<div class="empty"><b>All clear</b>Tasks from meetings land here, with who\'s on it and when it\'s due.</div>'; return; }
  $("#todoList").innerHTML = '<ul class="todos">' + [...open, ...done].map(t =>
    '<li class="todo' + (t.done ? " is-done" : "") + '"><input type="checkbox" disabled' + (t.done ? " checked" : "") + ' aria-label="' + (t.done ? "Done" : "Not done") + '">' +
    '<div><span class="todo-text">' + esc(t.text) + '</span><div class="todo-meta">' +
    (t.who ? "<span>" + esc(t.who) + "</span>" : "") + dueChip(t.due, t.done) + "</div></div></li>").join("") + "</ul>";
}

function renderSignups() {
  const t = todayISO();
  const isClosed = s => Boolean(s.deadline && s.deadline < t);
  const list = [...S.signups].sort((a, b) => (isClosed(a) - isClosed(b)) || (a.deadline || "9999").localeCompare(b.deadline || "9999"));
  $("#signTally").textContent = list.length ? list.filter(s => !isClosed(s)).length + " open" : "";
  if (!list.length) { $("#signList").innerHTML = '<div class="empty"><b>No sign-ups right now</b>Volunteer forms and event sign-ups get linked here.</div>'; return; }
  $("#signList").innerHTML = '<div class="signups">' + list.map(s => {
    const closed = isClosed(s), n = daysUntil(s.deadline);
    const chip = !s.deadline ? "" : closed ? '<span class="pill">Closed</span>'
      : n <= 3 ? '<span class="pill warn">Closes ' + esc(n === 0 ? "today" : fmt(s.deadline, { weekday: "short", month: "short", day: "numeric" })) + "</span>"
      : '<span class="pill">Closes ' + esc(fmt(s.deadline, { month: "short", day: "numeric" })) + "</span>";
    const url = safeUrl(s.url);
    return '<div class="signup' + (closed ? " closed" : "") + '"><div class="row"><b>' + esc(s.title) + "</b>" + chip + "</div>" +
      (url ? '<a class="btn ' + (closed ? "btn-ghost" : "btn-navy") + ' btn-sm" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">Sign up ↗</a>' : "") +
      (s.note ? "<p>" + esc(s.note) + "</p>" : "") + "</div>";
  }).join("") + "</div>";
}

function renderSugs() {
  const list = sortedSugs(S.sugs).slice(0, 12);
  $("#sugList").innerHTML = list.length ? list.map(s => {
    const [l, c] = SUG[s.status] || SUG.new;
    return '<li class="sug"><span class="sug-text">' + esc(s.text) + '</span><span class="sug-meta"><span class="pill ' + c + '">' + l + "</span><span>" + esc(s.name || "Anonymous") + " · " + esc(ago(millis(s.at))) + "</span></span></li>";
  }).join("") : '<li class="sug"><div class="empty"><b>The box is empty</b>Be the first to suggest something for the next meeting.</div></li>';
}

function renderMinutes() {
  const list = [...S.meetings].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  if (!list.length) { $("#minuteList").innerHTML = '<div class="empty"><b>No minutes posted yet</b>After each meeting, a recap of what we did shows up here.</div>'; return; }
  const shown = showAllMin ? list : list.slice(0, 4);
  $("#minuteList").innerHTML = shown.map(m => {
    const hl = (m.highlights || []).filter(Boolean);
    return '<article class="panel minute"><div class="cal" aria-hidden="true"><span>' + esc(fmt(m.date, { month: "short" }).toUpperCase()) + "</span><b>" + esc(fmt(m.date, { day: "numeric" })) + "</b><small>" + esc(fmt(m.date, { year: "numeric" })) + "</small></div>" +
      '<div class="minute-body"><span class="minute-meta">' + esc(fmt(m.date, { weekday: "long", month: "long", day: "numeric" })) + (m.attendance ? " · " + esc(m.attendance) + " members present" : "") + "</span>" +
      "<h3>" + esc(m.title || "Council meeting") + "</h3>" + (m.summary ? "<p>" + esc(m.summary) + "</p>" : "") +
      (hl.length ? "<ul>" + hl.map(h => "<li>" + esc(h) + "</li>").join("") + "</ul>" : "") + "</div></article>";
  }).join("") + (list.length > 4 ? '<button class="btn btn-ghost more" type="button" id="moreMin">' + (showAllMin ? "Show fewer" : "Show all " + list.length + " meetings") + "</button>" : "");
}

function render() { renderNext(); renderTopics(); renderTodos(); renderSignups(); renderSugs(); renderMinutes(); }

document.addEventListener("click", e => {
  const tab = e.target.closest("[data-topic]");
  if (tab) { topicSel = tab.dataset.topic; renderTopics(); document.querySelector('[data-topic="' + CSS.escape(topicSel) + '"]')?.focus(); return; }
  if (e.target.id === "moreMin") { showAllMin = !showAllMin; renderMinutes(); }
});

$("#sugForm").addEventListener("submit", async e => {
  e.preventDefault();
  const text = $("#sugText").value.trim(), name = $("#sugName").value.trim(), msg = $("#sugMsg");
  if (!text) return;
  if (!fb) { msg.textContent = "The suggestion box isn't open yet. Check back soon."; return; }
  $("#sugBtn").disabled = true; msg.textContent = "";
  try {
    await fb.fs.addDoc(fb.fs.collection(fb.db, "suggestions"), { text, name, at: Date.now(), status: "new" });
    $("#sugText").value = ""; msg.textContent = "Thanks! It's in the box.";
  } catch (err) {
    console.error(err);
    msg.textContent = "That didn't go through. Check your connection and try again.";
  } finally { $("#sugBtn").disabled = false; }
});

render();

if (configured) {
  connect().then(conn => {
    fb = conn;
    watchAll(conn, state => { S = state; render(); });
  }).catch(err => console.error("Couldn't load the bulletin", err));
}
