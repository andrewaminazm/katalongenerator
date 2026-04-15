/* Plain JS for page.evaluate — no TS/esbuild (avoids __name in browser). */
(() => {
  function norm(s) {
    return String(s || "").replace(/\s+/g, " ").trim();
  }
  function visible(el) {
    if (!el || el.nodeType !== 1) return false;
    var st = window.getComputedStyle(el);
    if (st.visibility === "hidden" || st.display === "none" || st.opacity === "0") return false;
    var r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    if (el.tagName === "INPUT" && el.type === "hidden") return false;
    return true;
  }
  function labelForControl(el) {
    var ls = el.labels;
    if (ls && ls.length > 0) {
      var t = norm(ls[0].innerText || "");
      if (t.length > 0 && t.length < 200) return t;
    }
    return null;
  }
  var out = [];
  var seen = new Set();
  var selectors =
    'h1,h2,h3,h4,h5,h6,button,a[href],input,select,textarea,[role="button"],[role="link"],[role="menuitem"],[role="tab"],label,img,[role="img"],svg,[style*="background-image"],[class*="logo" i],[id*="logo" i]';
  document.querySelectorAll(selectors).forEach(function (el) {
    if (seen.has(el)) return;
    if (!visible(el)) return;
    seen.add(el);
    var tag = el.tagName.toLowerCase();
    var type = (el.getAttribute("type") || "").toLowerCase();
    var id = (el.id && el.id.trim()) || null;
    var testId = (el.getAttribute("data-testid") || "").trim() || null;
    var nameAttr = (el.getAttribute("name") || "").trim() || null;
    var placeholder = (el.getAttribute("placeholder") || "").trim() || null;
    var ariaLabel = (el.getAttribute("aria-label") || "").trim() || null;
    var title = (el.getAttribute("title") || "").trim() || null;
    var alt = (el.getAttribute("alt") || "").trim() || null;
    var src = (el.getAttribute("src") || "").trim() || null;
    var className = (el.getAttribute("class") || "").trim() || null;
    var bg = null;
    try {
      var st2 = window.getComputedStyle(el);
      var bg2 = (st2 && st2.backgroundImage) || "";
      if (bg2 && bg2 !== "none") bg = String(bg2);
    } catch (e) {
      bg = null;
    }
    var text = norm(el.innerText || "").slice(0, 300);
    var roleAttr = (el.getAttribute("role") || "").trim().toLowerCase() || null;
    var headingLevel = null;
    if (/^h[1-6]$/.test(tag)) headingLevel = parseInt(tag[1], 10);
    var labelText = null;
    if (tag === "input" || tag === "select" || tag === "textarea") labelText = labelForControl(el);
    out.push({
      tag: tag,
      type: type,
      id: id,
      testId: testId,
      nameAttr: nameAttr,
      placeholder: placeholder,
      ariaLabel: ariaLabel,
      title: title,
      alt: alt,
      src: src,
      className: className,
      backgroundImage: bg,
      text: text,
      labelText: labelText,
      roleAttr: roleAttr,
      headingLevel: headingLevel,
    });
  });
  return out;
})();
