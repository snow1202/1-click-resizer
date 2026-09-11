// 1-Click Resizer — accent theming.
//
// The panel's look is one hue. Everything green in the stylesheet (borders,
// glows, button gradients, pill text…) is derived here from a single accent
// colour and written to CSS variables, so picking a colour in Settings retints
// the whole panel. The saturation/lightness pairs below were read off the
// original green palette, so the default accent reproduces it exactly.
//
// Only the accent moves — the dark background stays put, which keeps contrast
// predictable whatever hue the user picks.
window.RSZ_THEME = (function () {
  var DEFAULT = "#35E07E";
  var PRESETS = ["#35E07E", "#3BA9F5", "#B57BFF", "#FF7A45", "#FFC53D", "#FF5C8A"];

  // ---- colour maths --------------------------------------------------------

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function hexToRgb(hex) {
    var h = String(hex || "").replace("#", "");
    if (h.length === 3) { h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2); }
    if (!/^[0-9a-fA-F]{6}$/.test(h)) { return null; }
    return { r: parseInt(h.substring(0, 2), 16),
             g: parseInt(h.substring(2, 4), 16),
             b: parseInt(h.substring(4, 6), 16) };
  }

  function rgbToHex(r, g, b) {
    function p(n) {
      var s = Math.round(clamp(n, 0, 255)).toString(16);
      return s.length < 2 ? "0" + s : s;
    }
    return "#" + p(r) + p(g) + p(b);
  }

  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    var h = 0;
    if (d) {
      if (max === r) { h = (g - b) / d + (g < b ? 6 : 0); }
      else if (max === g) { h = (b - r) / d + 2; }
      else { h = (r - g) / d + 4; }
      h *= 60;
    }
    return { h: h, s: max ? d / max : 0, v: max };
  }

  function hsvToHex(h, s, v) {
    h = ((h % 360) + 360) % 360;
    var c = v * s;
    var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    var m = v - c;
    var r = 0, g = 0, b = 0;
    if (h < 60)       { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else              { r = c; b = x; }
    return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
  }

  // Hue only — the derived shades below pin their own saturation/lightness.
  function hueOf(hex) {
    var rgb = hexToRgb(hex) || hexToRgb(DEFAULT);
    return rgbToHsv(rgb.r, rgb.g, rgb.b).h;
  }

  function hslToHex(h, s, l) {           // s, l in 0..100
    s /= 100; l /= 100;
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs(((((h % 360) + 360) % 360) / 60 % 2) - 1));
    var m = l - c / 2;
    h = ((h % 360) + 360) % 360;
    var r = 0, g = 0, b = 0;
    if (h < 60)       { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else              { r = c; b = x; }
    return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
  }

  function rgba(hex, a) {
    var c = hexToRgb(hex) || hexToRgb(DEFAULT);
    return "rgba(" + c.r + "," + c.g + "," + c.b + "," + a + ")";
  }

  // ---- apply ---------------------------------------------------------------

  // Each entry is [cssVar, saturation%, lightness%] measured from the original
  // green palette, so the default accent renders byte-for-byte as before.
  var SHADES = [
    ["--accent-dim",    62, 45],   // #2FB865
    ["--accent-deep",   60, 15],   // #0F3D24  panel tint behind active chips
    ["--accent-line",   47, 22],   // #1d5236  borders on active/ok states
    ["--accent-edge",   52, 19],   // #17492c  logo tile border
    ["--accent-soft",   59, 78],   // #a7e9c4  text on tinted backgrounds
    ["--accent-sub",    50, 70],   // #8fd9b0  RESIZE sub-label
    ["--accent-btn-a",  41, 16],   // #193b28  RESIZE gradient top
    ["--accent-btn-b",  47, 13],   // #123020  RESIZE gradient bottom
    ["--accent-btn-ah", 41, 21],   // #1f4a32  hover top
    ["--accent-btn-bh", 46, 16],   // #153826  hover bottom
    ["--accent-row",    17, 24]    // #31463a  output row hover border
  ];

  function apply(hex) {
    var accent = (hexToRgb(hex) ? String(hex) : DEFAULT).toUpperCase();
    if (accent.charAt(0) !== "#") { accent = "#" + accent; }
    var h = hueOf(accent);
    var root = document.documentElement;
    root.style.setProperty("--accent", accent);
    for (var i = 0; i < SHADES.length; i++) {
      root.style.setProperty(SHADES[i][0], hslToHex(h, SHADES[i][1], SHADES[i][2]));
    }
    root.style.setProperty("--accent-glow", rgba(accent, 0.5));
    root.style.setProperty("--accent-ghost", rgba(accent, 0.25));
    return accent;
  }

  // ---- picker widget -------------------------------------------------------

  // Saturation/value square + hue strip + hex field, built in plain DOM so it
  // works inside CEP (a native <input type="color"> can't open a dialog there).
  // onChange fires live while dragging; the caller decides when to persist.
  function mount(host, hex, onChange) {
    if (!host) { return null; }
    var start = hexToRgb(hex) ? hex : DEFAULT;
    var rgb = hexToRgb(start);
    var hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
    var state = { h: hsv.h, s: hsv.s, v: hsv.v };

    host.innerHTML =
      '<div class="cp">' +
        '<div class="cp-sv"><span class="cp-dot"></span></div>' +
        '<div class="cp-hue"><span class="cp-bar"></span></div>' +
        '<div class="cp-foot">' +
          '<span class="cp-chip"></span>' +
          '<input class="cp-hex" type="text" spellcheck="false" maxlength="7" aria-label="Mã màu HEX" />' +
        '</div>' +
        '<div class="cp-presets"></div>' +
      '</div>';

    var sv = host.querySelector(".cp-sv");
    var dot = host.querySelector(".cp-dot");
    var hue = host.querySelector(".cp-hue");
    var bar = host.querySelector(".cp-bar");
    var chip = host.querySelector(".cp-chip");
    var field = host.querySelector(".cp-hex");
    var presetWrap = host.querySelector(".cp-presets");

    for (var i = 0; i < PRESETS.length; i++) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cp-preset";
      b.style.background = PRESETS[i];
      b.title = PRESETS[i];
      (function (col) {
        b.addEventListener("click", function () { setHex(col, true); });
      })(PRESETS[i]);
      presetWrap.appendChild(b);
    }

    function current() { return hsvToHex(state.h, state.s, state.v); }

    function paint(fireChange, skipField) {
      var hex = current();
      sv.style.background =
        "linear-gradient(to top, #000, rgba(0,0,0,0)), " +
        "linear-gradient(to right, #fff, " + hsvToHex(state.h, 1, 1) + ")";
      dot.style.left = (state.s * 100) + "%";
      dot.style.top = ((1 - state.v) * 100) + "%";
      bar.style.left = (state.h / 360 * 100) + "%";
      chip.style.background = hex;
      if (!skipField) { field.value = hex; }
      if (fireChange && onChange) { onChange(hex); }
    }

    function setHex(hex, fire) {
      var c = hexToRgb(hex);
      if (!c) { return; }
      var n = rgbToHsv(c.r, c.g, c.b);
      // Keep the current hue when the colour is a pure grey (hue is meaningless).
      state.h = n.s === 0 ? state.h : n.h;
      state.s = n.s; state.v = n.v;
      paint(fire !== false);
    }

    // Drag handling shared by both strips: pointer position → 0..1 fraction.
    function track(el, onMove) {
      function pos(e) {
        var r = el.getBoundingClientRect();
        return { x: clamp((e.clientX - r.left) / r.width, 0, 1),
                 y: clamp((e.clientY - r.top) / r.height, 0, 1) };
      }
      function move(e) {
        if (e.buttons !== undefined && !(e.buttons & 1)) { return up(); }
        onMove(pos(e));
      }
      function up() {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
      }
      el.addEventListener("mousedown", function (e) {
        e.preventDefault();
        onMove(pos(e));
        document.addEventListener("mousemove", move);
        document.addEventListener("mouseup", up);
      });
    }

    track(sv, function (p) { state.s = p.x; state.v = 1 - p.y; paint(true); });
    track(hue, function (p) { state.h = p.x * 360; paint(true); });

    field.addEventListener("change", function () { setHex(field.value, true); });
    field.addEventListener("blur", function () { paint(false); });

    paint(false);
    return { set: function (hex) { setHex(hex, false); } };
  }

  return { DEFAULT: DEFAULT, PRESETS: PRESETS, apply: apply, mount: mount,
           hsvToHex: hsvToHex, hslToHex: hslToHex, hueOf: hueOf };
})();
