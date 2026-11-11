// Injected into every frame of the tab the person is looking at, only when they press a button in
// the side panel. panel.js injects this file, then calls reviewKit.capture or reviewKit.fill. It runs
// in the page, so it must not use anything from the extension. `var` because a second injection
// into the same frame evaluates the file again.

// eslint-disable-next-line no-var
var reviewKit = (function () {
  const clip = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
  const norm = (s) => String(s || "").replace(/[\s:：*＊]+/g, "").toLowerCase();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitFor = async (test, ms = 1500) => {
    for (let t = 0; t < ms; t += 50) { const v = test(); if (v) return v; await sleep(50); }
    return test();
  };
  // Shown to the person: not hidden, not aria-hidden (a widget's form input), larger than the 1px
  // box that visually-hidden inputs use.
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden"
      && !el.closest("[aria-hidden=true]") && (r.width > 1 || r.height > 1);
  };
  const disabled = (el) => el.disabled || el.getAttribute("aria-disabled") === "true" || el.readOnly || el.getAttribute("aria-readonly") === "true";
  // Every element matching sel, also inside open shadow roots (web components), in page order.
  function all(sel, root = document) {
    const out = [];
    const walk = (node) => {
      for (const el of node.querySelectorAll("*")) {
        if (el.matches(sel)) out.push(el);
        if (el.shadowRoot) walk(el.shadowRoot);
      }
    };
    walk(root);
    return out;
  }
  const unique = (sel) => { try { return document.querySelectorAll(sel).length === 1; } catch { return false; } };
  const textOf = (ids) => ids.split(/\s+/).map((id) => document.getElementById(id)?.innerText || "").join(" ");

  // Native fields plus the ARIA widgets that component libraries build from divs and buttons:
  // comboboxes and listboxes (Base UI, Radix, MUI, Headless UI selects), checkboxes, switches,
  // radio groups and rich text editors.
  const NATIVE = "input, select, textarea";
  const CUSTOM = [
    "[role=combobox]:not(input)", "[aria-haspopup=listbox]:not(input)", "[role=listbox]",
    "[role=checkbox]:not(input)", "[role=switch]:not(input)", "[role=radiogroup]",
    "[contenteditable='']", "[contenteditable=true]", "[contenteditable=plaintext-only]",
    "[role=textbox]:not(input):not(textarea)",
  ].join(", ");
  const SKIP_TYPES = /^(hidden|password|submit|button|reset|image|file)$/i;

  // A CSS path from the nearest unique id. Inside a web component the path continues from its
  // host after " >>> ", which resolve() follows into the shadow root.
  function path(el) {
    const root = el.getRootNode();
    if (root instanceof ShadowRoot) {
      const inner = el.id && root.querySelectorAll(`#${CSS.escape(el.id)}`).length === 1 ? `#${CSS.escape(el.id)}` : localPath(el, root);
      return `${path(root.host)} >>> ${inner}`;
    }
    return localPath(el, document);
  }
  function resolve(key) {
    let node = document, el = null;
    for (const part of String(key).split(" >>> ")) {
      try { el = node.querySelector(part); } catch { return null; }
      if (!el) return null;
      node = el.shadowRoot || el;
    }
    return el;
  }
  function localPath(el, root) {
    const unique = (sel) => { try { return root.querySelectorAll(sel).length === 1; } catch { return false; } };
    const parts = [];
    for (let e = el; e && e.nodeType === 1 && e !== document.body && e !== root; e = e.parentElement) {
      if (e.id && unique(`#${CSS.escape(e.id)}`)) { parts.unshift(`#${CSS.escape(e.id)}`); break; }
      const same = e.parentElement ? [...e.parentElement.children].filter((c) => c.tagName === e.tagName) : [];
      parts.unshift(same.length > 1 ? `${e.tagName.toLowerCase()}:nth-of-type(${same.indexOf(e) + 1})` : e.tagName.toLowerCase());
    }
    return parts.join(" > ");
  }

  // The words a person reads next to a field, from the most explicit source to the layout.
  function labelOf(el) {
    const own = (el.labels && el.labels[0] && el.labels[0].innerText)
      || (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.innerText)
      || (el.getAttribute("aria-labelledby") && textOf(el.getAttribute("aria-labelledby")))
      || el.getAttribute("aria-label")
      || (el.tagName === "FIELDSET" && el.querySelector("legend")?.innerText)
      || el.closest("fieldset")?.querySelector("legend")?.innerText
      || el.placeholder || el.title || el.getAttribute("data-placeholder");
    if (own && clip(own, 200)) return clip(own, 200);
    // Table layouts (old PHP and ASP forms): the nearest earlier cell in the row with text, then
    // the column header; a definition list's term.
    const cell = el.closest("td, th, dd");
    for (let c = cell && cell.previousElementSibling, i = 0; c && i < 3; c = c.previousElementSibling, i++) {
      const text = clip(c.innerText, 200);
      if (text && !c.querySelector(NATIVE + ", " + CUSTOM)) return text;
    }
    if (cell && cell.tagName !== "DD") {
      const table = cell.closest("table"), row = cell.parentElement;
      const head = table && table.rows[0] !== row ? table.rows[0]?.cells[cell.cellIndex] : null;
      if (head && head.tagName === "TH" && clip(head.innerText, 200)) return clip(head.innerText, 200);
    }
    // A short line of text just before the field or one of its first three containers.
    for (let e = el, i = 0; e && i < 4; e = e.parentElement, i++) {
      const prev = e.previousElementSibling;
      const text = prev && clip(prev.innerText, 200);
      if (text && text.length <= 60 && !prev.querySelector(NATIVE + ", " + CUSTOM)) return text;
    }
    return "";
  }

  // A named hidden input next to a custom widget is what the page submits: Base UI and Radix keep
  // one beside their select trigger. Its name is how a workflow or a person refers to the field.
  function boundInput(widget) {
    for (let e = widget.parentElement, i = 0; e && i < 3; e = e.parentElement, i++) {
      const named = [...e.querySelectorAll("input[name], select[name]")].filter((x) => !visible(x) || x.getAttribute("aria-hidden") === "true" || x.type === "hidden");
      if (named.length === 1) return named[0];
      if (named.length > 1) return null;
    }
    return null;
  }

  function optionsOf(f) {
    if (f.kind === "select") return [...f.el.options].map((o) => ({ el: o, text: clip(o.text, 200), value: o.value }));
    if (f.kind === "radio") return f.radios.map((r) => ({ el: r, text: clip((r.labels && r.labels[0] && r.labels[0].innerText) || r.getAttribute("aria-label") || r.innerText || r.value, 200), value: r.value || "" }));
    if (f.kind === "listbox") return [...f.el.querySelectorAll("[role=option]")].map((o) => ({ el: o, text: clip(o.innerText || o.getAttribute("aria-label"), 200), value: o.getAttribute("data-value") || o.getAttribute("value") || "" }));
    if (f.kind === "combobox") {
      // Only when the list is already in the page; capture never opens a popup.
      const list = f.el.getAttribute("aria-controls") && document.getElementById(f.el.getAttribute("aria-controls"));
      return list ? [...list.querySelectorAll("[role=option]")].map((o) => ({ el: o, text: clip(o.innerText, 200), value: o.getAttribute("data-value") || "" })) : [];
    }
    return [];
  }

  function valueOf(f) {
    const el = f.el;
    if (f.kind === "checkbox") return String(el.tagName === "INPUT" ? el.checked : el.getAttribute("aria-checked") === "true");
    if (f.kind === "radio") { const on = f.radios.find((r) => r.checked || r.getAttribute("aria-checked") === "true"); return on ? optionsOf(f).find((o) => o.el === on)?.text || "" : ""; }
    if (f.kind === "richtext") return el.innerText;
    if (f.kind === "combobox") { const b = f.bound; return (b && b.value) || (el.getAttribute("data-placeholder") !== null ? "" : el.innerText); }
    if (f.kind === "listbox") return [...el.querySelectorAll("[role=option][aria-selected=true]")].map((o) => o.innerText).join(", ");
    return el.value;
  }

  // Every field a person can see and change, in page order, one entry per field: a radio group is
  // one field, the pieces inside a widget are not fields of their own.
  function collect() {
    const fields = [], taken = new Set(), groups = new Set();
    const controlled = new Set([...document.querySelectorAll("[aria-controls]")].map((e) => e.getAttribute("aria-controls")));
    for (const el of all(NATIVE + ", " + CUSTOM)) {
      if (fields.length >= 300) break;
      if (!visible(el) || disabled(el)) continue;
      if (taken.has(el) || [...taken].some((t) => t !== el && t.contains(el))) continue;
      let f;
      if (el.tagName === "INPUT" && el.type === "radio") {
        const group = el.name ? [...document.querySelectorAll(`input[type=radio][name="${CSS.escape(el.name)}"]`)].filter(visible) : [el];
        if (el.name && groups.has(el.name)) continue;
        groups.add(el.name);
        const box = group.length > 1 ? group.reduce((a, b) => { let p = a; while (p && !p.contains(b)) p = p.parentElement; return p; }) : el;
        f = { el: box, radios: group, kind: "radio", name: el.name || undefined, key: `input[type=radio][name="${CSS.escape(el.name)}"]` };
        f.label = clip(box === el ? labelOf(el) : (labelOf(box) || labelOf(el)), 200);
      } else if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") {
        if (SKIP_TYPES.test(el.type || "")) continue;
        const kind = el.tagName === "SELECT" ? "select" : el.type === "checkbox" ? "checkbox" : el.getAttribute("role") === "combobox" ? "autocomplete" : "text";
        f = { el, kind, name: el.name || undefined };
      } else {
        const role = el.getAttribute("role");
        if (role === "listbox" && (controlled.has(el.id) || el.closest("[role=combobox]"))) continue;
        const kind = role === "radiogroup" ? "radio" : role === "checkbox" || role === "switch" ? "checkbox" : role === "listbox" ? "listbox"
          : role === "combobox" || el.getAttribute("aria-haspopup") === "listbox" ? "combobox" : "richtext";
        f = { el, kind };
        if (kind === "radio") f.radios = [...el.querySelectorAll("[role=radio]")];
        const bound = kind === "combobox" || kind === "checkbox" ? boundInput(el) : null;
        if (bound) { f.bound = bound; f.name = bound.name; }
      }
      if (!f.key) {
        const inShadow = el.getRootNode() instanceof ShadowRoot;
        f.key = inShadow ? path(el) : el.id && unique(`#${CSS.escape(el.id)}`) ? `#${CSS.escape(el.id)}`
          : f.name && el.tagName !== "DIV" && el.name === f.name && unique(`${el.tagName.toLowerCase()}[name="${CSS.escape(f.name)}"]`) ? `${el.tagName.toLowerCase()}[name="${CSS.escape(f.name)}"]`
            : path(el);
      }
      if (f.label === undefined) f.label = labelOf(el);
      taken.add(f.el);
      if (f.bound) taken.add(f.bound);
      fields.push(f);
    }
    return fields;
  }

  // The options of a dropdown that only renders its list when open: open it, read, close it, and
  // give focus back. Nothing is chosen.
  async function peekOptions(f) {
    const before = new Set(document.querySelectorAll("[role=option]"));
    const focused = document.activeElement;
    const open = () => f.el.getAttribute("aria-expanded") === "true" || popupOptions(f.el, before).length > 0;
    press(f.el, ["down"]);
    if (!(await waitFor(open, 300))) { press(f.el, ["up"]); await waitFor(open, 300); }
    if (!open()) { key(f.el, "ArrowDown"); await waitFor(open, 300); }
    const options = (await waitFor(() => { const o = popupOptions(f.el, before); return o.length ? o : null; }, 800)) || [];
    const texts = options.map((o) => clip(o.innerText || o.getAttribute("aria-label"), 200)).filter(Boolean);
    key(f.el, "Escape");
    await waitFor(() => f.el.getAttribute("aria-expanded") !== "true", 300);
    if (f.el.getAttribute("aria-expanded") === "true") press(f.el);
    if (focused && focused.focus) focused.focus();
    return texts;
  }

  /** What a workflow asked for: url and title always, then text, selection, form fields. */
  async function capture(want) {
    const out = { url: location.href, title: document.title };
    if (want.includes("selection")) out.selection = String(getSelection() || "").slice(0, 20000);
    if (want.includes("text")) out.text = (document.body ? document.body.innerText : "").slice(0, 60000);
    const meta = {};
    for (const m of document.querySelectorAll("meta[name], meta[property]")) {
      const k = m.getAttribute("name") || m.getAttribute("property");
      if (/^(og:|citation_|dc\.|description$|keywords$|author$|book:|product:)/i.test(k) && Object.keys(meta).length < 60) meta[k] = clip(m.content, 1000);
    }
    if (Object.keys(meta).length) out.meta = meta;
    if (want.includes("fields")) {
      out.fields = [];
      for (const f of collect()) {
        const field = { key: f.key, label: f.label, type: f.kind === "text" || f.kind === "autocomplete" ? (f.el.type || "text") : f.kind, name: f.name };
        let options = optionsOf(f).slice(0, 300).map((o) => o.text);
        if (!options.length && f.kind === "combobox") options = (await peekOptions(f).catch(() => [])).slice(0, 300);
        if (options.length) field.options = options;
        const v = valueOf(f);
        if (v) field.value = clip(v, 2000);
        out.fields.push(field);
      }
    }
    return out;
  }

  // A real click, for widgets that listen to pointer events rather than click.
  function press(el, phases = ["down", "up"]) {
    const o = { bubbles: true, cancelable: true, composed: true, view: window, button: 0, pointerType: "mouse", isPrimary: true };
    if (phases.includes("down")) { el.dispatchEvent(new PointerEvent("pointerdown", o)); el.dispatchEvent(new MouseEvent("mousedown", o)); }
    if (phases.includes("up")) { el.dispatchEvent(new PointerEvent("pointerup", o)); el.dispatchEvent(new MouseEvent("mouseup", o)); el.dispatchEvent(new MouseEvent("click", o)); }
  }
  const key = (el, k) => ["keydown", "keyup"].forEach((t) => el.dispatchEvent(new KeyboardEvent(t, { key: k, bubbles: true, cancelable: true })));

  function pick(options, value) {
    const v = norm(value);
    return options.find((o) => o.value === value) || options.find((o) => norm(o.text) === v)
      || options.find((o) => norm(o.text).includes(v)) || options.find((o) => v.includes(norm(o.text)) && norm(o.text));
  }

  // Old pages validate and format in onfocus / onblur handlers; frameworks track the value through
  // the prototype setter and input events. A value already in place is left alone, so a field that
  // reloads the page on change (ASP.NET AutoPostBack) is not changed twice.
  const setNative = (el, value) => {
    if (el.value === value) return;
    el.dispatchEvent(new FocusEvent("focus"));
    el.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new FocusEvent("blur"));
    el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  };
  const truthy = (v) => /^(true|1|yes|是|y|on|checked)$/i.test(String(v).trim());

  // The options of a popup that a combobox opened: its own list when it names one, else whatever
  // options just appeared (popups are often portalled to the end of the body).
  function popupOptions(trigger, before) {
    const list = trigger.getAttribute("aria-controls") && document.getElementById(trigger.getAttribute("aria-controls"));
    const all = [...(list || document).querySelectorAll("[role=option]")].filter(visible);
    return list ? all : all.filter((o) => !before.has(o));
  }

  async function chooseFromPopup(trigger, value) {
    const before = new Set(document.querySelectorAll("[role=option]"));
    const open = () => trigger.getAttribute("aria-expanded") === "true" || popupOptions(trigger, before).length > 0;
    // Libraries open on different events: pointer down (Radix, Base UI), click (Headless UI), keys.
    trigger.focus();
    press(trigger, ["down"]);
    if (!(await waitFor(open, 300))) { press(trigger, ["up"]); await waitFor(open, 300); }
    if (!open()) { key(trigger, "ArrowDown"); await waitFor(open, 300); }
    if (!open()) { key(trigger, "Enter"); await waitFor(open, 300); }
    const options = await waitFor(() => { const o = popupOptions(trigger, before); return o.length ? o : null; }, 1500);
    if (!options) return false;
    const hit = pick(options.map((el) => ({ el, text: el.innerText || el.getAttribute("aria-label"), value: el.getAttribute("data-value") || "" })), value);
    if (!hit) { key(trigger, "Escape"); return false; }
    hit.el.scrollIntoView({ block: "nearest" });
    press(hit.el);
    await waitFor(() => trigger.getAttribute("aria-expanded") !== "true", 500);
    if (trigger.getAttribute("aria-expanded") === "true") key(trigger, "Escape");
    return true;
  }

  async function put(f, value) {
    const el = f.el;
    switch (f.kind) {
      case "text": setNative(el, value); return true;
      case "select": {
        // A dependent list (city after country) fills in after the field before it changed.
        const o = await waitFor(() => pick(optionsOf(f), value), 2000);
        if (!o) return false;
        setNative(el, o.value);
        return true;
      }
      case "checkbox": {
        const want = truthy(value);
        if ((valueOf(f) === "true") !== want) { el.tagName === "INPUT" ? el.click() : press(el); }
        await waitFor(() => (valueOf(f) === "true") === want, 300);
        return (valueOf(f) === "true") === want;
      }
      case "radio": {
        const o = pick(optionsOf(f), value);
        if (!o) return false;
        if (!(o.el.checked || o.el.getAttribute("aria-checked") === "true")) o.el.tagName === "INPUT" ? o.el.click() : press(o.el);
        return true;
      }
      case "listbox": { const o = pick(optionsOf(f), value); if (!o) return false; press(o.el); return true; }
      case "combobox": {
        const now = norm(valueOf(f)), want = norm(value);
        if (now && (now === want || norm(el.innerText) === want)) return true;
        return chooseFromPopup(el, value);
      }
      case "autocomplete": {
        setNative(el, value);
        // Take a suggestion that matches when the list offers one; otherwise keep the typed text.
        const before = new Set();
        const options = await waitFor(() => { const o = popupOptions(el, before); return o.length ? o : null; }, 800);
        const hit = options && pick(options.map((o) => ({ el: o, text: o.innerText, value: "" })), value);
        if (hit && norm(hit.text) === norm(value)) press(hit.el);
        return true;
      }
      case "richtext": {
        if (el.innerText.trim() === value.trim()) return true;
        el.focus();
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
        // insertText goes through the editor's own input handling (ProseMirror, Lexical, Quill).
        if (!document.execCommand("insertText", false, value)) { el.textContent = value; el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value })); }
        return true;
      }
    }
    return false;
  }

  /** Puts values into the page's fields; the person reviews and submits the page themselves. */
  async function fill(items, sites) {
    // Checked here, in the same script that fills, so the page cannot change in between.
    const host = location.hostname;
    if (sites && sites.length && !sites.some((s) => host === s || host.endsWith(`.${s}`))) return { refused: true, host };
    const fields = collect();
    const find = (item) => {
      // Only fields a person can see and review: never hidden, password or file inputs. A key that
      // points at a widget's hidden input (input[name=…]) means the widget.
      let el = null;
      el = resolve(item.field);
      // A bare name or id, as legacy pages expose them (ASP.NET ctl00$Main$txtTitle).
      if (!el && item.field) el = document.getElementsByName(item.field)[0] || document.getElementById(item.field);
      if (el) {
        const f = fields.find((x) => x.el === el || x.bound === el || (x.radios && x.radios.includes(el)) || x.el.contains(el));
        if (f) return f;
      }
      const want = norm(item.label);
      return want ? fields.find((x) => norm(x.label) === want) || fields.find((x) => norm(x.label).includes(want)) : null;
    };
    const filled = [], missing = [];
    for (const item of items) {
      // An empty value never overwrites what is already in the page.
      if (String(item.value ?? "").trim() === "") continue;
      const f = find(item);
      if (!f || !(await put(f, String(item.value)).catch(() => false))) { missing.push(item.field); continue; }
      f.el.style.outline = "2px solid #c8442f";
      f.el.style.outlineOffset = "1px";
      filled.push(item.field);
    }
    return { filled, missing, host };
  }

  return { capture, fill };
})();
