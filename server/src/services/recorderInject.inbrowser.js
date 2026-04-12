/* Injected into every frame — plain JS. Calls Playwright-exposed __pwRecorderEvent / __pwRecorderFinish / __pwRecorderUrl. */
(function () {
  if (window.__PW_RECORDER_INSTALLED) return;
  window.__PW_RECORDER_INSTALLED = true;

  function escapeAttr(s) {
    return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function buildSelector(el) {
    if (!el || el.nodeType !== 1) return null;
    if (el.id && /^[A-Za-z][\w-:.]*$/.test(el.id)) return "#" + CSS.escape(el.id);
    var testId = el.getAttribute("data-testid");
    if (testId && testId.trim()) return '[data-testid="' + escapeAttr(testId.trim()) + '"]';
    var name = el.getAttribute("name");
    if (name && name.trim()) return '[name="' + escapeAttr(name.trim()) + '"]';
    var tag = el.tagName ? el.tagName.toLowerCase() : "div";
    var ph = el.getAttribute("placeholder");
    if ((tag === "input" || tag === "textarea") && ph && ph.trim()) {
      return "xpath=//" + tag + '[@placeholder="' + escapeAttr(ph.trim()) + '"]';
    }
    if (tag === "button" || tag === "a") {
      var t = (el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 60);
      if (t) return "xpath=//" + tag + '[normalize-space()="' + t.replace(/"/g, '\\"') + '"]';
    }
    var cls = (el.getAttribute("class") || "")
      .trim()
      .split(/\s+/)
      .filter(function (c) {
        return c && c.indexOf("ng-") !== 0 && c.length < 40;
      })[0];
    if (cls && /^[a-zA-Z_-][\w-]*$/.test(cls)) return tag + "." + CSS.escape(cls);
    return null;
  }

  function labelFor(el) {
    if (!el || el.nodeType !== 1) return "element";
    var tag = el.tagName ? el.tagName.toUpperCase() : "";
    /** Prefer stable attributes — innerText on inputs/comboboxes (e.g. Google) often pulls sibling UI or ids. */
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
      var al = el.getAttribute("aria-label");
      if (al && al.trim()) return al.trim().replace(/\s+/g, " ").slice(0, 50);
      var ph = el.getAttribute("placeholder");
      if (ph && ph.trim()) return ph.trim().replace(/\s+/g, " ").slice(0, 50);
      var nm = el.getAttribute("name");
      if (nm && nm.trim()) return nm.trim().replace(/\s+/g, " ").slice(0, 50);
      var ttl = el.getAttribute("title");
      if (ttl && ttl.trim()) return ttl.trim().replace(/\s+/g, " ").slice(0, 50);
      if (el.id && el.id.trim()) return el.id.trim().slice(0, 50);
      return tag === "TEXTAREA" ? "text area" : "field";
    }
    var t = (
      el.innerText ||
      el.getAttribute("aria-label") ||
      el.getAttribute("placeholder") ||
      el.getAttribute("name") ||
      el.id ||
      el.tagName ||
      "element"
    ).toString();
    return t.replace(/\s+/g, " ").trim().slice(0, 50) || "element";
  }

  function reportPageUrl() {
    try {
      if (window.__pwRecorderUrl) {
        Promise.resolve(window.__pwRecorderUrl(String(location.href))).catch(function () {});
      }
    } catch (e) {}
  }

  function installUi() {
    if (document.getElementById("__pwRecorderFinishBtn")) return;
    var btn = document.createElement("button");
    btn.id = "__pwRecorderFinishBtn";
    btn.type = "button";
    btn.textContent = "Finish recording";
    btn.setAttribute("aria-label", "Finish recording");
    btn.style.cssText =
      "position:fixed;bottom:20px;right:20px;z-index:2147483647;padding:12px 18px;font-size:15px;font-weight:600;cursor:pointer;border-radius:8px;border:2px solid #0d6e6e;background:#fff;color:#0d6e6e;box-shadow:0 4px 12px rgba(0,0,0,.2);";
    btn.addEventListener(
      "click",
      function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (window.__pwRecorderFinish) {
          Promise.resolve(window.__pwRecorderFinish()).catch(function () {});
        }
      },
      true
    );
    (document.body || document.documentElement).appendChild(btn);
  }

  function patchHistory() {
    if (window.__PW_HISTORY_PATCHED) return;
    window.__PW_HISTORY_PATCHED = true;
    var origPush = history.pushState;
    var origReplace = history.replaceState;
    history.pushState = function () {
      var r = origPush.apply(this, arguments);
      reportPageUrl();
      return r;
    };
    history.replaceState = function () {
      var r = origReplace.apply(this, arguments);
      reportPageUrl();
      return r;
    };
    window.addEventListener("popstate", reportPageUrl);
    window.addEventListener("hashchange", reportPageUrl);
  }

  function onClick(ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    if (t.closest("#__pwRecorderFinishBtn")) return;
    var el = t.nodeType === 1 ? t : t.parentElement;
    if (!el) return;
    var sel = buildSelector(el);
    if (!sel) return;
    if (window.__pwRecorderEvent) {
      window.__pwRecorderEvent({
        type: "click",
        selector: sel,
        tag: el.tagName,
        text: labelFor(el),
      });
    }
  }

  /** Record committed field value when focus leaves — not on every keystroke. */
  function onFocusOut(ev) {
    var el = ev.target;
    if (!el || el.nodeType !== 1) return;
    if (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA" && el.tagName !== "SELECT") return;
    if (el.closest && el.closest("#__pwRecorderFinishBtn")) return;
    var sel = buildSelector(el);
    if (!sel) return;
    var val = el.type === "password" ? "***" : el.value != null ? String(el.value) : "";
    if (window.__pwRecorderEvent) {
      window.__pwRecorderEvent({
        type: "fill",
        selector: sel,
        value: val,
        tag: el.tagName,
        text: labelFor(el),
      });
    }
  }

  function boot() {
    installUi();
    patchHistory();
    document.addEventListener("click", onClick, true);
    document.addEventListener("focusout", onFocusOut, true);
    reportPageUrl();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
