/* Injected into every frame — plain JS. Raw capture only: no filtering of "weak" selectors. */
(function () {
  if (window.__PW_RECORDER_INSTALLED) return;
  window.__PW_RECORDER_INSTALLED = true;

  function escapeAttr(s) {
    return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  /** Last-resort XPath so we never drop an element for lack of a nicer selector. */
  function xpathForElement(el) {
    if (!el || el.nodeType !== 1) return "xpath=//*";
    if (el === document.documentElement) return "xpath=/html";
    var parts = [];
    for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
      var tag = n.tagName.toLowerCase();
      if (tag === "html") {
        parts.unshift("html");
        break;
      }
      var p = n.parentElement;
      if (!p) break;
      var ch = p.children;
      var ix = 0;
      for (var i = 0; i < ch.length; i++) {
        if (ch[i] === n) {
          var same = 0;
          for (var j = 0; j <= i; j++) {
            if (ch[j].tagName === n.tagName) same++;
          }
          parts.unshift(tag + "[" + same + "]");
          break;
        }
      }
    }
    return "xpath=/" + parts.join("/");
  }

  function buildSelector(el) {
    if (!el || el.nodeType !== 1) return xpathForElement(el);
    try {
      if (typeof CSS !== "undefined" && CSS.escape) {
        if (el.id && /^[A-Za-z][\w-:.]*$/.test(el.id)) return "#" + CSS.escape(el.id);
      } else if (el.id && /^[A-Za-z][\w-:.]*$/.test(el.id)) {
        return "#" + String(el.id).replace(/([^a-zA-Z0-9_-])/g, "\\$1");
      }
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
        var t = (el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 120);
        if (t) return "xpath=//" + tag + '[normalize-space()="' + escapeAttr(t) + '"]';
      }
      var cls = (el.getAttribute("class") || "").trim().split(/\s+/).filter(Boolean)[0];
      if (cls && typeof CSS !== "undefined" && CSS.escape) {
        return tag + "." + CSS.escape(cls);
      }
      if (cls && /^[a-zA-Z_-][\w-]*$/.test(cls)) {
        return tag + "." + cls.replace(/([^a-zA-Z0-9_-])/g, "\\$1");
      }
    } catch (e) {}
    return xpathForElement(el);
  }

  function labelFor(el) {
    if (!el || el.nodeType !== 1) return "element";
    var tag = el.tagName ? el.tagName.toUpperCase() : "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
      var al = el.getAttribute("aria-label");
      if (al && al.trim()) return al.trim().replace(/\s+/g, " ").slice(0, 120);
      var ph = el.getAttribute("placeholder");
      if (ph && ph.trim()) return ph.trim().replace(/\s+/g, " ").slice(0, 120);
      var nm = el.getAttribute("name");
      if (nm && nm.trim()) return nm.trim().replace(/\s+/g, " ").slice(0, 120);
      var ttl = el.getAttribute("title");
      if (ttl && ttl.trim()) return ttl.trim().replace(/\s+/g, " ").slice(0, 120);
      if (el.id && el.id.trim()) return el.id.trim().slice(0, 120);
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
    return t.replace(/\s+/g, " ").trim().slice(0, 120) || "element";
  }

  function send(ev) {
    if (window.__pwRecorderEvent) {
      window.__pwRecorderEvent(ev);
    }
  }

  function reportPageUrl() {
    try {
      if (window.__pwRecorderUrl) {
        Promise.resolve(window.__pwRecorderUrl(String(location.href))).catch(function () {});
      }
    } catch (e) {}
  }

  function recordNavigate(reason) {
    send({
      type: "navigate",
      selector: "",
      url: String(location.href),
      pageUrl: String(location.href),
      timestamp: Date.now(),
      reason: reason || "navigate",
    });
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
      recordNavigate("pushState");
      return r;
    };
    history.replaceState = function () {
      var r = origReplace.apply(this, arguments);
      reportPageUrl();
      recordNavigate("replaceState");
      return r;
    };
    window.addEventListener("popstate", function () {
      reportPageUrl();
      recordNavigate("popstate");
    });
    window.addEventListener("hashchange", function () {
      reportPageUrl();
      recordNavigate("hashchange");
    });
  }

  function onClick(ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    if (t.closest("#__pwRecorderFinishBtn")) return;
    var el = t.nodeType === 1 ? t : t.parentElement;
    if (!el) return;
    var sel = buildSelector(el);
    send({
      type: "click",
      selector: sel,
      tag: el.tagName,
      text: labelFor(el),
      pageUrl: String(location.href),
      timestamp: Date.now(),
    });
  }

  function onChange(ev) {
    var el = ev.target;
    if (!el || el.nodeType !== 1) return;
    if (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA" && el.tagName !== "SELECT") return;
    if (el.closest && el.closest("#__pwRecorderFinishBtn")) return;
    var sel = buildSelector(el);
    var val = el.type === "password" ? "***" : el.value != null ? String(el.value) : "";
    send({
      type: "change",
      selector: sel,
      value: val,
      tag: el.tagName,
      text: labelFor(el),
      pageUrl: String(location.href),
      timestamp: Date.now(),
    });
  }

  function boot() {
    installUi();
    patchHistory();
    document.addEventListener("click", onClick, true);
    document.addEventListener("change", onChange, true);
    reportPageUrl();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
