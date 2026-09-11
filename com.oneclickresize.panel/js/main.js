(function () {
  var cs = new CSInterface();

  function evalAsync(script, cb) { cs.evalScript(script, cb); }

  // Pure display formatting only — the ratio itself is decided by ExtendScript's
  // detectRatio and arrives on info.ratio. No ratio classification lives here.
  var RATIO_DISPLAY = { "9-16": "9 : 16", "4-5": "4 : 5", "1-1": "1 : 1", "2-3": "2 : 3" };

  function setStatus(message) {
    var el = document.getElementById("status-msg");
    if (el) { el.textContent = message || ""; }
  }

  // The panel's ScriptPath can load lazily; make sure the jsx layer is present
  // before calling into it (also lets the updater hot-reload a fresh jsx).
  // Cached after the first success so the realtime poll costs one evalScript.
  var jsxReady = false;
  function ensureJsx(cb) {
    if (jsxReady) { cb(); return; }
    evalAsync("typeof RSZ_activeSequenceInfo", function (t) {
      if (t === "function") { jsxReady = true; cb(); return; }
      var p = cs.getSystemPath(SystemPath.EXTENSION) + "/jsx/premiere.jsx";
      evalAsync('$.evalFile("' + p.replace(/"/g, '\\"') + '")', function () { jsxReady = true; cb(); });
    });
  }

  // ENGINE pill: can the panel actually talk to Premiere's script engine?
  // Green once RSZ_activeSequenceInfo answers with parseable data; red when
  // evalScript fails (jsx not loaded / "EvalScript error."). The realtime
  // poll keeps this self-healing.
  function paintEngine(ok) {
    var pill = document.getElementById("pill-engine");
    if (!pill) { return; }
    pill.className = ok ? "pill ok" : "pill rec";
    pill.innerHTML = '<span class="dot"></span>' + (ok ? "ENGINE OK" : "ENGINE ERR");
    pill.title = ok ? "Đã kết nối script engine của Premiere"
                    : "Không nói chuyện được với Premiere — thử tắt/bật lại panel";
  }

  // Header pill = selection state. A sequence selected in the Project panel →
  // green + its name (so you never resize the wrong one). Nothing selected, or
  // another kind of object clicked → red + "Chưa chọn Sequence".
  function paintSequenceState(info) {
    var pill = document.getElementById("pill-seq");
    if (pill) {
      var selected = !!(info && info.from === "selection");
      pill.className = selected ? "pill ok" : "pill rec";
      pill.innerHTML = '<span class="dot"></span><span class="pill-label"></span>';
      var label = pill.querySelector(".pill-label");
      if (selected && info.count > 1) {
        // Batch: the Project panel already highlights which ones, so just say
        // how many will be processed.
        label.textContent = info.count + " sequence đã chọn";
        pill.title = "Sẽ resize cả " + info.count + " sequence đang chọn";
      } else if (selected) {
        var nm = info.name || "Sequence";
        label.textContent = nm.length > 26 ? (nm.substring(0, 25) + "…") : nm;
        pill.title = nm; // full name on hover
      } else {
        label.textContent = "Chưa chọn Sequence";
        pill.title = "Hãy click chọn một sequence ở Project panel rồi bấm RESIZE";
      }
    }
    var rb = document.querySelector(".ratiobox");
    if (rb) {
      // Draw the real aspect rather than one of three canned shapes, so an
      // unusual sequence still looks like itself.
      var known = !!(info && info.width > 0 && info.height > 0);
      rb.className = "ratiobox" + (known ? "" : " none");
      if (known) {
        var h = 40, w = Math.round(h * (info.width / info.height));
        rb.style.height = h + "px";
        rb.style.width = Math.max(10, Math.min(64, w)) + "px";
      } else {
        rb.style.width = ""; rb.style.height = "";
      }
    }
  }

  function resetMeta(el) {
    el.querySelector("b").textContent = "—";
    el.querySelector("span").textContent = "chọn hoặc mở một sequence để bắt đầu";
  }

  // force=true (manual ⟳) always repaints; the realtime poll passes false so
  // an unchanged answer costs nothing and never wipes a visible status message.
  var lastSourceRes = null;
  var lastSrcRatios = null;
  var sourceInFlight = false;
  function refreshSource(force) {
    // Skip a poll tick if the previous probe hasn't answered yet — keeps the
    // fast interval from stacking evalScript calls when Premiere is busy.
    if (sourceInFlight && !force) { return; }
    sourceInFlight = true;
    ensureJsx(function () {
      evalAsync("RSZ_activeSequenceInfo()", function (res) {
        sourceInFlight = false;
        if (!force && res === lastSourceRes) { return; }
        lastSourceRes = res;
        var el = document.querySelector(".source .meta");
        var info = null;
        try { info = res && res !== "null" ? JSON.parse(res) : null; }
        catch (e) {
          paintEngine(false);
          resetMeta(el);
          paintSequenceState(null);
          setStatus("Không đọc được thông tin sequence.");
          return;
        }
        paintEngine(true);
        var seen = (info && info.ratios) ? info.ratios.join(",") : "";
        if (seen !== lastSrcRatios) {
          lastSrcRatios = seen;
          window.RSZ_SRC_RATIOS = (info && info.ratios) ? info.ratios : [];
          renderTargets();          // a chip may have just become redundant
        }
        if (info) {
          el.querySelector("b").textContent = info.label || RATIO_DISPLAY[info.ratio] || "—";
          var sizeTxt = info.width + " × " + info.height;
          if (info.count > 1) { sizeTxt += " · +" + (info.count - 1) + " sequence nữa"; }
          el.querySelector("span").textContent = sizeTxt;
          setStatus("");
        } else {
          resetMeta(el);
        }
        paintSequenceState(info);
      });
    });
  }

  // ---- Realtime auto-detect (the AUTO badge is a working toggle) -----------
  // Premiere never emits a usable sequence-changed CSXS event, so poll cheaply:
  // one evalScript per tick, DOM untouched unless the answer actually changed.
  var autoTimer = null;

  function paintAutoBadge() {
    var b = document.getElementById("auto-toggle");
    if (!b) { return; }
    var on = window.RSZ_AUTO;
    b.className = "autobadge" + (on ? "" : " off");
    b.textContent = on ? "AUTO" : "AUTO OFF";
    b.title = on ? "Đang tự nhận diện realtime — bấm để tắt"
                 : "Đã tắt tự nhận diện — bấm để bật (hoặc dùng nút ⟳)";
  }

  var AUTO_POLL_MS = 300; // near-instant selection detection

  function setAuto(on) {
    window.RSZ_AUTO = !!on;
    savePrefs();
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    if (on) {
      autoTimer = setInterval(function () {
        var go = document.getElementById("go");
        if (go && go.disabled) { return; } // don't poll mid-resize
        refreshSource(false);             // skipped if a probe is still in flight
      }, AUTO_POLL_MS);
    }
    paintAutoBadge();
  }

  function renderResults(payload) {
    var outs = document.getElementById("outs");
    outs.innerHTML = "";
    if (!payload.ok) {
      outs.innerHTML = '<p class="hint">' +
        (payload.error === "UNKNOWN_RATIO" ? "ratio nguồn không nằm trong 9:16 / 4:5 / 1:1"
         : payload.error === "NO_ACTIVE_SEQUENCE" ? "chưa chọn hoặc mở sequence nào"
         : "có lỗi xảy ra") + "</p>";
      return;
    }
    var made = 0, failed = 0;
    for (var i = 0; i < payload.results.length; i++) {
      var r = payload.results[i];
      var row = document.createElement("div");
      row.className = "orow show";
      var ok = !r.error;
      if (ok) { made++; } else { failed++; }
      row.innerHTML = '<span class="oico"></span><div class="oinfo"><b></b><span></span></div>' +
        '<span class="ostatus"><span class="dot"></span>' + (ok ? "DONE" : "ERROR") + '</span>';
      row.querySelector(".oinfo b").textContent =
        r.name || r.src || (RATIO_DISPLAY[r.ratio] || r.ratio);
      var sub = RATIO_DISPLAY[r.ratio] || r.ratio || "";
      if (ok && r.moved) { sub += " · đã canh " + r.moved + " lớp"; }
      if (ok && r.bin) { sub += " · bin: " + r.bin; }
      if (!ok) {
        sub = r.error === "UNKNOWN_RATIO"
          ? "bỏ qua — ratio nguồn không nằm trong 9:16 / 4:5 / 1:1"
          : r.error === "NO_TARGET_SELECTED"
          ? "bỏ qua — không còn size nào được tick cho nguồn này"
          : "không tạo được";
        if (r.orphan) { sub += " — bản dở dang: " + r.orphan; }
      }
      row.querySelector(".oinfo span").textContent = sub;
      outs.appendChild(row);
    }
    // Batch summary: how many sources went in, how many sequences came out.
    if (payload.count > 1 || failed) {
      var sum = document.createElement("p");
      sum.className = "hint";
      sum.textContent = (payload.count || 1) + " sequence nguồn · tạo " + made + " bản"
                      + (failed ? " · " + failed + " lỗi/bỏ qua" : "");
      outs.appendChild(sum);
    }
  }

  function setBusy(busy) {
    var f = document.getElementById("foot-status");
    if (f) {
      f.className = "ai" + (busy ? " busy" : "");
      f.innerHTML = '<span class="dot"></span>' + (busy ? "BUSY" : "READY");
    }
  }

  function run() {
    var btn = document.getElementById("go");
    btn.disabled = true;
    setBusy(true);
    var bg = parseInt(window.RSZ_BG_TRACK, 10) || 1;
    var g = window.RSZ_GUIDE || {};
    var mode = window.RSZ_MODE;
    var wanted = tickedTargets(mode);
    // Judge "nothing selected" by the chips the user can actually see: a ticked
    // but hidden ratio only matters to other sequences in a mixed batch.
    var pickable = visibleTargets(mode);
    var anyVisibleTicked = false;
    for (var vi = 0; vi < pickable.length; vi++) {
      for (var wj = 0; wj < wanted.length; wj++) {
        if (wanted[wj] === pickable[vi]) { anyVisibleTicked = true; break; }
      }
      if (anyVisibleTicked) { break; }
    }
    if (!wanted.length || (pickable.length && !anyVisibleTicked)) {
      btn.disabled = false; setBusy(false);
      setStatus("Chưa tick size nào để tạo.");
      return;
    }
    var call = 'RSZ_runResize("' + mode + '","' + wanted.join(",") + '",' + bg + ','
             + gnum(g["9-16"], 0.5) + ',' + gnum(g["4-5"], 0.5) + ','
             + gnum(g["1-1"], 0.5) + ',' + gnum(g["2-3"], 0.5) + ')';
    setStatus("Đang xử lý…");
    ensureJsx(function () {
      evalAsync(call, function (res) {
        btn.disabled = false;
        setBusy(false);
        var payload = null;
        try { payload = JSON.parse(res); }
        catch (e) { setStatus("Không đọc được phản hồi từ Premiere."); return; }
        setStatus("");
        renderResults(payload);
      });
    });
  }

  // What each button can produce; mirrors RSZ.PLATFORM_TARGETS in the jsx layer.
  var MODE_TARGETS = { GG: ["9-16", "4-5", "1-1"], FB: ["9-16", "4-5"], PIN: ["2-3"] };
  var MODE_SUB = {
    GG: "Google · 9:16 / 4:5 / 1:1",
    FB: "Facebook · 9:16 / 4:5",
    PIN: "Pinterest · 2:3"
  };
  var CHIP_LABEL = { "9-16": "9:16", "4-5": "4:5", "1-1": "1:1", "2-3": "2:3" };

  // The ratios the user left ticked for this mode. PIN has a single fixed output,
  // so it ignores the chips entirely. Hidden ratios stay in the list on purpose:
  // in a mixed batch a ratio that is the source for one sequence is still a
  // valid target for another, and the jsx drops it per-sequence anyway.
  function tickedTargets(mode) {
    var all = MODE_TARGETS[mode] || [];
    if (mode === "PIN") { return all.slice(); }
    var on = window.RSZ_RATIOS || {};
    var out = [];
    for (var i = 0; i < all.length; i++) { if (on[all[i]] !== false) { out.push(all[i]); } }
    return out;
  }

  // Offering "9:16" when the selection IS 9:16 is noise, so that chip is hidden —
  // but only when EVERY selected sequence shares the ratio. With a mixed
  // selection each ratio is still a real target for the other sequences.
  function visibleTargets(mode) {
    var all = MODE_TARGETS[mode] || [];
    var src = window.RSZ_SRC_RATIOS || [];
    var out = [];
    for (var i = 0; i < all.length; i++) {
      var redundant = src.length === 1 && src[0] === all[i];
      if (!redundant) { out.push(all[i]); }
    }
    return out;
  }

  // Chips for the current mode. Hidden for PIN (nothing to choose).
  function renderTargets() {
    var box = document.getElementById("targets");
    if (!box) { return; }
    var mode = window.RSZ_MODE;
    if (mode === "PIN") { box.style.display = "none"; box.innerHTML = ""; return; }
    var all = visibleTargets(mode);
    if (!all.length) { box.style.display = "none"; box.innerHTML = ""; return; }
    box.style.display = "flex";
    box.innerHTML = "";
    var on = window.RSZ_RATIOS || {};
    for (var i = 0; i < all.length; i++) {
      (function (key) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "tchip" + (on[key] !== false ? " on" : "");
        b.innerHTML = '<span class="tick">✓</span>' + (CHIP_LABEL[key] || key);
        b.addEventListener("click", function () {
          window.RSZ_RATIOS[key] = (window.RSZ_RATIOS[key] === false);
          savePrefs();
          renderTargets();
          noteSaved();
        });
        box.appendChild(b);
      })(all[i]);
    }
  }

  // Reflect the current mode on the toggle, the chips and the button sub-label.
  function renderMode() {
    var mode = window.RSZ_MODE;
    var ids = { GG: "mode-gg", FB: "mode-fb", PIN: "mode-pin" };
    for (var k in ids) {
      if (!ids.hasOwnProperty(k)) { continue; }
      var el = document.getElementById(ids[k]);
      if (el) { el.className = "seg" + (k === mode ? " active" : ""); }
    }
    var sub = document.querySelector("#go .sub");
    if (sub) { sub.textContent = MODE_SUB[mode] || MODE_SUB.GG; }
    renderTargets();
  }

  function setMode(mode) {
    window.RSZ_MODE = MODE_TARGETS[mode] ? mode : "GG";
    savePrefs();
    renderMode();
  }

  window.initPanel = function () {
    document.getElementById("go").addEventListener("click", run);
    var segIds = { GG: "mode-gg", FB: "mode-fb", PIN: "mode-pin" };
    for (var mk in segIds) {
      if (!segIds.hasOwnProperty(mk)) { continue; }
      (function (m) {
        var el = document.getElementById(segIds[m]);
        if (el) { el.addEventListener("click", function () { setMode(m); }); }
      })(mk);
    }
    initTips();
    var refreshBtn = document.getElementById("refresh");
    if (refreshBtn) { refreshBtn.addEventListener("click", function () { refreshSource(true); }); }
    var autoBtn = document.getElementById("auto-toggle");
    if (autoBtn) { autoBtn.addEventListener("click", function () { setAuto(!window.RSZ_AUTO); }); }
    refreshSource(true);
    // Realtime detection is the poll (AUTO toggle, on by default); the focus
    // listener is a free extra kick when the user clicks into the panel.
    window.addEventListener("focus", function () { refreshSource(false); });
    renderMode();
    setAuto(window.RSZ_AUTO);
  };

  function gnum(v, def) {
    v = parseFloat(v);
    if (isNaN(v)) { return def; }
    return v < 0 ? 0 : (v > 1 ? 1 : v);
  }

  // Every setting lives in ONE persisted store (js/prefs.js writes it to a file
  // outside the panel, so a single save applies to every project and survives
  // Premiere restarts + panel updates).
  var prefsReady = false;

  function loadPrefs() {
    var s = null;
    try { s = window.RSZ_PREFS ? window.RSZ_PREFS.load() : null; } catch (e) {}
    s = s || {};
    var bg = parseInt(s.bgTrack, 10);
    window.RSZ_BG_TRACK = (bg && bg > 0) ? bg : 1;
    var g = s.guide || {};
    window.RSZ_GUIDE = {
      "9-16": gnum(g["9-16"], 0.5),
      "4-5":  gnum(g["4-5"], 0.5),
      "1-1":  gnum(g["1-1"], 0.5),
      "2-3":  gnum(g["2-3"], 0.5)
    };
    window.RSZ_MODE = (s.mode === "PIN" || s.mode === "FB") ? s.mode : "GG";
    window.RSZ_AUTO = s.auto !== false;   // default: on
    // Which target ratios stay ticked. Absent = ticked, so a fresh install keeps
    // the old "make everything" behaviour.
    var r = s.ratios || {};
    window.RSZ_RATIOS = {
      "9-16": r["9-16"] !== false,
      "4-5":  r["4-5"]  !== false,
      "1-1":  r["1-1"]  !== false
    };
    window.RSZ_ACCENT = (window.RSZ_THEME ? window.RSZ_THEME.apply(s.accent) : (s.accent || null));
    prefsReady = true;
  }

  // Called on every change; the guard keeps a pre-load call from overwriting
  // good settings with undefined.
  function savePrefs() {
    if (!prefsReady || !window.RSZ_PREFS) { return false; }
    return window.RSZ_PREFS.save({
      bgTrack: window.RSZ_BG_TRACK,
      guide: window.RSZ_GUIDE,
      mode: window.RSZ_MODE,
      auto: !!window.RSZ_AUTO,
      ratios: window.RSZ_RATIOS,
      accent: window.RSZ_ACCENT
    });
  }

  // Boot: settings first (initPanel paints from them). Must run AFTER the
  // declarations above — `var prefsReady = false` would otherwise re-run and
  // silently disable every later save.
  loadPrefs();
  window.initPanel();

  // Hover notes: any element carrying data-tip floats a shared bubble instead of
  // taking up permanent space under the control (the Flex-style behaviour the
  // editor asked for). Delegated, so chips built at runtime get it for free.
  var tipEl = null, tipFor = null;

  function hideTip() {
    if (tipEl) { tipEl.className = "tipbubble"; }
    tipFor = null;
  }

  function showTip(el) {
    var text = el.getAttribute("data-tip");
    if (!text) { return; }
    if (!tipEl) {
      tipEl = document.createElement("div");
      tipEl.className = "tipbubble";
      document.body.appendChild(tipEl);
    }
    tipFor = el;
    tipEl.textContent = text;
    tipEl.className = "tipbubble show";
    // Measure first, then place: below the control, flipped above when it would
    // fall off the bottom, and clamped to the panel's width.
    var r = el.getBoundingClientRect();
    var b = tipEl.getBoundingClientRect();
    var top = r.bottom + 6;
    if (top + b.height > window.innerHeight - 6) { top = r.top - b.height - 6; }
    var left = r.left + (r.width - b.width) / 2;
    if (left < 6) { left = 6; }
    if (left + b.width > window.innerWidth - 6) { left = window.innerWidth - 6 - b.width; }
    tipEl.style.top = Math.max(6, top) + "px";
    tipEl.style.left = left + "px";
  }

  function initTips() {
    document.addEventListener("mouseover", function (e) {
      var el = e.target;
      while (el && el !== document.body && !el.getAttribute) { el = el.parentNode; }
      while (el && el !== document.body && !el.getAttribute("data-tip")) { el = el.parentNode; }
      if (el && el.getAttribute && el.getAttribute("data-tip")) {
        if (el !== tipFor) { showTip(el); }
      } else { hideTip(); }
    });
    document.addEventListener("mouseleave", hideTip);
    window.addEventListener("blur", hideTip);
  }

  // Settings save silently on change; flash a confirmation so it's obvious the
  // value is now stored for every project (no per-project re-entry).
  var PREFS_NOTE_IDLE = "Cài đặt tự lưu 1 lần — dùng cho MỌI project.";
  var noteTimer = null;

  function noteSaved() {
    var el = document.getElementById("prefs-note");
    if (!el) { return; }
    el.textContent = "✓ Đã lưu — áp dụng cho mọi project";
    el.className = "hint shint saved";
    if (noteTimer) { clearTimeout(noteTimer); }
    noteTimer = setTimeout(function () {
      el.textContent = PREFS_NOTE_IDLE;
      el.className = "hint shint";
    }, 2000);
  }

  function showSettings(show) {
    var main = document.getElementById("main-view");
    var settings = document.getElementById("settings");
    if (main) { main.style.display = show ? "none" : "block"; }
    if (settings) { settings.style.display = show ? "block" : "none"; }
  }

  // ---- Text guide editor (one horizontal guide line per ratio) -----------
  var RATIO_ASPECT = { "9-16": 1920 / 1080, "4-5": 1350 / 1080, "1-1": 1, "2-3": 1620 / 1080 };
  // Reference safe-zone insets (fraction of the frame) shown as a faint box to
  // help align the guide line. 9:16 ~ Reels; 4:5 / 1:1 / 2:3 a modest inset.
  var SAFE_REF = {
    "9-16": { top: 0.12, bottom: 0.33, side: 0.06 },
    "4-5":  { top: 0.08, bottom: 0.10, side: 0.06 },
    "1-1":  { top: 0.08, bottom: 0.12, side: 0.06 },
    "2-3":  { top: 0.08, bottom: 0.12, side: 0.06 }
  };
  var GZ_WIDTH = 92; // px; frame height = width * aspect
  var curRatio = "9-16";

  function saveGuide() { savePrefs(); noteSaved(); }

  function renderGuide() {
    var frame = document.getElementById("gzframe");
    var line = document.getElementById("gzline");
    var input = document.getElementById("guideY");
    var y = window.RSZ_GUIDE[curRatio];
    if (frame) { frame.style.height = Math.round(GZ_WIDTH * RATIO_ASPECT[curRatio]) + "px"; }
    var safe = document.getElementById("gzsafe");
    var sr = SAFE_REF[curRatio];
    if (safe && sr) {
      safe.style.top = (sr.top * 100) + "%";
      safe.style.bottom = (sr.bottom * 100) + "%";
      safe.style.left = (sr.side * 100) + "%";
      safe.style.right = (sr.side * 100) + "%";
    }
    if (line) { line.style.top = (y * 100) + "%"; }
    if (input && document.activeElement !== input) { input.value = Math.round(y * 100); }
    var tabs = document.querySelectorAll(".gz-tab");
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].className = "gz-tab" + (tabs[i].getAttribute("data-ratio") === curRatio ? " active" : "");
    }
  }

  function setGuideY(f) {
    window.RSZ_GUIDE[curRatio] = gnum(f, 0.5);
    renderGuide(); saveGuide();
  }

  function initGuideDrag() {
    var handle = document.getElementById("gzline");
    var frame = document.getElementById("gzframe");
    if (!handle || !frame) { return; }
    function onMove(e) {
      if (e.buttons !== undefined && !(e.buttons & 1)) { onUp(); return; }
      var rect = frame.getBoundingClientRect();
      setGuideY((e.clientY - rect.top) / rect.height);
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    handle.addEventListener("mousedown", function (e) {
      e.preventDefault();
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  }

  function initSettings() {
    var gear = document.getElementById("gear");
    var back = document.getElementById("settings-back");
    var done = document.getElementById("settings-done");
    var input = document.getElementById("bgtrack");
    if (input) {
      input.value = window.RSZ_BG_TRACK;
      input.addEventListener("change", function () {
        var v = parseInt(input.value, 10);
        if (!v || v < 1) { v = 1; }
        if (v > 20) { v = 20; }
        window.RSZ_BG_TRACK = v;
        input.value = v;
        savePrefs();
        noteSaved();
      });
    }

    // ratio tabs
    var tabs = document.querySelectorAll(".gz-tab");
    for (var i = 0; i < tabs.length; i++) {
      (function (tab) {
        tab.addEventListener("click", function () {
          curRatio = tab.getAttribute("data-ratio");
          renderGuide();
        });
      })(tabs[i]);
    }
    var pick = document.getElementById("accent-picker");
    if (pick && window.RSZ_THEME) {
      window.RSZ_THEME.mount(pick, window.RSZ_ACCENT || window.RSZ_THEME.DEFAULT, function (hex) {
        window.RSZ_ACCENT = window.RSZ_THEME.apply(hex);   // live preview
        savePrefs();
        noteSaved();
      });
    }

    var gy = document.getElementById("guideY");
    if (gy) { gy.addEventListener("change", function () { setGuideY((parseFloat(gy.value) || 0) / 100); }); }
    initGuideDrag();
    renderGuide();

    if (gear) { gear.addEventListener("click", function () { showSettings(true); }); }
    if (back) { back.addEventListener("click", function () { showSettings(false); }); }
    if (done) { done.addEventListener("click", function () { showSettings(false); }); }
  }
  initSettings();
})();
