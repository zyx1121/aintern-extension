<div align="center">

<h1>aintern-extension</h1>

<p><strong>The AIntern browser extension: run your workflows beside any web page.</strong></p>

[![Release](https://img.shields.io/github/v/release/zyx1121/aintern-extension?style=flat-square&sort=semver)](https://github.com/zyx1121/aintern-extension/releases)

**English** | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md)

</div>

Staff at an organisation that runs AIntern use this extension in Chrome. It opens AIntern in the side panel and runs a workflow on the page they read. Then it fills the result into the form on that page.

## Features

- **Run on this page**: a workflow reads the page you are on, for example the ISBN on a bookshop page.
- **Verify, then fill**: you verify the result in the side panel, and the extension fills it into the page form.
- **Record once**: you do a task once on a site, and the agent learns it as a workflow step.

## Install

1. Download [aintern-extension.zip](https://github.com/zyx1121/aintern-extension/releases/latest/download/aintern-extension.zip) and unzip it.
2. Open `chrome://extensions` in Chrome and turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose the unzipped folder.
4. Click the extension icon, open its options, enter your AIntern address (for example `https://aintern.example.edu`) and save.

The side panel opens when you click the extension icon. Sign in with your passkey there.

## Update

Download the newest zip, unzip it over the old folder and click the reload button on the extension in `chrome://extensions`.

## Configuration

| Key | Sets | Default |
|-----|------|---------|
| AIntern address (options page) | The AIntern instance the side panel opens | required |
| `AINTERN_EXTENSION_ORIGINS` (on the AIntern server) | Must list `chrome-extension://ifbmgcfmalplanmilfnemmalpdnfhlli`, or the side panel stays blank | required |

## For AI agents

Facts for coding agents and LLM tools. The rules for changing the code are in [AGENTS.md](AGENTS.md).

- **Summary**: Chrome side panel extension for AIntern. It mirrors `extension/` in zyx1121/aintern.
- **Type**: app
- **Interfaces**: Chrome extension (Manifest V3), side panel
- **Install**: Load unpacked from the unzipped release asset `aintern-extension.zip`
- **Run**: Click the extension icon in Chrome
- **Verify**: `chrome://extensions` lists AIntern with id `ifbmgcfmalplanmilfnemmalpdnfhlli`
- **Config**: AIntern address in the options page, and `AINTERN_EXTENSION_ORIGINS` on the server
- **Secrets**: none. Sign-in uses the passkey session of the AIntern instance
- **Limits**: Chrome and Chromium browsers only. Not in the Chrome Web Store yet, so it needs Developer mode.

## Development

Change the extension in zyx1121/aintern. Each AIntern release copies `extension/` here, tags it and publishes the zip.
