import { html, render, useState, useEffect, useRef, useErrorBoundary } from "../vendor/preact-htm.js";
import { T, EV, TOURS } from "./i18n.js";
import { db, api, LIVE, onChange, UPLOAD_URL, H, D } from "./data.js";

/* ================= state ================= */
const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (_) { return null; } };
const ui = { ready: false, lang: store("hub_lang") || "ar", route: null, panel: null, sheet: null, toasts: [], side: "client", err: "", busy: false, month: null, tour: null, x: {} };
let rerender = () => {};
const set = p => { Object.assign(ui, p); rerender(); };
const t = k => (T[k] ? T[k][ui.lang] : k);
const tf = (k, o) => t(k).replace(/\{(\w)\}/g, (_, x) => o[x]);

/* ================= helpers ================= */
const me = () => db.profiles[db.me] || {};
const role = id => (db.profiles[id] || {}).role;
const myRole = () => role(db.me);
const nm = id => (db.profiles[id] && (db.profiles[id].name || db.profiles[id].username)) || "—";
const P = id => db.projects.find(p => p.id === id);
const V = id => db.videos.find(v => v.id === id);
const TK = id => db.tasks.find(x => x.id === id);
const clientsOf = p => [p.client, ...db.members.filter(m => m.project === p.id).map(m => m.client)].filter((x, i, a) => x && a.indexOf(x) === i);
const isMine = p => !!p && clientsOf(p).includes(db.me);
const ST = i => t("st" + i);
const sod = x => { const d = new Date(x); d.setHours(0, 0, 0, 0); return d.getTime(); };
const fd = x => (x ? new Date(x).toLocaleDateString(ui.lang === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "short" }) : "—");
const fdt = x => (x ? new Date(x).toLocaleString(ui.lang === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—");
const ago = x => { const m = Math.round((Date.now() - x) / 6e4); if (m < 1) return t("now"); if (m < 60) return m + t("m"); if (m < 1440) return Math.round(m / 60) + t("h"); return Math.round(m / 1440) + t("d"); };
const vname = v => { const p = P(v.project); return `${p && p.type === "tLong" ? t("video") : t("reel")} ${v.n}`; };
const vfull = v => { const p = P(v.project); return p ? `${p.title} · ${vname(v)}` : vname(v); };
const isLateV = v => v.stage < 7 && v.due < Date.now() && !db.deliveries.some(d => d.video === v.id);
const tDone = x => x.stage >= Math.max(1, x.stages.length);
const isLateT = x => !tDone(x) && x.due < Date.now();
const bucket = x => { const done = x.kind === "task" ? tDone(x) : x.stage === 7; if (done) return "done"; if (x.due < Date.now()) return "late"; const d = sod(x.due), T0 = sod(Date.now()); if (d === T0) return "today"; if (d === T0 + D) return "tomorrow"; return "later"; };
const notesOf = vid => db.notes.filter(n => n.video === vid).sort((a, b) => tcSec(a.tc) - tcSec(b.tc) || a.sort - b.sort);
const tcSec = tc => { const p = String(tc || "").split(":").map(Number); if (!tc || p.some(isNaN)) return 1e9; return p.reduce((a, b) => a * 60 + b, 0); };
const delivOf = vid => db.deliveries.filter(d => d.video === vid).sort((a, b) => b.created - a.created);
const pendingDeliv = vid => db.deliveries.find(d => d.video === vid && d.status === "pending");
const usedRounds = v => (v.pub < 6 ? 0 : v.rs === "awaiting" || v.pub === 7 ? Math.max(0, v.round - 1) : v.round);
const cleanUrl = x => { const m = String(x || "").match(/https?:\/\/[^\s]+/g); if (!m) return ""; let u = m[m.length - 1]; const i = u.lastIndexOf("http"); return i > 0 ? u.slice(i) : u; };
const money = n => `${Math.round(n || 0).toLocaleString(ui.lang === "ar" ? "ar-EG" : "en-US")} ${db.settings.currency || ""}`;
const ym = x => { const d = new Date(x); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); };
const curMonth = () => ui.month || ym(Date.now());
const editors = () => Object.values(db.profiles).filter(p => p.role === "editor").map(p => p.id);
const clientsList = () => Object.values(db.profiles).filter(p => p.role === "client").map(p => p.id);
function toast(msg) { const id = Math.random(); set({ toasts: [...ui.toasts, { id, msg }] }); setTimeout(() => set({ toasts: ui.toasts.filter(x => x.id !== id) }), 3600); }
async function run(fn) { try { set({ busy: true }); await fn(); } catch (e) { console.error(e); toast(e && e.message && /[؀-ۿa-z]/i.test(e.message) && e.message.length < 140 ? e.message : t("err")); } finally { set({ busy: false }); } }
const actorName = e => (myRole() === "client" && e.actorRole === "editor" ? t("theEditor") : e.actorRole === "admin" ? "Cammio" : nm(e.actor));
function itemName(e) { if (e.video) { const v = V(e.video); return v ? vfull(v) : t("video"); } if (e.task) { const x = TK(e.task); return x ? x.title : t("task"); } if (e.project) { const p = P(e.project); return p ? p.title : t("project"); } return ""; }
function evText(e) { const tpl = EV[e.kind]; if (!tpl) return e.kind; const pr = e.params || {}; const stage = typeof pr.stage === "number" ? ST(pr.stage) : pr.stage || ""; return tpl[ui.lang].replace("{a}", actorName(e)).replace("{item}", itemName(e)).replace("{stage}", stage).replace("{round}", pr.round || "").replace("{n}", pr.n || "").replace("{text}", pr.text || ""); }
const notifText = n => { const e = db.events.find(x => x.id === n.eventId); return e ? evText(e) : (ui.lang === "ar" ? n.ar : n.en) || "…"; };

/* ---- sheets / notes parsing ---- */
function parseCSV(s) { const rows = []; let row = [], cell = "", q = false; for (let i = 0; i < s.length; i++) { const c = s[i]; if (q) { if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; } else if (c === '"') q = true; else if (c === ",") { row.push(cell); cell = ""; } else if (c === "\n" || c === "\r") { if (c === "\r" && s[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; } else cell += c; } if (cell !== "" || row.length) { row.push(cell); rows.push(row); } return rows; }
const isTc = c => /^\d{1,2}:\d{2}(:\d{2})?([.,]\d+)?$/.test(c);
const shortCue = x => { const w = String(x || "").replace(/\.{2,}|…/g, " ").replace(/\s+/g, " ").trim().split(" "); return w.length > 7 ? w.slice(0, 7).join(" ") + "…" : w.join(" "); };
function rowsToNotes(rows) {
  rows = rows.map(r => r.map(c => String(c || "").trim()));
  const HD = [["tc", /time ?code|تايم|التوقيت|الوقت/i], ["cue", /المنطوق|النص|الكلام|الكلمة|كلمة|الجملة|script|cue|voice|word/i], ["visual", /المشهود|المشهد|الكادر|visual|scene|shot/i], ["asset", /العنصر|asset|cutout/i], ["sfx", /sfx|صوت|الصوتي|ملاحظ|notes|edit/i]];
  let hi = -1, map = {};
  for (let i = 0; i < rows.length && hi < 0; i++) { const m = {}; rows[i].forEach((c, j) => { if (!c || c.length > 60) return; for (const [k, re] of HD) { if (m[k] == null && re.test(c)) { m[k] = j; break; } } }); if (Object.keys(m).length >= 2) { hi = i; map = m; } }
  const out = [];
  if (hi < 0) { rows.forEach(r => { const cells = r.filter(Boolean); if (!cells.length) return; let tc = ""; const i = cells.findIndex(isTc); if (i >= 0) { tc = cells[i]; cells.splice(i, 1); } if (cells.length > 1 && /^\d{1,3}$/.test(cells[0])) cells.shift(); if (!tc && cells.length < 2) return; out.push({ tc, cue: shortCue(cells[0] || ""), visual: cells[1] || "", sfx: cells.slice(2).join(" · ") }); }); return out; }
  rows.slice(hi + 1).forEach(r => { const g = k => (map[k] != null ? r[map[k]] || "" : ""); if (r.filter(Boolean).length < 2) return; let tc = g("tc"); if (!isTc(tc)) tc = r.find(isTc) || ""; const cue = shortCue(g("cue")), vis = g("visual"), asset = g("asset"), sfx = g("sfx"); if (!cue && !vis) return; out.push({ tc, cue, visual: vis + (asset && !vis.includes(asset) ? ` (${asset})` : ""), sfx }); });
  return out;
}
const pasteToNotes = txt => rowsToNotes(String(txt || "").split(/\r?\n/).map(l => l.split("\t")));

/* ---- money ---- */
function priceOf(v, ed) { if (v.price != null) return v.price; const p = P(v.project); return ((db.rates[ed] || {})[p.type]) || 0; }
function ledger(ed, month) {
  const early = (+db.settings.early_hours || 0) * H, allow = +db.settings.late_allowance || 0, pen = +db.settings.late_penalty || 0;
  const items = db.videos.filter(v => { const p = P(v.project); if (!p || p.status !== "active") return false; return (v.deliveredBy || p.editor) === ed && ym(v.deliveredAt || v.due) === month; })
    .map(v => { const at = v.deliveredAt; return { v, at, late: at ? at > v.due : Date.now() > v.due, early: !!at && at <= v.due - early, price: priceOf(v, ed) }; })
    .sort((a, b) => (a.at || a.v.due) - (b.at || b.v.due));
  const done = items.filter(i => i.at), earned = done.reduce((a, i) => a + i.price, 0);
  const reds = items.filter(i => i.late).length, greens = items.filter(i => i.early).length;
  const net = Math.max(0, reds - greens), excess = Math.max(0, net - allow), deduction = excess * pen;
  return { items, done: done.length, earned, reds, greens, net, allow, excess, deduction, pen, total: Math.max(0, earned - deduction) };
}

/* ================= actions ================= */
const A = {
  // editor
  moveStage: (v, s) => run(async () => { await api.updVideo(v.id, { stage: s, pending: { type: "stage", stage: s } }); await api.log("stage_req", { video: v.id, params: { stage: s } }); toast(t("waitingCammio")); }),
  deliver: (v, link, note) => run(async () => { const u = cleanUrl(link); if (!u) throw new Error(t("needLink")); const round = (v.round || 0) + 1; await api.addDelivery(v.id, round, u, note); await api.log("draft_sent", { video: v.id, params: { round } }); set({ sheet: null }); toast(t("sent")); }),
  gotNotes: v => run(async () => { await api.updVideo(v.id, { rs: "revising" }); await api.log("revising", { video: v.id }); }),
  tick: (n, done) => run(async () => { await api.setNote(n.id, done); const ns = notesOf(n.video); if (done && ns.every(x => x.done)) await api.log("notes_all_done", { video: n.video }); }),
  taskStage: (x, s) => run(async () => { await api.updTask(x.id, { stage: s }); await api.log("task_stage", { task: x.id, params: { stage: x.stages[s - 1] || t("done") } }); }),
  taskDeliver: (x, link, finish) => run(async () => { const u = cleanUrl(link); if (!u) throw new Error(t("needLink")); await api.updTask(x.id, finish ? { resLink: u, stage: Math.max(1, x.stages.length) } : { resLink: u }); await api.log("task_delivered", { task: x.id, params: { link: u } }); set({ sheet: null }); toast(t("sent")); }),
  checkin: changes => run(async () => { for (const [v, s] of changes) { await api.updVideo(v.id, { stage: s, pending: { type: "stage", stage: s } }); await api.log("stage_req", { video: v.id, params: { stage: s } }); } await api.log("checkin", { params: { n: changes.length } }); store("hub_chk_" + db.me, String(Date.now())); set({ sheet: null }); toast(t("sent")); }),
  // admin
  approveStage: v => run(async () => { const s = v.pending.stage; await api.updVideo(v.id, { pub: Math.max(v.pub, s), pending: null }); await api.log("stage_ok", { video: v.id, params: { stage: s } }); toast("✓"); }),
  holdStage: v => run(async () => { const s = v.pending.stage; await api.updVideo(v.id, { pending: null }); await api.log("stage_hold", { video: v.id, params: { stage: s } }); }),
  approveDeliv: d => run(async () => { const v = V(d.video); await api.setDelivery(d.id, "approved"); for (const o of db.deliveries.filter(x => x.video === d.video && x.status === "pending" && x.id !== d.id)) await api.setDelivery(o.id, "superseded"); await api.updVideo(v.id, { stage: 6, pub: 6, round: d.round, link: d.link, rs: "awaiting", pending: null }); await api.log("draft_ok", { video: v.id, params: { round: d.round } }); await api.loadAll(); toast("✓"); }),
  holdDeliv: d => run(async () => { await api.setDelivery(d.id, "held"); await api.log("draft_hold", { video: d.video, params: { round: d.round } }); await api.loadAll(); }),
  setStage: (v, s) => run(async () => { await api.updVideo(v.id, { stage: s, pub: s, pending: null, ...(s === 7 ? { rs: null } : {}) }); await api.log("stage_ok", { video: v.id, params: { stage: s } }); }),
  assign: (p, ed) => run(async () => { await api.updProject(p.id, { status: "active", editor: ed }); await api.markVideosNew(p.id); await api.loadAll(); await api.log("assigned", { project: p.id }); set({ panel: null }); toast("✓"); }),
  ping: v => run(async () => { await api.log("ask_status", { video: v.id }); toast(t("asked")); }),
  pingTask: x => run(async () => { await api.log("task_ping", { task: x.id }); toast(t("asked")); }),
  // client
  reviewNotes: v => run(async () => { await api.updVideo(v.id, { rs: "notes" }); await api.log("review_notes", { video: v.id }); toast(t("sent")); }),
  approveFinal: v => run(async () => { await api.updVideo(v.id, { stage: 7, pub: 7, rs: null }); await api.log("client_approved", { video: v.id }); toast("✓"); }),
  ask: v => run(async () => { await api.log("ask_status", { video: v.id }); toast(t("asked")); }),
  // shared
  addNotes: (vid, rows) => run(async () => { if (!rows.length) return; await api.addNotes(vid, rows); await api.log("notes_added", { video: vid, params: { n: rows.length } }); toast("✓"); }),
};

/* ================= routing ================= */
function defaultRoute() { const r = myRole(); return r === "admin" ? "inbox" : r === "editor" ? "queue" : "projects"; }
function go(route) { set({ route, panel: null, sheet: null }); try { window.scrollTo(0, 0); } catch (_) {} }
function openRef(ref) {
  if (!ref) return; const [k, id] = ref.split(":");
  if (k === "v" && V(id)) return set({ sheet: null, panel: { type: "v", id } });
  if (k === "t" && TK(id)) return set({ sheet: null, panel: { type: "t", id } });
  if (k === "p" && P(id)) { const p = P(id); if (p.status === "pending" && myRole() === "admin") return set({ sheet: null, panel: { type: "p", id } }); const v = db.videos.find(x => x.project === id); if (v) return set({ sheet: null, panel: { type: "v", id: v.id } }); }
  toast(t("none"));
}

/* ================= small components ================= */
const ico = {
  bell: html`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`,
  x: html`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>`,
  help: html`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>`,
  inbox: html`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`,
  users: html`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  film: html`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="2" width="20" height="20" rx="2.18"/><path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5"/></svg>`,
  coin: html`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M14.5 9a2.5 2 0 0 0-2.5-1.5c-1.4 0-2.5.8-2.5 2s1.1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2A2.5 2 0 0 1 9.5 15M12 6v1.5M12 16.5V18"/></svg>`,
  key: html`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/></svg>`,
  list: html`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>`,
  out: html`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>`,
};
const Av = ({ id, lg }) => { const p = db.profiles[id]; const n = (p && (p.name || p.username)) || "?"; return html`<span class=${"av" + (lg ? " lg" : "")}>${p && p.avatar_url ? html`<img src=${p.avatar_url} alt="" />` : n[0]}</span>`; };
const Chip = ({ k, children }) => html`<span class=${"chip " + (k || "")}>${children}</span>`;
const Steps = ({ s, pub }) => html`<div class="steps">${[1, 2, 3, 4, 5, 6, 7].map(i => html`<span class=${i < s || s === 7 && i === 7 ? "on" : i === s ? "cur" : ""} title=${ST(i)}>${pub != null && i === pub && pub !== s ? html`<i class="pubmark"></i>` : ""}</span>`)}</div>`;
const Empty = ({ text }) => html`<div class="empty">${text || t("none")}</div>`;
const Section = ({ title, count, action, children }) => html`<section class="sec"><div class="sec-h"><b>${title}</b>${count ? html`<em class="cnt">${count}</em>` : ""}<span class="grow"></span>${action || ""}</div>${children}</section>`;
const ExtLink = ({ href, children }) => (href ? html`<a class="ext" href=${href} target="_blank" rel="noopener">${children || t("open")} ↗</a>` : null);

function stageChip(v) {
  const r = myRole(), pd = pendingDeliv(v.id);
  if (r === "client") { if (v.pub === 6 && v.rs === "awaiting") return html`<${Chip} k="y">${t("needsReview")}<//>`; return html`<${Chip} k=${v.pub === 7 ? "k" : ""}>${ST(v.pub)}<//>`; }
  if (pd) return html`<${Chip} k="y">${r === "admin" ? t("draftIn") : t("waitingCammio")}<//>`;
  if (v.pending) return html`<${Chip} k="y">${r === "admin" ? t("stageReq") : t("waitingCammio")}: ${ST(v.pending.stage)}<//>`;
  if (v.stage === 6 && v.rs === "notes") return html`<${Chip} k="k">${t("clientNotesIn")}<//>`;
  if (v.stage === 6 && v.rs === "awaiting") return html`<${Chip}>${t("withClient")}<//>`;
  return html`<${Chip} k=${v.stage === 7 ? "k" : ""}>${ST(v.stage)}<//>`;
}
function notesChip(vid) { const ns = notesOf(vid); if (!ns.length) return null; const d = ns.filter(n => n.done).length; return html`<${Chip} k=${d === ns.length ? "k" : "o"}>${t("pNotes")} ${d}/${ns.length}<//>`; }

function VideoRow({ v, sub }) {
  const p = P(v.project), r = myRole();
  const subline = sub || (r === "client" ? p.title : r === "editor" ? `${nm(p.client)} · ${p.title}` : `${nm(p.client)} → ${nm(p.editor)}`);
  return html`<button class="row-item" onClick=${() => set({ panel: { type: "v", id: v.id } })}>
    <div class="ri-main"><div class="ri-t">${v.isNew && r === "editor" ? html`<${Chip} k="y">${t("newTag")}<//> ` : ""}${r === "client" ? vname(v) : vfull(v)}</div><div class="ri-s">${subline}</div></div>
    <div class="ri-meta">${notesChip(v.id)}${(r !== "client" && isLateV(v)) ? html`<${Chip} k="r">${t("late")}<//>` : ""}${stageChip(v)}<span class="ri-due">${fd(v.due)}</span></div></button>`;
}
function TaskRow({ x }) {
  return html`<button class="row-item" onClick=${() => set({ panel: { type: "t", id: x.id } })}>
    <div class="ri-main"><div class="ri-t">${x.isNew && myRole() === "editor" ? html`<${Chip} k="y">${t("newTag")}<//> ` : ""}${x.title}</div><div class="ri-s">${t("task")}${myRole() === "admin" ? " · " + nm(x.editor) : ""}</div></div>
    <div class="ri-meta">${isLateT(x) ? html`<${Chip} k="r">${t("late")}<//>` : ""}<${Chip} k=${tDone(x) ? "k" : ""}>${tDone(x) ? t("done") : x.stages[x.stage] || t("task")}<//><span class="ri-due">${fd(x.due)}</span></div></button>`;
}
function ReqRow({ p }) { return html`<button class="row-item" onClick=${() => set({ panel: { type: "p", id: p.id } })}><div class="ri-main"><div class="ri-t">${p.title}</div><div class="ri-s">${nm(p.client)} · ${p.count} × ${t(p.type)} · ${t(p.cad)}</div></div><div class="ri-meta"><${Chip} k="y">${t("newRequests")}<//><span class="ri-due">${ago(p.created)}</span></div></button>`; }
const List = ({ children }) => html`<div class="list">${children && children.length ? children : html`<${Empty} />`}</div>`;

/* ================= LOGIN ================= */
function Login() {
  const [u, setU] = useState(""), [p, setP] = useState(""), [picked, setPicked] = useState(false);
  const submit = async e => { e.preventDefault(); if (!u || !p) return; set({ busy: true, err: "" }); try { await api.login(u.trim().toLowerCase(), p, ui.side, { bad: t("badLogin"), side: t("wrongSide"), noRole: t("noRole") }); afterLogin(); } catch (er) { set({ err: er.message || t("badLogin") }); } finally { set({ busy: false }); } };
  const pick = side => { set({ side, err: "" }); setPicked(true); setTimeout(() => { const el = document.querySelector(".lfields input"); el && el.focus(); }, 380); };
  const sideCls = !picked ? "" : ui.side === "client" ? " a" : " b";
  return html`<div class="login">
    <div class="corner"><button class="btn line sm" onClick=${() => setLang(ui.lang === "ar" ? "en" : "ar")}>${ui.lang === "ar" ? "EN" : "ع"}</button></div>
    <form class=${"lbox rise" + (picked ? " open" : "")} onSubmit=${submit}>
      <div class=${"gswitch" + sideCls}><i class="knob"></i>
        <button type="button" class=${picked && ui.side === "client" ? "on" : ""} onClick=${() => pick("client")}>${ico.users}<span>${t("client")}</span></button>
        <button type="button" class=${picked && ui.side === "editor" ? "on" : ""} onClick=${() => pick("editor")}>${ico.film}<span>${t("editor")}</span></button>
      </div>
      <div class="lfields"><div class="lfields-in">
        <input placeholder=${t("user")} value=${u} onInput=${e => setU(e.target.value)} autocapitalize="off" spellcheck="false" autocomplete="username" tabindex=${picked ? 0 : -1} />
        <input type="password" placeholder=${t("pass")} value=${p} onInput=${e => setP(e.target.value)} autocomplete="current-password" tabindex=${picked ? 0 : -1} />
        <div class="err">${ui.err}</div>
        <button class=${"btn" + (ui.busy ? " busy" : "")} type="submit" tabindex=${picked ? 0 : -1}>${t("signIn")}</button>
      </div></div>
    </form>
    ${!LIVE ? html`<div class="demo">${t("demo")}: ${api.demoUsers().map(x => html`<button onClick=${() => { setU(x); setP("1234"); pick(x === "alizakria" || x === "youssef" ? "client" : "editor"); }}>${x}</button> `)} — 1234</div>` : ""}
  </div>`;
}
function setLang(l) { store("hub_lang", l); set({ lang: l }); document.documentElement.lang = l; document.documentElement.dir = l === "ar" ? "rtl" : "ltr"; if (db.me) api.updProfile({ lang: l }).catch(() => {}); }
function afterLogin() {
  const p = me(); if (p.lang && p.lang !== ui.lang) setLang(p.lang);
  set({ route: defaultRoute(), err: "" });
  const TV = 4; if ((p.tour_version || 0) < TV) { api.updProfile({ tour_version: TV }).catch(() => {}); setTimeout(startTour, 600); }
}

/* ================= SHELL ================= */
function navItems() {
  const r = myRole();
  if (r === "admin") {
    const inboxN = db.deliveries.filter(d => d.status === "pending").length + db.videos.filter(v => v.pending).length + db.projects.filter(p => p.status === "pending").length;
    return [["inbox", t("inbox"), ico.inbox, inboxN], ["clients", t("clients"), ico.users, 0], ["team", t("team"), ico.film, 0], ["money", t("money"), ico.coin, 0], ["accounts", t("accounts"), ico.key, Object.values(db.profiles).filter(p => p.role === "pending").length]];
  }
  if (r === "editor") { const mine = myQueue(); return [["queue", t("myWork"), ico.list, mine.filter(x => ["late", "today"].includes(bucket(x))).length], ["record", t("myRecord"), ico.coin, 0]]; }
  const need = db.videos.filter(v => isMine(P(v.project)) && v.pub === 6 && v.rs === "awaiting").length;
  return [["projects", t("myProjects"), ico.film, need]];
}
function Shell() {
  const items = navItems(), route = (ui.route || defaultRoute()).split(":")[0], unread = db.notifs.filter(n => !n.read).length;
  const canAsk = typeof Notification !== "undefined" && Notification.permission === "default";
  const user = html`<button class="me" data-tour="me" onClick=${() => set({ sheet: { type: "account" } })}><${Av} id=${db.me} /><span class="nm">${nm(db.me)}</span></button>`;
  return html`<div class="shell">
    <aside class="side">
      <div class="brand"><span class="sig-s">Cammio Studio</span><span class="muted tiny">Hub</span></div>
      <nav>${items.map(([k, l, ic, n]) => html`<button class=${"nav" + (route === k ? " on" : "")} data-tour=${"nav-" + k} onClick=${() => go(k)}>${ic}<span class="grow">${l}</span>${n ? html`<em>${n}</em>` : ""}</button>`)}</nav>
      <div class="side-foot">${user}<div class="row"><button class="ico" title=${t("tour")} onClick=${startTour}>${ico.help}</button><button class="btn line sm" onClick=${() => setLang(ui.lang === "ar" ? "en" : "ar")}>${ui.lang === "ar" ? "EN" : "ع"}</button><button class="ico" title=${t("signOut")} onClick=${() => run(async () => { await api.logout(); set({ route: null, panel: null, sheet: null }); })}>${ico.out}</button></div></div>
    </aside>
    <div class="main-wrap">
      <header class="top">
        <div class="top-title">${(items.find(i => i[0] === route) || [])[1] || ""}</div><span class="grow"></span>
        ${canAsk ? html`<button class="btn line sm hide-m" onClick=${() => { try { Notification.requestPermission().then(rerender); } catch (_) {} }}>🔔 ${t("enableN")}</button>` : ""}
        <button class="ico" data-tour="bell" onClick=${() => { set({ sheet: { type: "notifs" } }); api.markRead().catch(() => {}); }}>${ico.bell}${unread ? html`<b>${unread}</b>` : ""}</button>
        <span class="show-m">${user}</span>
      </header>
      <main class="main">${page()}</main>
    </div>
    <nav class="bottom">${items.map(([k, l, ic, n]) => html`<button class=${route === k ? "on" : ""} onClick=${() => go(k)}>${ic}<span>${l}</span>${n ? html`<em>${n}</em>` : ""}</button>`)}</nav>
    ${ui.panel ? html`<div class="scrim" onClick=${() => set({ panel: null })}></div><${Panel} />` : ""}
    ${ui.sheet ? html`<div class="scrim" onClick=${() => set({ sheet: null })}></div><${Sheet} />` : ""}
  </div>`;
}
function page() {
  const [r0, arg] = (ui.route || defaultRoute()).split(":"), r = myRole();
  if (r === "admin") return r0 === "clients" ? (arg ? html`<${ClientPage} id=${arg} />` : html`<${ClientsPage} />`) : r0 === "team" ? (arg ? html`<${EditorPage} id=${arg} />` : html`<${TeamPage} />`) : r0 === "money" ? html`<${MoneyPage} />` : r0 === "accounts" ? html`<${AccountsPage} />` : html`<${Inbox} />`;
  if (r === "editor") return r0 === "record" ? html`<${RecordPage} id=${db.me} />` : html`<${Queue} />`;
  return html`<${ClientHome} />`;
}

/* ================= ADMIN PAGES ================= */
function Inbox() {
  const pd = db.deliveries.filter(d => d.status === "pending" && V(d.video)), sr = db.videos.filter(v => v.pending && v.pending.type === "stage");
  const reqs = db.projects.filter(p => p.status === "pending"), replies = db.videos.filter(v => v.rs === "notes");
  const lateV = db.videos.filter(v => P(v.project) && P(v.project).status === "active" && isLateV(v)), lateT = db.tasks.filter(isLateT);
  const asks = db.events.filter(e => e.kind === "ask_status" && e.actorRole === "client" && Date.now() - e.time < 2 * D);
  const total = pd.length + sr.length + reqs.length;
  const quick = (a, b) => html`<span class="row" onClick=${e => e.stopPropagation()}>${a}${b}</span>`;
  return html`<div class="page">
    <div class="hero"><h1>${t("inbox")}</h1>${!total && !replies.length && !lateV.length && !lateT.length ? html`<p class="muted">${t("allGood")}</p>` : ""}</div>
    ${pd.length || sr.length ? html`<${Section} title=${t("needsOk")} count=${pd.length + sr.length}><div class="list">
      ${pd.map(d => { const v = V(d.video), p = P(v.project); return html`<div class="row-item static"><div class="ri-main" onClick=${() => set({ panel: { type: "v", id: v.id } })}><div class="ri-t">${vfull(v)} <${Chip} k="y">${t("draft")} ${d.round}<//></div><div class="ri-s">${nm(d.author)} → ${nm(p.client)} · ${ago(d.created)}${d.note ? " · “" + d.note + "”" : ""}</div></div>
        <div class="ri-meta">${quick(html`<${ExtLink} href=${d.link}>Krock<//>`, "")}<button class="btn line sm" onClick=${() => A.holdDeliv(d)}>${t("hold")}</button><button class="btn sm" onClick=${() => A.approveDeliv(d)}>${t("approveSend")}</button></div></div>`; })}
      ${sr.map(v => html`<div class="row-item static"><div class="ri-main" onClick=${() => set({ panel: { type: "v", id: v.id } })}><div class="ri-t">${vfull(v)}</div><div class="ri-s">${nm(P(v.project).editor)}: ${ST(v.pub)} → <b>${ST(v.pending.stage)}</b> · ${ago(v.upd)}</div></div>
        <div class="ri-meta"><button class="btn line sm" onClick=${() => A.holdStage(v)}>${t("hold")}</button><button class="btn sm" onClick=${() => A.approveStage(v)}>${t("approveStage")}</button></div></div>`)}
    </div><//>` : ""}
    ${reqs.length ? html`<${Section} title=${t("newRequests")} count=${reqs.length}><${List}>${reqs.map(p => html`<${ReqRow} p=${p} />`)}<//><//>` : ""}
    ${replies.length || asks.length ? html`<${Section} title=${t("clientReplies")}><${List}>${[...replies.map(v => html`<${VideoRow} v=${v} />`), ...asks.filter(e => e.video && V(e.video)).map(e => html`<button class="row-item" onClick=${() => set({ panel: { type: "v", id: e.video } })}><div class="ri-main"><div class="ri-t">${evText(e)}</div><div class="ri-s">${ago(e.time)}</div></div></button>`)]}<//><//>` : ""}
    ${lateV.length || lateT.length ? html`<${Section} title=${t("lateItems")} count=${lateV.length + lateT.length}><${List}>${[...lateV.map(v => html`<${VideoRow} v=${v} />`), ...lateT.map(x => html`<${TaskRow} x=${x} />`)]}<//><//>` : ""}
    <${Section} title=${t("pActivity")}><div class="list">${db.events.slice(0, 12).map(e => html`<button class="row-item" onClick=${() => openRef(e.video ? "v:" + e.video : e.task ? "t:" + e.task : e.project ? "p:" + e.project : null)}><div class="ri-main"><div class="ri-s" style="color:var(--ink)">${evText(e)}</div></div><span class="ri-due">${ago(e.time)}</span></button>`)}${!db.events.length ? html`<${Empty} />` : ""}</div><//>
  </div>`;
}
function ClientsPage() {
  const cls = clientsList();
  return html`<div class="page"><div class="hero row"><h1 class="grow">${t("clients")}</h1><button class="btn y" onClick=${() => set({ sheet: { type: "project" } })}>+ ${t("newProject")}</button></div>
    <div class="cards">${cls.map(c => { const ps = db.projects.filter(p => clientsOf(p).includes(c)), vs = db.videos.filter(v => ps.some(p => p.id === v.project)); const need = ps.filter(p => p.status === "pending").length + vs.filter(v => pendingDeliv(v.id)).length; const dl = vs.filter(v => v.pub === 7).length; const acc = db.accounts[c] || {}; const rem = dl * (+acc.price || 0) - (+acc.paid || 0);
      return html`<button class="card" onClick=${() => go("clients:" + c)}><div class="row"><${Av} id=${c} lg /><div class="grow"><b>${nm(c)}</b><div class="tiny muted">${ps.length} ${t("projects")} · ${vs.filter(v => v.stage < 7).length} ${t("st0") === "جديد" ? "شغال" : "active"}</div></div>${need ? html`<em class="cnt">${need}</em>` : ""}</div>
        <div class="card-f"><span>${t("deliveredN")} ${dl}/${vs.length}</span>${acc.price ? html`<span class=${rem > 0 ? "warn" : ""}>${t("remaining")} ${money(Math.max(0, rem))}</span>` : ""}</div></button>`; })}
    ${!cls.length ? html`<${Empty} />` : ""}</div></div>`;
}
function ClientPage({ id }) {
  const c = id, pr = db.profiles[c]; if (!pr) return html`<${Empty} />`;
  const ps = db.projects.filter(p => clientsOf(p).includes(c)), vs = db.videos.filter(v => ps.some(p => p.id === v.project && p.status === "active"));
  const acc = db.accounts[c] || {}, dl = vs.filter(v => v.pub === 7).length, owed = dl * (+acc.price || 0), paid = +acc.paid || 0;
  const setAcc = (k, val) => run(() => api.setAccount(c, { [k]: val === "" ? null : Math.max(0, +val) }));
  return html`<div class="page">
    <button class="crumb" onClick=${() => go("clients")}>${ui.lang === "ar" ? "→" : "←"} ${t("clients")}</button>
    <div class="hero row"><${Av} id=${c} lg /><div class="grow"><h1>${nm(c)}</h1><div class="muted tiny">@${pr.username}</div></div><button class="btn line sm" onClick=${() => set({ sheet: { type: "user", id: c } })}>${t("edit")}</button><button class="btn y" onClick=${() => set({ sheet: { type: "project", client: c } })}>+ ${t("newProject")}</button></div>
    <div class="stats"><div class="st"><b>${dl}${pr.package_size ? html`<small>/${pr.package_size}</small>` : ""}</b><span>${t("deliveredN")}</span></div><div class="st"><b>${money(owed)}</b><span>${t("owed")}</span></div><div class="st"><b>${money(paid)}</b><span>${t("paid")}</span></div><div class=${"st" + (owed - paid > 0 ? " hl" : "")}><b>${money(Math.max(0, owed - paid))}</b><span>${t("remaining")}</span></div></div>
    <div class="inline-fields"><label>${t("pricePerVideo")}<input type="number" min="0" value=${acc.price ?? ""} onChange=${e => setAcc("price", e.target.value)} /></label><label>${t("paid")}<input type="number" min="0" value=${acc.paid ?? ""} onChange=${e => setAcc("paid", e.target.value)} /></label></div>
    ${ps.filter(p => p.status === "pending").length ? html`<${Section} title=${t("newRequests")}><${List}>${ps.filter(p => p.status === "pending").map(p => html`<${ReqRow} p=${p} />`)}<//><//>` : ""}
    ${ps.filter(p => p.status === "active").map(p => html`<${Section} title=${p.title} count=${`${db.videos.filter(v => v.project === p.id && v.pub === 7).length}/${db.videos.filter(v => v.project === p.id).length}`} action=${html`<button class="btn line sm" onClick=${() => set({ panel: { type: "p", id: p.id } })}>${t("projSettings")}</button>`}>
      <${List}>${db.videos.filter(v => v.project === p.id).sort((a, b) => a.n - b.n).map(v => html`<${VideoRow} v=${v} sub=${`${t("editorAt")}: ${ST(v.stage)} · ${t("clientSees")}: ${ST(v.pub)}`} />`)}<//><//>`)}
  </div>`;
}
function TeamPage() {
  const eds = editors();
  return html`<div class="page"><div class="hero row"><h1 class="grow">${t("team")}</h1><button class="btn y" onClick=${() => set({ sheet: { type: "task" } })}>+ ${t("newTask")}</button></div>
    <div class="cards">${eds.map(e => { const vs = db.videos.filter(v => P(v.project) && P(v.project).editor === e && P(v.project).status === "active"); const ts = db.tasks.filter(x => x.editor === e); const wait = db.deliveries.filter(d => d.status === "pending" && vs.some(v => v.id === d.video)).length + vs.filter(v => v.pending).length; const late = vs.filter(isLateV).length + ts.filter(isLateT).length; const L = ledger(e, curMonth());
      return html`<button class="card" onClick=${() => go("team:" + e)}><div class="row"><${Av} id=${e} lg /><div class="grow"><b>${nm(e)}</b><div class="tiny muted">${vs.filter(v => v.stage < 7).length + ts.filter(x => !tDone(x)).length} ${ui.lang === "ar" ? "شغال" : "active"}${late ? html` · <span class="red">${late} ${t("late")}</span>` : ""}</div></div>${wait ? html`<em class="cnt">${wait}</em>` : ""}</div><div class="card-f"><span>${t("month")}: ${money(L.total)}</span><span>${L.net}/${L.allow} ${t("lates")}</span></div></button>`; })}
    ${!eds.length ? html`<${Empty} />` : ""}</div></div>`;
}
function EditorPage({ id }) {
  const e = id; if (!db.profiles[e]) return html`<${Empty} />`;
  const tab = ui.x.edTab || "work";
  const vs = db.videos.filter(v => P(v.project) && P(v.project).editor === e && P(v.project).status === "active"), ts = db.tasks.filter(x => x.editor === e);
  const waiting = [...db.deliveries.filter(d => d.status === "pending" && vs.some(v => v.id === d.video)).map(d => V(d.video)), ...vs.filter(v => v.pending)].filter((v, i, a) => a.indexOf(v) === i);
  const work = [...vs.filter(v => v.stage < 7), ...ts.filter(x => !tDone(x))].sort((a, b) => a.due - b.due), done = [...vs.filter(v => v.stage === 7), ...ts.filter(tDone)];
  const tabs = [["work", t("myWork").replace("ي", "ه") === t("myWork") ? "Work" : (ui.lang === "ar" ? "شغله" : "Work"), work.length], ["wait", t("needsOk"), waiting.length], ["done", t("done"), done.length], ["money", t("money"), 0]];
  return html`<div class="page">
    <button class="crumb" onClick=${() => go("team")}>${ui.lang === "ar" ? "→" : "←"} ${t("team")}</button>
    <div class="hero row"><${Av} id=${e} lg /><div class="grow"><h1>${nm(e)}</h1><div class="muted tiny">${db.profiles[e].title || "@" + db.profiles[e].username}</div></div><button class="btn line sm" onClick=${() => set({ sheet: { type: "user", id: e } })}>${t("edit")}</button><button class="btn y" onClick=${() => set({ sheet: { type: "task", editor: e } })}>+ ${t("newTask")}</button></div>
    <div class="tabs">${tabs.map(([k, l, n]) => html`<button class=${"tab" + (tab === k ? " on" : "")} onClick=${() => set({ x: { ...ui.x, edTab: k } })}>${l}${n ? html`<em>${n}</em>` : ""}</button>`)}</div>
    ${tab === "work" ? html`<${List}>${work.map(x => (x.kind === "task" ? html`<${TaskRow} x=${x} />` : html`<${VideoRow} v=${x} />`))}<//>` : ""}
    ${tab === "wait" ? html`<${List}>${waiting.map(v => html`<${VideoRow} v=${v} />`)}<//>` : ""}
    ${tab === "done" ? html`<${List}>${done.map(x => (x.kind === "task" ? html`<${TaskRow} x=${x} />` : html`<${VideoRow} v=${x} />`))}<//>` : ""}
    ${tab === "money" ? html`<${RecordPage} id=${e} admin=${true} />` : ""}
  </div>`;
}
function MonthNav() { const [y, m] = curMonth().split("-").map(Number); const label = new Date(y, m - 1, 1).toLocaleDateString(ui.lang === "ar" ? "ar-EG" : "en-GB", { month: "long", year: "numeric" }); const mv = k => set({ month: ym(new Date(y, m - 1 + k, 1).getTime()) }); return html`<div class="row monthnav"><button class="btn line sm" onClick=${() => mv(-1)}>${ui.lang === "ar" ? "→" : "←"}</button><b>${label}</b><button class="btn line sm" onClick=${() => mv(1)}>${ui.lang === "ar" ? "←" : "→"}</button></div>`; }
function RecordPage({ id, admin }) {
  const L = ledger(id, curMonth()), r = db.rates[id] || {};
  return html`<div class=${admin ? "" : "page"}>${admin ? "" : html`<div class="hero"><h1>${t("myRecord")}</h1></div>`}
    <${MonthNav} />
    <div class="stats"><div class="st"><b>${L.done}</b><span>${t("deliveredN")}</span></div><div class="st"><b>${money(L.earned)}</b><span>${t("earned")}</span></div><div class="st"><b class=${L.excess ? "red" : ""}>${L.net}/${L.allow}</b><span>${t("lates")} ${"🔴".repeat(Math.min(L.reds, 6))}${"🟢".repeat(Math.min(L.greens, 6))}</span></div><div class="st hl"><b>${money(L.total)}</b><span>${t("net")}${L.deduction ? " · −" + money(L.deduction) : ""}</span></div></div>
    <p class="tiny muted">${tf("rule", { a: L.allow, p: money(L.pen) })}</p>
    <div class="list">${L.items.map(i => html`<div class="row-item static" onClick=${() => set({ panel: { type: "v", id: i.v.id } })}><div class="ri-main"><div class="ri-t row"><span class="dot" style=${{ background: i.late ? "var(--red)" : i.early ? "var(--green)" : "var(--line)" }}></span>${vfull(i.v)}</div><div class="ri-s">${nm(P(i.v.project).client)} · ${t("due")} ${fd(i.v.due)} · ${i.at ? fdt(i.at) : t("notYet")}${i.late ? " · " + t("late") : i.early ? " · " + t("early") : ""}</div></div>
      <div class="ri-meta" onClick=${e => e.stopPropagation()}>${admin ? html`<input class="price" type="number" min="0" placeholder=${(r[P(i.v.project).type]) || 0} value=${i.v.price ?? ""} onChange=${e => run(async () => { await api.updVideo(i.v.id, { price: e.target.value === "" ? null : Math.max(0, +e.target.value) }); toast(t("saved")); })} />` : html`<${Chip} k=${i.at ? "k" : ""}>${money(i.price)}<//>`}</div></div>`)}${!L.items.length ? html`<${Empty} />` : ""}</div>
    ${admin ? html`<${Section} title=${t("rates")}><div class="inline-fields">${["tReels", "tLong", "tMotion"].map(tp => html`<label>${t(tp)}<input type="number" min="0" value=${r[tp] ?? ""} onChange=${e => run(() => api.setRate(id, tp, Math.max(0, +e.target.value || 0)))} /></label>`)}</div><//>` : ""}
  </div>`;
}
function MoneyPage() {
  const eds = editors(), cls = clientsList();
  return html`<div class="page"><div class="hero"><h1>${t("money")}</h1></div><${MonthNav} />
    <${Section} title=${t("editorsMoney")}><div class="list">${eds.map(e => { const L = ledger(e, curMonth()); return html`<button class="row-item" onClick=${() => { set({ x: { ...ui.x, edTab: "money" } }); go("team:" + e); }}><div class="ri-main row"><${Av} id=${e} /><div><div class="ri-t">${nm(e)}</div><div class="ri-s">${L.done} ${t("deliveredN")} · ${L.net}/${L.allow} ${t("lates")}${L.deduction ? " · −" + money(L.deduction) : ""}</div></div></div><div class="ri-meta"><${Chip} k="k">${money(L.total)}<//></div></button>`; })}${!eds.length ? html`<${Empty} />` : ""}</div><//>
    <${Section} title=${t("clientsMoney")}><div class="list">${cls.map(c => { const ps = db.projects.filter(p => clientsOf(p).includes(c)), dl = db.videos.filter(v => ps.some(p => p.id === v.project) && v.pub === 7).length, acc = db.accounts[c] || {}, owed = dl * (+acc.price || 0), rem = owed - (+acc.paid || 0); return html`<button class="row-item" onClick=${() => go("clients:" + c)}><div class="ri-main row"><${Av} id=${c} /><div><div class="ri-t">${nm(c)}</div><div class="ri-s">${dl} ${t("deliveredN")} × ${money(acc.price || 0)} · ${t("paid")} ${money(acc.paid || 0)}</div></div></div><div class="ri-meta"><${Chip} k=${rem > 0 ? "y" : ""}>${t("remaining")} ${money(Math.max(0, rem))}<//></div></button>`; })}</div><//>
    <${Section} title=${t("rules")}><div class="inline-fields">${[["late_allowance", "sAllow"], ["late_penalty", "sPenalty"], ["early_hours", "sEarly"]].map(([k, l]) => html`<label>${t(l)}<input type="number" min="0" value=${db.settings[k] || ""} onChange=${e => run(() => api.setSetting(k, String(e.target.value)))} /></label>`)}<label>${t("sCurrency")}<input value=${db.settings.currency || ""} onChange=${e => run(() => api.setSetting("currency", e.target.value.trim()))} /></label></div><//>
  </div>`;
}
function AccountsPage() {
  const [f, setF] = useState({ name: "", username: "", password: "", role: "client" });
  const submit = e => { e.preventDefault(); const username = f.username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, ""); if (!f.name.trim() || !username || f.password.length < 6) return toast(t("accErr")); run(async () => { await api.createAccount({ ...f, username, name: f.name.trim() }, t("accErr")); setF({ name: "", username: "", password: "", role: f.role }); toast("@" + username + " ✓"); }); };
  const all = Object.values(db.profiles).sort((a, b) => ({ pending: 0, admin: 1, editor: 2, client: 3 }[a.role] - { pending: 0, admin: 1, editor: 2, client: 3 }[b.role]));
  return html`<div class="page"><div class="hero"><h1>${t("accounts")}</h1></div>
    <form class="list form-row" onSubmit=${submit}><input placeholder=${t("name")} value=${f.name} onInput=${e => setF({ ...f, name: e.target.value })} /><input placeholder=${t("user")} value=${f.username} onInput=${e => setF({ ...f, username: e.target.value })} autocapitalize="off" /><input placeholder=${t("pass") + " (6+)"} value=${f.password} onInput=${e => setF({ ...f, password: e.target.value })} /><select value=${f.role} onChange=${e => setF({ ...f, role: e.target.value })}><option value="client">${t("client")}</option><option value="editor">${t("editor")}</option></select><button class="btn" type="submit">${t("create")}</button></form>
    <div class="list">${all.map(p => html`<div class="row-item static"><div class="ri-main row"><${Av} id=${p.id} /><div><div class="ri-t">${p.name || p.username}</div><div class="ri-s">@${p.username}${p.title ? " · " + p.title : ""}</div></div></div><div class="ri-meta">${p.role === "pending" ? html`<button class="btn line sm" onClick=${() => run(() => api.setRole(p.id, "client"))}>${t("activateAs")}${t("client")}</button><button class="btn line sm" onClick=${() => run(() => api.setRole(p.id, "editor"))}>${t("editor")}</button>` : html`<${Chip} k=${p.role === "admin" ? "k" : ""}>${t(p.role)}<//>`}${p.role !== "admin" ? html`<button class="btn line sm" onClick=${() => set({ sheet: { type: "user", id: p.id } })}>${t("edit")}</button>` : ""}</div></div>`)}</div></div>`;
}

/* ================= EDITOR ================= */
function myQueue() { return [...db.videos.filter(v => { const p = P(v.project); return p && p.editor === db.me && p.status === "active"; }), ...db.tasks.filter(x => x.editor === db.me)]; }
function nextCheck() { let last = +store("hub_chk_" + db.me) || 0; if (!last) { last = Date.now(); store("hub_chk_" + db.me, String(last)); } return Math.max(0, last + 3 * H - Date.now()); }
function Queue() {
  const all = myQueue(), groups = ["late", "today", "tomorrow", "later"], showDone = ui.x.showDone;
  return html`<div class="page">
    <div class="hero row"><h1 class="grow">${t("myWork")}</h1><button class="btn line sm" onClick=${() => set({ sheet: { type: "checkin" } })}><span class="dot pulse"></span> ${t("nextCheck")} · ${Math.round(nextCheck() / H * 10) / 10}${t("h")}</button><button class="btn y" data-tour="deliver" onClick=${() => set({ sheet: { type: "deliver" } })}>+ ${t("deliver")}</button></div>
    <div data-tour="queue">${groups.map(g => { const items = all.filter(x => bucket(x) === g).sort((a, b) => a.due - b.due); return items.length ? html`<${Section} title=${t(g)} count=${items.length}><div class="list">${items.map(x => (x.kind === "task" ? html`<${TaskRow} x=${x} />` : html`<${VideoRow} v=${x} />`))}</div><//>` : ""; })}
    ${!all.filter(x => bucket(x) !== "done").length ? html`<${Empty} text=${t("allGood")} />` : ""}</div>
    <button class="crumb" onClick=${() => set({ x: { ...ui.x, showDone: !showDone } })}>${t("done")} (${all.filter(x => bucket(x) === "done").length}) ${showDone ? "▴" : "▾"}</button>
    ${showDone ? html`<div class="list">${all.filter(x => bucket(x) === "done").map(x => (x.kind === "task" ? html`<${TaskRow} x=${x} />` : html`<${VideoRow} v=${x} />`))}</div>` : ""}
  </div>`;
}

/* ================= CLIENT ================= */
function ClientHome() {
  const ps = db.projects.filter(isMine), vs = db.videos.filter(v => ps.some(p => p.id === v.project));
  const need = vs.filter(v => P(v.project).status === "active" && v.pub === 6 && v.rs === "awaiting");
  const pk = me().package_size, dl = vs.filter(v => v.pub === 7).length, n = pk || vs.length;
  return html`<div class="page">
    <div class="hero row"><h1 class="grow">${t("myProjects")}</h1><button class="btn y" data-tour="new" onClick=${() => set({ sheet: { type: "request" } })}>+ ${t("newRequest")}</button></div>
    ${n ? html`<div class="pkg"><div class="row"><b class="grow">${t("package")}</b><span class="tiny muted">${dl} / ${n}</span></div><div class="bar"><i style=${{ width: Math.min(100, Math.round(dl / n * 100)) + "%" }}></i></div></div>` : ""}
    ${need.length ? html`<${Section} title=${t("needsReview")} count=${need.length}><div class="list">${need.map(v => html`<${VideoRow} v=${v} />`)}</div><//>` : ""}
    <div data-tour="projects">${ps.map(p => html`<${Section} title=${p.title} count=${p.status === "pending" ? "" : `${db.videos.filter(v => v.project === p.id && v.pub === 7).length}/${db.videos.filter(v => v.project === p.id).length}`} action=${p.status === "pending" ? html`<${Chip} k="y">${t("underReview")}<//>` : ""}>
      ${p.status === "pending" ? "" : html`<div class="list">${db.videos.filter(v => v.project === p.id).sort((a, b) => a.n - b.n).map(v => html`<${VideoRow} v=${v} />`)}</div>`}<//>`)}
    ${!ps.length ? html`<${Empty} />` : ""}</div></div>`;
}

/* ================= PANELS ================= */
function Panel() { const p = ui.panel; return html`<aside class="panel rise-s">${p.type === "v" ? html`<${VideoPanel} id=${p.id} />` : p.type === "t" ? html`<${TaskPanel} id=${p.id} />` : html`<${ProjectPanel} id=${p.id} />`}</aside>`; }
const PanelHead = ({ title, sub, chips }) => html`<header class="ph"><div class="grow"><div class="ph-t">${title}</div><div class="ph-s">${sub}</div><div class="row wrap" style="margin-top:8px">${chips}</div></div><button class="ico" onClick=${() => set({ panel: null })}>${ico.x}</button></header>`;

function VideoPanel({ id }) {
  const v = V(id); if (!v) return html`<${PanelHead} title="—" />`;
  const p = P(v.project), r = myRole(), tab = ui.x.vTab || "notes";
  useEffect(() => { if (r === "editor" && v.isNew) api.updVideo(v.id, { isNew: false }).catch(() => {}); }, [id]);
  const sub = r === "client" ? p.title : r === "editor" ? `${p.title} · ${nm(p.client)}` : `${p.title} · ${nm(p.client)} → ${nm(p.editor)}`;
  const tabs = [["notes", t("pNotes"), notesOf(v.id).length], ["deliv", t("pDeliv"), delivOf(v.id).length], ["act", t("pActivity"), 0], ["info", t("pInfo"), 0]];
  return html`<${PanelHead} title=${r === "client" ? vname(v) : vfull(v)} sub=${sub} chips=${html`${stageChip(v)}<${Chip}>${t("due")} ${fd(v.due)}<//>${r !== "client" && isLateV(v) ? html`<${Chip} k="r">${t("late")}<//>` : ""}${notesChip(v.id)}`} />
    <div class="pb">
      <div class="pipe"><${Steps} s=${r === "client" ? v.pub : v.stage} pub=${r === "admin" ? v.pub : null} /><div class="pipe-l"><span>${ST(1)}</span><span>${ST(7)}</span></div>${r === "admin" && v.pub !== v.stage ? html`<div class="tiny muted">${t("editorAt")}: <b>${ST(v.stage)}</b> · ${t("clientSees")}: <b>${ST(v.pub)}</b></div>` : ""}</div>
      <${NextStep} v=${v} p=${p} />
      <div class="tabs">${tabs.map(([k, l, n]) => html`<button class=${"tab" + (tab === k ? " on" : "")} onClick=${() => set({ x: { ...ui.x, vTab: k } })}>${l}${n ? html` <span class="muted">${n}</span>` : ""}</button>`)}</div>
      ${tab === "notes" ? html`<${NotesBlock} v=${v} />` : tab === "deliv" ? html`<${DelivBlock} v=${v} />` : tab === "act" ? html`<${Activity} filter=${e => e.video === v.id} />` : html`<${InfoBlock} p=${p} />`}
    </div>`;
}
function NextStep({ v, p }) {
  const r = myRole(), pd = pendingDeliv(v.id); const [link, setLink] = useState(""), [note, setNote] = useState("");
  const box = (title, body, k) => html`<div class=${"next " + (k || "")}><div class="next-h">${t("pNext")}</div><b>${title}</b>${body}</div>`;
  if (r === "admin") {
    if (pd) return box(`${t("draftIn")}: ${t("draft")} ${pd.round}`, html`<div class="tiny muted">${nm(pd.author)} · ${fdt(pd.created)}${pd.note ? " · “" + pd.note + "”" : ""}</div><div class="acts"><${ExtLink} href=${pd.link}>Krock<//><span class="grow"></span><button class="btn line sm" onClick=${() => A.holdDeliv(pd)}>${t("hold")}</button><button class="btn sm" onClick=${() => A.approveDeliv(pd)}>${t("approveSend")}</button></div>`, "y");
    if (v.pending) return box(`${t("stageReq")}: ${ST(v.pub)} → ${ST(v.pending.stage)}`, html`<div class="acts"><span class="grow"></span><button class="btn line sm" onClick=${() => A.holdStage(v)}>${t("hold")}</button><button class="btn sm" onClick=${() => A.approveStage(v)}>${t("approveStage")}</button></div>`, "y");
    return box(v.stage === 6 && v.rs === "awaiting" ? t("withClient") : v.rs === "notes" ? t("clientNotesIn") : ST(v.stage), html`<div class="acts"><select class="sm-sel" value=${v.stage} onChange=${e => A.setStage(v, +e.target.value)}>${[0, 1, 2, 3, 4, 5, 6, 7].map(i => html`<option value=${i}>${ST(i)}</option>`)}</select><span class="tiny muted">${t("setStage")}</span><span class="grow"></span>${v.stage < 7 && p.editor ? html`<button class="btn line sm" onClick=${() => A.ping(v)}>${t("askEditor")}</button>` : ""}</div>`);
  }
  if (r === "editor") {
    if (pd) return box(t("waitingCammio"), html`<div class="tiny muted">${t("draft")} ${pd.round} · ${fdt(pd.created)}</div><div class="acts"><${ExtLink} href=${pd.link}>Krock<//></div>`);
    if (v.stage === 6 && v.rs === "awaiting") return box(t("withClient"), html`<div class="tiny muted">${t("draft")} ${v.round}</div>`);
    if (v.stage === 7) return box(ST(7), "");
    const deliverForm = html`<div class="dform"><div class="row wrap"><a class="btn line sm" href=${UPLOAD_URL} target="_blank" rel="noopener">${t("step1")} ↗</a></div><label>${t("step2")}</label><input placeholder=${t("linkPh")} value=${link} onInput=${e => setLink(e.target.value)} dir="ltr" /><input placeholder=${t("noteOpt")} value=${note} onInput=${e => setNote(e.target.value)} /><button class="btn" onClick=${() => A.deliver(v, link, note)}>${t("sendToCammio")} · ${t("draft")} ${(v.round || 0) + 1}</button></div>`;
    if (v.rs === "notes") return box(t("clientNotesIn"), html`<div class="acts"><${ExtLink} href=${v.link}>Krock<//><span class="grow"></span><button class="btn sm" onClick=${() => A.gotNotes(v)}>${t("gotNotes")}</button></div>`, "y");
    return box(v.pending ? `${t("waitingCammio")}: ${ST(v.pending.stage)}` : v.rs === "revising" ? t("revising") : ST(v.stage), html`
      ${v.rs !== "revising" ? html`<div class="stagepick">${[1, 2, 3, 4, 5].map(i => html`<button disabled=${i <= v.stage} class=${i === v.stage + 1 ? "nextst" : ""} onClick=${() => A.moveStage(v, i)}>${ST(i)}</button>`)}</div>` : ""}
      <details open=${v.stage >= 4 || v.rs === "revising"}><summary>${t("deliverDraft")}</summary>${deliverForm}</details>`);
  }
  // client
  if (v.pub === 6 && v.rs === "awaiting") { const u = usedRounds(v); return box(`${t("draftReady")} · ${t("draft")} ${v.round}`, html`<div class="row tiny muted">${t("rounds")} ${[1, 2, 3].map(i => html`<i class=${"rd" + (i <= u ? " on" : "")}></i>`)} ${u}/3</div><div class="acts"><${ExtLink} href=${v.link}>${t("openDraft")}<//><span class="grow"></span><button class="btn line sm" disabled=${u >= 3} onClick=${() => A.reviewNotes(v)}>${t("notesDone")}</button><button class="btn y sm" onClick=${() => A.approveFinal(v)}>${t("approveFinal")}</button></div>${u >= 3 ? html`<div class="tiny muted">${t("noRounds")}</div>` : ""}`, "y"); }
  if (v.rs === "notes") return box(t("notesSentWait"), "");
  if (v.rs === "revising") return box(t("revising"), "");
  if (v.pub === 7) return box(ST(7), html`<div class="acts"><${ExtLink} href=${v.link}>${t("openDraft")}<//></div>`);
  return box(`${t("theEditor")}: ${ST(v.pub)}`, html`<div class="acts"><span class="grow"></span><button class="btn line sm" onClick=${() => A.ask(v)}>${t("askEd")}</button></div>`);
}
function NotesBlock({ v }) {
  const r = myRole(), ns = notesOf(v.id), canAdd = r !== "editor", canTick = r === "editor";
  const [f, setF] = useState({ tc: "", cue: "", visual: "", sfx: "" }), [paste, setPaste] = useState(""), [url, setUrl] = useState(""), [arm, setArm] = useState(false);
  const preview = pasteToNotes(paste);
  const readSheet = () => run(async () => { if (!/docs\.google\.com\/spreadsheets\/d\//.test(url)) throw new Error(t("badSheet")); const csv = await api.fetchSheet(url, { notPublic: t("notPublic"), bad: t("badSheet"), err: t("err") }); const rows = rowsToNotes(parseCSV(csv)); if (!rows.length) throw new Error(t("noRows")); setPaste(rows.map(x => [x.tc, x.cue, x.visual, x.sfx].map(c => String(c || "").replace(/[\t\n]/g, " ")).join("\t")).join("\n")); });
  return html`<div>
    ${ns.length ? html`<div class="notes">${ns.map(n => html`<label class=${"note" + (n.done ? " done" : "")}><input type="checkbox" checked=${n.done} disabled=${!canTick} onChange=${e => A.tick(n, e.target.checked)} /><span class="tc">${n.tc || "—"}</span><span class="grow"><b>${n.cue}</b>${n.visual ? " — " + n.visual : ""}${n.sfx ? html`<small>${n.sfx}</small>` : ""}</span>${(r === "admin" || n.author === db.me) ? html`<button class="x" onClick=${e => { e.preventDefault(); run(() => api.delNote(n.id)); }}>✕</button>` : ""}</label>`)}</div>` : html`<${Empty} />`}
    ${canAdd ? html`<details class="addnotes" open=${!ns.length}><summary>+ ${t("addNote")}</summary>
      <form class="nform" onSubmit=${e => { e.preventDefault(); if (!f.cue && !f.visual) return; A.addNotes(v.id, [f]); setF({ tc: "", cue: "", visual: "", sfx: "" }); }}>
        <div class="two"><input placeholder=${t("tc") + " 01:23"} value=${f.tc} onInput=${e => setF({ ...f, tc: e.target.value })} dir="ltr" /><input placeholder=${t("cue")} value=${f.cue} onInput=${e => setF({ ...f, cue: e.target.value })} /></div>
        <input placeholder=${t("visual")} value=${f.visual} onInput=${e => setF({ ...f, visual: e.target.value })} /><input placeholder=${t("sfx")} value=${f.sfx} onInput=${e => setF({ ...f, sfx: e.target.value })} />
        <button class="btn line sm" type="submit">${t("add")}</button></form>
      <label>${t("fromSheet")}</label><div class="row"><input placeholder="https://docs.google.com/spreadsheets/d/…" value=${url} onInput=${e => setUrl(e.target.value)} dir="ltr" /><button class=${"btn sm" + (ui.busy ? " busy" : "")} onClick=${readSheet}>${t("readSheet")}</button></div>
      <label>${t("pasteRows")}</label><textarea value=${paste} onInput=${e => setPaste(e.target.value)} placeholder="00:12	الحُكم	مطرقة خشب	صوت مطرقة"></textarea>
      ${preview.length ? html`<div class="row"><${Chip} k="y">${preview.length} ${t("found")}<//><span class="tiny muted grow">${preview.slice(0, 2).map(x => (x.tc || "—") + " · " + x.cue).join(" | ")}</span><button class="btn sm" onClick=${() => { A.addNotes(v.id, preview); setPaste(""); }}>${t("addThem")}</button></div>` : ""}
      ${r === "admin" && ns.length ? html`<button class="btn line sm danger" onClick=${() => { if (!arm) { setArm(true); setTimeout(() => setArm(false), 4000); return; } setArm(false); run(() => api.clearNotes(v.id)); }}>${arm ? t("delSure") : t("clearNotes")}</button>` : ""}
    </details>` : ""}
  </div>`;
}
function DelivBlock({ v }) {
  const ds = delivOf(v.id), r = myRole();
  const lbl = d => d.status === "pending" ? (r === "admin" ? t("dPending") : t("dPendingEd")) : d.status === "approved" ? t("dApproved") : d.status === "held" ? t("dHeld") : t("dSuper");
  return ds.length ? html`<div class="list">${ds.map(d => html`<div class="row-item static"><div class="ri-main"><div class="ri-t">${t("draft")} ${d.round}${r !== "client" ? html` <${Chip} k=${d.status === "pending" ? "y" : d.status === "approved" ? "k" : ""}>${lbl(d)}<//>` : ""}</div><div class="ri-s">${r !== "client" ? nm(d.author) + " · " : ""}${fdt(d.created)}${d.note ? " · “" + d.note + "”" : ""}</div></div><div class="ri-meta"><${ExtLink} href=${d.link}>Krock<//>${r === "admin" && d.status === "pending" ? html`<button class="btn sm" onClick=${() => A.approveDeliv(d)}>${t("approveSend")}</button>` : ""}</div></div>`)}</div>` : html`<${Empty} />`;
}
function Activity({ filter }) { const es = db.events.filter(filter); return es.length ? html`<div class="timeline">${es.map(e => html`<div class="tl"><span class="dot"></span><div class="grow">${evText(e)}<small>${fdt(e.time)}</small></div></div>`)}</div>` : html`<${Empty} />`; }
function InfoBlock({ p }) {
  return html`<dl class="kv">${p.drive ? html`<dt>${t("material")}</dt><dd><${ExtLink} href=${cleanUrl(p.drive)}>Drive<//></dd>` : ""}${p.ref ? html`<dt>${t("reference")}</dt><dd><${ExtLink} href=${cleanUrl(p.ref)} /></dd>` : ""}${p.notes ? html`<dt>${t("details")}</dt><dd class="pre">${linkify(p.notes)}</dd>` : ""}<dt>${t("type")}</dt><dd>${t(p.type)} · ${p.count} · ${t(p.cad)}</dd></dl>`;
}
function linkify(s) { return String(s).split(/(https?:\/\/[^\s]+)/g).map(x => (/^https?:\/\//.test(x) ? html`<a class="ext" href=${x} target="_blank" rel="noopener">${x.length > 42 ? x.slice(0, 40) + "…" : x}</a>` : x)); }

function TaskPanel({ id }) {
  const x = TK(id); if (!x) return html`<${PanelHead} title="—" />`;
  const r = myRole(), [link, setLink] = useState(""), [fin, setFin] = useState(false);
  useEffect(() => { if (r === "editor" && x.isNew) api.updTask(x.id, { isNew: false }).catch(() => {}); }, [id]);
  const n = Math.max(1, x.stages.length);
  return html`<${PanelHead} title=${x.title} sub=${t("task") + (r === "admin" ? " · " + nm(x.editor) : "")} chips=${html`<${Chip} k=${tDone(x) ? "k" : ""}>${tDone(x) ? t("done") : x.stages[x.stage] || t("task")}<//><${Chip}>${t("due")} ${fd(x.due)}<//>${isLateT(x) ? html`<${Chip} k="r">${t("late")}<//>` : ""}`} />
    <div class="pb">
      <div class="steps">${Array.from({ length: n }, (_, i) => html`<span class=${i < x.stage ? "on" : i === x.stage ? "cur" : ""}></span>`)}</div>
      ${x.stages.length ? html`<div class="stagepick">${x.stages.map((s, i) => html`<button disabled=${r !== "editor" || i < x.stage} class=${i === x.stage ? "nextst" : i < x.stage ? "passed" : ""} onClick=${() => A.taskStage(x, i + 1)}>${s}</button>`)}</div>` : ""}
      ${r === "editor" && !tDone(x) ? html`<div class="next"><div class="next-h">${t("deliver")}</div><div class="dform"><a class="btn line sm" href=${UPLOAD_URL} target="_blank" rel="noopener">${t("step1")} ↗</a><input placeholder=${t("linkPh")} value=${link} onInput=${e => setLink(e.target.value)} dir="ltr" /><label class="row chk"><input type="checkbox" checked=${fin} onChange=${e => setFin(e.target.checked)} /> ${t("finishedTask")}</label><button class="btn" onClick=${() => A.taskDeliver(x, link, fin)}>${t("sendToCammio")}</button></div></div>` : ""}
      ${r === "admin" ? html`<div class="acts"><button class="btn line sm" onClick=${() => set({ sheet: { type: "task", id: x.id } })}>${t("edit")}</button><button class="btn line sm" onClick=${() => A.pingTask(x)}>${t("askEditor")}</button></div>` : ""}
      <dl class="kv">${x.resLink ? html`<dt>${t("delivery")}</dt><dd><${ExtLink} href=${x.resLink} /></dd>` : ""}${x.link ? html`<dt>${t("material")}</dt><dd><${ExtLink} href=${cleanUrl(x.link)} /></dd>` : ""}${x.notes ? html`<dt>${t("details")}</dt><dd class="pre">${linkify(x.notes)}</dd>` : ""}</dl>
      <h4 class="sub-h">${t("pActivity")}</h4><${Activity} filter=${e => e.task === x.id} />
    </div>`;
}
function ProjectPanel({ id }) {
  const p = P(id); if (!p) return html`<${PanelHead} title="—" />`;
  const [title, setTitle] = useState(p.title), [ed, setEd] = useState(p.editor || editors()[0] || "");
  const pending = p.status === "pending";
  return html`<${PanelHead} title=${p.title} sub=${nm(p.client)} chips=${html`<${Chip} k=${pending ? "y" : ""}>${pending ? t("newRequests") : t("projSettings")}<//>`} />
    <div class="pb">
      <${InfoBlock} p=${p} />
      ${pending ? html`<div class="next y"><div class="next-h">${t("pNext")}</div><label>${t("assignTo")}</label><div class="row"><select value=${ed} onChange=${e => setEd(e.target.value)}>${editors().map(e => html`<option value=${e}>${nm(e)}</option>`)}</select><button class="btn" disabled=${!ed} onClick=${() => A.assign(p, ed)}>${t("assign")}</button></div></div>` : html`
        <label>${t("title")}</label><div class="row"><input value=${title} onInput=${e => setTitle(e.target.value)} /><button class="btn sm" onClick=${() => run(async () => { await api.updProject(p.id, { title: title.trim() || p.title }); toast(t("saved")); })}>${t("save")}</button></div>
        <label>${t("changeEditor")}</label><div class="row"><select value=${p.editor || ""} onChange=${e => run(async () => { await api.updProject(p.id, { editor: e.target.value }); await api.log("assigned", { project: p.id }); toast(t("saved")); })}>${editors().map(e => html`<option value=${e}>${nm(e)}</option>`)}</select></div>`}
      <label>${t("members")}</label>
      <div class="members">${clientsList().map(c => { const own = c === p.client, on = own || db.members.some(m => m.project === p.id && m.client === c); return html`<button class=${"mem" + (on ? " on" : "")} disabled=${own} onClick=${() => run(async () => { if (on) await api.removeMember(p.id, c); else { await api.addMember(p.id, c); await api.log("member_added", { project: p.id, params: { user: c } }); } })}><${Av} id=${c} /> ${nm(c)} <span class="grow"></span><${Chip} k=${on ? "k" : ""}>${own ? t("owner") : on ? "✓" : "+"}<//></button>`; })}</div>
      <h4 class="sub-h">${t("pActivity")}</h4><${Activity} filter=${e => e.project === p.id && !e.video} />
    </div>`;
}

/* ================= SHEETS ================= */
function Sheet() {
  const s = ui.sheet; const C = { notifs: NotifSheet, request: RequestSheet, project: ProjectSheet, task: TaskSheet, user: UserSheet, account: AccountSheet, deliver: DeliverSheet, checkin: CheckinSheet }[s.type];
  return html`<aside class="sheet rise-s">${C ? html`<${C} ...${s} />` : ""}</aside>`;
}
const SheetHead = ({ title }) => html`<header class="ph"><b class="grow">${title}</b><button class="ico" onClick=${() => set({ sheet: null })}>${ico.x}</button></header>`;
function NotifSheet() {
  return html`<${SheetHead} title=${t("notifs")} /><div class="sb">${db.notifs.length ? db.notifs.map(n => html`<button class=${"nt" + (n.read ? "" : " unread")} onClick=${() => openRef(n.ref)}><span class="dot"></span><span class="grow">${notifText(n)}<small>${ago(n.time)}</small></span>${n.ref ? html`<span class="muted">${ui.lang === "ar" ? "‹" : "›"}</span>` : ""}</button>`) : html`<${Empty} />`}</div>`;
}
function ProjForm({ admin, client: c0, onDone }) {
  const today = new Date(); today.setDate(today.getDate() + 2); const dstr = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const [f, setF] = useState({ title: "", type: "tReels", drive: "", ref: "", notes: "", count: 1, cad: "cDaily", first: dstr(today), client: c0 || clientsList()[0] || "", editor: editors()[0] || "" });
  const S = k => e => setF({ ...f, [k]: e.target.value });
  const opt = (k, vals) => html`<div class="opt">${vals.map(x => html`<button type="button" class=${f[k] === x ? "on" : ""} onClick=${() => setF({ ...f, [k]: x })}>${t(x)}</button>`)}</div>`;
  const submit = e => { e.preventDefault(); if (!f.title.trim() || !cleanUrl(f.drive)) return toast(t("need")); run(async () => { const first = new Date(f.first + "T20:00:00").getTime(); const id = await api.createProject({ ...f, title: f.title.trim(), drive: cleanUrl(f.drive), ref: cleanUrl(f.ref), count: Math.max(1, Math.min(60, +f.count || 1)), first }, admin); await api.log(admin ? "project_new" : "request_new", { project: id }); set({ sheet: null }); toast(t("sent")); onDone && onDone(id); }); };
  return html`<form class="sb form" onSubmit=${submit}>
    ${admin ? html`<div class="two"><label>${t("forClient")}<select value=${f.client} onChange=${S("client")}>${clientsList().map(c => html`<option value=${c}>${nm(c)}</option>`)}</select></label><label>${t("withEditor")}<select value=${f.editor} onChange=${S("editor")}>${editors().map(e => html`<option value=${e}>${nm(e)}</option>`)}</select></label></div>` : ""}
    <label>${t("title")}<input value=${f.title} onInput=${S("title")} /></label>
    <label>${t("type")}${opt("type", ["tReels", "tLong", "tMotion"])}</label>
    <label>${t("drive")}<input value=${f.drive} onInput=${S("drive")} dir="ltr" placeholder="https://drive.google.com/…" /></label>
    <label>${t("refOpt")}<input value=${f.ref} onInput=${S("ref")} dir="ltr" /></label>
    <label>${t("notesFor")}<textarea value=${f.notes} onInput=${S("notes")}></textarea></label>
    <div class="two"><label>${t("count")}<input type="number" min="1" max="60" value=${f.count} onInput=${S("count")} /></label><label>${t("firstDue")}<input type="date" value=${f.first} onInput=${S("first")} /></label></div>
    <label>${t("cadence")}${opt("cad", ["cOnce", "cDaily", "c2", "cWeek"])}</label>
    <button class=${"btn" + (ui.busy ? " busy" : "")} type="submit">${t("send")}</button></form>`;
}
const RequestSheet = () => html`<${SheetHead} title=${t("newRequest")} /><${ProjForm} />`;
const ProjectSheet = ({ client }) => html`<${SheetHead} title=${t("newProject")} /><${ProjForm} admin=${true} client=${client} />`;
function TaskSheet({ id, editor }) {
  const x = id ? TK(id) : null; const dstr = ms => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const [f, setF] = useState(x ? { editor: x.editor, title: x.title, notes: x.notes, link: x.link, due: dstr(x.due), stages: [...x.stages] } : { editor: editor || editors()[0] || "", title: "", notes: "", link: "", due: dstr(Date.now()), stages: [] });
  const [st, setSt] = useState(""), [arm, setArm] = useState(false);
  const addSt = () => { if (st.trim()) { setF({ ...f, stages: [...f.stages, st.trim()] }); setSt(""); } };
  const submit = e => { e.preventDefault(); if (!f.editor || !f.title.trim()) return toast(t("needTask")); const stages = st.trim() ? [...f.stages, st.trim()] : f.stages; run(async () => { const due = new Date(f.due + "T20:00:00").getTime(); const data = { editor: f.editor, title: f.title.trim(), notes: f.notes, link: cleanUrl(f.link), due, stages }; if (x) { await api.updTask(x.id, { ...data, ...(x.stage > stages.length ? { stage: stages.length } : {}) }); } else { const nid = await api.createTask(data); await api.log("task_new", { task: nid }); } set({ sheet: null }); toast(t("saved")); }); };
  return html`<${SheetHead} title=${x ? t("edit") : t("newTask")} /><form class="sb form" onSubmit=${submit}>
    <label>${t("taskFor")}<div class="opt">${editors().map(e => html`<button type="button" class=${f.editor === e ? "on" : ""} onClick=${() => setF({ ...f, editor: e })}>${nm(e)}</button>`)}</div></label>
    <label>${t("task")}<input value=${f.title} onInput=${e => setF({ ...f, title: e.target.value })} /></label>
    <label>${t("detailsOpt")}<textarea value=${f.notes} onInput=${e => setF({ ...f, notes: e.target.value })}></textarea></label>
    <div class="two"><label>${t("linkOpt")}<input value=${f.link} onInput=${e => setF({ ...f, link: e.target.value })} dir="ltr" /></label><label>${t("due")}<input type="date" value=${f.due} onInput=${e => setF({ ...f, due: e.target.value })} /></label></div>
    <label>${t("stages")}</label><div class="opt">${f.stages.map((s, i) => html`<button type="button" class="on" onClick=${() => setF({ ...f, stages: f.stages.filter((_, j) => j !== i) })}>${i + 1}. ${s} ✕</button>`)}${!f.stages.length ? html`<span class="tiny muted">${t("noStages")}</span>` : ""}</div>
    <div class="row"><input placeholder=${t("stagePh")} value=${st} onInput=${e => setSt(e.target.value)} onKeyDown=${e => { if (e.key === "Enter") { e.preventDefault(); addSt(); } }} /><button type="button" class="btn line sm" onClick=${addSt}>${t("add")}</button></div>
    <button class="btn" type="submit">${x ? t("save") : t("send")}</button>
    ${x ? html`<button type="button" class="btn line danger" onClick=${() => { if (!arm) { setArm(true); setTimeout(() => setArm(false), 4000); return; } run(async () => { await api.delTask(x.id); set({ sheet: null, panel: null }); }); }}>${arm ? t("delSure") : t("del")}</button>` : ""}
  </form>`;
}
function UserSheet({ id }) {
  const p = db.profiles[id]; if (!p) return html`<${SheetHead} title="—" />`;
  const [f, setF] = useState({ name: p.name || "", username: p.username, role: p.role, password: "", pkg: p.package_size || "" }), [show, setShow] = useState(false), [arm, setArm] = useState(false);
  const pw = db.creds[id];
  const submit = e => { e.preventDefault(); if (f.password && f.password.length < 6) return toast(t("passShort")); const u = f.username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, ""); run(async () => { await api.updateUser(id, { name: f.name !== p.name ? f.name.trim() : null, username: u && u !== p.username ? u : null, role: f.role !== p.role ? f.role : null, password: f.password || null }, t("accErr")); if (p.role === "client" && String(f.pkg) !== String(p.package_size || "")) await api.setProfileOf(id, { package_size: f.pkg === "" ? null : Math.max(0, +f.pkg) }); toast(t("saved")); setF({ ...f, password: "" }); }); };
  const copy = () => { const txt = `${location.href.split("#")[0]}\n${t("user")}: ${p.username}${pw ? `\n${t("pass")}: ${pw}` : ""}`; try { navigator.clipboard.writeText(txt).then(() => toast(t("copied")), () => toast(txt)); } catch (_) { toast(txt); } };
  return html`<${SheetHead} title=${t("edit")} /><form class="sb form" onSubmit=${submit}>
    <div class="row"><${Av} id=${id} lg /><div><b>${p.name}</b><div class="tiny muted">@${p.username}</div></div></div>
    <label>${t("name")}<input value=${f.name} onInput=${e => setF({ ...f, name: e.target.value })} /></label>
    <label>${t("user")}<input value=${f.username} onInput=${e => setF({ ...f, username: e.target.value })} autocapitalize="off" /></label>
    ${p.role !== "admin" ? html`<label>${t("role")}<div class="opt">${["client", "editor"].map(rr => html`<button type="button" class=${f.role === rr ? "on" : ""} onClick=${() => setF({ ...f, role: rr })}>${t(rr)}</button>`)}</div></label>` : ""}
    ${f.role === "client" ? html`<label>${t("pkgSize")}<input type="number" min="0" value=${f.pkg} onInput=${e => setF({ ...f, pkg: e.target.value })} /></label>` : ""}
    <div class="box"><label>${t("curPass")}</label>${pw ? html`<div class="row"><code class="grow">${show ? pw : "••••••••"}</code><button type="button" class="btn line sm" onClick=${() => setShow(!show)}>${show ? t("hide") : t("show")}</button><button type="button" class="btn line sm" onClick=${copy}>${t("copyLogin")}</button></div>` : html`<div class="tiny muted">${t("passUnknown")}</div>`}</div>
    <label>${t("newPassOpt")}<input value=${f.password} onInput=${e => setF({ ...f, password: e.target.value })} placeholder=${t("passShort")} autocomplete="off" /></label>
    <button class="btn" type="submit">${t("save")}</button>
    ${p.role !== "admin" ? html`<button type="button" class="btn line danger" onClick=${() => { if (!arm) { setArm(true); setTimeout(() => setArm(false), 4000); return; } run(async () => { await api.deleteUser(id); set({ sheet: null }); go(p.role === "client" ? "clients" : "team"); }); }}>${arm ? t("delSure") : t("delAccount")}</button>` : ""}
  </form>`;
}
function AccountSheet() {
  const p = me(); const [f, setF] = useState({ name: p.name || "", title: p.title || "" }), [np, setNp] = useState("");
  return html`<${SheetHead} title=${t("myAccount")} /><div class="sb form">
    <div class="row"><${Av} id=${db.me} lg /><label class="link">${t("photo")}<input type="file" accept="image/*" hidden onChange=${e => { const file = e.target.files[0]; if (!file) return; if (file.size > 3e6) return toast("≤ 3MB"); run(async () => { const url = await api.uploadAvatar(file); await api.updProfile({ avatar_url: url }); toast(t("saved")); }); }} /></label></div>
    <label>${t("name")}<input value=${f.name} onInput=${e => setF({ ...f, name: e.target.value })} /></label>
    <label>${t("titleL")}<input value=${f.title} onInput=${e => setF({ ...f, title: e.target.value })} /></label>
    <label>${t("lang")}<div class="opt"><button type="button" class=${ui.lang === "ar" ? "on" : ""} onClick=${() => setLang("ar")}>العربية</button><button type="button" class=${ui.lang === "en" ? "on" : ""} onClick=${() => setLang("en")}>English</button></div></label>
    <button class="btn" onClick=${() => run(async () => { await api.updProfile({ name: f.name.trim() || p.name, title: f.title.trim() }); toast(t("saved")); })}>${t("save")}</button>
    <hr /><label>${t("newPass")}<input type="password" value=${np} onInput=${e => setNp(e.target.value)} placeholder=${t("passShort")} autocomplete="new-password" /></label>
    <button class="btn line" onClick=${() => { if (np.length < 6) return toast(t("passShort")); run(async () => { await api.changePassword(np); setNp(""); toast(t("saved")); }); }}>${t("changePass")}</button>
    <button class="btn line" onClick=${() => run(async () => { await api.logout(); set({ route: null, sheet: null, panel: null }); })}>${t("signOut")}</button>
  </div>`;
}
function DeliverSheet() {
  const list = [...db.videos.filter(v => { const p = P(v.project); return p && p.editor === db.me && p.status === "active" && v.stage < 7 && !pendingDeliv(v.id) && !(v.stage === 6 && v.rs === "awaiting"); }).sort((a, b) => a.due - b.due), ...db.tasks.filter(x => x.editor === db.me && !tDone(x))];
  const [sel, setSel] = useState(list[0] ? list[0].id : ""), [link, setLink] = useState(""), [note, setNote] = useState(""), [fin, setFin] = useState(false);
  const cur = list.find(x => x.id === sel);
  const label = x => (x.kind === "task" ? `${t("task")}: ${x.title}` : `${vfull(x)} · ${nm(P(x.project).client)}${notesOf(x.id).length ? ` (${t("pNotes")} ${notesOf(x.id).filter(n => n.done).length}/${notesOf(x.id).length})` : ""}`);
  return html`<${SheetHead} title=${t("deliver")} /><div class="sb form">${list.length ? html`
    <label>${t("whichItem")}<select value=${sel} onChange=${e => setSel(e.target.value)}>${list.map(x => html`<option value=${x.id}>${label(x)}</option>`)}</select></label>
    <a class="btn line" href=${UPLOAD_URL} target="_blank" rel="noopener">${t("step1")} ↗</a>
    <label>${t("step2")}<input value=${link} onInput=${e => setLink(e.target.value)} placeholder=${t("linkPh")} dir="ltr" /></label>
    ${cur && cur.kind !== "task" ? html`<label>${t("noteOpt")}<input value=${note} onInput=${e => setNote(e.target.value)} /></label>` : html`<label class="row chk"><input type="checkbox" checked=${fin} onChange=${e => setFin(e.target.checked)} /> ${t("finishedTask")}</label>`}
    <button class=${"btn" + (ui.busy ? " busy" : "")} onClick=${() => (cur.kind === "task" ? A.taskDeliver(cur, link, fin) : A.deliver(cur, link, note))}>${t("sendToCammio")}</button>` : html`<${Empty} text=${t("nothingToDeliver")} />`}</div>`;
}
function CheckinSheet() {
  const vs = db.videos.filter(v => { const p = P(v.project); return p && p.editor === db.me && p.status === "active" && v.stage < 6 && !v.pending; });
  const [vals, setVals] = useState(Object.fromEntries(vs.map(v => [v.id, v.stage])));
  return html`<${SheetHead} title=${t("checkin")} /><div class="sb form"><p class="tiny muted">${t("checkinSub")}</p>
    ${vs.map(v => html`<label>${vfull(v)}<select value=${vals[v.id]} onChange=${e => setVals({ ...vals, [v.id]: +e.target.value })}>${[0, 1, 2, 3, 4, 5].map(i => html`<option value=${i} disabled=${i < v.stage}>${ST(i)}</option>`)}</select></label>`)}
    ${!vs.length ? html`<${Empty} />` : ""}
    <button class="btn" onClick=${() => A.checkin(vs.filter(v => vals[v.id] !== v.stage).map(v => [v, vals[v.id]]))}>${t("sendUpdate")}</button></div>`;
}

/* ================= TOUR ================= */
function startTour() { const steps = (TOURS[myRole()] || []).filter(([k]) => document.querySelector(`[data-tour="${k}"]`)); if (steps.length) set({ tour: { steps, i: 0 } }); }
function Tour() {
  const tr = ui.tour; if (!tr) return null; const [k, txt] = tr.steps[tr.i]; const el = document.querySelector(`[data-tour="${k}"]`); if (!el) return null;
  const r = el.getBoundingClientRect(), pad = 6, last = tr.i === tr.steps.length - 1, tw = Math.min(300, innerWidth - 32);
  let top = r.bottom + 14; if (top + 170 > innerHeight) top = Math.max(10, r.top - 170); const left = Math.max(12, Math.min(innerWidth - tw - 12, r.left + r.width / 2 - tw / 2));
  return html`<div class="tour-block"></div><div class="tour-ring" style=${{ top: r.top - pad + "px", left: r.left - pad + "px", width: r.width + pad * 2 + "px", height: r.height + pad * 2 + "px" }}></div>
    <div class="tour-tip" style=${{ top: top + "px", left: left + "px", width: tw + "px" }}><div class="tiny muted">${tr.i + 1} / ${tr.steps.length}</div><p>${txt[ui.lang]}</p><div class="row"><button class="tiny muted grow" style="text-align:start" onClick=${() => set({ tour: null })}>${last ? "" : t("skip")}</button><button class=${"btn sm" + (last ? " y" : "")} onClick=${() => set({ tour: last ? null : { ...tr, i: tr.i + 1 } })}>${last ? t("gotIt") : t("next")}</button></div></div>`;
}

/* ================= ROOT ================= */
function Safe({ children }) {
  const [err, reset] = useErrorBoundary(e => console.error(e));
  if (err) return html`<div class="login"><div class="lbox"><b>${ui.lang === "ar" ? "حصلت مشكلة في العرض" : "Something went wrong"}</b><code style="white-space:pre-wrap;font-size:11px">${String(err && err.message || err)}</code><button class="btn" onClick=${() => { set({ panel: null, sheet: null, route: null, tour: null }); reset(); }}>${ui.lang === "ar" ? "رجوع" : "Back"}</button><button class="btn line" onClick=${() => location.reload()}>${ui.lang === "ar" ? "تحديث الصفحة" : "Reload"}</button></div></div>`;
  return children;
}
function Root() {
  const [, force] = useState(0);
  rerender = () => force(x => x + 1);
  useEffect(() => { const off = onChange(() => force(x => x + 1)); rerender(); return off; }, []);
  useEffect(() => { document.documentElement.lang = ui.lang; document.documentElement.dir = ui.lang === "ar" ? "rtl" : "ltr"; });
  if (!ui.ready) return html`<div class="loading"><span class="sig-s">Cammio Studio</span></div>`;
  return html`<${Safe}>${db.me ? html`<${Shell} />` : html`<${Login} />`}<//><div class="toasts">${ui.toasts.map(x => html`<div class="toast"><span class="dot"></span>${x.msg}</div>`)}</div><${Tour} /><div class="sig" aria-hidden="true"><small>by</small><svg width="168" height="40" viewBox="0 0 168 40"><text x="2" y="32" textLength="160" lengthAdjust="spacingAndGlyphs">Cammio Studio</text></svg></div>`;
}

/* notifications: toast + system notification when something new arrives */
let lastSeen = 0;
window.addEventListener("hub:notif", () => { const n = db.notifs.find(x => !x.read && x.time > lastSeen); if (!n) return; lastSeen = n.time; const txt = notifText(n); toast(txt); try { if (document.hidden && Notification.permission === "granted") new Notification("Cammio Studio", { body: txt }); } catch (_) {} });
/* editor 3-hour check-in reminder while open */
setInterval(() => { if (db.me && myRole() === "editor" && nextCheck() === 0 && !ui.sheet) { set({ sheet: { type: "checkin" } }); try { if (document.hidden && Notification.permission === "granted") new Notification("Cammio Studio", { body: t("checkin") }); } catch (_) {} } }, 60000);
addEventListener("resize", () => ui.tour && rerender());

render(html`<${Root} />`, document.getElementById("root"));
(async () => { const g = setTimeout(() => set({ ready: true }), 6000); try { await api.init(); } catch (e) { console.error(e); } clearTimeout(g); if (db.me) { lastSeen = Date.now(); set({ ready: true }); afterLogin(); } else set({ ready: true }); })();
window.__hub = { db, ui, set, A, api };
