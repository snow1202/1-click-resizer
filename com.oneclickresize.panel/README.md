# 1-Click Resizer — Premiere Pro Panel

**Repo:** https://github.com/snow1202/1-click-resizer (public)


A CEP panel that reframes the sequences you select into the sizes a campaign
needs — Google (9:16 / 4:5 / 1:1), Facebook (9:16 ⇄ 4:5) or Pinterest (2:3) — in
one click: it duplicates each sequence, changes the frame size, renames it, keeps
it in the same bin, and places text/graphics on your per-ratio guides (logos are
left where they are for a manual touch).

## Choosing which sequences

The panel resizes **every sequence selected in the Project panel** (just click
them — no need to open them). Select one or shift/⌘-click a whole batch: each
source is processed independently, with its own ratio and its own bin, and one
bad source (a ratio outside the set) is reported on its own row instead of
aborting the rest. If nothing is selected, the panel falls back to the sequence
open in the timeline. The header pill shows what it will act on — the sequence
name, or `N sequence đã chọn` for a batch.

## What one click does

Pick a platform with the toggle above the button, tick the sizes you want, then
press **RESIZE**:

| Button | Creates | Name suffix |
|---|---|---|
| **GG · Google** | the other ratios of 9:16 / 4:5 / 1:1 | `… 4x5 GG` |
| **FB · Facebook** | 9:16 ⇄ 4:5 only (a 1:1 source offers both) | `… 4x5 FB` |
| **PIN · Pinterest** | one 2:3 (1080×1620), from any source | `… 2x3 PIN` |

The chips under the toggle are the sizes that run — untick `1:1` and no 1:1
sequence is made (nothing to delete afterwards). A ratio equal to the source is
always skipped, so the chips never need to know what you selected. The choice is
remembered. For each target:

- **Duplicate** the sequence (the original is never modified).
- **Frame size** set to the target (all 1080 wide: 9:16 = 1080×1920, 4:5 =
  1080×1350, 1:1 = 1080×1080). Frame rate preserved.
- **Rename**: original name, trailing ratio label swapped, new label appended
  with a space — `MyClip 9x16` → `MyClip 4x5`.
- **Bin**: each new sequence is moved into the **same bin as its source**
  (`clone()` drops copies at the project root, so the panel moves them back).
  A source that already lives at the root stays at the root.
- **Background** (clips on the background track, default V1): **scale left
  untouched** — the panel API can't read a clip's native size, so auto-scaling
  would guess from the sequence ratio and over-scale. Standard 9:16-source
  footage already fills the 9:16 frame at its own scale; a non-matching
  background can be **Fill frame**-d by hand (one right-click).
- **Text / graphic / MOGRT**: scale kept; vertical position set to the target
  ratio's guide line (Settings; default centre), horizontal position kept.
  Graphics are recognised by three signals, because Premiere names their
  components differently per flavour: a component containing `Graphic` (MOGRT /
  template), a `Vector Motion` component (Type-tool text layers — their graphic
  component is named after the text itself, so nothing there says "Graphic"), or
  a truthy `getMGTComponent()`.
- **Logo** (clip name contains `logo`, `fav`, …): left exactly as-is — the
  editor positions it by hand. Detected only so it's never mistaken for text
  and snapped to the guide line.
- **Other overlays**: left as-is.
- **Audio** is never touched.

## Publishing a new version (maintainer only)

After changing the code, run one command from the repo root:

```bash
./publish.sh                    # bump patch (1.0.0 → 1.0.1), auto message
./publish.sh 1.1.0              # set an explicit version
./publish.sh "fixed the rename" # bump patch + custom message
```

It bumps `version.json`, syncs the version into the manifest and the panel's
version label, commits everything, and pushes to GitHub. Every teammate's panel
then offers the update on next open.

It also regenerates the README hero image and cuts a matching GitHub release with
the installer zip. Everything targets `origin` = `snow1202/1-click-resizer`, and
the same commits/tags are also mirrored to the `legacy` remote
(`tungnguyen1202/1-click-resizer`) so panels installed before the move keep
auto-updating. Once everyone has re-run the install one-liner, the legacy mirror
block in `publish.sh` can be deleted.

## Status indicators

- **ENGINE OK / ENGINE ERR** (header pill): whether the panel can talk to
  Premiere's script engine. Red means the jsx layer isn't responding —
  close and reopen the panel.
- **SEQUENCE OPEN / NO SEQUENCE** (header pill): whether a sequence is active.
- **READY / BUSY** (footer light): idle vs. a resize currently running.

## Settings (⚙)

- **Track nền (V…)** — which video track is the background (default 1 = V1).
- **Text position (guide per ratio)** — a visual editor: switch the 9:16 / 4:5 /
  1:1 / 2:3 tab (the preview reshapes to that ratio) and drag the green line to
  set where text/graphics/MOGRT sit vertically for that ratio (default centre).
  Their scale is never changed; horizontal position is kept.
- **Màu giao diện** — the accent colour. Pick from the saturation/brightness
  field, the hue strip, a preset swatch or by typing a hex value; every border,
  glow and highlight in the panel is derived from it (`js/theme.js`). The dark
  background never changes, so contrast stays readable at any hue.
- Logos (name contains `logo`, `fav`, …) are **left untouched** — position them
  by hand after the resize; no setting needed.
- Explanatory notes live on **hover** rather than taking up permanent space: any
  element with a `data-tip` attribute floats a bubble (see `initTips()`).
- **AUTO** (badge next to ⟳) is realtime detection: the panel polls Premiere
  ~every 0.3s and updates the source info the moment you switch sequences.
  Click it to toggle off (persisted); the **⟳ Refresh** button always works
  as the manual path.

**Settings are saved once, for every project.** They are written to
`~/Library/Application Support/1-Click Resizer Settings/settings.json` — a file
outside the panel's own folder, so it survives Premiere restarts, project
switches and panel updates. (A CEP panel runs from `file://`, where
`localStorage` lives in a cache the host may clear; that is why settings used to
look like they reset. localStorage is still written as a mirror/fallback.)
Settings from older versions are migrated automatically on first run.

## Install (macOS) — for teammates

### Cách 1 — 1 lệnh Terminal (khuyên dùng, không dính "Move to Trash")

Mở **Terminal**, dán và Enter:

```bash
curl -fsSL https://raw.githubusercontent.com/snow1202/1-click-resizer/main/web-install.sh | bash
```

Rồi thoát hẳn Premiere (Cmd+Q) → mở lại → **Window → Extensions → 1-Click Resizer**.

Vì không tải file app nào về máy nên macOS **không chặn** (hết lỗi *"Move to Trash"*
trên Sequoia). Cần `git` (lần đầu macOS mời cài qua `xcode-select --install`). Từ
đây mọi bản mới tự hiện nút **↑ Cập nhật** trong panel — không phải cài lại.

<details>
<summary>Cách 2 — Bộ cài .app (double-click)</summary>

1. Tải: **https://github.com/snow1202/1-click-resizer/releases/latest/download/1-Click-Resizer-Installer.zip**
2. Giải nén → **chuột phải** vào **"Cài đặt 1-Click Resizer"** → **Open**.
3. **macOS 15 Sequoia**: nếu chỉ thấy **"Move to Trash"**, vào **System Settings →
   Privacy & Security** → kéo xuống → **Open Anyway** cạnh tên app → mở lại.
4. Thoát hẳn Premiere (Cmd+Q) → mở lại → **Window → Extensions → 1-Click Resizer**.
</details>

<details>
<summary>Cách 2 — Cài bằng git (cho dev)</summary>

```bash
git clone https://github.com/snow1202/1-click-resizer.git "$HOME/Dev/1-click-resizer" && "$HOME/Dev/1-click-resizer/install.sh"
```
Rồi thoát hẳn Premiere và mở lại.
</details>

## Updating (get the latest version)

**Easiest — in the panel (realtime):** the panel watches for updates while open:
- a new release on GitHub → green bar **"Có bản mới vX · ↑ Cập nhật"** appears
  within ~5 minutes (or instantly on open). Click → pulls and reloads itself.
- files already updated on disk (you ran `git pull` yourself, or you're the
  maintainer who just published) → bar **"Đã có vX trên máy · ⟳ Tải lại"**
  appears within ~20 seconds. Click → just reloads.

(Requires the clone + symlink install above and access to the repo. If it can't
reach the repo it simply won't show the bar.)

**Manual fallback:**
```bash
cd "$HOME/Dev/1-click-resizer" && git pull
```
Then reload the panel (close/reopen, or restart Premiere).

> Note: the extension folder is named `com.oneclickresize.panel` (its internal
> bundle id — kept stable so existing installs don't break). The product's
> display name is **1-Click Resizer**.

## Acceptance checklist

Primary (9:16 → 4:5 & 1:1):
- [ ] Two new sequences appear, correctly named and sized (1080×1350, 1080×1080).
- [ ] Text/graphics sit on the guide line; background keeps its scale (untouched); logos untouched.
- [ ] Source sequence unchanged; audio untouched.

Taller (1:1 or 4:5 → 9:16):
- [ ] Background keeps its scale — 9:16-source footage fills the 9:16 frame, never over-scaled/cropped.
- [ ] Text/graphics sit on the guide line; logos kept exactly where they were.

General:
- [ ] Re-running on an already-labelled sequence swaps the label (no `… 9x16 4x5`).
- [ ] ⟳ Refresh re-detects the ratio after switching sequences.

## Known limitations (v1)

- Premiere's API gives no element/clip size, so the panel can't auto-"Fill
  frame" a background reliably (it would over-scale) and can't invoke the
  "Fill frame" menu command. Background scale is therefore left untouched;
  Fill-frame any non-9:16 background by hand (one right-click).
- Text placement sets the clip's **Motion Position anchor** only. Logos are
  intentionally left untouched (position them by hand). Fine positioning may
  still need a manual touch.
- Only the fixed **Motion** effect is adjusted (not a separate Transform effect).
- Width-constant 1080 ratios only.
- The background track (default V1) is left untouched; keep graphics/logos on
  upper tracks so they get the guide/pass-through handling.
- If a duplicate fails partway (e.g. Premiere rejects the frame-size change on an
  unusual sequence), the stray half-configured sequence is left in the project
  and reported as an error row; the source is never affected — just delete the
  stray one.

## Project layout

```
com.oneclickresize.panel/
  CSXS/manifest.xml     extension manifest
  .debug                unsigned-debug config
  index.html            panel markup
  css/style.css         dark neon theme
  js/CSInterface.js     Adobe bridge (vendored)
  js/main.js            panel controller (no business logic)
  js/prefs.js           settings store (JSON file outside the panel; one save, all projects)
  js/updater.js         in-panel auto-update (git fetch/pull; needs clone+symlink install)
  jsx/resize-core.jsx   pure logic (ratio, naming, fillScale, isLogoName) — Node-tested
  jsx/premiere.jsx      Premiere DOM layer (#includes resize-core)
```

Pure logic has automated tests: from the project root, run `npm test`.
