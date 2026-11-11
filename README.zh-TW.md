<!-- Translated from README.md at its first commit. -->
<div align="center">

<h1>aintern-extension</h1>

<p><strong>AIntern 瀏覽器擴充功能：在任何網頁旁邊執行你的流程。</strong></p>

[![Release](https://img.shields.io/github/v/release/zyx1121/aintern-extension?style=flat-square&sort=semver)](https://github.com/zyx1121/aintern-extension/releases)

[English](README.md) | **繁體中文** | [简体中文](README.zh-CN.md)

</div>

使用 AIntern 的單位，同仁在 Chrome 裝這個擴充功能。它在側邊欄打開 AIntern，對你正在看的網頁執行流程，再把結果填進你開著的表單。

## 功能

- **在這一頁執行**：流程讀取你正在看的網頁，例如書店頁面上的 ISBN。
- **確認後填入**：你在側邊欄確認結果，擴充功能再把它填進網頁表單。
- **錄一次就會**：你在網站上操作一次，agent 把它學成流程的一個步驟。

## 安裝

1. 下載 [aintern-extension.zip](https://github.com/zyx1121/aintern-extension/releases/latest/download/aintern-extension.zip) 並解壓縮。
2. Chrome 打開 `chrome://extensions`，打開右上角的「開發人員模式」。
3. 按「載入未封裝項目」，選解壓縮後的資料夾。
4. 按擴充功能圖示，打開選項，填你們的 AIntern 網址（例如 `https://aintern.example.edu`）後儲存。

按擴充功能圖示就會打開側邊欄，在那裡用 passkey 登入。

## 更新

下載最新的 zip，解壓縮蓋過舊資料夾，再到 `chrome://extensions` 按這個擴充功能的重新載入按鈕。

## 設定

| 項目 | 設定什麼 | 預設 |
|------|----------|------|
| AIntern 網址（選項頁） | 側邊欄打開哪一套 AIntern | 必填 |
| `AINTERN_EXTENSION_ORIGINS`（AIntern 伺服器上） | 要列出 `chrome-extension://ifbmgcfmalplanmilfnemmalpdnfhlli`，否則側邊欄是空白的 | 必填 |
