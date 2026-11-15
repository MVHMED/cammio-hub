self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "Cammio Studio", { body: d.body || "", tag: d.tag, renotify: true, icon: "icon-192.png", badge: "icon-192.png", data: { url: d.url || "./" }, dir: "rtl", lang: "ar" }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) { if (c.url.split("#")[0] === url.split("#")[0]) { c.postMessage({ open: url.split("#")[1] || "" }); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
