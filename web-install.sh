#!/usr/bin/env bash
# 1-Click Resizer — cài bằng 1 lệnh Terminal (macOS), KHÔNG cần tải app.
#
#   curl -fsSL https://raw.githubusercontent.com/snow1202/1-click-resizer/main/web-install.sh | bash
#
# Vì không tải file .app nào về máy, macOS Gatekeeper KHÔNG chặn (không còn lỗi
# "Move to Trash"). Script clone repo về một chỗ cố định, bật PlayerDebugMode và
# liên kết panel vào Premiere. Chạy lại bao nhiêu lần cũng an toàn (idempotent):
# lần sau nó tự cập nhật (git pull) thay vì clone lại.
set -euo pipefail

REPO_URL="https://github.com/snow1202/1-click-resizer.git"
BUNDLE="com.oneclickresize.panel"
DEST="$HOME/Library/Application Support/1-Click Resizer"
EXT_DIR="$HOME/Library/Application Support/Adobe/CEP/extensions"

[ "$(uname)" = "Darwin" ] || { echo "❌ Script này chỉ hỗ trợ macOS."; exit 1; }

if ! command -v git >/dev/null 2>&1; then
  echo "❌ Máy chưa có 'git'. Cài công cụ dòng lệnh của Xcode trước:"
  echo "     xcode-select --install"
  echo "   Đợi cài xong rồi chạy lại lệnh này."
  exit 1
fi

if [ -d "$DEST/.git" ]; then
  echo "→ Đã cài trước đó — đang cập nhật lên bản mới nhất…"
  git -C "$DEST" fetch --quiet origin main
  git -C "$DEST" reset --hard --quiet origin/main
else
  echo "→ Tải panel về '$DEST'…"
  rm -rf "$DEST"
  mkdir -p "$(dirname "$DEST")"
  git clone --quiet "$REPO_URL" "$DEST"
fi

echo "→ Bật chế độ cho phép panel chưa ký (PlayerDebugMode)…"
for v in 9 10 11 12; do
  defaults write "com.adobe.CSXS.$v" PlayerDebugMode 1 >/dev/null 2>&1 || true
done

echo "→ Liên kết panel vào Premiere…"
mkdir -p "$EXT_DIR"
ln -sfn "$DEST/$BUNDLE" "$EXT_DIR/$BUNDLE"

echo ""
echo "✅ Cài đặt xong!"
echo "   1. Thoát hẳn Premiere (Cmd+Q) rồi mở lại."
echo "   2. Mở panel: Window → Extensions → 1-Click Resizer"
echo ""
echo "Từ nay có bản mới, panel tự hiện nút '↑ Cập nhật' — không cần cài lại."
