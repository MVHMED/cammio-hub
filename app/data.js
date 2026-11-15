// Cammio Studio Hub — data layer (Supabase live + in-memory demo)
const CFG = window.HUB_CONFIG || {};
export const LIVE = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);
export const UPLOAD_URL = CFG.UPLOAD_URL || "https://platform.krock.io/dashboard/projects";
const H = 36e5, D = 24 * H;

export const db = {
  me: null, profiles: {}, projects: [], members: [], videos: [], deliveries: [], notes: [], tasks: [],
  events: [], notifs: [], rates: {}, settings: { late_allowance: "3", late_penalty: "0", early_hours: "24", currency: "EGP" },
  accounts: {}, creds: {},
};
const subs = new Set();
export const onChange = fn => (subs.add(fn), () => subs.delete(fn));
export const emit = () => subs.forEach(f => f());

// ---------- mapping ----------
const ts = x => (x ? Date.parse(x) : null);
const mapV = r => ({ id: r.id, project: r.project, n: r.n, due: ts(r.due), stage: r.stage, pub: r.pub, round: r.round, rs: r.rs, link: r.link || "",
  pending: r.pending, isNew: !!r.is_new, upd: ts(r.updated_at), deliveredAt: ts(r.delivered_at), deliveredBy: r.delivered_by, price: r.price == null ? null : +r.price });
const mapP = r => ({ id: r.id, client: r.client, title: r.title, type: r.type, drive: r.drive || "", ref: r.ref || "", notes: r.notes || "", count: r.count,
  cad: r.cad, first: ts(r.first), status: r.status, editor: r.editor, created: ts(r.created_at) });
const mapD = r => ({ id: r.id, video: r.video, round: r.round, link: r.link, note: r.note || "", author: r.author, status: r.status, created: ts(r.created_at), decided: ts(r.decided_at) });
const mapN = r => ({ id: r.id, video: r.video, tc: r.tc || "", cue: r.cue || "", visual: r.visual || "", sfx: r.sfx || "", done: !!r.done, sort: r.sort || 0, author: r.author });
const mapT = r => ({ id: r.id, kind: "task", editor: r.editor, title: r.title, notes: r.notes || "", link: r.link || "", due: ts(r.due), stages: r.stages || [],
  stage: r.stage, isNew: !!r.is_new, upd: ts(r.updated_at), resLink: r.result_link || "" });
const mapE = r => ({ id: r.id, kind: r.kind, project: r.project, video: r.video, task: r.task, actor: r.actor, actorRole: r.actor_role, params: r.params || {}, vis: r.visibility, time: ts(r.created_at) });
const mapNo = r => ({ id: r.id, eventId: r.event_id, ref: r.ref, read: r.read, time: ts(r.created_at), ar: r.ar || "", en: r.en || "" });

const email = u => `${u}@${CFG.EMAIL_DOMAIN || "users.cammio.app"}`;
const errText = (e, fb) => new Error((e && e.message && /[؀-ۿ]/.test(e.message)) ? e.message : fb);

// ======================= LIVE =======================
let sb = null, chan = null, reloadT = null;
const live = {
  async init() {
    sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, lock: async (_n, _t, fn) => await fn() } });
    const { data } = await Promise.race([sb.auth.getSession(), new Promise(r => setTimeout(() => r({ data: {} }), 6000))]);
    if (data && data.session) {
      const p = await this.myProfile(data.session.user.id);
      if (p && p.role !== "pending") { db.me = p.id; await this.loadAll(); this.subscribe(); }
    }
  },
  async myProfile(id) { const { data } = await sb.from("profiles").select("*").eq("id", id).single(); if (data) db.profiles[data.id] = data; return data; },
  async login(u, pw, side, msg) {
    const { data, error } = await sb.auth.signInWithPassword({ email: email(u), password: pw });
    if (error) throw new Error(msg.bad);
    const p = await this.myProfile(data.user.id);
    if (!p || p.role === "pending") { await sb.auth.signOut(); throw new Error(msg.noRole); }
    if ((side === "client") !== (p.role === "client")) { await sb.auth.signOut(); throw new Error(msg.side); }
    db.me = p.id; await this.loadAll(); this.subscribe();
  },
  async logout() { if (chan) { sb.removeChannel(chan); chan = null; } await sb.auth.signOut(); reset(); },
  async loadAll() {
    const me = db.me, admin = db.profiles[me] && db.profiles[me].role === "admin";
    const q = (t, f) => (f ? f(sb.from(t).select("*")) : sb.from(t).select("*"));
    const [pr, pj, mb, vd, dl, nt, tk, ev, no, rt, st, ac, cr] = await Promise.all([
      q("profiles"), q("projects"), q("project_members"), q("videos"), q("deliveries"), q("video_notes"), q("tasks"),
      q("events", x => x.order("created_at", { ascending: false }).limit(400)),
      q("notifs", x => x.eq("user_id", me).order("created_at", { ascending: false }).limit(80)),
      q("editor_rates"), q("settings"),
      admin ? q("client_accounts") : Promise.resolve({ data: [] }),
      admin ? q("admin_creds") : Promise.resolve({ data: [] }),
    ]);
    db.profiles = {}; (pr.data || []).forEach(p => (db.profiles[p.id] = p));
    db.projects = (pj.data || []).map(mapP); db.members = mb.data || []; db.videos = (vd.data || []).map(mapV);
    db.deliveries = (dl.data || []).map(mapD); db.notes = (nt.data || []).map(mapN); db.tasks = (tk.data || []).map(mapT);
    db.events = (ev.data || []).map(mapE); db.notifs = (no.data || []).map(mapNo);
    db.rates = {}; (rt.data || []).forEach(r => ((db.rates[r.editor] = db.rates[r.editor] || {})[r.type] = +r.price));
    (st.data || []).forEach(r => (db.settings[r.key] = r.value));
    db.accounts = {}; (ac.data || []).forEach(r => (db.accounts[r.client] = { price: r.price == null ? null : +r.price, paid: r.paid == null ? null : +r.paid }));
    db.creds = {}; (cr.data || []).forEach(r => (db.creds[r.user_id] = r.password));
    emit();
  },
  subscribe() {
    if (chan) sb.removeChannel(chan);
    const kick = () => { clearTimeout(reloadT); reloadT = setTimeout(() => this.loadAll(), 300); };
    chan = sb.channel("hub2");
    ["projects", "project_members", "videos", "deliveries", "video_notes", "tasks", "events", "profiles", "editor_rates", "settings", "client_accounts"]
      .forEach(t => chan.on("postgres_changes", { event: "*", schema: "public", table: t }, kick));
    chan.on("postgres_changes", { event: "INSERT", schema: "public", table: "notifs", filter: `user_id=eq.${db.me}` }, () => { kick(); setTimeout(() => window.dispatchEvent(new Event("hub:notif")), 900); });
    chan.subscribe();
  },
  async log(kind, o = {}) { const { error } = await sb.rpc("log_event", { p_kind: kind, p_project: o.project || null, p_video: o.video || null, p_task: o.task || null, p_params: o.params || {} }); if (error) console.warn("log_event", kind, error.message); },
  async createProject(f, asAdmin) {
    const row = { client: f.client || db.me, title: f.title, type: f.type, drive: f.drive, ref: f.ref || "", notes: f.notes || "", count: f.count, cad: f.cad, first: new Date(f.first).toISOString() };
    const { data, error } = await sb.from("projects").insert(row).select("id").single(); if (error) throw error;
    if (asAdmin && f.editor) { const r = await sb.from("projects").update({ status: "active", editor: f.editor }).eq("id", data.id); if (r.error) throw r.error; await sb.from("videos").update({ is_new: true }).eq("project", data.id); }
    await this.loadAll(); return data.id;
  },
  async updProject(id, patch) { const { error } = await sb.from("projects").update(patch).eq("id", id); if (error) throw error; await this.loadAll(); },
  async updVideo(id, patch) {
    const o = {}; for (const k in patch) { if (k === "isNew") o.is_new = patch[k]; else if (k === "due") o.due = new Date(patch[k]).toISOString(); else o[k] = patch[k]; }
    const { error } = await sb.from("videos").update(o).eq("id", id); if (error) throw error; Object.assign(db.videos.find(v => v.id === id) || {}, patch); emit();
  },
  async markVideosNew(pid) { await sb.from("videos").update({ is_new: true }).eq("project", pid); },
  async addDelivery(video, round, link, note) { const { error } = await sb.from("deliveries").insert({ video, round, link, note: note || "", author: db.me }); if (error) throw error; await this.loadAll(); },
  async setDelivery(id, status) { const { error } = await sb.from("deliveries").update({ status, decided_at: new Date().toISOString() }).eq("id", id); if (error) throw error; },
  async addNotes(video, rows) { const base = db.notes.filter(n => n.video === video).length; const { error } = await sb.from("video_notes").insert(rows.map((r, i) => ({ video, tc: r.tc, cue: r.cue, visual: r.visual, sfx: r.sfx, sort: base + i, author: db.me }))); if (error) throw error; await this.loadAll(); },
  async setNote(id, done) { const n = db.notes.find(x => x.id === id); if (n) n.done = done; emit(); const { error } = await sb.from("video_notes").update({ done }).eq("id", id); if (error) throw error; },
  async delNote(id) { const { error } = await sb.from("video_notes").delete().eq("id", id); if (error) throw error; db.notes = db.notes.filter(x => x.id !== id); emit(); },
  async clearNotes(video) { const { error } = await sb.from("video_notes").delete().eq("video", video); if (error) throw error; db.notes = db.notes.filter(x => x.video !== video); emit(); },
  async createTask(f) { const { data, error } = await sb.from("tasks").insert({ editor: f.editor, title: f.title, notes: f.notes, link: f.link, due: new Date(f.due).toISOString(), stages: f.stages }).select("id").single(); if (error) throw error; await this.loadAll(); return data.id; },
  async updTask(id, p) { const o = { ...p }; if ("isNew" in o) { o.is_new = o.isNew; delete o.isNew; } if ("resLink" in o) { o.result_link = o.resLink; delete o.resLink; } if ("due" in o) o.due = new Date(o.due).toISOString(); const { error } = await sb.from("tasks").update(o).eq("id", id); if (error) throw error; await this.loadAll(); },
  async delTask(id) { const { error } = await sb.from("tasks").delete().eq("id", id); if (error) throw error; await this.loadAll(); },
  async markRead() { db.notifs.forEach(n => (n.read = true)); emit(); await sb.from("notifs").update({ read: true }).eq("user_id", db.me).eq("read", false); },
  async addMember(project, client) { const { error } = await sb.from("project_members").insert({ project, client }); if (error) throw error; await this.loadAll(); },
  async removeMember(project, client) { const { error } = await sb.from("project_members").delete().eq("project", project).eq("client", client); if (error) throw error; await this.loadAll(); },
  async createAccount(o, msg) { const { error } = await sb.rpc("admin_create_user", { p_username: o.username, p_name: o.name, p_password: o.password, p_role: o.role }); if (error) throw new Error(msg); await this.loadAll(); },
  async updateUser(id, o, msg) { const { error } = await sb.rpc("admin_update_user", { p_id: id, p_name: o.name || null, p_username: o.username || null, p_role: o.role || null, p_password: o.password || null }); if (error) throw new Error(msg); await this.loadAll(); },
  async deleteUser(id) { const { error } = await sb.rpc("admin_delete_user", { p_id: id }); if (error) throw error; await this.loadAll(); },
  async setRole(id, role) { const { error } = await sb.from("profiles").update({ role }).eq("id", id); if (error) throw error; await this.loadAll(); },
  async setProfileOf(id, patch) { const { error } = await sb.from("profiles").update(patch).eq("id", id); if (error) throw error; Object.assign(db.profiles[id], patch); emit(); },
  async updProfile(patch) { return this.setProfileOf(db.me, patch); },
  async uploadAvatar(file) { const ext = (file.name.split(".").pop() || "jpg").toLowerCase(); const path = `${db.me}/avatar-${Date.now()}.${ext}`; const up = await sb.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type }); if (up.error) throw up.error; return sb.storage.from("avatars").getPublicUrl(path).data.publicUrl; },
  async changePassword(pw) { const { error } = await sb.auth.updateUser({ password: pw }); if (error) throw error; await sb.rpc("forget_my_cred"); },
  async setRate(editor, type, price) { (db.rates[editor] = db.rates[editor] || {})[type] = price; emit(); const { error } = await sb.from("editor_rates").upsert({ editor, type, price }); if (error) throw error; },
  async setSetting(key, value) { db.settings[key] = value; emit(); const { error } = await sb.from("settings").upsert({ key, value }); if (error) throw error; },
  async setAccount(client, patch) { db.accounts[client] = { ...(db.accounts[client] || {}), ...patch }; emit(); const { error } = await sb.from("client_accounts").upsert({ client, ...db.accounts[client] }); if (error) throw error; },
  async fetchSheet(url, msgs) {
    const { data, error } = await sb.functions.invoke("sheet", { body: { url } });
    if (error) { let code = ""; try { code = (await error.context.json()).error; } catch (_) {} throw new Error(code === "not_public" ? msgs.notPublic : code === "bad_url" ? msgs.bad : msgs.err); }
    if (data && data.error) throw new Error(data.error === "not_public" ? msgs.notPublic : msgs.err); return data.csv;
  },
};

// ======================= DEMO =======================
const pw = {}; let uid = 1; const nid = p => p + (uid++).toString(36) + Math.random().toString(36).slice(2, 6);
function reset() { Object.assign(db, { me: null, profiles: {}, projects: [], members: [], videos: [], deliveries: [], notes: [], tasks: [], events: [], notifs: [], rates: {}, accounts: {}, creds: {} }); }
const nbox = {};
function demoNotify(kind, o, actorId) {
  const me = actorId, r = db.profiles[me].role, admins = Object.values(db.profiles).filter(p => p.role === "admin").map(p => p.id);
  let pid = o.project, ed = null, clients = [];
  if (o.video) pid = db.videos.find(v => v.id === o.video).project;
  if (o.task) ed = db.tasks.find(x => x.id === o.task).editor;
  else if (pid) { const p = db.projects.find(x => x.id === pid); ed = p.editor; clients = [p.client, ...db.members.filter(m => m.project === pid).map(m => m.client)]; }
  let rec = [], vis = "internal";
  const K = kind;
  if (["stage_req", "draft_sent", "task_stage", "task_delivered", "checkin"].includes(K)) rec = admins;
  else if (["stage_hold", "draft_hold", "task_new", "task_ping", "admin_note"].includes(K)) rec = [ed];
  else if (["stage_ok", "draft_ok", "assigned", "project_new"].includes(K)) { rec = [ed, ...clients]; vis = "client"; }
  else if (["notes_added", "review_notes", "client_approved"].includes(K)) { rec = [ed, ...admins, ...clients]; vis = "client"; }
  else if (["notes_all_done", "revising"].includes(K)) { rec = [...admins, ...clients]; vis = "client"; }
  else if (K === "request_new") { rec = admins; vis = "client"; }
  else if (K === "ask_status") { if (r === "client") { rec = [ed, ...admins, ...clients]; vis = "client"; } else rec = [ed]; }
  else if (K === "member_added") { rec = [o.params.user]; vis = "client"; }
  const ev = { id: uid++, kind, project: pid || null, video: o.video || null, task: o.task || null, actor: me, actorRole: r, params: o.params || {}, vis, time: Date.now() };
  db.events.unshift(ev);
  const ref = o.video ? "v:" + o.video : o.task ? "t:" + o.task : pid ? "p:" + pid : null;
  [...new Set(rec)].filter(u => u && u !== me).forEach(u => (nbox[u] = nbox[u] || []).unshift({ id: uid++, eventId: ev.id, ref, read: false, time: Date.now(), ar: "", en: "" }));
}
function demoVisible() { // what the current user may see (mirrors RLS)
  const me = db.me, r = db.profiles[me] && db.profiles[me].role; db.notifs = nbox[me] || (nbox[me] = []);
  return r;
}
const demo = {
  _all: null,
  async init() { seed(); },
  async login(u, p, side, msg) {
    const prof = Object.values(this._all.profiles).find(x => x.username === u);
    if (!prof || pw[prof.id] !== p) throw new Error(msg.bad);
    if ((side === "client") !== (prof.role === "client")) throw new Error(msg.side);
    db.me = prof.id; this.view();
  },
  view() { // apply visibility like the server would
    const A = this._all, me = db.me, r = A.profiles[me].role;
    const myP = A.projects.filter(p => r === "admin" || p.editor === me || p.client === me || A.members.some(m => m.project === p.id && m.client === me)).map(p => p.id);
    db.profiles = {}; Object.values(A.profiles).forEach(p => { if (r !== "client" || p.id === me || p.role === "client" && A.projects.some(pr => myP.includes(pr.id) && (pr.client === p.id || A.members.some(m => m.project === pr.id && m.client === p.id)))) db.profiles[p.id] = p; });
    db.projects = A.projects.filter(p => myP.includes(p.id)); db.members = A.members.filter(m => myP.includes(m.project));
    db.videos = A.videos.filter(v => myP.includes(v.project));
    db.deliveries = A.deliveries.filter(d => db.videos.some(v => v.id === d.video) && (r !== "client" || d.status === "approved"));
    db.notes = A.notes.filter(n => db.videos.some(v => v.id === n.video));
    db.tasks = A.tasks.filter(x => r === "admin" || x.editor === me);
    db.events = A.events.filter(e => r === "admin" || e.actor === me || (r === "editor" && (myP.includes(e.project) || db.tasks.some(x => x.id === e.task))) || (e.vis === "client" && myP.includes(e.project)));
    db.rates = r === "client" ? {} : A.rates; db.settings = A.settings; db.accounts = r === "admin" ? A.accounts : {}; db.creds = r === "admin" ? A.creds : {};
    db.notifs = nbox[me] || (nbox[me] = []); emit();
  },
  async logout() { db.me = null; emit(); },
  async loadAll() { this.view(); },
  async log(kind, o = {}) { const A = this._all; const save = { ...db }; Object.assign(db, { profiles: A.profiles, projects: A.projects, members: A.members, videos: A.videos, tasks: A.tasks, events: A.events }); demoNotify(kind, o, db.me); Object.assign(db, save); this.view(); window.dispatchEvent(new Event("hub:notif")); },
  async createProject(f, asAdmin) {
    const A = this._all, id = nid("p"); const p = { id, client: f.client || db.me, title: f.title, type: f.type, drive: f.drive, ref: f.ref || "", notes: f.notes || "", count: f.count, cad: f.cad, first: f.first, status: asAdmin && f.editor ? "active" : "pending", editor: asAdmin ? f.editor || null : null, created: Date.now() };
    A.projects.unshift(p); genVideos(A, p, asAdmin && f.editor); this.view(); return id;
  },
  async updProject(id, patch) { Object.assign(this._all.projects.find(p => p.id === id), patch); this.view(); },
  async updVideo(id, patch) { Object.assign(this._all.videos.find(v => v.id === id), patch, { upd: Date.now() }); this.view(); },
  async markVideosNew(pid) { this._all.videos.filter(v => v.project === pid).forEach(v => (v.isNew = true)); },
  async addDelivery(video, round, link, note) { const A = this._all; A.deliveries.unshift({ id: nid("d"), video, round, link, note: note || "", author: db.me, status: "pending", created: Date.now() }); const v = A.videos.find(x => x.id === video); if (!v.deliveredAt) { v.deliveredAt = Date.now(); v.deliveredBy = db.me; } this.view(); },
  async setDelivery(id, status) { Object.assign(this._all.deliveries.find(d => d.id === id), { status, decided: Date.now() }); this.view(); },
  async addNotes(video, rows) { const A = this._all, base = A.notes.filter(n => n.video === video).length; rows.forEach((r, i) => A.notes.push({ id: nid("n"), video, ...r, done: false, sort: base + i, author: db.me })); this.view(); },
  async setNote(id, done) { this._all.notes.find(n => n.id === id).done = done; this.view(); },
  async delNote(id) { this._all.notes = this._all.notes.filter(n => n.id !== id); this.view(); },
  async clearNotes(video) { this._all.notes = this._all.notes.filter(n => n.video !== video); this.view(); },
  async createTask(f) { const id = nid("t"); this._all.tasks.push({ id, kind: "task", editor: f.editor, title: f.title, notes: f.notes, link: f.link, due: f.due, stages: f.stages, stage: 0, isNew: true, upd: Date.now(), resLink: "" }); this.view(); return id; },
  async updTask(id, p) { Object.assign(this._all.tasks.find(x => x.id === id), p, { upd: Date.now() }); this.view(); },
  async delTask(id) { this._all.tasks = this._all.tasks.filter(x => x.id !== id); this.view(); },
  async markRead() { (nbox[db.me] || []).forEach(n => (n.read = true)); this.view(); },
  async addMember(project, client) { this._all.members.push({ project, client }); this.view(); },
  async removeMember(project, client) { this._all.members = this._all.members.filter(m => !(m.project === project && m.client === client)); this.view(); },
  async createAccount(o, msg) { const A = this._all; if (Object.values(A.profiles).some(p => p.username === o.username) || o.password.length < 6) throw new Error(msg); const id = nid("u"); A.profiles[id] = { id, username: o.username, name: o.name, role: o.role, title: "", lang: "ar", tour_version: 0 }; pw[id] = o.password; A.creds[id] = o.password; this.view(); },
  async updateUser(id, o, msg) { const A = this._all, p = A.profiles[id]; if (o.username && Object.values(A.profiles).some(x => x.username === o.username && x.id !== id)) throw new Error(msg); if (o.password && o.password.length < 6) throw new Error(msg); if (o.name) p.name = o.name; if (o.username) p.username = o.username; if (o.role) p.role = o.role; if (o.password) { pw[id] = o.password; A.creds[id] = o.password; } this.view(); },
  async deleteUser(id) { const A = this._all; delete A.profiles[id]; A.projects.forEach(p => { if (p.editor === id) { p.editor = null; p.status = "pending"; } }); A.projects = A.projects.filter(p => p.client !== id); this.view(); },
  async setRole(id, role) { this._all.profiles[id].role = role; this.view(); },
  async setProfileOf(id, patch) { Object.assign(this._all.profiles[id], patch); this.view(); },
  async updProfile(patch) { return this.setProfileOf(db.me, patch); },
  async uploadAvatar(file) { return await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); }); },
  async changePassword(p) { pw[db.me] = p; delete this._all.creds[db.me]; },
  async setRate(editor, type, price) { (this._all.rates[editor] = this._all.rates[editor] || {})[type] = price; this.view(); },
  async setSetting(key, value) { this._all.settings[key] = value; this.view(); },
  async setAccount(client, patch) { this._all.accounts[client] = { ...(this._all.accounts[client] || {}), ...patch }; this.view(); },
  async fetchSheet(url, msgs) { throw new Error(msgs.err); },
  demoUsers: () => ["cammio", "ahmed", "alizakria", "youssef"],
};
function genVideos(A, p, isNew) { const step = { cOnce: 0, cDaily: 1, c2: 2, cWeek: 7 }[p.cad] || 0; for (let i = 0; i < p.count; i++) A.videos.push({ id: nid("v"), project: p.id, n: i + 1, due: p.first + i * step * D, stage: 0, pub: 0, round: 0, rs: null, link: "", pending: null, isNew: !!isNew, upd: Date.now(), deliveredAt: null, deliveredBy: null, price: null }); }
function seed() {
  const T0 = new Date(); T0.setHours(20, 0, 0, 0); const t0 = T0.getTime();
  const A = { profiles: {}, projects: [], members: [], videos: [], deliveries: [], notes: [], tasks: [], events: [], rates: { ahmed: { tReels: 400, tLong: 1200 } }, settings: { late_allowance: "3", late_penalty: "100", early_hours: "24", currency: "EGP" }, accounts: { alizakria: { price: 900, paid: 1800 } }, creds: {} };
  const mk = (id, name, role, title = "") => { A.profiles[id] = { id, username: id, name, role, title, lang: "ar", tour_version: 99, avatar_url: "" }; pw[id] = "1234"; A.creds[id] = "1234"; };
  mk("cammio", "Cammio", "admin", "Team lead"); mk("ahmed", "Ahmed", "editor", "Video editor"); mk("alizakria", "Ali Zakaria", "client"); mk("youssef", "Youssef", "client");
  A.projects.push({ id: "p1", client: "alizakria", title: "Illegal AI", type: "tLong", drive: "https://drive.google.com/drive/folders/demo", ref: "https://docs.google.com/spreadsheets/d/demo", notes: "ستايل قصاصات وكولاج (Vox). الخط Xb Titre.", count: 1, cad: "cDaily", first: t0, status: "active", editor: "ahmed", created: Date.now() - 3 * D });
  A.projects.push({ id: "p2", client: "alizakria", title: "Legal AI — Top Voice", type: "tReels", drive: "https://drive.google.com/drive/folders/demo2", ref: "", notes: "", count: 4, cad: "c2", first: t0 - 3 * D, status: "active", editor: "ahmed", created: Date.now() - 4 * D });
  A.projects.push({ id: "p3", client: "youssef", title: "Promo batch", type: "tReels", drive: "https://drive.google.com/drive/folders/demo3", ref: "", notes: "", count: 2, cad: "cWeek", first: t0 + 2 * D, status: "pending", editor: null, created: Date.now() - 2 * H });
  A.members.push({ project: "p1", client: "youssef" }, { project: "p2", client: "youssef" });
  A.projects.forEach(p => genVideos(A, p, false));
  const vs = A.videos;
  Object.assign(vs[0], { stage: 3, pub: 2, isNew: false }); // Illegal AI video 1
  Object.assign(vs[1], { stage: 6, pub: 6, round: 1, rs: "awaiting", link: "https://platform.krock.io/r/1", deliveredAt: vs[1].due - 30 * H, deliveredBy: "ahmed" });
  Object.assign(vs[2], { stage: 6, pub: 6, round: 1, rs: "notes", link: "https://platform.krock.io/r/2", deliveredAt: vs[2].due + 5 * H, deliveredBy: "ahmed" });
  Object.assign(vs[3], { stage: 5, pub: 4, deliveredAt: Date.now() - H, deliveredBy: "ahmed" });
  A.deliveries.push({ id: "d1", video: vs[1].id, round: 1, link: "https://platform.krock.io/r/1", note: "", author: "ahmed", status: "approved", created: vs[1].deliveredAt, decided: vs[1].deliveredAt + H });
  A.deliveries.push({ id: "d2", video: vs[2].id, round: 1, link: "https://platform.krock.io/r/2", note: "", author: "ahmed", status: "approved", created: vs[2].deliveredAt, decided: vs[2].deliveredAt + H });
  A.deliveries.push({ id: "d3", video: vs[3].id, round: 1, link: "https://platform.krock.io/r/3", note: "النسخة الأولى", author: "ahmed", status: "pending", created: Date.now() - H });
  [["", "محامي شاطر", "أكوام ورق تتراكم حوالين علي", "زوم بطيء"], ["", "راحت عليها", "ختم أحمر باطل / EXPIRED", "قطع حاد + صوت ختم"], ["", "الحُكم", "كلمة الحُكم + مطرقة خشب", "صوت مطرقة"]].forEach((r, i) => A.notes.push({ id: "n" + i, video: vs[0].id, tc: r[0], cue: r[1], visual: r[2], sfx: r[3], done: i === 0, sort: i, author: "cammio" }));
  A.tasks.push({ id: "t1", kind: "task", editor: "ahmed", title: "قص ماتريال علي زكريا", notes: "", link: "https://drive.google.com/drive/folders/x", due: t0 - D, stages: ["حملت", "قصيت فيديو", "نص الماتريال", "خلصت"], stage: 2, isNew: false, upd: Date.now() - 5 * H, resLink: "" });
  demo._all = A;
  Object.assign(db, { profiles: A.profiles, projects: A.projects, members: A.members, videos: A.videos, tasks: A.tasks, events: A.events });
  // a few events
  const ctx = id => { db.me = id; };
  ctx("ahmed"); demoNotify("draft_sent", { video: vs[3].id, params: { round: 1 } }, "ahmed");
  demoNotify("stage_req", { video: vs[0].id, params: { stage: 3 } }, "ahmed");
  Object.assign(vs[0], { pending: { type: "stage", stage: 3 } });
  demoNotify("review_notes", { video: vs[2].id, params: {} }, "youssef");
  demoNotify("request_new", { project: "p3", params: {} }, "youssef");
  db.me = null;
}

export const api = LIVE ? live : demo;
export { H, D };
