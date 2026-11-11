// The toolbar button opens the side panel. Opening it from the click (rather than with
// openPanelOnActionClick) grants activeTab, so the panel can read the current page without
// asking for access to every site.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
});

// A developer's unpacked copy (a git checkout) reloads itself once its files on disk are a newer
// version, so a pull needs no trip to chrome://extensions. It waits while a side panel is open,
// since reloading closes it and would end a recording. Store installs update through the store.
async function reloadIfUpdated() {
  if ((await chrome.management.getSelf()).installType !== "development") return;
  const disk = await fetch(chrome.runtime.getURL("manifest.json"), { cache: "no-store" }).then((r) => r.json()).catch(() => null);
  if (!disk?.version || disk.version === chrome.runtime.getManifest().version) return;
  const open = await chrome.runtime.getContexts({ contextTypes: ["SIDE_PANEL", "TAB"] }).catch(() => []);
  if (!open.some((c) => c.contextType === "SIDE_PANEL" || c.documentUrl?.includes("/panel.html"))) chrome.runtime.reload();
}
chrome.alarms.create("review-update", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === "review-update") void reloadIfUpdated(); });
chrome.runtime.onStartup.addListener(() => void reloadIfUpdated());
