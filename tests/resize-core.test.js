const test = require("node:test");
const assert = require("node:assert");
const RSZ = require("../com.oneclickresize.panel/jsx/resize-core.jsx");

test("detectRatio matches the three standard 1080 sizes", () => {
  assert.strictEqual(RSZ.detectRatio(1080, 1920), "9-16");
  assert.strictEqual(RSZ.detectRatio(1080, 1350), "4-5");
  assert.strictEqual(RSZ.detectRatio(1080, 1080), "1-1");
});

test("detectRatio matches by aspect ratio at other resolutions", () => {
  assert.strictEqual(RSZ.detectRatio(2160, 3840), "9-16");
  assert.strictEqual(RSZ.detectRatio(1920, 1080), null); // 16:9 is not in our set
});

test("detectRatio returns null on bad input", () => {
  assert.strictEqual(RSZ.detectRatio(0, 100), null);
  assert.strictEqual(RSZ.detectRatio(100, 0), null);
});

test("detectRatio tolerance boundary (EPS = 0.02 on aspect)", () => {
  // 1080/1900 = 0.5684 vs 0.5625 -> diff ~0.006, inside tolerance
  assert.strictEqual(RSZ.detectRatio(1080, 1900), "9-16");
  // 1080/2100 = 0.5143 -> ~0.048 from 9:16, outside tolerance
  assert.strictEqual(RSZ.detectRatio(1080, 2100), null);
});

test("otherRatios returns the two remaining labels in order", () => {
  assert.deepStrictEqual(RSZ.otherRatios("9-16"), ["4-5", "1-1"]);
  assert.deepStrictEqual(RSZ.otherRatios("4-5"), ["9-16", "1-1"]);
  assert.deepStrictEqual(RSZ.otherRatios("1-1"), ["9-16", "4-5"]);
});

test("stripTrailingRatioLabel removes only a trailing known label", () => {
  assert.strictEqual(RSZ.stripTrailingRatioLabel("Clip 9-16"), "Clip");
  assert.strictEqual(RSZ.stripTrailingRatioLabel("Clip 4-5"), "Clip");
  assert.strictEqual(RSZ.stripTrailingRatioLabel("Clip"), "Clip");
  // must not strip a label that is not at the end
  assert.strictEqual(RSZ.stripTrailingRatioLabel("9-16 master"), "9-16 master");
  // must not strip a bracketed tag that merely contains digits
  assert.strictEqual(RSZ.stripTrailingRatioLabel("vid17.0 [tung]"), "vid17.0 [tung]");
  // strips the new x-style labels too
  assert.strictEqual(RSZ.stripTrailingRatioLabel("Clip 9x16"), "Clip");
  assert.strictEqual(RSZ.stripTrailingRatioLabel("Clip 1x1"), "Clip");
  // tolerates accidental trailing spaces from manual renames
  assert.strictEqual(RSZ.stripTrailingRatioLabel("Clip 9-16 "), "Clip");
  assert.strictEqual(RSZ.buildName("Clip 9x16 ", "4-5"), "Clip 4x5");
});

test("RATIOS/LABELS carry 2:3 (Pinterest); ORDER stays the GG set; detectRatio ignores 2:3", () => {
  assert.deepStrictEqual(RSZ.RATIOS["2-3"], { w: 1080, h: 1620 });
  assert.strictEqual(RSZ.LABELS["2-3"], "2x3");
  assert.deepStrictEqual(RSZ.ORDER, ["9-16", "4-5", "1-1"]);
  // 2:3 is PIN-only — detectRatio must never pick it as a source ratio
  assert.strictEqual(RSZ.detectRatio(1080, 1620), null);
});

test("buildName appends a platform tag after the ratio label", () => {
  var base = "SoftyGrace v1.1 [c.ngoc.nguyen][tung.thanhnguyen]";
  assert.strictEqual(RSZ.buildName(base, "4-5", "GG"), base + " 4x5 GG");
  assert.strictEqual(RSZ.buildName(base, "2-3", "PIN"), base + " 2x3 PIN");
  // no platform arg -> legacy label-only form still works
  assert.strictEqual(RSZ.buildName(base, "1-1"), base + " 1x1");
});

test("re-resizing swaps ratio + platform cleanly (no stacking)", () => {
  var base = "Brand vid17.0 [ed.a]";
  assert.strictEqual(RSZ.buildName(base + " 4x5 GG", "1-1", "GG"), base + " 1x1 GG");
  assert.strictEqual(RSZ.buildName(base + " 4x5 GG", "2-3", "PIN"), base + " 2x3 PIN");
  assert.strictEqual(RSZ.buildName(base + " 2x3 PIN", "9-16", "GG"), base + " 9x16 GG");
  // legacy plain-ratio name still swaps into the new tagged form
  assert.strictEqual(RSZ.buildName(base + " 9x16", "4-5", "GG"), base + " 4x5 GG");
});

test("stripTrailingRatioLabel handles ratio+platform, leaves real names alone", () => {
  assert.strictEqual(RSZ.stripTrailingRatioLabel("Clip 4x5 GG"), "Clip");
  assert.strictEqual(RSZ.stripTrailingRatioLabel("Clip 2x3 PIN"), "Clip");
  assert.strictEqual(RSZ.stripTrailingRatioLabel("Clip 9-16 GG"), "Clip"); // legacy dash + tag
  assert.strictEqual(RSZ.stripTrailingRatioLabel("Clip 4x5 GG "), "Clip"); // trailing space
  // a real name ending in GG/PIN with NO ratio before it must be preserved
  assert.strictEqual(RSZ.stripTrailingRatioLabel("Weekly GG"), "Weekly GG");
  assert.strictEqual(RSZ.stripTrailingRatioLabel("Team PIN"), "Team PIN");
});

test("buildName appends the x-style label and swaps any prior label", () => {
  var base = "Brand vid17.0 [editor.a][editor.b]";
  assert.strictEqual(RSZ.buildName(base, "4-5"), base + " 4x5");
  assert.strictEqual(RSZ.buildName(base, "9-16"), base + " 9x16");
  assert.strictEqual(RSZ.buildName(base, "1-1"), base + " 1x1");
  // swaps a prior x-style label (no stacking)
  assert.strictEqual(RSZ.buildName(base + " 9x16", "1-1"), base + " 1x1");
  // also swaps a legacy dash label from older versions
  assert.strictEqual(RSZ.buildName(base + " 4-5", "9-16"), base + " 9x16");
});

test("isLogoName detects the team's logo naming conventions", () => {
  // core hints: "logo" and "fav" (covers fav vid / fav video / favicon)
  assert.strictEqual(RSZ.isLogoName("Logo"), true);
  assert.strictEqual(RSZ.isLogoName("brand_logo.png"), true);
  assert.strictEqual(RSZ.isLogoName("fav vid"), true);
  assert.strictEqual(RSZ.isLogoName("Fav Video 01"), true);
  assert.strictEqual(RSZ.isLogoName("FAVICON"), true);
  // case-insensitive
  assert.strictEqual(RSZ.isLogoName("LOGO_final"), true);
  // non-logo overlays stay unmatched
  assert.strictEqual(RSZ.isLogoName("Text All-In-One"), false);
  assert.strictEqual(RSZ.isLogoName("background.mp4"), false);
  // guards
  assert.strictEqual(RSZ.isLogoName(""), false);
  assert.strictEqual(RSZ.isLogoName(null), false);
  assert.strictEqual(RSZ.isLogoName(undefined), false);
});

test("clamp01 keeps values in [0,1]", () => {
  assert.strictEqual(RSZ.clamp01(-0.2), 0);
  assert.strictEqual(RSZ.clamp01(1.4), 1);
  assert.strictEqual(RSZ.clamp01(0.42), 0.42);
});

test("targetsFor picks a platform's ratios, minus the source, minus unticked", () => {
  // GG offers all three; the source's own ratio is never re-made
  assert.deepStrictEqual(RSZ.targetsFor("GG", "9-16"), ["4-5", "1-1"]);
  assert.deepStrictEqual(RSZ.targetsFor("GG", "1-1"), ["9-16", "4-5"]);
  // unticking 1:1 leaves just 4:5
  assert.deepStrictEqual(RSZ.targetsFor("GG", "9-16", ["4-5"]), ["4-5"]);
  // FB only swaps between 9:16 and 4:5 …
  assert.deepStrictEqual(RSZ.targetsFor("FB", "9-16"), ["4-5"]);
  assert.deepStrictEqual(RSZ.targetsFor("FB", "4-5"), ["9-16"]);
  // … and from a 1:1 source it offers both
  assert.deepStrictEqual(RSZ.targetsFor("FB", "1-1"), ["9-16", "4-5"]);
  // PIN is a single fixed output, whatever the source
  assert.deepStrictEqual(RSZ.targetsFor("PIN", "9-16"), ["2-3"]);
  assert.deepStrictEqual(RSZ.targetsFor("PIN", null), ["2-3"]);
  // everything unticked -> nothing to do
  assert.deepStrictEqual(RSZ.targetsFor("GG", "9-16", ["9-16"]), []);
  // an unknown platform never invents work
  assert.deepStrictEqual(RSZ.targetsFor("XX", "9-16"), []);
});

test("FB joins the platform tags and swaps cleanly with the others", () => {
  var base = "Brand vid [ed.a]";
  assert.strictEqual(RSZ.buildName(base, "4-5", "FB"), base + " 4x5 FB");
  assert.strictEqual(RSZ.buildName(base + " 4x5 FB", "9-16", "GG"), base + " 9x16 GG");
  assert.strictEqual(RSZ.buildName(base + " 2x3 PIN", "9-16", "FB"), base + " 9x16 FB");
  assert.strictEqual(RSZ.stripTrailingRatioLabel("Clip 9x16 FB"), "Clip");
  // a real name merely ending in FB keeps it (no ratio label in front)
  assert.strictEqual(RSZ.stripTrailingRatioLabel("Highlights FB"), "Highlights FB");
});

test("describeRatio labels ANY frame size without widening what can be resized", () => {
  // the named sizes keep their familiar label
  assert.strictEqual(RSZ.describeRatio(1080, 1920), "9 : 16");
  assert.strictEqual(RSZ.describeRatio(1080, 1350), "4 : 5");
  assert.strictEqual(RSZ.describeRatio(1080, 1080), "1 : 1");
  // 2:3 is READ correctly but is still not a resize source — that separation is
  // the whole point of keeping describeRatio apart from detectRatio.
  assert.strictEqual(RSZ.describeRatio(1080, 1620), "2 : 3");
  assert.strictEqual(RSZ.detectRatio(1080, 1620), null);
  assert.strictEqual(RSZ.describeRatio(1000, 1500), "2 : 3");
  // sizes the panel never touches are still reported
  assert.strictEqual(RSZ.describeRatio(1920, 1080), "16 : 9");
  assert.strictEqual(RSZ.describeRatio(2560, 1080), "64 : 27");
  // an awkward size is approximated rather than shown as a giant fraction
  assert.strictEqual(RSZ.describeRatio(1234, 987), "≈ 5 : 4");
  // guards
  assert.strictEqual(RSZ.describeRatio(0, 100), null);
  assert.strictEqual(RSZ.describeRatio(100, 0), null);
});

test("versionOf reads the major version from team sequence names", () => {
  assert.strictEqual(RSZ.versionOf("Veracomfort vid 22.0 [c.phuong.mainguyen][tung.thanhnguyen]"), 22);
  assert.strictEqual(RSZ.versionOf("Brand vid17.1 [a][b]"), 17);
  assert.strictEqual(RSZ.versionOf("Promo v9.2"), 9);
  assert.strictEqual(RSZ.versionOf("EvaGlow v16.1"), 16);
  assert.strictEqual(RSZ.versionOf("Veracomfort master"), null);
  assert.strictEqual(RSZ.versionOf("Loose master"), null);
});

test("parseVersionBin knows both naming styles", () => {
  assert.deepStrictEqual(RSZ.parseVersionBin("22x"), { n: 22, style: "x" });
  assert.deepStrictEqual(RSZ.parseVersionBin("v22"), { n: 22, style: "v" });
  assert.strictEqual(RSZ.parseVersionBin("Google"), null);
});

test("planVersionBin picks the vN container with the MOST bins and the siblings' style", () => {
  const b = (name, kids) => ({ name, kids: kids || [] });
  const fb = b("Facebook", [b("v1", [b("1x")]), b("v2", [b("1x"), b("5x")]), b("v3", [b("1x"), b("2x"), b("23x")])]);
  const p = RSZ.planVersionBin(fb, 24);
  assert.strictEqual(p.home.name, "v3");
  assert.strictEqual(p.name, "24x");
  assert.strictEqual(p.existing, null);
  assert.strictEqual(RSZ.planVersionBin(fb, 5).existing.name, "5x");   // reuse wherever it exists
  assert.strictEqual(RSZ.planVersionBin(b("GG", [b("v20"), b("v21")]), 22).name, "v22");
  assert.strictEqual(RSZ.planVersionBin(b("Google", []), 3).name, "v3");   // default style is v
  assert.strictEqual(RSZ.planVersionBin(b("GG", [b("v20"), b("21x")]), 22).name, "v22");   // tie -> v
  assert.strictEqual(RSZ.planVersionBin(b("Google", [b("20x"), b("21x")]), 22).name, "22x"); // siblings win
  // a newer-numbered but thinner line is OFF: the busy v2 is still the home
  const off = b("Facebook", [b("v2", [b("1x"), b("2x"), b("3x"), b("4x")]), b("v3", [b("1x")])]);
  assert.strictEqual(RSZ.planVersionBin(off, 5).home.name, "v2");
});

test("platformBinName follows the project's GG/FB vs Google/Facebook convention", () => {
  assert.strictEqual(RSZ.platformBinName("PIN", ["GG", "FB", "Amazon"]), "PIN");
  assert.strictEqual(RSZ.platformBinName("PIN", ["Google", "Facebook"]), "Pinterest");
  assert.strictEqual(RSZ.platformBinName("GG", ["fb"]), "GG");
  assert.strictEqual(RSZ.platformBinName("FB", []), "Facebook");
});

// Premiere's ExtendScript is ES3: its "future reserved words" (short, int,
// class, const, let …) are SYNTAX ERRORS there even though Node accepts them —
// one of them in a .jsx kills the whole engine (panel shows ENGINE ERR).
test("no ES3 reserved word is used as an identifier in any .jsx", () => {
  const fs = require("node:fs"), path = require("node:path");
  const dir = path.join(__dirname, "..", "com.oneclickresize.panel", "jsx");
  const RESERVED = ("abstract boolean byte char class const debugger double enum export extends final " +
    "float goto implements import int interface long native package private protected public short " +
    "static super synchronized throws transient volatile let").split(" ");
  const hits = [];
  fs.readdirSync(dir).filter(f => f.endsWith(".jsx")).forEach(f => {
    fs.readFileSync(path.join(dir, f), "utf8").split("\n").forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, "").replace(/"(?:[^"\\]|\\.)*"/g, '""');
      RESERVED.forEach(w => { if (new RegExp("\\b" + w + "\\b").test(code)) { hits.push(f + ":" + (i + 1) + " " + w); } });
    });
  });
  assert.deepStrictEqual(hits, []);
});
