var RSZ = (function () {
  var EPS = 0.02;
  var RATIOS = {
    "9-16": { w: 1080, h: 1920 },
    "4-5":  { w: 1080, h: 1350 },
    "1-1":  { w: 1080, h: 1080 },
    "2-3":  { w: 1080, h: 1620 }   // Pinterest (PIN) target only
  };
  // The GG cross-resize set (a source in here produces the other two). 2-3 is
  // deliberately NOT in ORDER: it's a PIN-only target and must never be a GG
  // source or be picked by detectRatio.
  var ORDER = ["9-16", "4-5", "1-1"];
  // Internal ratio keys stay "9-16"; the name suffix uses the "x" style.
  var LABELS = { "9-16": "9x16", "4-5": "4x5", "1-1": "1x1", "2-3": "2x3" };
  // Every trailing ratio label we recognise when stripping (new + legacy dash
  // form), so re-resizing a file named either way swaps cleanly.
  var STRIP_SUFFIXES = ["9x16", "4x5", "1x1", "2x3", "9-16", "4-5", "1-1", "2-3"];
  // Platform tags appended after the ratio label, e.g. "... 4x5 GG".
  var PLATFORM_TAGS = ["GG", "FB", "PIN"];
  // Which ratios each button may produce. The source's own ratio is always
  // dropped, so FB from a 1:1 source offers BOTH 9:16 and 4:5, while FB from
  // 9:16 offers only 4:5.
  var PLATFORM_TARGETS = {
    "GG":  ["9-16", "4-5", "1-1"],   // Google
    "FB":  ["9-16", "4-5"],          // Facebook
    "PIN": ["2-3"]                   // Pinterest
  };

  function contains(arr, v) {
    if (!arr) { return false; }
    for (var i = 0; i < arr.length; i++) { if (arr[i] === v) { return true; } }
    return false;
  }

  function aspectOf(w, h) { return w / h; }

  function detectRatio(w, h) {
    if (!w || !h) { return null; }
    var a = aspectOf(w, h);
    var best = null;
    var bestDiff = EPS;
    for (var i = 0; i < ORDER.length; i++) {
      var r = RATIOS[ORDER[i]];
      var diff = Math.abs(aspectOf(r.w, r.h) - a);
      if (diff <= bestDiff) { bestDiff = diff; best = ORDER[i]; }
    }
    return best;
  }

  function otherRatios(label) {
    var out = [];
    for (var i = 0; i < ORDER.length; i++) {
      if (ORDER[i] !== label) { out.push(ORDER[i]); }
    }
    return out;
  }

  function rtrimSpaces(name) {
    while (name.length && name.charAt(name.length - 1) === " ") {
      name = name.substring(0, name.length - 1);
    }
    return name;
  }

  // Remove one trailing " " + token from `list` if present; return name unchanged
  // otherwise.
  function stripOneTrailing(name, list) {
    for (var i = 0; i < list.length; i++) {
      var suffix = " " + list[i];
      if (name.length >= suffix.length &&
          name.substring(name.length - suffix.length) === suffix) {
        return name.substring(0, name.length - suffix.length);
      }
    }
    return name;
  }

  // The ratios a run should actually create: the platform's set, minus the
  // source's own ratio, intersected with `wanted` (the ticked boxes). An empty
  // or missing `wanted` means "everything this platform offers".
  function targetsFor(platform, sourceRatio, wanted) {
    var base = PLATFORM_TARGETS[platform] || [];
    var out = [];
    for (var i = 0; i < base.length; i++) {
      var t = base[i];
      if (t === sourceRatio) { continue; }
      if (wanted && wanted.length && !contains(wanted, t)) { continue; }
      out.push(t);
    }
    return out;
  }

  // Strip a trailing "<ratio>" or "<ratio> <platform>" label so re-resizing (or
  // switching GG/FB/PIN) swaps cleanly. A platform tag (GG/PIN) is only stripped
  // when it sits right after a ratio label — so a real name ending in "GG"/"PIN"
  // (with no ratio before it) is left alone.
  function stripTrailingRatioLabel(name) {
    name = rtrimSpaces(name);
    var noPlatform = stripOneTrailing(name, PLATFORM_TAGS);
    if (noPlatform !== name) {
      var trimmed = rtrimSpaces(noPlatform);
      var noRatio = stripOneTrailing(trimmed, STRIP_SUFFIXES);
      if (noRatio !== trimmed) { return noRatio; } // matched "<ratio> <platform>"
      // platform tag without a preceding ratio label -> leave the name as-is
    }
    return stripOneTrailing(name, STRIP_SUFFIXES);
  }

  // targetLabel is an internal ratio key ("9-16"); the suffix uses LABELS.
  // platform (optional) appends a trailing tag, e.g. "GG" -> "... 4x5 GG".
  function buildName(originalName, targetLabel, platform) {
    var suffix = LABELS[targetLabel] || targetLabel;
    var out = stripTrailingRatioLabel(originalName) + " " + suffix;
    if (platform) { out += " " + platform; }
    return out;
  }

  // A clip is treated as a logo when its name contains any of these hints
  // (case-insensitive substring). The team names logo files like "logo",
  // "fav vid", "fav video" — "fav" covers all of those. Add more hints here to
  // teach the panel new naming conventions; keep them lowercase.
  var LOGO_NAME_HINTS = ["logo", "fav"];

  function isLogoName(name) {
    if (!name) { return false; }
    var n = String(name).toLowerCase();
    for (var i = 0; i < LOGO_NAME_HINTS.length; i++) {
      if (n.indexOf(LOGO_NAME_HINTS[i]) !== -1) { return true; }
    }
    return false;
  }

  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

  return {
    RATIOS: RATIOS,
    ORDER: ORDER,
    LABELS: LABELS,
    detectRatio: detectRatio,
    otherRatios: otherRatios,
    stripTrailingRatioLabel: stripTrailingRatioLabel,
    buildName: buildName,
    clamp01: clamp01,
    PLATFORM_TAGS: PLATFORM_TAGS,
    PLATFORM_TARGETS: PLATFORM_TARGETS,
    targetsFor: targetsFor,
    LOGO_NAME_HINTS: LOGO_NAME_HINTS,
    isLogoName: isLogoName
  };
})();

if (typeof module !== "undefined" && module.exports) { module.exports = RSZ; }
