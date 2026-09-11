<h1 align="center">1-Click Resizer</h1>

<p align="center"><b>Premiere Pro panel — resize a sequence to 9:16 / 4:5 / 1:1 in one click.</b><br/>
<i>Panel cho Premiere Pro — resize sequence sang 9:16 / 4:5 / 1:1 chỉ với một cú click.</i></p>

<p align="center">
  <img src="media/panel.png" alt="1-Click Resizer panel" width="380" />
</p>

<p align="center">
  <a href="https://github.com/snow1202/1-click-resizer/releases/latest"><img src="https://img.shields.io/github/v/release/snow1202/1-click-resizer?label=version&color=2ea043" alt="Latest version" /></a>
  <img src="https://img.shields.io/github/last-commit/snow1202/1-click-resizer/main?color=2ea043" alt="Last commit" />
</p>

<p align="center">
  <a href="https://github.com/snow1202/1-click-resizer/releases/latest/download/1-Click-Resizer-Installer.zip"><b>⬇️ Download installer (.zip)</b></a>
  &nbsp;·&nbsp;
  <a href="#-tiếng-việt">🇻🇳 Tiếng Việt</a>
  &nbsp;·&nbsp;
  <a href="#-english">🇬🇧 English</a>
</p>

---

## 🇬🇧 English

**Click a sequence in the Project panel** (no need to open it) and press **RESIZE** — the panel turns it into the other two ratios of **{9:16, 4:5, 1:1}** as new sequences: duplicating, resizing the frame, renaming, and placing text/graphics on your per-ratio guides. Your original sequence and audio are never touched.

**What one click does**
- **Duplicate** the active sequence (original untouched).
- **Frame size** → target (1080-wide: 9:16 = 1080×1920, 4:5 = 1080×1350, 1:1 = 1080×1080); frame rate preserved.
- **Rename** — swaps the trailing ratio label, e.g. `Clip 9x16` → `Clip 4x5`.
- **Same bin** — new sequences land in the same bin as the source, not the project root.
- **Batch** — select several sequences in the Project panel and all of them are resized in one click.
- **Per-platform buttons** — **GG** (9:16 / 4:5 / 1:1), **FB** (9:16 ⇄ 4:5) and **PIN** (2:3); the name suffix follows, e.g. `… 4x5 FB`.
- **Pick the sizes** — tick only the ratios you want, so no unwanted sequence is created (and none to delete).
- **Your accent colour** — set the panel's tone from a colour picker in Settings.
- **Background kept at its scale** — never over-scaled or cropped. Standard 9:16-source footage fills the 9:16 frame as-is; a non-matching background can be “Fill frame”-d by hand in one click.
- **Text guide** — text/graphics/MOGRT snap to a per-ratio guide line you set (Settings); logos are left untouched for manual placement.
- **Realtime** source detection (AUTO) and **in-panel auto-update** (a bar appears when a new version is out — one click to update).

**Install (macOS) — recommended, one Terminal command**

Open **Terminal** and paste:

```bash
curl -fsSL https://raw.githubusercontent.com/snow1202/1-click-resizer/main/web-install.sh | bash
```

Then quit Premiere fully (Cmd+Q), reopen → **Window → Extensions → 1-Click Resizer**. From then on the panel updates itself — you never reinstall.

> Why Terminal? Nothing is downloaded as an app, so macOS Gatekeeper never blocks it. Needs `git` (macOS offers to install it on first run via `xcode-select --install`).

<details><summary>Alternative: the .app installer</summary>

1. [Download the installer .zip](https://github.com/snow1202/1-click-resizer/releases/latest/download/1-Click-Resizer-Installer.zip), unzip, **right-click** “Cài đặt 1-Click Resizer” → **Open**.
2. **On macOS 15 Sequoia** the right-click trick no longer works — you'll see only **“Move to Trash”**. Fix: **System Settings → Privacy & Security**, scroll down, click **Open Anyway** next to the app's name, then reopen it. (Or just use the Terminal command above — simpler.)
3. Quit Premiere fully (Cmd+Q), reopen → **Window → Extensions → 1-Click Resizer**.
</details>

---

## 🇻🇳 Tiếng Việt

**Click chọn một sequence ở Project panel** (không cần mở) rồi bấm **RESIZE** — panel biến nó thành hai ratio còn lại trong **{9:16, 4:5, 1:1}** dưới dạng sequence mới: tự duplicate, đổi khung, đặt tên và canh text/graphic theo guide từng ratio. **Sequence gốc và audio không bao giờ bị đụng tới.**

**Một cú click làm gì**
- **Duplicate** sequence đang mở (giữ nguyên bản gốc).
- **Đổi khung** → ratio đích (rộng 1080: 9:16 = 1080×1920, 4:5 = 1080×1350, 1:1 = 1080×1080); giữ nguyên frame rate.
- **Đổi tên** — thay nhãn ratio ở cuối, vd `Clip 9x16` → `Clip 4x5`.
- **Cùng bin** — sequence mới nằm ngay trong bin của sequence gốc, không rơi ra ngoài cùng.
- **Chọn nhiều** — chọn nhiều sequence trong Project panel, một cú click resize hết.
- **Nút theo nền tảng** — **GG** (9:16 / 4:5 / 1:1), **FB** (9:16 ⇄ 4:5) và **PIN** (2:3); hậu tố tên đi kèm, vd `… 4x5 FB`.
- **Tick chọn size** — chỉ tạo đúng ratio bạn cần, khỏi sinh thừa rồi phải xoá.
- **Chọn tông màu** — đổi màu nhấn của panel bằng bảng chọn màu trong Settings.
- **Giữ nguyên scale nền** — không phóng lố, không cắt. Footage 9:16 gốc sẽ lấp đầy khung 9:16 y như cũ; nền khác tỉ lệ thì bạn tự "Fill frame" 1 click.
- **Guide text** — text/graphic/MOGRT canh theo đường guide từng ratio (chỉnh trong Settings); logo giữ nguyên để canh tay.
- **Nhận diện realtime** (AUTO) và **tự cập nhật trong panel** (có bản mới là hiện thanh báo — bấm một nút là xong).

**Cài đặt (macOS) — khuyên dùng, chỉ 1 lệnh Terminal**

Mở **Terminal** rồi dán:

```bash
curl -fsSL https://raw.githubusercontent.com/snow1202/1-click-resizer/main/web-install.sh | bash
```

Sau đó thoát hẳn Premiere (Cmd+Q), mở lại → **Window → Extensions → 1-Click Resizer**. Từ đó panel tự cập nhật — không bao giờ phải cài lại.

> Vì sao dùng Terminal? Không tải file app nào về máy nên macOS **không chặn** (hết lỗi *"Move to Trash"*). Cần có `git` (lần đầu macOS sẽ mời cài qua `xcode-select --install`).

<details><summary>Cách khác: bộ cài .app</summary>

1. [Tải bộ cài .zip](https://github.com/snow1202/1-click-resizer/releases/latest/download/1-Click-Resizer-Installer.zip), giải nén, **chuột phải** vào “Cài đặt 1-Click Resizer” → **Open**.
2. **Trên macOS 15 Sequoia**, mẹo chuột phải không còn tác dụng — bạn sẽ chỉ thấy nút **“Move to Trash”**. Cách xử lý: vào **System Settings → Privacy & Security**, kéo xuống dưới, bấm **Open Anyway** cạnh tên app, rồi mở lại. (Hoặc dùng lệnh Terminal ở trên cho nhanh gọn.)
3. Thoát hẳn Premiere (Cmd+Q), mở lại → **Window → Extensions → 1-Click Resizer**.
</details>

---

<p align="center"><sub>Chi tiết kỹ thuật, Settings, giới hạn & hướng dẫn cho maintainer: xem <a href="com.oneclickresize.panel/README.md">tài liệu đầy đủ</a>.</sub></p>
