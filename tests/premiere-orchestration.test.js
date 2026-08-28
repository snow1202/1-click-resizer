// Orchestration tests: run the REAL jsx/premiere.jsx against a fake Premiere DOM.
// Covers what pure-logic tests can't — batch resize over a multi-sequence
// selection, per-source bin placement, naming, and the guide/logo layout rules.
//
// The fake mirrors the collection APIs the panel actually uses:
//   project.sequences.numSequences | rootItem.children.numItems
//   sequence.videoTracks.numTracks | track.clips.numItems
//   clip.components.numItems       | component.properties.numItems
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const PANEL = path.join(__dirname, "..", "com.oneclickresize.panel");

// Load resize-core into premiere.jsx in place of its #include, then evaluate —
// the RSZ_* functions land in this module's scope.
const core = fs.readFileSync(path.join(PANEL, "jsx", "resize-core.jsx"), "utf8");
const dom = fs.readFileSync(path.join(PANEL, "jsx", "premiere.jsx"), "utf8")
  .replace(/^#include\s+"resize-core\.jsx"\s*$/m, core);
eval(dom);

// ---- fake Premiere DOM ------------------------------------------------------

function arrayLike(items, countKey) {
  const o = {};
  o[countKey || "numItems"] = items.length;
  items.forEach((it, i) => { o[i] = it; });
  return o;
}

function setup() {
  let nodeSeq = 0;
  const nid = () => "node-" + (++nodeSeq);
  const sequences = [];
  const rootChildren = [];
  const moves = [];                 // every projectItem.moveBin() call
  let activeSequence = null;

  // kind: undefined = plain footage | "mogrt" = component named "Graphics"
  // | "text" = Type-tool text layer, whose graphic component is named after the
  //   TEXT ITSELF (real Premiere behaviour) leaving "Vector Motion" as the marker.
  function makeClip(name, kind) {
    const pos = [0.5, 0.5];
    const comps = [{
      displayName: "Motion",
      properties: arrayLike([
        { displayName: "Position",
          getValue: () => pos.slice(),
          setValue: (v) => { pos[0] = v[0]; pos[1] = v[1]; } },
        { displayName: "Scale", getValue: () => 100, setValue: () => {} }
      ])
    }];
    if (kind === "mogrt") {
      comps.push({ displayName: "Graphics", properties: arrayLike([]) });
    } else if (kind === "text") {
      comps.push({ displayName: "Vector Motion", properties: arrayLike([]) });
      comps.push({ displayName: name, properties: arrayLike([]) });  // named after the text
    }
    return { name, components: arrayLike(comps), y: () => pos[1] };
  }

  // A sequence's clips as data, so clone() can rebuild the SAME shape (the real
  // clone copies the timeline; the layout pass then runs on the copy, not the
  // source). Each track is a list of [clipName, kind].
  const DEFAULT_SPEC = [
    [["bg footage.mp4", null]],                                        // V1 background
    [["Text All-In-One", "mogrt"],                                     // V2 overlays
     ["For my full-busted ladies out there", "text"],
     ["fav video logo", "mogrt"]]
  ];

  function makeSeq(name, w, h, spec) {
    const st = { videoFrameWidth: w, videoFrameHeight: h };
    const shape = spec || DEFAULT_SPEC;
    const seq = {
      name,
      sequenceID: "seq-" + (sequences.length + 1) + "-" + name,
      getSettings: () => ({ ...st }),
      setSettings: (s) => { st.videoFrameWidth = s.videoFrameWidth; st.videoFrameHeight = s.videoFrameHeight; },
      videoTracks: arrayLike(
        shape.map(track => ({ clips: arrayLike(track.map(([n, k]) => makeClip(n, k))) })),
        "numTracks"),
      // Real clone() returns nothing and drops the copy at the project ROOT.
      clone() {
        const copy = makeSeq(this.name + " Copy", st.videoFrameWidth, st.videoFrameHeight, shape);
        rootChildren.push(copy.projectItem);
      }
    };
    seq.projectItem = {
      nodeId: nid(), name, type: 1,
      isSequence: () => true,
      moveBin: (dest) => { moves.push({ seq: seq.name, bin: dest.name }); }
    };
    sequences.push(seq);
    return seq;
  }

  function makeBin(name, kids) {
    return { nodeId: nid(), name, type: 2, isSequence: () => false,
             get children() { return arrayLike(kids); } };
  }

  let selection = [];
  global.app = {
    project: {
      get sequences() { return arrayLike(sequences, "numSequences"); },
      get rootItem() {
        return { nodeId: "ROOT", name: "root", type: 2,
                 get children() { return arrayLike(rootChildren); } };
      },
      get activeSequence() { return activeSequence; },
      set activeSequence(s) { activeSequence = s; },
      openSequence: () => {}
    },
    getCurrentProjectViewSelection: () => selection
  };

  return {
    makeSeq, makeBin, moves, rootChildren,
    select: (items) => { selection = items; },
    setActive: (s) => { activeSequence = s; }
  };
}

// Three 9:16 sequences inside one bin — the shape of a real batch selection.
function threeInABin(env) {
  const seqs = ["19.0", "19.1", "19.2"].map(v => env.makeSeq("Veracomfort vid " + v + " [ed.a][ed.b]", 1080, 1920));
  const bin = env.makeBin("19x", seqs.map(s => s.projectItem));
  env.rootChildren.push(bin);
  env.select(seqs.map(s => s.projectItem));
  return seqs;
}

// ---- tests -----------------------------------------------------------------

test("info probe reports how many sequences a run would process", () => {
  const env = setup();
  threeInABin(env);
  const info = JSON.parse(RSZ_activeSequenceInfo());
  assert.strictEqual(info.count, 3);
  assert.strictEqual(info.from, "selection");
  assert.strictEqual(info.ratio, "9-16");
});

test("GG resizes EVERY selected sequence (3 sources -> 6 variants)", () => {
  const env = setup();
  threeInABin(env);
  const res = JSON.parse(RSZ_runResizeGG(1, 0.4, 0.3, 0.5));
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.count, 3);
  assert.strictEqual(res.results.length, 6);
  const names = res.results.map(r => r.name);
  assert.ok(names.every(n => / (4x5|1x1) GG$/.test(n)), names.join(" | "));
  // each source contributed exactly its two other ratios
  ["19.0", "19.1", "19.2"].forEach(v => {
    assert.strictEqual(names.filter(n => n.indexOf(v) !== -1).length, 2, v);
  });
  assert.ok(res.results.every(r => r.src), "each variant names its source");
});

test("every new sequence is moved into its source's bin", () => {
  const env = setup();
  threeInABin(env);
  const res = JSON.parse(RSZ_runResizeGG(1, 0.5, 0.5, 0.5));
  assert.ok(res.results.every(r => r.bin === "19x"), JSON.stringify(res.results));
  assert.strictEqual(env.moves.length, 6);
});

test("a source at the project root stays at the root", () => {
  const env = setup();
  const seq = env.makeSeq("Loose master", 1080, 1920);
  env.rootChildren.push(seq.projectItem);
  env.select([seq.projectItem]);
  const res = JSON.parse(RSZ_runResizeGG(1, 0.5, 0.5, 0.5));
  assert.ok(res.results.every(r => !r.bin), JSON.stringify(res.results));
  assert.strictEqual(env.moves.length, 0);
});

test("layout moves the text/graphic to the guide and leaves logos alone", () => {
  const env = setup();
  threeInABin(env);
  // 4:5 guide 0.30 differs from the clips' 0.5; 1:1 guide stays at 0.5.
  const res = JSON.parse(RSZ_runResizeGG(1, 0.4, 0.30, 0.5));
  const moved45 = res.results.filter(r => r.ratio === "4-5").map(r => r.moved);
  const moved11 = res.results.filter(r => r.ratio === "1-1").map(r => r.moved);
  // Two clips per variant: the MOGRT and the Type-tool text layer. The logo is a
  // graphic too but must be skipped by name — a 3 here would mean logos moved.
  assert.deepStrictEqual(moved45, [2, 2, 2]);
  assert.deepStrictEqual(moved11, [0, 0, 0]);
});

test("PIN gives exactly one 2:3 sequence per selected source", () => {
  const env = setup();
  threeInABin(env);
  const res = JSON.parse(RSZ_runResizePIN(1, 0.55));
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.results.length, 3);
  assert.ok(res.results.every(r => / 2x3 PIN$/.test(r.name)), JSON.stringify(res.results));
  assert.ok(res.results.every(r => r.bin === "19x"));
});

test("an odd-ratio source is skipped per-sequence, never aborting the batch", () => {
  const env = setup();
  const good = env.makeSeq("Good 9x16", 1080, 1920);
  const odd = env.makeSeq("Weird 16x9 master", 1920, 1080);
  env.rootChildren.push(good.projectItem, odd.projectItem);
  env.select([good.projectItem, odd.projectItem]);
  const res = JSON.parse(RSZ_runResizeGG(1, 0.5, 0.5, 0.5));
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.results.length, 3);          // 2 variants + 1 skip
  const skipped = res.results.filter(r => r.error === "UNKNOWN_RATIO");
  assert.strictEqual(skipped.length, 1);
  assert.strictEqual(skipped[0].src, "Weird 16x9 master");
});

test("PIN accepts any source ratio", () => {
  const env = setup();
  const odd = env.makeSeq("Weird 16x9 master", 1920, 1080);
  env.rootChildren.push(odd.projectItem);
  env.select([odd.projectItem]);
  const res = JSON.parse(RSZ_runResizePIN(1, 0.5));
  assert.strictEqual(res.results.length, 1);
  assert.strictEqual(res.results[0].name, "Weird 16x9 master 2x3 PIN");
});

test("duplicate selection entries are processed once", () => {
  const env = setup();
  const seq = env.makeSeq("Only one", 1080, 1080);
  env.rootChildren.push(seq.projectItem);
  env.select([seq.projectItem, seq.projectItem]);   // same item twice
  const res = JSON.parse(RSZ_runResizeGG(1, 0.5, 0.5, 0.5));
  assert.strictEqual(res.count, 1);
  assert.strictEqual(res.results.length, 2);        // 9x16 + 4x5, not four
});

test("falls back to the active sequence when nothing is selected", () => {
  const env = setup();
  const seq = env.makeSeq("Open one", 1080, 1920);
  env.rootChildren.push(seq.projectItem);
  env.select([]);
  env.setActive(seq);
  const res = JSON.parse(RSZ_runResizeGG(1, 0.5, 0.5, 0.5));
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.from, "active");
  assert.strictEqual(res.results.length, 2);
});

test("no selection and no open sequence reports NO_ACTIVE_SEQUENCE", () => {
  const env = setup();
  env.select([]);
  env.setActive(null);
  const res = JSON.parse(RSZ_runResizeGG(1, 0.5, 0.5, 0.5));
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.error, "NO_ACTIVE_SEQUENCE");
  const pin = JSON.parse(RSZ_runResizePIN(1, 0.5));
  assert.strictEqual(pin.ok, false);
});

test("Type-tool text layers are detected (component named after the text, not \"Graphic\")", () => {
  const env = setup();
  const seq = env.makeSeq("Solo", 1080, 1920);
  env.rootChildren.push(seq.projectItem);
  env.select([seq.projectItem]);
  const res = JSON.parse(RSZ_runResizeGG(1, 0.5, 0.25, 0.5));
  // V2 holds a MOGRT + a text layer + a logo; only the first two follow the guide.
  const r45 = res.results.find(r => r.ratio === "4-5");
  assert.strictEqual(r45.moved, 2);
});

test("a Type-tool text layer named like a logo is still left alone", () => {
  const env = setup();
  // one overlay track holding only a logo-named text layer
  const seq = env.makeSeq("LogoOnly", 1080, 1920, [
    [["bg footage.mp4", null]],
    [["fav video logo", "text"]]
  ]);
  env.rootChildren.push(seq.projectItem);
  env.select([seq.projectItem]);
  const res = JSON.parse(RSZ_runResizeGG(1, 0.5, 0.25, 0.5));
  assert.ok(res.results.every(r => r.moved === 0), JSON.stringify(res.results));
});
