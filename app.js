/* ATHLONEX – app.js
   Single-page app. Data is stored in the browser (localStorage + IndexedDB for files).
   To go multi-device, replace the DB load/save + FileStore with a backend (e.g. Supabase / Firebase). */
"use strict";

/* =============== helpers =============== */
const KEY = "athlonex_db_v1", SKEY = "athlonex_session_v1", TKEY = "athlonex_theme";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const inr = n => "₹" + Number(n || 0).toLocaleString("en-IN");
const norm = s => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
const sum = (a, f) => a.reduce((t, x) => t + (Number(typeof f === "function" ? f(x) : x[f]) || 0), 0);
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const fmtDate = d => d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }) : "-";
const fmtTime = t => { const [h, m] = t.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; };

let toastT;
function toast(msg, bad) {
  const t = $("#toast"); t.textContent = msg; t.className = "toast" + (bad ? " bad" : ""); t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2800);
}
function openModal(html, wide) {
  const m = $("#modal");
  m.innerHTML = `<div class="modal ${wide ? "wide" : ""}">${html}</div>`; m.hidden = false;
  m.onclick = e => { if (e.target === m) closeModal(); };
  const x = $(".x", m); if (x) x.onclick = closeModal;
  return m;
}
function closeModal() { const m = $("#modal"); m.hidden = true; m.innerHTML = ""; }
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
function download(name, content, type) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([content], { type })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* =============== storage =============== */
function fresh() { return { users: [], achievements: [], claims: [], grants: [], events: [], interests: {} }; }
function loadDB() { try { return Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY)) || {}); } catch { return fresh(); } }
let DB = loadDB();
function save() { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch { toast("Storage is full – delete some old entries.", true); } }

const FileStore = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open("athlonex_files", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("f");
      r.onsuccess = () => { this.db = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  },
  tx(mode, fn) {
    return new Promise((res, rej) => {
      const t = this.db.transaction("f", mode), s = t.objectStore("f"), rq = fn(s);
      t.oncomplete = () => res(rq && rq.result); t.onerror = () => rej(t.error);
    });
  },
  put(id, blob) { return this.tx("readwrite", s => s.put(blob, id)); },
  get(id) { return this.tx("readonly", s => s.get(id)); },
  del(id) { return this.tx("readwrite", s => s.delete(id)); }
};

/* Compress images, accept small PDFs */
async function prepFile(file) {
  const MAX = 2 * 1024 * 1024;
  if (file.type.startsWith("image/")) {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, "image/jpeg", .82));
    return { id: uid("f"), name: file.name.replace(/\.\w+$/, "") + ".jpg", type: "image/jpeg", size: blob.size, blob };
  }
  if (file.type === "application/pdf") {
    if (file.size > MAX) throw new Error(`"${file.name}" is over 2 MB. Compress the PDF first.`);
    return { id: uid("f"), name: file.name, type: file.type, size: file.size, blob: file };
  }
  throw new Error(`"${file.name}" – only images and PDFs are allowed.`);
}
async function storeFiles(fileList) {
  const metas = [];
  for (const f of fileList) { const p = await prepFile(f); await FileStore.put(p.id, p.blob); metas.push({ id: p.id, name: p.name, type: p.type, size: p.size }); }
  return metas;
}
async function viewFile(meta) {
  const blob = await FileStore.get(meta.id);
  if (!blob) return toast("This file is stored on another device/browser, so it can't be opened here.", true);
  const url = URL.createObjectURL(blob);
  const w = document.createElement("div"); w.className = "modal-wrap"; w.style.zIndex = 90;
  w.innerHTML = `<div class="modal wide"><div class="modal-h"><h3>${esc(meta.name)}</h3><button class="x">×</button></div><div class="viewer">${meta.type.startsWith("image/") ? `<img src="${url}" alt="">` : `<iframe src="${url}"></iframe>`}</div></div>`;
  const shut = () => { w.remove(); URL.revokeObjectURL(url); };
  w.onclick = e => { if (e.target === w) shut(); }; $(".x", w).onclick = shut;
  document.body.appendChild(w);
}

/* =============== auth =============== */
async function hashPw(pw, salt) {
  const data = new TextEncoder().encode(salt + pw);
  if (window.crypto && crypto.subtle) {
    const b = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
  }
  let h = 5381; for (const c of salt + pw) h = ((h << 5) + h + c.charCodeAt(0)) | 0; return "x" + h;
}
function chipInput(root, initial = []) {
  const items = [...initial];
  root.innerHTML = `<div class="chips"></div><input list="sportlist" placeholder="Type a sport and press Enter" />`;
  const box = $(".chips", root), inp = $("input", root);
  const draw = () => box.innerHTML = items.map((s, i) => `<span class="chip">${esc(s)}<button type="button" data-i="${i}">×</button></span>`).join("");
  const add = v => {
    v = v.trim(); if (!v) return;
    const m = SPORTS.find(s => s.name.toLowerCase() === v.toLowerCase()); v = m ? m.name : v;
    if (!items.includes(v)) items.push(v); inp.value = ""; draw();
  };
  inp.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(inp.value); } });
  inp.addEventListener("change", () => add(inp.value));
  box.addEventListener("click", e => { const b = e.target.closest("button"); if (b) { items.splice(+b.dataset.i, 1); draw(); } });
  draw();
  return { get: () => { add(inp.value); return items; } };
}

function viewAuth(mode = "login") {
  $("#root").innerHTML = `
  <div class="auth">
    <section class="hero">
      <div class="logo"><i><svg viewBox="0 0 64 64"><path d="M12 50 32 10l20 40h-9L32 28 21 50z"/></svg></i><div>ATHLONEX<small>EVERY SPORT · EVERY OPPORTUNITY</small></div></div>
      <div>
        <h1>One home for every <b>athlete's</b> journey.</h1>
        <p>Find competitions across ${SPORTS.length}+ sports in India, keep your medals and certificates in one place, and claim your TA/DA from your college — transparently.</p>
        <div class="feat">
          <div><b>🏆 Opportunities</b><span>District to international, all sports</span></div>
          <div><b>🏅 Achievements</b><span>Upload certificates, medals &amp; photos</span></div>
          <div><b>💰 TA / DA</b><span>Claim with proof, track what's left</span></div>
          <div><b>🏫 College view</b><span>Sports directors see every student</span></div>
        </div>
      </div>
      <small style="color:var(--muted)">ATHLONEX v${CONFIG.version}</small>
    </section>
    <section class="auth-card"><div class="auth-box">
      <div class="tabs"><button data-m="login" class="${mode === "login" ? "on" : ""}">Log in</button><button data-m="register" class="${mode === "register" ? "on" : ""}">Create account</button></div>
      <form id="authForm" autocomplete="on">${mode === "login" ? loginFields() : registerFields()}<div class="err" id="err"></div><button class="btn" style="width:100%;margin-top:6px">${mode === "login" ? "Log in" : "Create account"}</button></form>
    </div></section>
  </div>`;
  $$(".tabs button").forEach(b => b.onclick = () => viewAuth(b.dataset.m));
  let chips;
  if (mode === "register") {
    chips = chipInput($("#sportsBox"));
    $$("input[name=role]").forEach(r => r.onchange = () => { $("#offBox").hidden = r.value !== "official" || !r.checked; $("#sportsWrap").hidden = $("input[name=role]:checked").value === "official"; });
  }
  $("#authForm").onsubmit = async e => {
    e.preventDefault(); const err = $("#err"); err.textContent = "";
    try { mode === "login" ? await doLogin(new FormData(e.target)) : await doRegister(new FormData(e.target), chips.get()); }
    catch (x) { err.textContent = x.message; }
  };
}
const loginFields = () => `
  <label>Username or User ID</label><input name="id" required autofocus />
  <label>Password</label><input name="pw" type="password" required />`;
const registerFields = () => `
  <label>I am a</label>
  <div class="roleswitch"><label><input type="radio" name="role" value="student" checked><span>🎓 Student athlete</span></label><label><input type="radio" name="role" value="official"><span>🏫 Sports director / Official</span></label></div>
  <label>Full name</label><input name="name" required />
  <div class="row"><div><label>Username</label><input name="username" required pattern="[A-Za-z0-9_.]{3,}" title="3+ letters, numbers, _ or ." /></div>
  <div><label>User ID (e.g. USN)</label><input name="userId" required /></div></div>
  <label>College / University</label><input name="college" list="collegelist" required placeholder="Dayananda Sagar University" />
  <div class="row"><div><label>Email</label><input name="email" type="email" /></div><div><label>Phone</label><input name="phone" /></div></div>
  <div id="sportsWrap"><label>Your sports</label><div id="sportsBox"></div></div>
  <div id="offBox" hidden><label>Designation</label><input name="designation" placeholder="Sports Director" />
  <label>Official access code</label><input name="code" /><div class="hint">Given to you by the university administration.</div></div>
  <label>Password</label><input name="pw" type="password" minlength="6" required />`;

async function doRegister(fd, sports) {
  const role = fd.get("role"), username = fd.get("username").trim(), userId = fd.get("userId").trim();
  if (DB.users.some(u => norm(u.username) === norm(username))) throw new Error("That username is taken.");
  if (DB.users.some(u => norm(u.userId) === norm(userId))) throw new Error("That User ID is already registered.");
  if (role === "official" && fd.get("code").trim() !== CONFIG.officialCode) throw new Error("Invalid official access code.");
  const salt = uid("s");
  const u = {
    id: uid("u"), role, name: fd.get("name").trim(), username, userId, college: fd.get("college").trim(),
    email: fd.get("email").trim(), phone: fd.get("phone").trim(), sports: role === "student" ? sports : [],
    designation: fd.get("designation") || "", salt, pw: await hashPw(fd.get("pw"), salt), created: today()
  };
  DB.users.push(u); save(); localStorage.setItem(SKEY, u.id); location.hash = ""; render(); toast("Welcome to ATHLONEX, " + u.name.split(" ")[0] + "!");
}
async function doLogin(fd) {
  const id = norm(fd.get("id")), u = DB.users.find(x => norm(x.username) === id || norm(x.userId) === id);
  if (!u || (await hashPw(fd.get("pw"), u.salt)) !== u.pw) throw new Error("Wrong username/ID or password.");
  localStorage.setItem(SKEY, u.id); location.hash = ""; render();
}
function logout() { localStorage.removeItem(SKEY); location.hash = ""; render(); }

/* =============== events data =============== */
const SAMPLE = buildSampleEvents();
function allEvents() {
  const custom = DB.events.map(e => ({ ...e, custom: true, cats: (SPORT_MAP[e.sport] || { cats: ["Other"] }).cats }));
  return [...custom, ...SAMPLE];
}
const upcoming = () => allEvents().filter(e => e.date >= today()).sort((a, b) => a.date.localeCompare(b.date));
const myInterests = () => DB.interests[ME.id] || [];

function icsFor(e) {
  const d = e.date.replace(/-/g, ""), t = e.time.replace(":", "") + "00";
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ATHLONEX//EN", "BEGIN:VEVENT", `UID:${e.id}@athlonex`,
    "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z", `DTSTART:${d}T${t}`, "DURATION:PT3H",
    `SUMMARY:${e.title}`, `LOCATION:${e.venue}, ${e.city}, ${e.state}`, `DESCRIPTION:${e.sport} · ${e.category} · ${e.organiser}`, "END:VEVENT", "END:VCALENDAR"];
  download(`${e.sport.replace(/\W+/g, "_")}_${e.date}.ics`, L.join("\r\n"), "text/calendar");
}
function eventCard(e) {
  const d = new Date(e.date + "T00:00:00"), on = myInterests().includes(e.id);
  return `<article class="ev">
    <div class="date"><b>${d.getDate()}</b><span>${d.toLocaleDateString("en-IN", { month: "short" })} ${d.getFullYear()}</span></div>
    <div><div><h3>${esc(e.title)}</h3><span class="badge lvl">${esc(e.level)}</span> ${e.sample ? '<span class="badge warn" title="Placeholder data – confirm with the organiser">Sample</span>' : '<span class="badge ok">Verified</span>'}</div>
      <div class="meta"><span>📅 ${fmtDate(e.date)}</span><span>🕒 ${fmtTime(e.time)}</span><span>📍 ${esc(e.city)}, ${esc(e.state)}</span><span>🏟 ${esc(e.venue)}</span><span>🏷 ${esc(e.category)}</span></div>
      <div class="meta2">${esc(e.sport)} · Organiser: ${esc(e.organiser)}${e.link ? ` · <a href="${esc(e.link)}" target="_blank" rel="noopener">Details</a>` : ""}</div></div>
    <div class="evact"><button class="btn sm ${on ? "" : "ghost"}" data-int="${e.id}">${on ? "★ Interested" : "☆ Interested"}</button><button class="btn sm ghost" data-ics="${e.id}">📅 Add to calendar</button></div>
  </article>`;
}
function bindEventButtons(root) {
  $$("[data-int]", root).forEach(b => b.onclick = () => {
    const l = DB.interests[ME.id] = DB.interests[ME.id] || [], i = l.indexOf(b.dataset.int);
    i < 0 ? l.push(b.dataset.int) : l.splice(i, 1); save();
    const e = allEvents().find(x => x.id === b.dataset.int), card = b.closest(".ev");
    card.outerHTML = eventCard(e); bindEventButtons(root);
  });
  $$("[data-ics]", root).forEach(b => b.onclick = () => icsFor(allEvents().find(x => x.id === b.dataset.ics)));
}

/* =============== finance + college scoping =============== */
function finance(userId) {
  const cl = DB.claims.filter(c => c.userId === userId);
  const sanctioned = sum(DB.grants.filter(g => g.userId === userId), "amount");
  const approvedList = cl.filter(c => c.status === "Approved" || c.status === "Paid");
  const approved = sum(approvedList, "approvedAmount"), paid = sum(cl.filter(c => c.status === "Paid"), "approvedAmount");
  return { sanctioned, claimed: sum(cl, "amount"), approved, paid, pending: sum(cl.filter(c => c.status === "Pending"), "amount"), toReceive: approved - paid, remaining: sanctioned - approved };
}
const collegeStudents = () => DB.users.filter(u => u.role === "student" && norm(u.college) === norm(ME.college));
const medalCount = (uid_, m) => DB.achievements.filter(a => a.userId === uid_ && a.medal === m).length;
const statusBadge = s => `<span class="badge ${s === "Paid" || s === "Approved" ? "ok" : s === "Rejected" ? "bad" : "warn"}">${s}</span>`;

/* =============== shell + routing =============== */
let ME = null;
const UI = { opp: { q: "", level: "All", cat: "All", sport: "", mine: false, from: "", to: "", page: 1 }, stuQ: "", stuSport: "", claimF: "All" };
const NAV = {
  student: [["dashboard", "Home", "🏠"], ["opportunities", "Opportunities", "🏆"], ["achievements", "My Achievements", "🏅"], ["expenses", "TA / DA Claims", "💰"], ["profile", "Profile", "👤"]],
  official: [["overview", "Overview", "📊"], ["students", "Students", "🎓"], ["claims", "Claims", "💰"], ["events", "Events", "📅"], ["profile", "Profile", "👤"]]
};
function render() {
  ME = DB.users.find(u => u.id === localStorage.getItem(SKEY)) || null;
  document.documentElement.dataset.theme = localStorage.getItem(TKEY) || "dark";
  $("#sportlist").innerHTML = SPORTS.map(s => `<option value="${esc(s.name)}"></option>`).join("");
  if (!ME) { viewAuth(); return; }
  const nav = NAV[ME.role], r = (location.hash.replace(/^#\/?/, "").split("?")[0]) || nav[0][0];
  const route = nav.find(n => n[0] === r) ? r : nav[0][0];
  $("#root").innerHTML = `
  <div class="app">
    <aside class="side">
      <div class="logo"><i><svg viewBox="0 0 64 64"><path d="M12 50 32 10l20 40h-9L32 28 21 50z"/></svg></i><div>ATHLONEX</div></div>
      <nav class="nav">${nav.map(n => `<a href="#/${n[0]}" class="${n[0] === route ? "on" : ""}"><span>${n[2]}</span>${n[1]}</a>`).join("")}</nav>
      <div class="me"><b>${esc(ME.name)}</b><span>${ME.role === "official" ? esc(ME.designation || "Official") : "Student"} · ${esc(ME.college)}</span>
        <div class="btns"><button class="btn sm ghost" id="themeBtn">🌓</button><button class="btn sm ghost" id="outBtn">Log out</button></div></div>
    </aside>
    <main id="view"></main>
  </div>`;
  $("#outBtn").onclick = logout;
  $("#themeBtn").onclick = () => { localStorage.setItem(TKEY, document.documentElement.dataset.theme === "dark" ? "light" : "dark"); render(); };
  VIEWS[ME.role][route]($("#view"));
  mountChat();
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", () => { if (localStorage.getItem(SKEY)) render(); });
const refreshView = () => { const r = (location.hash.replace(/^#\/?/, "")) || NAV[ME.role][0][0]; const f = VIEWS[ME.role][r] || VIEWS[ME.role][NAV[ME.role][0][0]]; f($("#view")); };
const head = (t, p, actions = "") => `<div class="page-h"><div><h2>${t}</h2><p>${p}</p></div><div>${actions}</div></div>`;
const stat = (l, v, c = "") => `<div class="card stat ${c}"><small>${l}</small><b>${v}</b></div>`;

/* =============== STUDENT VIEWS =============== */
const VIEWS = { student: {}, official: {} };
const S = VIEWS.student, O = VIEWS.official;

S.dashboard = v => {
  const f = finance(ME.id), mine = DB.achievements.filter(a => a.userId === ME.id);
  const my = new Set(ME.sports), up = upcoming(), next = (my.size ? up.filter(e => my.has(e.sport)) : up).slice(0, 4);
  v.innerHTML = head(`Hello, ${esc(ME.name.split(" ")[0])} 👋`, "Here's your ATHLONEX snapshot.") + `
  <div class="grid">${stat("Upcoming events", up.length.toLocaleString("en-IN"), "accent")}${stat("Achievements", mine.length)}${stat("Medals", mine.filter(a => ["Gold", "Silver", "Bronze"].includes(a.medal)).length)}
    ${stat("Sanctioned by college", inr(f.sanctioned))}${stat("Paid to you", inr(f.paid), "good")}${stat("Sanction remaining", inr(f.remaining), f.remaining < 0 ? "bad" : "")}</div>
  <div class="section-t"><span>Next for you ${my.size ? "(" + [...my].map(esc).join(", ") + ")" : ""}</span><a href="#/opportunities">See all →</a></div>
  <div id="nx">${next.map(eventCard).join("") || '<div class="empty">No upcoming events yet.</div>'}</div>
  ${my.size ? "" : '<p class="hint">Tip: add your sports in Profile to personalise this list.</p>'}`;
  bindEventButtons(v);
};

S.opportunities = v => {
  const f = UI.opp;
  const sportsIn = SPORTS.filter(s => f.cat === "All" || s.cats.includes(f.cat));
  v.innerHTML = head("Opportunities", `Competitions across ${SPORTS.length} sports, ${CATEGORIES.length} categories.`) + `
  <div class="pills" id="catPills">${["All", ...CATEGORIES].map(c => `<button class="pill ${f.cat === c ? "on" : ""}" data-c="${esc(c)}">${esc(c)}</button>`).join("")}</div>
  <div class="pills" id="lvlPills">${["All", ...LEVELS].map(c => `<button class="pill ${f.level === c ? "on" : ""}" data-l="${esc(c)}">${c === "All" ? "All levels" : esc(c)}</button>`).join("")}</div>
  <div class="filters">
    <div><label>Search</label><input id="fq" placeholder="Sport, city, venue, category…" value="${esc(f.q)}"></div>
    <div><label>Sport</label><select id="fs"><option value="">All sports (${sportsIn.length})</option>${sportsIn.map(s => `<option ${f.sport === s.name ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></div>
    <div><label>From</label><input id="ff" type="date" value="${f.from}"></div><div><label>To</label><input id="ft" type="date" value="${f.to}"></div>
  </div>
  <label class="check"><input type="checkbox" id="fm" ${f.mine ? "checked" : ""}> Only my sports${ME.sports.length ? "" : " (add sports in Profile)"}</label>
  <div class="hint" id="cnt" style="margin:6px 0 12px"></div><div id="evl"></div><div style="text-align:center;margin:14px"><button class="btn ghost" id="more">Show more</button></div>
  <p class="hint">“Sample” events are placeholders so the portal works on day one. Always confirm dates with the organiser; sports officials can add verified events.</p>`;
  const draw = () => {
    let l = upcoming();
    if (f.level !== "All") l = l.filter(e => e.level === f.level);
    if (f.cat !== "All") l = l.filter(e => e.cats.includes(f.cat));
    if (f.sport) l = l.filter(e => e.sport === f.sport);
    if (f.mine) l = l.filter(e => ME.sports.includes(e.sport));
    if (f.from) l = l.filter(e => e.date >= f.from);
    if (f.to) l = l.filter(e => e.date <= f.to);
    if (f.q) { const q = norm(f.q); l = l.filter(e => norm([e.title, e.sport, e.city, e.state, e.venue, e.category, e.level, e.organiser].join(" ")).includes(q)); }
    const shown = l.slice(0, f.page * 20);
    $("#cnt").textContent = `${l.length.toLocaleString("en-IN")} upcoming competition${l.length === 1 ? "" : "s"} found`;
    $("#evl").innerHTML = shown.map(eventCard).join("") || '<div class="empty">Nothing matches these filters.</div>';
    $("#more").hidden = shown.length >= l.length; bindEventButtons(v);
  };
  $$("#catPills .pill").forEach(b => b.onclick = () => { f.cat = b.dataset.c; f.sport = ""; f.page = 1; S.opportunities(v); });
  $$("#lvlPills .pill").forEach(b => b.onclick = () => { f.level = b.dataset.l; f.page = 1; S.opportunities(v); });
  $("#fq").oninput = e => { f.q = e.target.value; f.page = 1; draw(); };
  $("#fs").onchange = e => { f.sport = e.target.value; f.page = 1; draw(); };
  $("#ff").onchange = e => { f.from = e.target.value; f.page = 1; draw(); };
  $("#ft").onchange = e => { f.to = e.target.value; f.page = 1; draw(); };
  $("#fm").onchange = e => { f.mine = e.target.checked; f.page = 1; draw(); };
  $("#more").onclick = () => { f.page++; draw(); };
  draw();
};

const MEDALS = ["Gold", "Silver", "Bronze", "Participation", "Certificate only"];
const achCard = (a, official) => `
  <div class="ach"><div class="thumb">${a.files.some(f => f.type.startsWith("image/")) ? `<img data-fid="${a.files.find(f => f.type.startsWith("image/")).id}" alt="">` : "🏅"}</div>
  <div class="body"><h4>${esc(a.title)}</h4>
    <div><span class="badge ${a.medal === "Gold" ? "gold" : a.medal === "Silver" ? "silver" : a.medal === "Bronze" ? "bronze" : ""}">${esc(a.medal)}</span> <span class="badge lvl">${esc(a.level)}</span> ${a.verified ? '<span class="badge ok">Verified</span>' : '<span class="badge warn">Pending</span>'}</div>
    <div class="hint">${esc(a.sport)} · ${fmtDate(a.date)}${a.venue ? " · " + esc(a.venue) : ""}</div>
    ${a.notes ? `<div class="hint">${esc(a.notes)}</div>` : ""}
    <div class="acts">${a.files.map((f, i) => `<button class="btn sm ghost" data-vf="${a.id}:${i}">${f.type.startsWith("image/") ? "🖼" : "📄"} ${i + 1}</button>`).join("")}
    ${official ? `<button class="btn sm ${a.verified ? "ghost" : "ok"}" data-ver="${a.id}">${a.verified ? "Unverify" : "✔ Verify"}</button>` : `<button class="btn sm danger" data-delach="${a.id}">Delete</button>`}</div></div></div>`;
async function loadThumbs(root) {
  for (const im of $$("img[data-fid]", root)) { const b = await FileStore.get(im.dataset.fid); if (b) im.src = URL.createObjectURL(b); }
}
function bindAch(root, after) {
  $$("[data-vf]", root).forEach(b => b.onclick = () => { const [id, i] = b.dataset.vf.split(":"); viewFile(DB.achievements.find(a => a.id === id).files[+i]); });
  $$("[data-delach]", root).forEach(b => b.onclick = async () => {
    if (!confirm("Delete this achievement and its files?")) return;
    const a = DB.achievements.find(x => x.id === b.dataset.delach); for (const f of a.files) await FileStore.del(f.id);
    DB.achievements = DB.achievements.filter(x => x !== a); save(); after();
  });
  $$("[data-ver]", root).forEach(b => b.onclick = () => {
    const a = DB.achievements.find(x => x.id === b.dataset.ver); a.verified = !a.verified; a.verifiedBy = a.verified ? ME.name : ""; save(); after();
  });
  loadThumbs(root);
}

S.achievements = v => {
  const list = DB.achievements.filter(a => a.userId === ME.id).sort((a, b) => b.date.localeCompare(a.date));
  v.innerHTML = head("My Achievements", "Medals, certificates and photos — visible to your sports department.", '<button class="btn" id="addA">+ Add achievement</button>') + `
  <div class="grid">${stat("Total", list.length)}${stat("🥇 Gold", list.filter(a => a.medal === "Gold").length)}${stat("🥈 Silver", list.filter(a => a.medal === "Silver").length)}${stat("🥉 Bronze", list.filter(a => a.medal === "Bronze").length)}${stat("Verified", list.filter(a => a.verified).length, "good")}</div>
  ${list.length ? `<div class="ach-grid">${list.map(a => achCard(a)).join("")}</div>` : '<div class="empty">No achievements yet. Add your first medal or certificate!</div>'}`;
  $("#addA").onclick = () => achForm(v);
  bindAch(v, () => S.achievements(v));
};
function achForm(v) {
  const m = openModal(`<div class="modal-h"><h3>Add achievement</h3><button class="x">×</button></div>
  <form id="af"><label>Title</label><input name="title" required placeholder="e.g. Gold – 66 kg, Karnataka State Powerlifting" />
  <div class="row"><div><label>Sport</label><input name="sport" list="sportlist" required></div><div><label>Level</label><select name="level">${LEVELS.map(l => `<option>${l}</option>`).join("")}</select></div></div>
  <div class="row"><div><label>Result</label><select name="medal">${MEDALS.map(l => `<option>${l}</option>`).join("")}</select></div><div><label>Date</label><input type="date" name="date" required max="${today()}"></div></div>
  <label>Event / venue</label><input name="venue" placeholder="Event name, city" /><label>Notes (rank, record, weight lifted…)</label><textarea name="notes"></textarea>
  <label>Files (photos, certificates, medal pictures · images or PDF ≤ 2 MB each)</label><input type="file" name="files" accept="image/*,application/pdf" multiple />
  <div class="err" id="ae"></div><button class="btn" style="width:100%">Save achievement</button></form>`);
  $("#af", m).onsubmit = async e => {
    e.preventDefault(); const fd = new FormData(e.target), btn = $("button.btn", e.target); btn.disabled = true;
    try {
      const files = await storeFiles([...e.target.files.files]);
      DB.achievements.push({ id: uid("a"), userId: ME.id, title: fd.get("title").trim(), sport: fd.get("sport").trim(), level: fd.get("level"), medal: fd.get("medal"), date: fd.get("date"), venue: fd.get("venue").trim(), notes: fd.get("notes").trim(), files, verified: false });
      save(); closeModal(); S.achievements(v); toast("Achievement saved");
    } catch (x) { $("#ae").textContent = x.message; btn.disabled = false; }
  };
}

const CLAIM_TYPES = ["Travel – Train", "Travel – Bus", "Travel – Flight", "Local transport (cab/auto)", "Food (DA)", "Accommodation", "Entry / registration fee", "Equipment", "Medical / physio", "Other"];
S.expenses = v => {
  const f = finance(ME.id), list = DB.claims.filter(c => c.userId === ME.id).sort((a, b) => b.date.localeCompare(a.date));
  v.innerHTML = head("TA / DA Claims", "Upload bills with proof and track what your college has granted.", '<button class="btn" id="addC">+ New claim</button>') + `
  <div class="grid">${stat("Sanctioned by college", inr(f.sanctioned))}${stat("Approved so far", inr(f.approved))}${stat("Paid to you", inr(f.paid), "good")}${stat("Approved, yet to receive", inr(f.toReceive))}${stat("Pending review", inr(f.pending))}${stat("Sanction remaining", inr(f.remaining), f.remaining < 0 ? "bad" : "accent")}</div>
  <p class="hint" style="margin:-8px 0 14px">Sanction remaining = amount your college sanctioned − amount approved. The sanction is set by your sports director.</p>
  ${list.length ? `<div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Event</th><th>Claimed</th><th>Approved</th><th>Status</th><th>Proof</th><th></th></tr></thead><tbody>
  ${list.map(c => `<tr><td>${fmtDate(c.date)}</td><td>${esc(c.type)}</td><td>${esc(c.event || "-")}</td><td>${inr(c.amount)}</td><td>${c.approvedAmount != null ? inr(c.approvedAmount) : "-"}</td>
  <td>${statusBadge(c.status)}${c.remarks ? `<div class="hint">${esc(c.remarks)}</div>` : ""}</td>
  <td>${c.files.map((f, i) => `<button class="btn sm ghost" data-cf="${c.id}:${i}">${i + 1}</button>`).join(" ")}</td>
  <td>${c.status === "Pending" ? `<button class="btn sm danger" data-delc="${c.id}">Delete</button>` : ""}</td></tr>`).join("")}</tbody></table></div>` : '<div class="empty">No claims yet.</div>'}`;
  $("#addC").onclick = () => claimForm(v);
  $$("[data-cf]", v).forEach(b => b.onclick = () => { const [id, i] = b.dataset.cf.split(":"); viewFile(DB.claims.find(c => c.id === id).files[+i]); });
  $$("[data-delc]", v).forEach(b => b.onclick = async () => {
    if (!confirm("Delete this pending claim?")) return;
    const c = DB.claims.find(x => x.id === b.dataset.delc); for (const f of c.files) await FileStore.del(f.id);
    DB.claims = DB.claims.filter(x => x !== c); save(); S.expenses(v);
  });
};
function claimForm(v) {
  const evs = allEvents().filter(e => myInterests().includes(e.id)).map(e => e.title);
  const m = openModal(`<div class="modal-h"><h3>New TA / DA claim</h3><button class="x">×</button></div>
  <form id="cf"><div class="row"><div><label>Expense date</label><input type="date" name="date" required max="${today()}"></div><div><label>Type</label><select name="type">${CLAIM_TYPES.map(t => `<option>${t}</option>`).join("")}</select></div></div>
  <label>Competition / purpose</label><input name="event" list="evl2" placeholder="e.g. State Powerlifting Championship, Mysuru" /><datalist id="evl2">${evs.map(e => `<option value="${esc(e)}">`).join("")}</datalist>
  <label>Amount (₹)</label><input type="number" name="amount" min="1" step="1" required />
  <label>Details</label><textarea name="notes" placeholder="Train no./route, hotel name, number of days…"></textarea>
  <label>Proof – bill, ticket, receipt (required)</label><input type="file" name="files" accept="image/*,application/pdf" multiple required />
  <div class="err" id="ce"></div><button class="btn" style="width:100%">Submit claim</button></form>`);
  $("#cf", m).onsubmit = async e => {
    e.preventDefault(); const fd = new FormData(e.target), btn = $("button.btn", e.target); btn.disabled = true;
    try {
      const files = await storeFiles([...e.target.files.files]); if (!files.length) throw new Error("Attach at least one proof file.");
      DB.claims.push({ id: uid("c"), userId: ME.id, date: fd.get("date"), type: fd.get("type"), event: fd.get("event").trim(), amount: Number(fd.get("amount")), notes: fd.get("notes").trim(), files, status: "Pending", approvedAmount: null, remarks: "", created: today() });
      save(); closeModal(); S.expenses(v); toast("Claim submitted for review");
    } catch (x) { $("#ce").textContent = x.message; btn.disabled = false; }
  };
}

function profileView(v) {
  v.innerHTML = head("Profile", "Keep your details current — your college sees these.") + `<div class="card" style="max-width:640px"><form id="pf">
  <div class="row"><div><label>Full name</label><input name="name" value="${esc(ME.name)}" required></div><div><label>College / University</label><input name="college" list="collegelist" value="${esc(ME.college)}" required></div></div>
  <div class="row"><div><label>Username</label><input value="${esc(ME.username)}" disabled></div><div><label>User ID</label><input value="${esc(ME.userId)}" disabled></div></div>
  <div class="row"><div><label>Email</label><input name="email" type="email" value="${esc(ME.email)}"></div><div><label>Phone</label><input name="phone" value="${esc(ME.phone)}"></div></div>
  ${ME.role === "official" ? `<label>Designation</label><input name="designation" value="${esc(ME.designation)}">` : '<label>Your sports</label><div id="sb"></div>'}
  <label>New password (leave blank to keep)</label><input name="pw" type="password" minlength="6">
  <button class="btn" style="margin-top:16px">Save profile</button></form></div>`;
  const chips = ME.role === "student" ? chipInput($("#sb"), ME.sports) : null;
  $("#pf").onsubmit = async e => {
    e.preventDefault(); const fd = new FormData(e.target);
    Object.assign(ME, { name: fd.get("name").trim(), college: fd.get("college").trim(), email: fd.get("email").trim(), phone: fd.get("phone").trim() });
    if (chips) ME.sports = chips.get(); else ME.designation = fd.get("designation");
    if (fd.get("pw")) { ME.salt = uid("s"); ME.pw = await hashPw(fd.get("pw"), ME.salt); }
    save(); render(); toast("Profile updated");
  };
}
S.profile = O.profile = profileView;

/* =============== OFFICIAL VIEWS =============== */
O.overview = v => {
  const st = collegeStudents(), ids = new Set(st.map(s => s.id));
  const ach = DB.achievements.filter(a => ids.has(a.userId)), cl = DB.claims.filter(c => ids.has(c.userId));
  const bySport = {}; st.forEach(s => s.sports.forEach(x => bySport[x] = (bySport[x] || 0) + 1));
  const top = Object.entries(bySport).sort((a, b) => b[1] - a[1]).slice(0, 8), mx = top.length ? top[0][1] : 1;
  const sanc = sum(DB.grants.filter(g => ids.has(g.userId)), "amount"), paid = sum(cl.filter(c => c.status === "Paid"), "approvedAmount");
  v.innerHTML = head("College overview", esc(ME.college)) + `
  <div class="grid">${stat("Registered students", st.length, "accent")}${stat("Achievements", ach.length)}${stat("Medals", ach.filter(a => ["Gold", "Silver", "Bronze"].includes(a.medal)).length)}${stat("To verify", ach.filter(a => !a.verified).length)}
  ${stat("Claims pending", cl.filter(c => c.status === "Pending").length, "bad")}${stat("Total sanctioned", inr(sanc))}${stat("Total paid", inr(paid), "good")}</div>
  <div class="two"><div class="card"><div class="section-t">Students by sport</div>${top.map(([n, c]) => `<div class="barrow"><span>${esc(n)}</span><div class="bar"><i style="width:${c / mx * 100}%"></i></div><b>${c}</b></div>`).join("") || '<div class="hint">No students have joined under this college yet. Ask them to register with the exact college name: <b>' + esc(ME.college) + "</b>.</div>"}</div>
  <div class="card"><div class="section-t">Latest achievements</div>${ach.slice(-6).reverse().map(a => `<div class="list-line"><span>${esc((DB.users.find(u => u.id === a.userId) || {}).name || "")}<div class="hint">${esc(a.title)}</div></span><span class="badge">${esc(a.medal)}</span></div>`).join("") || '<div class="hint">Nothing yet.</div>'}</div></div>`;
};

O.students = v => {
  let st = collegeStudents();
  v.innerHTML = head("Students", `All athletes registered under ${esc(ME.college)}.`, '<button class="btn ghost" id="csv">⬇ Export CSV</button>') + `
  <div class="filters" style="grid-template-columns:2fr 1fr"><div><label>Search</label><input id="sq" placeholder="Name, user ID, username…" value="${esc(UI.stuQ)}"></div><div><label>Sport</label><input id="ss" list="sportlist" value="${esc(UI.stuSport)}" placeholder="Any"></div></div>
  <div class="tbl-wrap" style="margin-top:10px"><table><thead><tr><th>Name</th><th>User ID</th><th>Sports</th><th>🥇/🥈/🥉</th><th>Achievements</th><th>Sanctioned</th><th>Remaining</th><th>Pending claims</th></tr></thead><tbody id="sb2"></tbody></table></div>`;
  const draw = () => {
    const q = norm(UI.stuQ), sp = norm(UI.stuSport);
    const l = st.filter(s => (!q || norm([s.name, s.userId, s.username].join(" ")).includes(q)) && (!sp || s.sports.some(x => norm(x).includes(sp))));
    $("#sb2").innerHTML = l.map(s => { const f = finance(s.id); return `<tr class="click" data-s="${s.id}"><td><b>${esc(s.name)}</b></td><td>${esc(s.userId)}</td><td>${s.sports.map(esc).join(", ") || "-"}</td>
      <td>${medalCount(s.id, "Gold")}/${medalCount(s.id, "Silver")}/${medalCount(s.id, "Bronze")}</td><td>${DB.achievements.filter(a => a.userId === s.id).length}</td><td>${inr(f.sanctioned)}</td><td>${inr(f.remaining)}</td><td>${DB.claims.filter(c => c.userId === s.id && c.status === "Pending").length}</td></tr>`; }).join("") || '<tr><td colspan="8" class="hint">No students found.</td></tr>';
    $$("tr[data-s]", v).forEach(r => r.onclick = () => studentModal(r.dataset.s));
    $("#csv").onclick = () => {
      const rows = [["Name", "User ID", "Username", "Email", "Phone", "Sports", "Gold", "Silver", "Bronze", "Achievements", "Sanctioned", "Claimed", "Approved", "Paid", "Remaining"]];
      l.forEach(s => { const f = finance(s.id); rows.push([s.name, s.userId, s.username, s.email, s.phone, s.sports.join("; "), medalCount(s.id, "Gold"), medalCount(s.id, "Silver"), medalCount(s.id, "Bronze"), DB.achievements.filter(a => a.userId === s.id).length, f.sanctioned, f.claimed, f.approved, f.paid, f.remaining]); });
      download(`ATHLONEX_${ME.college.replace(/\W+/g, "_")}_students.csv`, rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n"), "text/csv");
    };
  };
  $("#sq").oninput = e => { UI.stuQ = e.target.value; draw(); };
  $("#ss").oninput = e => { UI.stuSport = e.target.value; draw(); };
  draw();
};

function studentModal(id) {
  const s = DB.users.find(u => u.id === id), f = finance(id);
  const ach = DB.achievements.filter(a => a.userId === id), cl = DB.claims.filter(c => c.userId === id).sort((a, b) => b.date.localeCompare(a.date)), gr = DB.grants.filter(g => g.userId === id);
  const m = openModal(`<div class="modal-h"><h3>${esc(s.name)} <span class="hint">· ${esc(s.userId)}</span></h3><button class="x">×</button></div>
  <p class="hint">${esc(s.college)} · ${esc(s.email || "no email")} · ${esc(s.phone || "no phone")}<br>Sports: ${s.sports.map(esc).join(", ") || "-"}</p>
  <div class="grid" style="margin-top:12px">${stat("Sanctioned", inr(f.sanctioned))}${stat("Approved", inr(f.approved))}${stat("Paid", inr(f.paid), "good")}${stat("Remaining", inr(f.remaining), f.remaining < 0 ? "bad" : "accent")}</div>
  <div class="section-t">Sanction funds</div>
  <form id="gf" class="row3" style="align-items:end"><div><label>Amount (₹)</label><input type="number" name="amount" min="1" required></div><div><label>Note</label><input name="note" placeholder="e.g. Nationals 2026-27"></div><button class="btn">Add sanction</button></form>
  ${gr.map(g => `<div class="list-line"><span>${inr(g.amount)} <span class="hint">${esc(g.note)} · ${fmtDate(g.date)} · ${esc(g.by)}</span></span><button class="btn sm ghost" data-dg="${g.id}">Remove</button></div>`).join("")}
  <div class="section-t" style="margin-top:18px">Claims (${cl.length})</div>
  ${cl.map(c => `<div class="list-line"><span><b>${inr(c.amount)}</b> · ${esc(c.type)} · ${fmtDate(c.date)}<div class="hint">${esc(c.event || "")} ${esc(c.notes || "")}</div>${c.files.map((x, i) => `<button class="btn sm ghost" data-vc="${c.id}:${i}">Proof ${i + 1}</button>`).join(" ")}</span>
    <span>${statusBadge(c.status)} ${c.approvedAmount != null ? inr(c.approvedAmount) : ""} <button class="btn sm" data-rv="${c.id}">${c.status === "Pending" ? "Review" : "Update"}</button></span></div>`).join("") || '<div class="hint">No claims.</div>'}
  <div class="section-t" style="margin-top:18px">Achievements (${ach.length})</div>
  ${ach.length ? `<div class="ach-grid">${ach.map(a => achCard(a, true)).join("")}</div>` : '<div class="hint">None uploaded.</div>'}`, true);
  $("#gf", m).onsubmit = e => {
    e.preventDefault(); const fd = new FormData(e.target);
    DB.grants.push({ id: uid("g"), userId: id, amount: Number(fd.get("amount")), note: fd.get("note").trim(), date: today(), by: ME.name }); save(); studentModal(id); refreshView(); toast("Sanction added");
  };
  $$("[data-dg]", m).forEach(b => b.onclick = () => { DB.grants = DB.grants.filter(g => g.id !== b.dataset.dg); save(); studentModal(id); refreshView(); });
  $$("[data-vc]", m).forEach(b => b.onclick = () => { const [cid, i] = b.dataset.vc.split(":"); viewFile(DB.claims.find(c => c.id === cid).files[+i]); });
  $$("[data-rv]", m).forEach(b => b.onclick = () => claimDecision(b.dataset.rv, () => { studentModal(id); refreshView(); }));
  bindAch(m, () => { studentModal(id); refreshView(); });
}

function claimDecision(cid, done) {
  const c = DB.claims.find(x => x.id === cid), s = DB.users.find(u => u.id === c.userId), f = finance(s.id);
  const m = openModal(`<div class="modal-h"><h3>Review claim · ${esc(s.name)}</h3><button class="x">×</button></div>
  <p class="hint">${esc(c.type)} · ${fmtDate(c.date)} · claimed <b>${inr(c.amount)}</b> · sanction remaining <b>${inr(f.remaining)}</b></p>
  <p>${esc(c.event || "")} ${esc(c.notes || "")}</p><div>${c.files.map((x, i) => `<button class="btn sm ghost" data-p="${i}">View proof ${i + 1}</button>`).join(" ")}</div>
  <label>Approved amount (₹)</label><input id="aa" type="number" min="0" value="${c.approvedAmount ?? c.amount}">
  <label>Remarks</label><textarea id="rm">${esc(c.remarks)}</textarea><div class="err" id="de"></div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn ok" id="ap">Approve</button><button class="btn danger" id="rj">Reject</button>${c.status === "Approved" ? '<button class="btn" id="pd">Mark as paid</button>' : ""}<button class="btn ghost" id="bk">Back</button></div>`);
  $$("[data-p]", m).forEach(b => b.onclick = () => viewFile(c.files[+b.dataset.p]));
  const fin = st => { c.status = st; c.decidedBy = ME.name; c.decidedAt = today(); c.remarks = $("#rm", m) ? $("#rm", m).value.trim() : c.remarks; save(); done(); toast("Claim " + st.toLowerCase()); };
  $("#ap", m).onclick = () => {
    const amt = Number($("#aa", m).value); if (!(amt >= 0)) return $("#de", m).textContent = "Enter a valid amount.";
    const after = f.approved - (["Approved", "Paid"].includes(c.status) ? c.approvedAmount : 0) + amt;
    if (after > f.sanctioned && !confirm(`This takes approvals (${inr(after)}) above the sanction (${inr(f.sanctioned)}). Approve anyway?`)) return;
    c.approvedAmount = amt; fin("Approved");
  };
  $("#rj", m).onclick = () => { if (!$("#rm", m).value.trim()) return $("#de", m).textContent = "Please add a remark explaining the rejection."; c.approvedAmount = null; fin("Rejected"); };
  if ($("#pd", m)) $("#pd", m).onclick = () => { c.paidAt = today(); fin("Paid"); };
  $("#bk", m).onclick = done;
}

O.claims = v => {
  const ids = new Set(collegeStudents().map(s => s.id)), F = ["All", "Pending", "Approved", "Paid", "Rejected"];
  v.innerHTML = head("Claims", "TA / DA claims from students of your college.") + `<div class="pills">${F.map(x => `<button class="pill ${UI.claimF === x ? "on" : ""}" data-f="${x}">${x}</button>`).join("")}</div><div id="cl"></div>`;
  $$(".pill", v).forEach(b => b.onclick = () => { UI.claimF = b.dataset.f; O.claims(v); });
  const l = DB.claims.filter(c => ids.has(c.userId) && (UI.claimF === "All" || c.status === UI.claimF)).sort((a, b) => b.created.localeCompare(a.created));
  $("#cl").innerHTML = l.length ? `<div class="tbl-wrap"><table><thead><tr><th>Student</th><th>Date</th><th>Type</th><th>Claimed</th><th>Approved</th><th>Status</th><th></th></tr></thead><tbody>${l.map(c => { const s = DB.users.find(u => u.id === c.userId); return `<tr><td>${esc(s.name)}<div class="hint">${esc(s.userId)}</div></td><td>${fmtDate(c.date)}</td><td>${esc(c.type)}</td><td>${inr(c.amount)}</td><td>${c.approvedAmount != null ? inr(c.approvedAmount) : "-"}</td><td>${statusBadge(c.status)}</td><td><button class="btn sm" data-rv="${c.id}">${c.status === "Pending" ? "Review" : "Update"}</button></td></tr>`; }).join("")}</tbody></table></div>` : '<div class="empty">No claims here.</div>';
  $$("[data-rv]", v).forEach(b => b.onclick = () => claimDecision(b.dataset.rv, () => { closeModal(); O.claims(v); }));
};

O.events = v => {
  const mine = DB.events.slice().sort((a, b) => a.date.localeCompare(b.date));
  v.innerHTML = head("Events", "Add verified competitions — students see them instantly with a “Verified” badge.") + `
  <div class="two"><div class="card"><div class="section-t">Add competition</div><form id="ef">
  <label>Title</label><input name="title" required placeholder="Karnataka State Powerlifting Championship 2027">
  <div class="row"><div><label>Sport</label><input name="sport" list="sportlist" required></div><div><label>Level</label><select name="level">${LEVELS.map(l => `<option>${l}</option>`).join("")}</select></div></div>
  <div class="row"><div><label>Date</label><input type="date" name="date" required min="${today()}"></div><div><label>Time</label><input type="time" name="time" value="09:00" required></div></div>
  <div class="row"><div><label>City</label><input name="city" required></div><div><label>State</label><input name="state" required></div></div>
  <label>Venue</label><input name="venue" required><div class="row"><div><label>Category</label><input name="category" placeholder="Junior / Senior / Men / Women"></div><div><label>Organiser</label><input name="organiser"></div></div>
  <label>Link (optional)</label><input name="link" type="url" placeholder="https://"><button class="btn" style="margin-top:14px">Publish event</button></form></div>
  <div class="card"><div class="section-t">Your published events (${mine.length})</div>${mine.map(e => `<div class="list-line"><span><b>${esc(e.title)}</b><div class="hint">${fmtDate(e.date)} · ${esc(e.city)} · ${esc(e.level)}</div></span><button class="btn sm danger" data-de="${e.id}">Delete</button></div>`).join("") || '<div class="hint">None yet.</div>'}</div></div>`;
  $("#ef").onsubmit = e => {
    e.preventDefault(); const fd = new FormData(e.target);
    DB.events.push({ id: uid("E"), title: fd.get("title").trim(), sport: fd.get("sport").trim(), level: fd.get("level"), date: fd.get("date"), time: fd.get("time"), city: fd.get("city").trim(), state: fd.get("state").trim(), venue: fd.get("venue").trim(), category: fd.get("category").trim() || "Open", organiser: fd.get("organiser").trim() || ME.college, link: fd.get("link"), by: ME.id });
    save(); O.events(v); toast("Event published");
  };
  $$("[data-de]", v).forEach(b => b.onclick = () => { DB.events = DB.events.filter(x => x.id !== b.dataset.de); save(); O.events(v); });
};

/* =============== iChaty – the in-app assistant =============== */
const chatLog = [];
function mountChat() {
  if ($("#chatfab")) return;
  const fab = document.createElement("button"); fab.id = "chatfab"; fab.className = "chat-fab"; fab.title = "iChaty assistant"; fab.textContent = "💬"; document.body.appendChild(fab);
  const box = document.createElement("div"); box.className = "chat"; box.id = "chatbox"; box.hidden = true;
  box.innerHTML = `<header><div>iChaty<small>Your ATHLONEX assistant</small></div><button class="x" id="cx">×</button></header><div class="msgs" id="msgs"></div><div class="quick" id="qk"></div><form id="cform"><input id="cin" placeholder="Ask me anything…" autocomplete="off"><button class="btn sm">Send</button></form>`;
  document.body.appendChild(box);
  const add = (cls, html) => { const d = document.createElement("div"); d.className = "m " + cls; d.innerHTML = html; $("#msgs").appendChild(d); $("#msgs").scrollTop = 1e6; };
  const quick = () => { const q = ME.role === "student" ? ["Next events for me", "My balance", "How do I claim TA/DA?", "Upload a medal"] : ["Pending claims", "How many students?", "Add an event"]; $("#qk").innerHTML = q.map(x => `<button type="button">${x}</button>`).join(""); $$("#qk button").forEach(b => b.onclick = () => ask(b.textContent)); };
  const ask = t => { add("me", esc(t)); const typing = document.createElement("div"); typing.className = "m bot"; typing.textContent = "…"; $("#msgs").appendChild(typing); setTimeout(() => { typing.remove(); add("bot", botReply(t)); }, 350); };
  fab.onclick = () => { box.hidden = !box.hidden; if (!box.hidden && !$("#msgs").children.length) { add("bot", `Hi ${esc(ME.name.split(" ")[0])}! 👋 I'm <b>iChaty</b>. ${ME.role === "student" ? "Ask me about upcoming competitions, your TA/DA balance, or how to upload medals." : "Ask me about students, pending claims, or adding events."}`); } quick(); $("#cin").focus(); };
  $("#cx").onclick = () => box.hidden = true;
  $("#cform").onsubmit = e => { e.preventDefault(); const t = $("#cin").value.trim(); if (t) { $("#cin").value = ""; ask(t); } };
  box.addEventListener("click", e => { const a = e.target.closest("[data-go]"); if (a) { const [lvl, sp] = a.dataset.go.split("|"); Object.assign(UI.opp, { level: lvl || "All", sport: sp || "", cat: "All", page: 1, q: "", mine: false }); location.hash = "#/opportunities"; if (ME.role === "student") render(); box.hidden = true; } });
}
function eventsList(l, go) {
  return l.length ? `<ul>${l.slice(0, 5).map(e => `<li><b>${esc(e.title)}</b><br>${fmtDate(e.date)}, ${fmtTime(e.time)} · ${esc(e.city)}</li>`).join("")}</ul>${go ? `<p><a data-go="${go}">Open in Opportunities →</a></p>` : ""}` : "";
}
function botReply(t) {
  const q = norm(t), first = ME.name.split(" ")[0];
  if (/^(hi|hello|hey|namaste|yo)\b/.test(q)) return `Hey ${esc(first)}! What would you like to know?`;
  if (/thank/.test(q)) return "Anytime! Go win something. 🏆";
  if (ME.role === "official") {
    const st = collegeStudents(), ids = new Set(st.map(s => s.id));
    if (/pending|claim/.test(q)) { const p = DB.claims.filter(c => ids.has(c.userId) && c.status === "Pending"); return `There ${p.length === 1 ? "is" : "are"} <b>${p.length}</b> pending claim${p.length === 1 ? "" : "s"} worth <b>${inr(sum(p, "amount"))}</b>. Open the <a href="#/claims">Claims</a> tab to review.`; }
    if (/student|athlete|how many/.test(q)) return `<b>${st.length}</b> student${st.length === 1 ? "" : "s"} registered under ${esc(ME.college)}. See the <a href="#/students">Students</a> tab (you can export CSV).`;
    if (/event|add|publish/.test(q)) return 'Go to <a href="#/events">Events</a> and fill in the form — it shows to students with a Verified badge.';
    if (/verify|achievement|medal/.test(q)) { const n = DB.achievements.filter(a => ids.has(a.userId) && !a.verified).length; return `<b>${n}</b> achievement${n === 1 ? "" : "s"} waiting for verification. Open a student in <a href="#/students">Students</a> to verify.`; }
    return "I can tell you about pending claims, student counts, achievements to verify, or how to add events.";
  }
  const f = finance(ME.id);
  if (/balance|remaining|granted|sanction|how much|paid|money|received/.test(q)) return `Sanctioned: <b>${inr(f.sanctioned)}</b><br>Approved: <b>${inr(f.approved)}</b> · Paid: <b>${inr(f.paid)}</b><br>Approved but not yet received: <b>${inr(f.toReceive)}</b><br>Sanction remaining: <b>${inr(f.remaining)}</b>`;
  if (/claim|ta\b|da\b|bill|expense|reimburse|travel allowance/.test(q)) return 'Go to <a href="#/expenses">TA / DA Claims → New claim</a>, enter the date, type and amount, and attach the bill/ticket as proof. Your sports director reviews it and the status updates there.';
  if (/upload|certificate|medal|photo|achievement|trophy/.test(q)) return 'Open <a href="#/achievements">My Achievements → Add achievement</a>. Add title, sport, level, result and attach photos/certificates (images or PDF up to 2 MB each). Your college can then view and verify them.';
  const lv = LEVELS.find(l => q.includes(norm(l).split(" ")[0]) && !(l === "College / University" && !/college|university/.test(q)));
  const sp = SPORTS.filter(s => s.name.length > 3).sort((a, b) => b.name.length - a.name.length).find(s => q.includes(norm(s.name)) || q.includes(norm(s.name.split(" (")[0])) && s.name.split(" (")[0].length > 3);
  if (/next|upcoming|event|competition|meet|tournament|championship/.test(q) || lv || sp) {
    let l = upcoming(), label = "";
    if (sp) { l = l.filter(e => e.sport === sp.name); label = ` for <b>${esc(sp.name)}</b>`; }
    else if (/my|me\b/.test(q) && ME.sports.length) { l = l.filter(e => ME.sports.includes(e.sport)); label = " for your sports"; }
    if (lv) { l = l.filter(e => e.level === lv); label += ` at <b>${esc(lv)}</b> level`; }
    return l.length ? `Here are the next competitions${label}:${eventsList(l, (lv || "") + "|" + (sp ? sp.name : ""))}` : `I couldn't find upcoming competitions${label}. Try the <a href="#/opportunities">Opportunities</a> page.`;
  }
  if (/sport|categor|list|kinds/.test(q)) return `ATHLONEX covers <b>${SPORTS.length}</b> sports in ${CATEGORIES.length} categories: ${CATEGORIES.map(esc).join(", ")}.`;
  return "I can help with upcoming competitions (try “kabaddi state”), your TA/DA balance, uploading medals, or claiming expenses. 🙂";
}

/* =============== boot =============== */
FileStore.open().catch(() => { }).finally(render);
