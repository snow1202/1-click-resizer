// Changelog shown by the panel's "Changelog" button — newest first, a few
// short lines per version. publish.sh refuses to release a version that has
// no entry here, so add one BEFORE running it.
window.RSZ_CHANGELOG = [
  { v: "1.12.1", date: "2026-10-07", notes: [
    "Bấm vào dòng kết quả: mở đúng sequence vừa tạo (thay vì chọn Bin)"
  ] },
  { v: "1.12.0", date: "2026-10-07", notes: [
    "Thêm nút Changelog cạnh số version",
    "Bấm vào từng dòng kết quả để chọn đúng Bin của dòng đó",
    "Resize nhiều version một lúc: liệt kê mọi Bin đã xếp vào"
  ] },
  { v: "1.11.2", date: "2026-10-07", notes: [
    "Sửa lỗi ENGINE ERR của bản 1.11.1"
  ] },
  { v: "1.11.1", date: "2026-10-07", notes: [
    "Bin version mới ưu tiên kiểu v22",
    "Facebook: chọn tầng vN có nhiều Bin nhất (bản đang phát triển)",
    "Bin nền tảng mới đặt tên theo quy ước của project (GG hay Google…)"
  ] },
  { v: "1.11.0", date: "2026-10-07", notes: [
    "Tự xếp sequence mới vào Timeline › Google / Facebook / Pinterest › v22",
    "Tự tạo Bin nếu chưa có và chọn sẵn Bin đó sau khi resize"
  ] },
  { v: "1.10.3", date: "2026-09-11", notes: [
    "Hiện tên sequence đầy đủ, bỏ mã RSZ-A17F"
  ] },
  { v: "1.10.2", date: "2026-09-11", notes: [
    "Đọc được ratio của mọi sequence (2:3, 16:9…)"
  ] },
  { v: "1.10.1", date: "2026-09-11", notes: [
    "Ẩn ô tick trùng ratio của sequence nguồn"
  ] },
  { v: "1.10.0", date: "2026-09-11", notes: [
    "Thêm chế độ FB (9:16 ⇄ 4:5)",
    "Tick chọn size muốn tạo",
    "Chú thích chuyển sang hover, chọn màu giao diện trong Settings"
  ] },
  { v: "1.9.2", date: "2026-08-28", notes: [
    "Nhận diện text tạo bằng Type tool để canh theo guide"
  ] },
  { v: "1.9.1", date: "2026-08-25", notes: [
    "Chuyển nơi phát hành sang repo snow1202"
  ] },
  { v: "1.9.0", date: "2026-08-19", notes: [
    "Resize hàng loạt mọi sequence đang chọn"
  ] },
  { v: "1.8.1", date: "2026-08-19", notes: [
    "Sequence mới nằm cùng Bin với sequence gốc",
    "Settings lưu 1 lần, dùng cho mọi project"
  ] },
  { v: "1.8.0", date: "2026-08-11", notes: [
    "Tách 2 chế độ GG (Google) và PIN (Pinterest 2:3)"
  ] },
  { v: "1.7.9", date: "2026-07-23", notes: [
    "Giữ nguyên scale video nền khi resize"
  ] },
  { v: "1.7.8", date: "2026-07-23", notes: [
    "Cài bằng 1 dòng Terminal, hết lỗi \"Move to Trash\""
  ] },
  { v: "1.7.5", date: "2026-07-20", notes: [
    "Canh text theo đường guide; logo giữ nguyên để chỉnh tay"
  ] },
  { v: "1.5.0", date: "2026-07-20", notes: [
    "Resize sequence đang chọn ở Project panel"
  ] },
  { v: "1.4.0", date: "2026-07-17", notes: [
    "Bản phát hành đầu tiên kèm bộ cài 1-click"
  ] }
];
