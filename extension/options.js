const input = document.getElementById("instance");
const status = document.getElementById("status");
chrome.storage.sync.get({ instance: "" }, ({ instance }) => { input.value = instance; });
document.getElementById("save").onclick = () => {
  let url;
  try { url = new URL(input.value.trim()); } catch { status.textContent = "網址不正確"; return; }
  if (url.protocol !== "https:") { status.textContent = "要用 https"; return; }
  chrome.storage.sync.set({ instance: url.origin }, () => { status.textContent = "已儲存，重新開啟側邊欄生效"; });
};
