// The side panel: AIntern's /ext page in a frame, plus what only the extension can do: read the
// current tab, fill its form fields and record what the person does in it, each when the person
// presses a button there.
const frame = document.getElementById("review");
const bar = document.getElementById("bar");
let origin = "";

const get = (keys) => new Promise((r) => chrome.storage.sync.get(keys, r));

async function currentTab() {
  const pinned = Number(new URLSearchParams(location.search).get("tab"));
  if (pinned) return chrome.tabs.get(pinned);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// A page the panel may not read yet: the toolbar button grants that one page (activeTab); the
// panel's own button asks once for every site. Browsers accept permission requests only from a
// click in the extension itself.
function askAccess() {
  return new Promise((resolve) => {
    document.getElementById("bar-text").textContent = "點工具列的 AIntern 圖示讀取這一頁，或";
    const button = document.getElementById("bar-button");
    button.textContent = "允許所有網站";
    bar.hidden = false;
    const done = (ok) => { bar.hidden = true; chrome.permissions.onAdded.removeListener(onAdded); clearInterval(poll); resolve(ok); };
    const onAdded = () => done(true);
    chrome.permissions.onAdded.addListener(onAdded);
    // activeTab is not announced: notice it by trying the page again.
    const poll = setInterval(async () => {
      const tab = await currentTab().catch(() => null);
      if (tab && tab.id) chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => true }).then(() => done(true), () => {});
    }, 1000);
    button.onclick = async () => done(await chrome.permissions.request({ origins: ["https://*/*", "http://*/*"] }));
  });
}

// Loads page.js into every frame of the tab (framesets and iframes hold many old forms), asking
// for access first when the page is not readable yet. Returns the tab and the frames it reached,
// the top frame first.
async function frames() {
  const tab = await currentTab();
  if (!tab || !tab.id) throw new Error("找不到目前的分頁");
  const inject = () => chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ["page.js"] });
  let results;
  try { results = await inject(); } catch (error) {
    if (/chrome:|edge:|about:|Web Store|extensions gallery/i.test(String(error))) throw new Error("這個頁面不能使用擴充功能");
    if (!(await askAccess())) throw new Error("沒有讀取網頁的權限");
    results = await inject();
  }
  const ids = [...new Set(results.map((r) => r.frameId))].sort((a, b) => a - b);
  return { tab, ids };
}

const callIn = (tab, frameId, name, args) => chrome.scripting.executeScript({
  target: { tabId: tab.id, frameIds: [frameId] },
  func: (n, a) => reviewKit[n](...a),
  args: [name, args],
}).then((r) => (r && r[0] ? r[0].result : null));

// Resolves when the tab has finished loading again, for a field that reloads the page on change.
function settled(tabId) {
  return new Promise((resolve) => {
    const done = () => { chrome.tabs.onUpdated.removeListener(listen); clearTimeout(timer); resolve(); };
    const listen = (id, info) => { if (id === tabId && info.status === "complete") done(); };
    const timer = setTimeout(done, 15_000);
    chrome.tabs.onUpdated.addListener(listen);
    chrome.tabs.get(tabId).then((t) => { if (t.status === "complete") setTimeout(done, 300); }, done);
  });
}

const handlers = {
  async capture({ capture = [] }) {
    const { tab, ids } = await frames();
    const parts = (await Promise.all(ids.map((id) => callIn(tab, id, "capture", [capture]).catch(() => null)))).filter(Boolean);
    // The top frame gives url, title and meta; text, selection and fields come from every frame.
    const value = { ...parts[0] };
    if (capture.includes("text")) value.text = parts.map((p) => p.text || "").filter(Boolean).join("\n\n").slice(0, 60000);
    if (capture.includes("selection")) value.selection = parts.map((p) => p.selection).find(Boolean) || "";
    if (capture.includes("fields")) value.fields = parts.flatMap((p) => p.fields || []).slice(0, 300);
    if (capture.includes("screenshot")) value.screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "jpeg", quality: 70 });
    return value;
  },
  async fill({ fields = [], sites = [] }) {
    // The values go into the page the person is looking at; a workflow can limit which sites.
    // Frame by frame, top first, each taking the fields the frames before it did not find. A
    // field that reloads the page (ASP.NET AutoPostBack) ends the script mid-way: wait for the
    // page and go again; fields already holding their value are left alone.
    let host = "";
    const filled = new Set();
    for (let attempt = 0; attempt < 6; attempt++) {
      const { tab, ids } = await frames();
      let left = fields.filter((f) => !filled.has(f.field));
      try {
        for (const id of ids) {
          if (!left.length) break;
          const r = await callIn(tab, id, "fill", [left, sites]);
          if (!r) continue;
          if (id === ids[0]) host = r.host;
          if (r.refused) { if (id === ids[0]) throw Object.assign(new Error(`這個結果只能填入 ${sites.join("、")}`), { final: true }); continue; }
          r.filled.forEach((f) => filled.add(f));
          left = left.filter((f) => !filled.has(f.field));
        }
        return { filled: [...filled], missing: left.filter((f) => String(f.value ?? "").trim() !== "").map((f) => f.field), host };
      } catch (error) {
        if (error.final || attempt === 5) throw error;
        await settled(tab.id);
      }
    }
  },
  // Recording (recorder.js): the person does a task once while the agent watches the requests.
  async "record-start"() {
    const tab = await currentTab();
    if (!tab || !tab.id) throw new Error("找不到目前的分頁");
    return reviewRecorder.start(tab, origin);
  },
  async "record-status"() { return reviewRecorder.status(); },
  async "record-stop"({ discard }) { return reviewRecorder.stop(Boolean(discard)); },
  async open({ url }) {
    if (new URL(url).origin !== origin) throw new Error("只能開啟 AIntern");
    await chrome.tabs.create({ url });
    return true;
  },
};

window.addEventListener("message", async (event) => {
  if (event.origin !== origin || event.source !== frame.contentWindow || !event.data || !event.data.review) return;
  const { id, type } = event.data;
  if (type === "ready") return notifyTab();
  if (!handlers[type]) return;
  try { frame.contentWindow.postMessage({ review: true, type: "reply", id, ok: true, data: await handlers[type](event.data) }, origin); }
  catch (error) { frame.contentWindow.postMessage({ review: true, type: "reply", id, ok: false, error: error.message || String(error) }, origin); }
});

// Which site the person is on, so the panel can list the workflows for it first. The url is only
// visible for sites the person has allowed.
async function notifyTab() {
  const tab = await currentTab().catch(() => null);
  if (tab && tab.url && origin) frame.contentWindow.postMessage({ review: true, type: "tab", url: tab.url }, origin);
}
chrome.tabs.onActivated.addListener(notifyTab);
// A reload of the frame (sign-out, an error) or closing the panel ends a recording, since nothing
// is left to stop it; nothing is kept.
frame.addEventListener("load", () => { if (reviewRecorder.active()) reviewRecorder.stop(true); });
addEventListener("pagehide", () => { if (reviewRecorder.active()) reviewRecorder.stop(true); });
chrome.tabs.onUpdated.addListener((_id, info) => { if (info.url || info.status === "complete") notifyTab(); });

// No address yet: the options page asks for this organisation's AIntern.
get({ instance: "" }).then(({ instance }) => {
  if (!instance) { chrome.runtime.openOptionsPage(); return; }
  origin = new URL(instance).origin;
  frame.src = `${origin}/ext`;
});
