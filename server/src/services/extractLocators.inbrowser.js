/* Plain JS — loaded as string for page.evaluate (must not be processed by TS). */
() => {
  const out = [];

  function visible(el) {
    if (!(el instanceof HTMLElement)) return false;
    const st = window.getComputedStyle(el);
    if (st.visibility === "hidden" || st.display === "none" || st.opacity === "0") return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    if (el instanceof HTMLInputElement && el.type === "hidden") return false;
    return true;
  }

  function trimText(s, max) {
    max = max || 80;
    var t = s.replace(/\s+/g, " ").trim();
    return t.length > max ? t.slice(0, max) + "..." : t;
  }

  function escapeAttr(s) {
    return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function buildSelector(el) {
    if (el.id && /^[A-Za-z][\w-:.]*$/.test(el.id)) {
      return "#" + CSS.escape(el.id);
    }
    var testId = el.getAttribute("data-testid");
    if (testId && testId.trim()) {
      return '[data-testid="' + escapeAttr(testId.trim()) + '"]';
    }
    var name = el.getAttribute("name");
    if (name && name.trim()) {
      return '[name="' + escapeAttr(name.trim()) + '"]';
    }

    var tag = el.tagName.toLowerCase();
    var ph = el.getAttribute("placeholder");
    ph = ph ? ph.trim() : "";
    if ((tag === "input" || tag === "textarea") && ph) {
      return "xpath=//" + tag + '[@placeholder="' + escapeAttr(ph) + '"]';
    }

    if (tag === "button" || tag === "a") {
      var txt = trimText(el.innerText || "", 60);
      if (txt.length > 0) {
        var safe = txt.replace(/"/g, '\\"');
        if (safe.length <= 80) {
          return "xpath=//" + tag + '[normalize-space()="' + safe + '"]';
        }
      }
    }

    var cls = (el.getAttribute("class") || "")
      .trim()
      .split(/\s+/)
      .filter(function (c) {
        return c && !c.startsWith("ng-") && c.length < 40;
      })[0];
    if (cls && /^[a-zA-Z_-][\w-]*$/.test(cls)) {
      return tag + "." + CSS.escape(cls);
    }
    return null;
  }

  function humanName(el, type, text) {
    var placeholder = el.getAttribute("placeholder");
    placeholder = placeholder ? placeholder.trim() : "";
    var aria = el.getAttribute("aria-label");
    aria = aria ? aria.trim() : "";
    var title = el.getAttribute("title");
    title = title ? title.trim() : "";
    var nm = el.getAttribute("name");
    nm = nm ? nm.trim() : "";
    var id = el.id ? el.id.trim() : "";
    var base =
      text ||
      placeholder ||
      aria ||
      title ||
      nm ||
      id ||
      type + "_" + (out.length + 1);
    var cleaned = base
      .replace(/[^\w\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60);
    return cleaned || type + "_" + (out.length + 1);
  }

  function mapType(tag) {
    var t = tag.toLowerCase();
    if (t === "button") return "button";
    if (t === "a") return "link";
    if (t === "input" || t === "textarea" || t === "select") return "input";
    return "unknown";
  }

  var nodes = document.querySelectorAll("button, input, a[href], textarea, select");
  nodes.forEach(function (el) {
    if (!visible(el)) return;
    var tag = el.tagName.toLowerCase();
    var text = trimText(el.innerText || "", 80);
    var type = mapType(tag);

    var hasSignal =
      Boolean(el.id) ||
      Boolean(el.getAttribute("data-testid")) ||
      Boolean(el.getAttribute("name")) ||
      text.length > 0 ||
      Boolean(el.getAttribute("placeholder")) ||
      Boolean(el.getAttribute("aria-label")) ||
      Boolean((el.getAttribute("class") || "").trim());

    if (!hasSignal) return;

    var selector = buildSelector(el);
    if (!selector) return;

    var name = humanName(el, type, text);
    out.push({ name: name, selector: selector, type: type, text: text || undefined });
  });

  return out;
}
