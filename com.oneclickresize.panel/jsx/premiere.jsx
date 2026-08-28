// 1-Click Resizer — Premiere DOM layer.
//
// ┌─ PROBE FINDINGS (from diagnostic.jsx, probe v1 2026-07-16) ─────────────┐
// │ POSITION_UNITS       = "normalized"   // Position prints as 0.5,0.5      │
// │ Motion component: find by displayName === "Motion" (was index 1; Opacity │
// │   was index 0 — locate by name, do NOT hardcode the index)              │
// │ Position property: displayName === "Position" ([x,y] normalized)        │
// │ Scale property:    displayName === "Scale"    (percent; Uniform Scale on)│
// │ BIN PLACEMENT: clone() drops the copy at the project ROOT — the panel     │
// │   walks rootItem for the source's parent bin (by nodeId) and moves the new │
// │   sequence there via projectItem.moveBin(bin).                             │
// │ DUPLICATE_METHOD   = "clone"  // activeSequence.clone() is a function;   │
// │   qe.duplicate() and createClone() are undefined. clone() does not       │
// │   return the new sequence → diff app.project.sequences IDs to find it.   │
// │ app.project.activeSequence is assignable (settable).                     │
// │ NATIVE_SIZE = UNAVAILABLE  // getXMPMetadata() exposes stDim:w/h for only │
// │   SOME clips (a few .mp4/.mov); most .mp4, ALL .png, .aep, .aegraphic     │
// │   return no dimensions. Coverage-by-native-size is therefore infeasible.  │
// │ REPOSITION MODEL (native-size-free): overlay SCALE is never touched.      │
// │   • Logo (name matches isLogoName): left exactly as-is (hand-placed).      │
// │   • Text/graphic/MOGRT: snap Y to the target ratio's guide line (keep X).  │
// │   • Background track (default V1): SCALE LEFT UNTOUCHED — native size is    │
// │     unreadable so any auto-scale would over-scale; keeping the editor's     │
// │     scale keeps 9:16-source footage filling 9:16. Others left untouched.    │
// │ NOTE: v1 operates on the fixed Motion effect only (find component by      │
// │   displayName "Motion"; props by displayName "Scale"/"Position").         │
// └────────────────────────────────────────────────────────────────────────┘

#include "resize-core.jsx"

// ---- small DOM helpers -----------------------------------------------------

function RSZ_findComponent(clip, name) {
  for (var c = 0; c < clip.components.numItems; c++) {
    if (clip.components[c].displayName === name) { return clip.components[c]; }
  }
  return null;
}

function RSZ_findProp(comp, name) {
  for (var p = 0; p < comp.properties.numItems; p++) {
    if (comp.properties[p].displayName === name) { return comp.properties[p]; }
  }
  return null;
}

// A clip is a graphic (Essential Graphics: MOGRT, template, or a Type-tool text
// layer). Their component naming differs per flavour, so check three independent
// signals — matching only on "Graphic" silently missed every Type-tool text clip:
//   • MOGRT / template graphics expose a component whose name contains "Graphic".
//   • A Type-tool text clip names that component after the TEXT ITSELF. Proven
//     from a real sequence exported as FCP7 XML: the clip carries exactly
//     "Basic Motion" + "Vector Motion" + <effectid>GraphicAndType</effectid>
//     whose <name> is the caption text ("For my full-busted ladies out there").
//     Nothing there contains "Graphic", so "Vector Motion" is the stable marker —
//     only Essential Graphics clips carry it.
//   • getMGTComponent() is truthy for both flavours (earlier DOM probe).
// Such clips are never scaled; they only get their guide Y applied.
function RSZ_isGraphicClip(clip) {
  try {
    if (typeof clip.getMGTComponent === "function" && clip.getMGTComponent()) { return true; }
  } catch (e) {}
  for (var c = 0; c < clip.components.numItems; c++) {
    var dn = clip.components[c].displayName;
    if (!dn) { continue; }
    if (dn.indexOf("Graphic") !== -1) { return true; }
    if (dn === "Vector Motion") { return true; }
  }
  return false;
}

// Minimal JSON string escaper. ExtendScript (ES3) has no reliable JSON global,
// so payloads are built by hand; only string values need escaping. Sequence
// names may contain quotes/backslashes; control chars are replaced with space.
function RSZ_esc(s) {
  s = String(s);
  var out = "";
  for (var i = 0; i < s.length; i++) {
    var ch = s.charAt(i);
    var code = s.charCodeAt(i);
    if (ch === '"') { out += '\\"'; }
    else if (ch === '\\') { out += '\\\\'; }
    else if (code < 32) { out += " "; }
    else { out += ch; }
  }
  return out;
}

// ---- source selection -------------------------------------------------------

// Resolve a Sequence object from a Project-panel projectItem (a sequence need
// not be open to be cloned). Match by the sequence's own projectItem node id
// when available; fall back to name.
function RSZ_seqFromProjectItem(item) {
  if (!item) { return null; }
  var seqs = app.project.sequences;
  var i, s;
  for (i = 0; i < seqs.numSequences; i++) {
    s = seqs[i];
    try {
      if (s.projectItem && item.nodeId && s.projectItem.nodeId === item.nodeId) { return s; }
    } catch (e) {}
  }
  for (i = 0; i < seqs.numSequences; i++) {           // fallback: by name
    if (seqs[i].name === item.name) { return seqs[i]; }
  }
  return null;
}

function RSZ_isSequenceItem(item) {
  try { return !!(item && typeof item.isSequence === "function" && item.isSequence()); }
  catch (e) { return false; }
}

// EVERY sequence selected in the Project panel (batch resize), in selection
// order and de-duplicated by sequenceID. Falls back to the open/active sequence
// when nothing usable is selected. Returns { seqs: [...], from }.
function RSZ_resolveSources() {
  var out = [];
  var seen = {};
  try {
    if (typeof app.getCurrentProjectViewSelection === "function") {
      var sel = app.getCurrentProjectViewSelection();
      if (sel && sel.length) {
        for (var i = 0; i < sel.length; i++) {
          if (!RSZ_isSequenceItem(sel[i])) { continue; }
          var s = RSZ_seqFromProjectItem(sel[i]);
          if (!s) { continue; }
          var id = s.sequenceID;
          if (id && seen[id]) { continue; }
          if (id) { seen[id] = true; }
          out.push(s);
        }
      }
    }
  } catch (e) {}
  if (out.length) { return { seqs: out, from: "selection" }; }
  var a = app.project.activeSequence;
  return a ? { seqs: [a], from: "active" } : { seqs: [], from: "none" };
}

// Diagnostics for when no source can be found — surfaced to the panel so a
// single failed run tells us exactly which API is missing.
function RSZ_sourceDiag() {
  var hasSelApi = (typeof app.getCurrentProjectViewSelection === "function");
  var selCount = -1, seqSel = 0;
  try {
    if (hasSelApi) {
      var sel = app.getCurrentProjectViewSelection();
      selCount = sel ? sel.length : 0;
      for (var i = 0; i < selCount; i++) { if (RSZ_isSequenceItem(sel[i])) { seqSel++; } }
    }
  } catch (e) {}
  return '"selApi":' + (hasSelApi ? 'true' : 'false')
       + ',"selCount":' + selCount + ',"seqSelected":' + seqSel
       + ',"hasActive":' + (app.project.activeSequence ? 'true' : 'false');
}

// ---- sequence info ---------------------------------------------------------

function RSZ_seqGeom(seq) {
  var st = seq.getSettings();
  return { w: st.videoFrameWidth, h: st.videoFrameHeight };
}

// Internal: the live objects + geometry of the FIRST source (not for
// evalScript). `count` is how many sequences a run would process.
function RSZ_activeInfoObj() {
  var r = RSZ_resolveSources();
  if (!r.seqs.length) { return null; }
  var seq = r.seqs[0];
  var g = RSZ_seqGeom(seq);
  return { seq: seq, from: r.from, name: seq.name, width: g.w, height: g.h,
           ratio: RSZ.detectRatio(g.w, g.h), count: r.seqs.length };
}

// Public (evalScript): JSON string for the panel. detectRatio is the single
// source of truth for the ratio label; the panel only displays it. `count` lets
// the panel say "3 sequence đã chọn" before the user commits to a batch.
function RSZ_activeSequenceInfo() {
  var o = RSZ_activeInfoObj();
  if (!o) { return "null"; }
  return '{"name":"' + RSZ_esc(o.name) + '","width":' + o.width
       + ',"height":' + o.height + ',"from":"' + o.from + '"'
       + ',"count":' + o.count
       + ',"ratio":' + (o.ratio ? ('"' + o.ratio + '"') : 'null') + '}';
}

// ---- duplication -----------------------------------------------------------

function RSZ_sequenceIdSet() {
  var ids = {};
  var seqs = app.project.sequences;
  for (var i = 0; i < seqs.numSequences; i++) { ids[seqs[i].sequenceID] = true; }
  return ids;
}

// clone() does not return the new sequence, so find it by diffing sequence IDs.
function RSZ_duplicateSequence(sourceSeq) {
  var before = RSZ_sequenceIdSet();
  sourceSeq.clone();
  var seqs = app.project.sequences;
  for (var i = 0; i < seqs.numSequences; i++) {
    if (!before[seqs[i].sequenceID]) { return seqs[i]; }
  }
  return null;
}

// ---- bin placement ---------------------------------------------------------

// A ProjectItem is a bin when its type says so (ProjectItemType.BIN === 2 —
// referenced numerically because the enum isn't always defined in this host).
function RSZ_isBin(item) {
  try { return item && item.type === 2; } catch (e) { return false; }
}

// The bin that directly contains `item`, or null when it sits at the project
// root (or can't be located). Depth-first walk over rootItem's children —
// matching on nodeId, the same identity the source resolver uses.
function RSZ_findParentBin(item) {
  if (!item) { return null; }
  var targetId;
  try { targetId = item.nodeId; } catch (e) { return null; }
  if (!targetId) { return null; }

  function walk(bin) {
    var kids;
    try { kids = bin.children; } catch (e) { return null; }
    if (!kids) { return null; }
    for (var i = 0; i < kids.numItems; i++) {
      var child = kids[i];
      try { if (child.nodeId === targetId) { return bin; } } catch (e1) {}
      if (RSZ_isBin(child)) {
        var hit = walk(child);
        if (hit) { return hit; }
      }
    }
    return null;
  }

  var root = app.project.rootItem;
  var found = walk(root);
  if (!found) { return null; }
  try { if (found.nodeId === root.nodeId) { return null; } } catch (e2) {}
  return found;   // a real bin, not the root
}

// Move a sequence's ProjectItem into `bin`. No-op (false) when there is no bin
// to move into or the host lacks moveBin. Returns true only if it moved.
function RSZ_moveSeqToBin(seq, bin) {
  if (!seq || !bin) { return false; }
  try {
    var pi = seq.projectItem;
    if (!pi || typeof pi.moveBin !== "function") { return false; }
    pi.moveBin(bin);
    return true;
  } catch (e) { return false; }
}

// Sets the frame size and verifies it actually took effect (some hosts can
// silently ignore setSettings fields). Returns false on mismatch so the caller
// can report FRAME_SIZE_FAILED instead of pretending the resize happened.
function RSZ_setFrameSize(seq, w, h) {
  if (!seq) { return false; }
  var st = seq.getSettings();
  st.videoFrameWidth = w;
  st.videoFrameHeight = h;
  seq.setSettings(st);
  var chk = seq.getSettings();
  return (chk.videoFrameWidth === w && chk.videoFrameHeight === h);
}

function RSZ_isLogoClip(clip) {
  return RSZ.isLogoName(clip && clip.name);
}

// Set an overlay clip's vertical Motion Position, keeping X and Scale.
// Returns true if it moved.
function RSZ_setClipY(clip, newY) {
  var motion = RSZ_findComponent(clip, "Motion");
  if (!motion) { return false; }
  var posProp = RSZ_findProp(motion, "Position");
  if (!posProp) { return false; }
  var pos = posProp.getValue(); // [x, y] normalized
  if (pos[1] === newY) { return false; }
  posProp.setValue([pos[0], newY], true);
  return true;
}

// Make a sequence the active one — assignment first, openSequence as fallback
// (needed when the source was picked in the Project panel but not open).
function RSZ_makeActive(seq) {
  try { app.project.activeSequence = seq; } catch (e) {}
  try {
    var a = app.project.activeSequence;
    if ((!a || a.sequenceID !== seq.sequenceID) && seq.sequenceID
        && typeof app.project.openSequence === "function") {
      app.project.openSequence(seq.sequenceID);
    }
  } catch (e2) {}
}

// ---- orchestration ---------------------------------------------------------

function RSZ_guideOf(v) { v = parseFloat(v); return isNaN(v) ? 0.5 : RSZ.clamp01(v); }

function RSZ_normBgTrack(bgTrack) {
  bgTrack = parseInt(bgTrack, 10);
  return (!bgTrack || bgTrack < 1) ? 1 : bgTrack;
}

// Reposition overlays inside `dup`: background track left untouched (scale kept),
// logos left untouched, text/graphic/MOGRT snapped to guideY. Returns the count
// of clips moved.
function RSZ_layoutClips(dup, bgTrack, guideY) {
  var moved = 0;
  var bgIndex = bgTrack - 1;
  // If the configured background track doesn't exist on this sequence, fall back
  // to V1 so the real background is never mistaken for an overlay.
  if (bgIndex < 0 || bgIndex >= dup.videoTracks.numTracks) { bgIndex = 0; }
  for (var vt = 0; vt < dup.videoTracks.numTracks; vt++) {
    var track = dup.videoTracks[vt];
    for (var c = 0; c < track.clips.numItems; c++) {
      var clip = track.clips[c];
      if (vt === bgIndex) {
        // Background: SCALE LEFT UNTOUCHED. The API can't read a clip's native
        // size, so any auto-scale would over-scale (blow up + crop). Keeping the
        // editor's scale means 9:16-source footage stays "Fill frame" going up.
      } else if (RSZ_isLogoClip(clip)) {
        // Logo: left exactly as-is (the editor positions it by hand). Detected
        // only so it isn't snapped to the text guide below.
      } else if (RSZ_isGraphicClip(clip)) {
        // Text / graphic / MOGRT: keep Scale, snap Y to this ratio's guide.
        try { if (RSZ_setClipY(clip, guideY)) { moved++; } } catch (se) {}
      }
    }
  }
  return moved;
}

// Duplicate `sourceSeq`, reframe to `tgtRatio`, rename with the platform tag,
// move it into `destBin` (the source's own bin; null = leave at root) and lay out
// its clips. Returns a hand-built JSON result item (ExtendScript has no JSON
// global). Isolated so one failing target never aborts the batch.
function RSZ_makeVariant(sourceSeq, baseName, tgtRatio, platform, bgTrack, guideY, destBin) {
  var tgt = RSZ.RATIOS[tgtRatio];
  var src = ',"src":"' + RSZ_esc(baseName) + '"';   // which selected sequence this came from
  var dup = null; // visible in catch so a stranded duplicate can be reported
  try {
    // Re-select the source each time so every duplicate derives from the
    // original (also opens it if it was only selected in the Project panel).
    RSZ_makeActive(sourceSeq);
    dup = RSZ_duplicateSequence(sourceSeq);
    if (!dup) {
      return '{"ratio":"' + tgtRatio + '"' + src + ',"error":"DUPLICATE_FAILED"}';
    }
    if (!RSZ_setFrameSize(dup, tgt.w, tgt.h)) {
      dup.name = RSZ.buildName(baseName, tgtRatio, platform);
      return '{"ratio":"' + tgtRatio + '"' + src + ',"error":"FRAME_SIZE_FAILED","orphan":"'
           + RSZ_esc(dup.name) + '"}';
    }
    dup.name = RSZ.buildName(baseName, tgtRatio, platform);
    // clone() drops the copy at the project root — put it beside its source.
    var binName = RSZ_moveSeqToBin(dup, destBin) ? String(destBin.name) : "";
    var moved = RSZ_layoutClips(dup, bgTrack, guideY);
    return '{"ratio":"' + tgtRatio + '","name":"' + RSZ_esc(dup.name) + '"' + src
         + ',"moved":' + moved
         + (binName ? ',"bin":"' + RSZ_esc(binName) + '"' : '') + '}';
  } catch (te) {
    return '{"ratio":"' + tgtRatio + '"' + src + ',"error":"' + RSZ_esc(String(te)) + '"'
         + (dup ? ',"orphan":"' + RSZ_esc(dup.name) + '"' : '') + '}';
  }
}

// Snapshot every selected sequence's identity BEFORE any cloning: clone() adds
// items to the project, which grows the bin tree and can change the Project
// panel selection out from under us. Each job carries its own ratio, geometry
// and bin, so a batch of differently-sized sequences is handled correctly.
function RSZ_snapshotJobs(seqs) {
  var jobs = [];
  for (var i = 0; i < seqs.length; i++) {
    var seq = seqs[i];
    var g, bin = null, nm = "";
    try { g = RSZ_seqGeom(seq); } catch (e) { g = { w: 0, h: 0 }; }
    try { nm = String(seq.name); } catch (e1) {}
    try { bin = RSZ_findParentBin(seq.projectItem); } catch (e2) {}
    jobs.push({ seq: seq, name: nm, width: g.w, height: g.h,
                ratio: RSZ.detectRatio(g.w, g.h), bin: bin });
  }
  return jobs;
}

// GG (Google): for EVERY selected 9:16 / 4:5 / 1:1 sequence, create the OTHER
// two ratios, naming them "... <ratio> GG". Args: bgTrack; guide9/guide45/guide11
// = per-ratio text guide Y (0..1, default 0.5). A source whose ratio isn't in the
// set is reported per-sequence and never aborts the rest of the batch.
function RSZ_runResizeGG(bgTrack, guide9, guide45, guide11) {
  bgTrack = RSZ_normBgTrack(bgTrack);
  var guideByRatio = { "9-16": RSZ_guideOf(guide9), "4-5": RSZ_guideOf(guide45), "1-1": RSZ_guideOf(guide11) };

  var src = RSZ_resolveSources();
  if (!src.seqs.length) { return '{"ok":false,"error":"NO_ACTIVE_SEQUENCE",' + RSZ_sourceDiag() + '}'; }

  var jobs = RSZ_snapshotJobs(src.seqs);
  var parts = [];
  for (var i = 0; i < jobs.length; i++) {
    var j = jobs[i];
    if (!j.ratio) {
      parts.push('{"src":"' + RSZ_esc(j.name) + '","error":"UNKNOWN_RATIO","width":'
               + j.width + ',"height":' + j.height + '}');
      continue;
    }
    var targets = RSZ.otherRatios(j.ratio);
    for (var t = 0; t < targets.length; t++) {
      parts.push(RSZ_makeVariant(j.seq, j.name, targets[t], "GG", bgTrack,
                                 guideByRatio[targets[t]], j.bin));
    }
  }
  RSZ_makeActive(jobs[0].seq);
  return '{"ok":true,"count":' + jobs.length + ',"from":"' + src.from
       + '","results":[' + parts.join(",") + '],"error":null}';
}

// PIN (Pinterest): for EVERY selected sequence (any ratio), create a single 2:3
// sequence named "... 2x3 PIN". Args: bgTrack; guide23 = the 2:3 text guide Y.
function RSZ_runResizePIN(bgTrack, guide23) {
  bgTrack = RSZ_normBgTrack(bgTrack);
  var guideY = RSZ_guideOf(guide23);

  var src = RSZ_resolveSources();
  if (!src.seqs.length) { return '{"ok":false,"error":"NO_ACTIVE_SEQUENCE",' + RSZ_sourceDiag() + '}'; }

  var jobs = RSZ_snapshotJobs(src.seqs);
  var parts = [];
  for (var i = 0; i < jobs.length; i++) {
    parts.push(RSZ_makeVariant(jobs[i].seq, jobs[i].name, "2-3", "PIN", bgTrack,
                               guideY, jobs[i].bin));
  }
  RSZ_makeActive(jobs[0].seq);
  return '{"ok":true,"count":' + jobs.length + ',"from":"' + src.from
       + '","results":[' + parts.join(",") + '],"error":null}';
}
