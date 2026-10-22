import { $, esc, fmt, fmtTime, iso, addDays, todayISO, safeUrl, ago, upcomingDates, sortedTopics, STATUS, SUG, sortedSugs, millis, toast, configured, connect, watchAll } from "./common.js";

let fb = null;
let S = { board: {}, topics: [], meetings: [], todos: [], signups: [], sugs: [] };
let watching = false;

const show = id => { for (const g of ["gateSetup", "gateSignIn", "gateDenied", "adminGrid"]) $("#" + g).hidden = g !== id; };

function errText(e) {
  const code = e && e.code;
  if (code === "permission-denied") return "You don't have permission to change this. Make sure your email is in the admins list.";
  if (code === "unavailable") return "Couldn't reach the database. Check your connection and try again.";
  return (e && e.message) || "Something went wrong. Try again.";
}

/* ---------- writes ---------- */
const ref = (col, id) => fb.fs.doc(fb.db, col, id);
const newRef = col => fb.fs.doc(fb.fs.collection(fb.db, col));
const saveBoard = data => fb.fs.setDoc(ref("site", "board"), { ...data, updatedAt: Date.now() }, { merge: true });
const add = (col, data) => fb.fs.addDoc(fb.fs.collection(fb.db, col), { ...data, createdAt: Date.now() });
const update = (col, id, data) => fb.fs.updateDoc(ref(col, id), data);
const remove = (col, id) => fb.fs.deleteDoc(ref(col, id));

/* ---------- admin lists ---------- */
const byId = (arr, id) => arr.find(x => x.id === id) || {};
const nextDate = () => upcomingDates(S.board)[0] || "";
const edit = (key, label = "Edit") => '<button class="btn btn-ghost btn-sm" type="button" data-act="' + esc(key) + '">' + label + "</button>";
const del = key => '<button class="btn btn-ghost btn-sm btn-danger" type="button" data-act="' + esc(key) + '">Delete</button>';
const row = (title, sub, actions) => '<li class="a-row"><div class="t"><b>' + esc(title) + "</b>" + (sub ? "<small>" + esc(sub) + "</small>" : "") + '</div><div class="a-actions">' + actions + "</div></li>";
const list = (items, emptyMsg) => items.length ? '<ul class="a-list">' + items.join("") + "</ul>" : '<p class="muted">' + emptyMsg + "</p>";

function render() {
  const b = S.board || {}, date = nextDate(), ag = b.agenda || [];
  const sugs = sortedSugs(S.sugs);
  const toReview = sugs.filter(s => s.status === "new").length;
  $("#adminGrid").innerHTML =
    '<section class="panel"><div class="a-head"><h2>Next meeting</h2><div class="a-actions">' + edit("next") + '<button class="btn btn-gold btn-sm" type="button" data-act="wrap">Wrap up meeting</button></div></div>' +
      '<div class="a-next"><b>' + esc(date ? fmt(date, { weekday: "long", month: "long", day: "numeric" }) : "No date set yet") + "</b>" +
      '<span class="muted">' + esc([fmtTime(b.time), b.room].filter(Boolean).join(" · ") || "No time or room set") + "</span>" +
      "<span>" + (ag.length ? ag.length + " agenda item" + (ag.length > 1 ? "s" : "") : "No agenda yet") + "</span></div>" +
      '<p class="a-hint">Wrap up posts this meeting to Past meetings, then moves the bulletin two weeks ahead with a fresh agenda.</p></section>' +
    '<section class="panel"><div class="a-head"><h2>Notice banner</h2><div class="a-actions">' + edit("announce", b.announce ? "Edit" : "Add notice") + "</div></div>" +
      '<p class="' + (b.announce ? "" : "muted") + '" style="white-space:pre-line">' + esc(b.announce || "No notice is showing. Add one for reminders like \"No meeting next week, early release.\"") + "</p></section>" +
    '<section class="panel wide"><div class="a-head"><h2>Topics</h2><button class="btn btn-navy btn-sm" type="button" data-act="topic-add">Add topic</button></div>' +
      list(sortedTopics(S.topics).map(t => row(t.title || "Untitled", (STATUS[t.status] || STATUS.open)[0] + ((t.points || []).length ? " · " + t.points.length + " key points" : ""),
        (t.status !== "current" ? edit("topic-current:" + t.id, "Make current") : "") + edit("topic-edit:" + t.id) + del("topic-del:" + t.id))), "No topics yet. Add the one the council is discussing now.") + "</section>" +
    '<section class="panel"><div class="a-head"><h2>To-do</h2><button class="btn btn-navy btn-sm" type="button" data-act="todo-add">Add task</button></div>' +
      list([...S.todos].sort((a, b) => (a.done - b.done) || (a.due || "9999").localeCompare(b.due || "9999")).map(t => row((t.done ? "✓ " : "") + t.text, [t.who, t.due && "due " + fmt(t.due, { month: "short", day: "numeric" })].filter(Boolean).join(" · "),
        edit("todo-toggle:" + t.id, t.done ? "Reopen" : "Done") + edit("todo-edit:" + t.id) + del("todo-del:" + t.id))), "No tasks.") + "</section>" +
    '<section class="panel"><div class="a-head"><h2>Sign-ups</h2><button class="btn btn-navy btn-sm" type="button" data-act="sign-add">Add sign-up</button></div>' +
      list(S.signups.map(s => row(s.title, [s.deadline && "closes " + fmt(s.deadline, { month: "short", day: "numeric" }), s.url].filter(Boolean).join(" · "),
        edit("sign-edit:" + s.id) + del("sign-del:" + s.id))), "No sign-up links.") + "</section>" +
    '<section class="panel wide"><div class="a-head"><h2>Suggestions <span class="tally">' + toReview + " new</span></h2></div>" +
      list(sugs.map(s => row(s.text, (s.name || "Anonymous") + " · " + ago(millis(s.at)) + " · " + (SUG[s.status] || SUG.new)[0],
        (s.status === "new" ? '<button class="btn btn-gold btn-sm" type="button" data-act="sug-agenda:' + esc(s.id) + '">Add to agenda</button>' : "") +
        (s.status !== "discussed" ? edit("sug-done:" + s.id, "Mark discussed") : "") + del("sug-del:" + s.id))), "No suggestions yet. Students can drop ideas in the box on the bulletin.") + "</section>" +
    '<section class="panel wide"><div class="a-head"><h2>Past meetings</h2><button class="btn btn-navy btn-sm" type="button" data-act="min-add">Add past meeting</button></div>' +
      list([...S.meetings].sort((a, b) => (b.date || "").localeCompare(a.date || "")).map(m => row(m.title || "Council meeting", fmt(m.date, { weekday: "short", month: "short", day: "numeric", year: "numeric" }),
        edit("min-edit:" + m.id) + del("min-del:" + m.id))), "No minutes posted yet.") + "</section>";
}

/* ---------- form dialog ---------- */
const dlg = $("#dlg");
let onSave = null, curFields = [];
function field(f) {
  const id = "f_" + f.key, v = f.value ?? "";
  const val = Array.isArray(v) ? v.join("\n") : v;
  let ctl;
  if (f.type === "textarea" || f.type === "lines") ctl = '<textarea id="' + id + '" rows="' + (f.rows || 4) + '" placeholder="' + esc(f.placeholder || "") + '">' + esc(val) + "</textarea>";
  else if (f.type === "select") ctl = '<select id="' + id + '">' + f.options.map(([k, l]) => '<option value="' + esc(k) + '"' + (k === val ? " selected" : "") + ">" + esc(l) + "</option>").join("") + "</select>";
  else ctl = '<input id="' + id + '" type="' + (f.type || "text") + '" value="' + esc(val) + '" placeholder="' + esc(f.placeholder || "") + '">';
  return '<div class="field"><label for="' + id + '">' + esc(f.label) + "</label>" + ctl + (f.hint || f.type === "lines" ? "<small>" + esc(f.hint || "One per line.") + "</small>" : "") + "</div>";
}
function openForm({ title, fields, submit = "Save", save }) {
  curFields = fields.flat(); onSave = save;
  $("#dlgTitle").textContent = title;
  $("#dlgSubmit").textContent = submit; $("#dlgSubmit").disabled = false;
  $("#dlgErr").textContent = "";
  $("#dlgFields").innerHTML = fields.map(f => Array.isArray(f) ? '<div class="field-pair">' + f.map(field).join("") + "</div>" : field(f)).join("");
  dlg.showModal();
  $("#dlgFields input, #dlgFields textarea")?.focus();
}
$("#dlgX").onclick = () => dlg.close();
$("#dlgCancel").onclick = () => dlg.close();
$("#dlgForm").addEventListener("submit", async e => {
  e.preventDefault();
  const vals = {};
  for (const f of curFields) {
    const raw = $("#f_" + f.key).value;
    vals[f.key] = f.type === "lines" ? raw.split("\n").map(s => s.replace(/^\s*[-•*\d.)]+\s+/, "").trim()).filter(Boolean)
      : f.type === "number" ? (raw === "" ? null : Number(raw)) : raw.trim();
  }
  const missing = curFields.find(f => f.required && !vals[f.key]);
  if (missing) { $("#dlgErr").textContent = missing.label + " is required."; return; }
  $("#dlgSubmit").disabled = true; $("#dlgErr").textContent = "";
  try { await onSave(vals); dlg.close(); toast("Saved"); }
  catch (err) { console.error(err); $("#dlgErr").textContent = errText(err); $("#dlgSubmit").disabled = false; }
});

const topicFields = t => [
  { key: "title", label: "Topic", value: t.title, required: true, placeholder: "e.g. MacBooks for students" },
  { key: "status", label: "Status", type: "select", value: t.status || "current", options: [["current", "Now discussing"], ["open", "Coming up"], ["done", "Wrapped up"]] },
  { key: "summary", label: "Summary", type: "textarea", rows: 3, value: t.summary, placeholder: "What's this about, in a couple of sentences?" },
  { key: "points", label: "What we know", type: "lines", value: t.points, rows: 4 },
  { key: "questions", label: "Open questions", type: "lines", value: t.questions, rows: 3 },
  { key: "outcome", label: "Where we landed", type: "textarea", rows: 2, value: t.outcome, hint: "Leave blank until the council decides something." }];
const todoFields = t => [
  { key: "text", label: "Task", value: t.text, required: true, placeholder: "e.g. Email the office about the MacBook survey" },
  [{ key: "who", label: "Who's on it", value: t.who, placeholder: "Name or committee" }, { key: "due", label: "Due", type: "date", value: t.due }]];
const signFields = s => [
  { key: "title", label: "Sign-up name", value: s.title, required: true, placeholder: "e.g. Fall Festival volunteers" },
  { key: "url", label: "Link", type: "url", value: s.url, required: true, placeholder: "https://www.signupgenius.com/…" },
  { key: "deadline", label: "Closes on", type: "date", value: s.deadline },
  { key: "note", label: "Short note", value: s.note, placeholder: "e.g. Need 6 people, 2-hour shifts" }];
const minFields = m => [
  [{ key: "date", label: "Date", type: "date", value: m.date, required: true }, { key: "attendance", label: "Members present", type: "number", value: m.attendance }],
  { key: "title", label: "Meeting title", value: m.title, placeholder: "e.g. MacBook survey kickoff" },
  { key: "summary", label: "Summary", type: "textarea", rows: 3, value: m.summary },
  { key: "highlights", label: "What we did", type: "lines", rows: 5, value: m.highlights }];

function arm(btn) {
  if (btn.dataset.armed === "1") return true;
  btn.dataset.armed = "1"; btn.textContent = "Confirm delete";
  setTimeout(() => { if (btn.isConnected) { btn.dataset.armed = ""; btn.textContent = "Delete"; } }, 3000);
  return false;
}

async function act(key, btn) {
  const [a, id] = key.split(":");
  const b = S.board || {};
  try {
    switch (a) {
      case "next": return openForm({ title: "Edit next meeting", fields: [
        [{ key: "nextDate", label: "Date", type: "date", value: nextDate(), required: true, hint: "Pick a Wednesday. After that, it moves two weeks at a time." }, { key: "time", label: "Time", type: "time", value: b.time }],
        { key: "room", label: "Room / place", value: b.room, placeholder: "e.g. Room 214 or the library" },
        { key: "title", label: "Headline (optional)", value: b.title, placeholder: "e.g. MacBook survey results" },
        { key: "agenda", label: "Agenda", type: "lines", rows: 6, value: b.agenda, hint: "One item per line, in order." },
        { key: "notes", label: "Note for members (optional)", type: "textarea", rows: 2, value: b.notes, placeholder: "e.g. Bring your laptop." }],
        save: v => saveBoard(v) });
      case "wrap": {
        const date = nextDate() || todayISO();
        return openForm({ title: "Wrap up meeting", submit: "Post minutes", fields: [
          [{ key: "date", label: "Meeting date", type: "date", value: date, required: true }, { key: "attendance", label: "Members present", type: "number", value: "" }],
          { key: "title", label: "Meeting title", value: b.title, placeholder: "e.g. MacBook discussion, part 2" },
          { key: "summary", label: "Summary", type: "textarea", rows: 3, placeholder: "The big picture of what happened." },
          { key: "highlights", label: "What we did", type: "lines", rows: 6, value: b.agenda, hint: "Filled in from the agenda. Edit it to match what really happened." }],
          save: async v => {
            const batch = fb.fs.writeBatch(fb.db);
            batch.set(newRef("meetings"), { ...v, createdAt: Date.now() });
            batch.set(ref("site", "board"), { nextDate: addDays(v.date, 14), title: "", agenda: [], notes: "", updatedAt: Date.now() }, { merge: true });
            for (const s of S.sugs) if (s.status === "agenda") batch.update(ref("suggestions", s.id), { status: "discussed" });
            await batch.commit();
          } });
      }
      case "announce": return openForm({ title: "Notice banner", fields: [{ key: "announce", label: "Notice", type: "textarea", rows: 3, value: b.announce, hint: "Shows in a gold banner under the next meeting. Leave blank to hide it." }],
        save: v => saveBoard(v) });
      case "topic-add": return openForm({ title: "Add topic", fields: topicFields({}), save: v => saveTopic(null, v) });
      case "topic-edit": return openForm({ title: "Edit topic", fields: topicFields(byId(S.topics, id)), save: v => saveTopic(id, v) });
      case "topic-current": await saveTopic(id, { status: "current" }); return toast("Now discussing: " + (byId(S.topics, id).title || "topic"));
      case "topic-del": if (!arm(btn)) return; await remove("topics", id); return toast("Topic deleted");
      case "todo-add": return openForm({ title: "Add task", fields: todoFields({}), save: v => add("todos", { ...v, done: false }) });
      case "todo-edit": return openForm({ title: "Edit task", fields: todoFields(byId(S.todos, id)), save: v => update("todos", id, v) });
      case "todo-toggle": { const t = byId(S.todos, id); await update("todos", id, { done: !t.done, doneAt: t.done ? null : Date.now() }); return; }
      case "todo-del": if (!arm(btn)) return; await remove("todos", id); return toast("Task deleted");
      case "sign-add": return openForm({ title: "Add sign-up", fields: signFields({}), save: v => add("signups", { ...v, url: safeUrl(v.url) }) });
      case "sign-edit": return openForm({ title: "Edit sign-up", fields: signFields(byId(S.signups, id)), save: v => update("signups", id, { ...v, url: safeUrl(v.url) }) });
      case "sign-del": if (!arm(btn)) return; await remove("signups", id); return toast("Sign-up removed");
      case "min-add": return openForm({ title: "Add past meeting", fields: minFields({ date: iso(new Date()) }), save: v => add("meetings", v) });
      case "min-edit": return openForm({ title: "Edit past meeting", fields: minFields(byId(S.meetings, id)), save: v => update("meetings", id, v) });
      case "min-del": if (!arm(btn)) return; await remove("meetings", id); return toast("Meeting deleted");
      case "sug-agenda": {
        const s = byId(S.sugs, id); if (!s.text) return;
        const batch = fb.fs.writeBatch(fb.db);
        batch.set(ref("site", "board"), { agenda: [...(b.agenda || []), s.text], updatedAt: Date.now() }, { merge: true });
        batch.update(ref("suggestions", id), { status: "agenda" });
        await batch.commit();
        return toast("Added to the agenda");
      }
      case "sug-done": await update("suggestions", id, { status: "discussed" }); return toast("Marked discussed");
      case "sug-del": if (!arm(btn)) return; await remove("suggestions", id); return toast("Suggestion removed");
    }
  } catch (err) { console.error(err); toast(errText(err)); }
}

// Only one topic is "Now discussing" at a time.
async function saveTopic(id, v) {
  const batch = fb.fs.writeBatch(fb.db);
  const target = id ? ref("topics", id) : newRef("topics");
  if (v.status === "current") for (const t of S.topics) if (t.status === "current" && t.id !== id) batch.update(ref("topics", t.id), { status: "open" });
  if (id) batch.set(target, { ...v, updatedAt: Date.now() }, { merge: true });
  else batch.set(target, { ...v, updatedAt: Date.now() });
  await batch.commit();
}

document.addEventListener("click", e => {
  const b = e.target.closest("[data-act]");
  if (b && fb) act(b.dataset.act, b);
});

/* ---------- sign-in ---------- */
async function start() {
  if (!configured) { show("gateSetup"); return; }
  try { fb = await connect(); }
  catch (err) { console.error(err); show("gateSetup"); return; }
  const { authMod, auth, fs, db } = fb;
  const signOut = () => authMod.signOut(auth);
  $("#signOut").onclick = signOut; $("#signOut2").onclick = signOut;
  $("#signIn").onclick = async () => {
    $("#signInMsg").textContent = "";
    try { await authMod.signInWithPopup(auth, new authMod.GoogleAuthProvider()); }
    catch (err) { if (err.code !== "auth/popup-closed-by-user") $("#signInMsg").textContent = "Sign-in didn't work: " + (err.message || "try again."); }
  };
  authMod.onAuthStateChanged(auth, async user => {
    $("#who").hidden = !user;
    if (!user) { show("gateSignIn"); return; }
    $("#whoEmail").textContent = user.email || "";
    let isAdmin = false;
    try { isAdmin = (await fs.getDoc(fs.doc(db, "admins", (user.email || "").toLowerCase()))).exists(); }
    catch (err) { console.error(err); }
    if (!isAdmin) {
      $("#deniedText").textContent = (user.email || "This account") + " isn't on the SCLC admin list. Ask the secretary to add it, or sign in with a different Google account.";
      show("gateDenied"); return;
    }
    show("adminGrid");
    if (!watching) { watching = true; watchAll(fb, state => { S = state; render(); }); }
    render();
  });
}
start();
