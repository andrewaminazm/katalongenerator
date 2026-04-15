/* Plain JS — loaded as string for page.evaluate (must not be processed by TS).
   Must be an expression that evaluates to the array (IIFE). A bare `() => {}`
   returns a Function to Node, which serializes as undefined → .map crash. */
(() => {
  const out = [];

  function visible(el) {
    if (!el || el.nodeType !== 1) return false;
    const st = window.getComputedStyle(el);
    if (st.visibility === "hidden" || st.display === "none" || st.opacity === "0") return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    if (el instanceof HTMLInputElement && el.type === "hidden") return false;
    return true;
  }

  function isTinyTrackingImage(tag, r, src, alt) {
    if (tag !== "img") return false;
    if (r.width >= 16 && r.height >= 16) return false;
    const s = String(src || "").toLowerCase();
    const a = String(alt || "").toLowerCase();
    if (s.includes("pixel") || s.includes("track") || s.includes("beacon")) return true;
    if (!a && (r.width <= 2 || r.height <= 2)) return true;
    return false;
  }

  function trimText(s, max) {
    max = max || 80;
    var t = s.replace(/\s+/g, " ").trim();
    return t.length > max ? t.slice(0, max) + "..." : t;
  }

  function escapeAttr(s) {
    return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function escapeXpathAttr(s) {
    // Used only inside double quotes in XPath attr tests.
    return escapeAttr(String(s || "").trim());
  }

  function safeFirstClassToken(cls) {
    var t = String(cls || "")
      .trim()
      .split(/\s+/)
      .filter(function (c) {
        return c && !c.startsWith("ng-") && c.length < 40;
      })[0];
    if (!t) return null;
    if (/^(css-|sc-|_)/i.test(t)) return null;
    if (/[0-9]{4,}/.test(t)) return null;
    if (!/^[a-zA-Z_-][\w-]*$/.test(t)) return null;
    return t;
  }

  function buildSelector(el) {
    var idAttr = el.getAttribute("id");
    if (idAttr && String(idAttr).trim()) {
      return "#" + CSS.escape(String(idAttr).trim());
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
    // Images / logos / icons
    if (tag === "img") {
      var alt = (el.getAttribute("alt") || "").trim();
      if (alt) {
        return 'xpath=//img[@alt="' + escapeXpathAttr(alt) + '"]';
      }
      var aria = (el.getAttribute("aria-label") || "").trim();
      if (aria) {
        return 'xpath=//img[@aria-label="' + escapeXpathAttr(aria) + '"]';
      }
      var title = (el.getAttribute("title") || "").trim();
      if (title) {
        return 'xpath=//img[@title="' + escapeXpathAttr(title) + '"]';
      }
      var src = (el.getAttribute("src") || "").trim();
      if (src) {
        var base = src.split("?")[0];
        var part = base.split("/").pop() || base;
        part = part.replace(/\.(png|jpg|jpeg|gif|webp|svg)$/i, "");
        part = part.slice(0, 60);
        if (part.length >= 3) {
          return 'xpath=//img[contains(@src,"' + escapeXpathAttr(part) + '")]';
        }
        return 'xpath=//img[contains(@src,"' + escapeXpathAttr(base.slice(0, 80)) + '")]';
      }
    }
    if (tag === "svg") {
      var a2 = (el.getAttribute("aria-label") || "").trim();
      if (a2) {
        return 'xpath=//*[name()="svg" and @aria-label="' + escapeXpathAttr(a2) + '"]';
      }
      var c2 = safeFirstClassToken(el.getAttribute("class") || "");
      if (c2) {
        return 'xpath=//*[name()="svg" and contains(@class,"' + escapeXpathAttr(c2) + '")]';
      }
      return 'xpath=//*[name()="svg"]';
    }

    var ph = el.getAttribute("placeholder");
    ph = ph ? ph.trim() : "";
    if ((tag === "input" || tag === "textarea") && ph) {
      return "xpath=//" + tag + '[@placeholder="' + escapeAttr(ph) + '"]';
    }

    var role = (el.getAttribute("role") || "").toLowerCase();
    var useTextXpath =
      tag === "button" ||
      tag === "a" ||
      tag === "label" ||
      tag === "summary" ||
      role === "button" ||
      role === "link";

    if (useTextXpath) {
      var rawTxt = (el.innerText || "").replace(/\s+/g, " ").trim();
      if (rawTxt.length > 0) {
        var useContains = rawTxt.length > 280;
        var chunk = useContains ? rawTxt.slice(0, 120) : rawTxt.slice(0, 280);
        var safe = escapeAttr(chunk);
        if (safe.length > 0 && safe.length <= 500) {
          if (role === "button" && tag !== "button") {
            return useContains
              ? 'xpath=//*[@role="button" and contains(normalize-space(.),"' + safe + '")]'
              : 'xpath=//*[@role="button" and normalize-space()="' + safe + '"]';
          }
          if (role === "link" && tag !== "a") {
            return useContains
              ? 'xpath=//*[@role="link" and contains(normalize-space(.),"' + safe + '")]'
              : 'xpath=//*[@role="link" and normalize-space()="' + safe + '"]';
          }
          return useContains
            ? "xpath=//" + tag + '[contains(normalize-space(.),"' + safe + '")]'
            : "xpath=//" + tag + '[normalize-space()="' + safe + '"]';
        }
      }
    }

    // Background-image: prefer inline style (stable-ish) then stable class.
    var st = window.getComputedStyle(el);
    var bg = (st && st.backgroundImage) || "";
    if (bg && bg !== "none") {
      var styleAttr = (el.getAttribute("style") || "").toLowerCase();
      if (styleAttr.indexOf("background-image") >= 0) {
        return 'xpath=//*[contains(@style,"background-image")]';
      }
      var bgCls = safeFirstClassToken(el.getAttribute("class") || "");
      if (bgCls) return tag + "." + CSS.escape(bgCls);
    }

    var cls = safeFirstClassToken(el.getAttribute("class") || "");
    if (cls) return tag + "." + CSS.escape(cls);
    return null;
  }

  function humanName(el, type, text) {
    var alt = el.getAttribute("alt");
    alt = alt ? alt.trim() : "";
    var placeholder = el.getAttribute("placeholder");
    placeholder = placeholder ? placeholder.trim() : "";
    var aria = el.getAttribute("aria-label");
    aria = aria ? aria.trim() : "";
    var title = el.getAttribute("title");
    title = title ? title.trim() : "";
    var src = el.getAttribute("src");
    src = src ? src.trim() : "";
    var nm = el.getAttribute("name");
    nm = nm ? nm.trim() : "";
    var id = el.id ? el.id.trim() : "";
    var cls = (el.getAttribute("class") || "").trim();
    var isLogo = /logo/i.test(id) || /logo/i.test(cls);
    var base =
      text ||
      alt ||
      placeholder ||
      aria ||
      title ||
      nm ||
      id ||
      type + "_" + (out.length + 1);
    // Keep Arabic (and common RTL) letters — old regex stripped \u0600-\u06FF and broke human-readable names.
    var cleaned = base
      .replace(/[^\w\s\u0600-\u06FF-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^#+|#+$/g, "")
      .trim()
      .slice(0, 100);
    var prefix = "";
    if (type === "icon") prefix = "Icon ";
    else if (type === "logo" || isLogo) prefix = "Logo ";
    else if (type === "image") prefix = "Image ";
    else if (type === "bgimage") prefix = "Background ";
    return (prefix + (cleaned || type + "_" + (out.length + 1))).trim();
  }

  function mapType(el) {
    var t = el.tagName.toLowerCase();
    var r = (el.getAttribute("role") || "").toLowerCase();
    var cls = (el.getAttribute("class") || "").toLowerCase();
    var id = (el.getAttribute("id") || "").toLowerCase();
    var st = window.getComputedStyle(el);
    var bg = (st && st.backgroundImage) || "";
    if (t === "img" || r === "img") {
      if (cls.indexOf("logo") >= 0 || id.indexOf("logo") >= 0) return "logo";
      return "image";
    }
    if (t === "svg") {
      if (cls.indexOf("logo") >= 0 || id.indexOf("logo") >= 0) return "logo";
      return "icon";
    }
    if (bg && bg !== "none") {
      if (cls.indexOf("logo") >= 0 || id.indexOf("logo") >= 0) return "logo";
      return "bgimage";
    }
    if (r === "button") return "button";
    if (r === "link") return "link";
    if (t === "button") return "button";
    if (t === "a") return "link";
    if (t === "input" || t === "textarea" || t === "select") return "input";
    if (t === "label") return "input";
    if (t === "summary") return "button";
    return "unknown";
  }

  var nodes = document.querySelectorAll(
    'button, input, textarea, select, a, [role="button"], [role="link"], label, summary, img, [role="img"], svg, [style*="background-image"], [class*="logo" i], [id*="logo" i]'
  );
  nodes.forEach(function (el) {
    if (!visible(el)) return;
    var tag = el.tagName.toLowerCase();
    var text = trimText(el.innerText || "", 120);
    var type = mapType(el);
    var r = el.getBoundingClientRect();

    if (isTinyTrackingImage(tag, r, el.getAttribute("src"), el.getAttribute("alt"))) return;

    var hasSignal =
      Boolean(el.id) ||
      Boolean(el.getAttribute("data-testid")) ||
      Boolean(el.getAttribute("name")) ||
      text.length > 0 ||
      Boolean((el.getAttribute("alt") || "").trim()) ||
      Boolean((el.getAttribute("src") || "").trim()) ||
      Boolean((el.getAttribute("style") || "").toLowerCase().indexOf("background-image") >= 0) ||
      Boolean(el.getAttribute("placeholder")) ||
      Boolean(el.getAttribute("aria-label")) ||
      Boolean((el.getAttribute("class") || "").trim());

    if (!hasSignal) return;

    var selector = buildSelector(el);
    if (!selector) return;

    var name = humanName(el, type, text);
    out.push({
      name: name,
      selector: selector,
      type: type,
      text: text || undefined,
      tag: tag,
      src: (el.getAttribute("src") || "").trim() || undefined,
      alt: (el.getAttribute("alt") || "").trim() || undefined,
      title: (el.getAttribute("title") || "").trim() || undefined,
      ariaLabel: (el.getAttribute("aria-label") || "").trim() || undefined,
      className: (el.getAttribute("class") || "").trim() || undefined,
      id: (el.getAttribute("id") || "").trim() || undefined,
      boundingBox: { x: r.x, y: r.y, width: r.width, height: r.height },
    });
  });

  return out;
})();
