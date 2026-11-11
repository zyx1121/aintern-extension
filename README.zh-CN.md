<!-- Translated from README.md at its first commit. -->
<div align="center">

<h1>aintern-extension</h1>

<p><strong>AIntern 浏览器扩展：在任何网页旁边运行你的流程。</strong></p>

[![Release](https://img.shields.io/github/v/release/zyx1121/aintern-extension?style=flat-square&sort=semver)](https://github.com/zyx1121/aintern-extension/releases)

[English](README.md) | [繁體中文](README.zh-TW.md) | **简体中文**

</div>

使用 AIntern 的单位，同事在 Chrome 装这个扩展。它在侧边栏打开 AIntern，对你正在看的网页运行流程，再把结果填进你打开的表单。

## 功能

- **在这一页运行**：流程读取你正在看的网页，例如书店页面上的 ISBN。
- **确认后填入**：你在侧边栏确认结果，扩展再把它填进网页表单。
- **录一次就会**：你在网站上操作一次，agent 把它学成流程的一个步骤。

## 安装

1. 下载 [aintern-extension.zip](https://github.com/zyx1121/aintern-extension/releases/latest/download/aintern-extension.zip) 并解压缩。
2. Chrome 打开 `chrome://extensions`，打开右上角的「开发者模式」。
3. 点「加载已解压的扩展程序」，选解压缩后的文件夹。
4. 点扩展图标，打开选项，填你们的 AIntern 网址（例如 `https://aintern.example.edu`）后保存。

点扩展图标就会打开侧边栏，在那里用 passkey 登录。

## 更新

下载最新的 zip，解压缩覆盖旧文件夹，再到 `chrome://extensions` 点这个扩展的重新加载按钮。

## 设置

| 项目 | 设置什么 | 默认 |
|------|----------|------|
| AIntern 网址（选项页） | 侧边栏打开哪一套 AIntern | 必填 |
| `AINTERN_EXTENSION_ORIGINS`（AIntern 服务器上） | 要列出 `chrome-extension://ifbmgcfmalplanmilfnemmalpdnfhlli`，否则侧边栏是空白的 | 必填 |
