# AIRTECH AI — AI-Powered Air Gesture Teaching Platform

> **Tên tiếng Việt:** Hệ thống dạy học thông minh tương tác không chạm bằng AI  
> **Phiên bản:** 1.0.0 (Windows Local-First Desktop Edition)

---

## 1. Giới thiệu tổng quan

**AIRTECH AI** biến webcam thông thường của máy tính thành thiết bị tương tác thị giác thông minh dành riêng cho giáo viên trong môi trường lớp học và giảng đường hiện đại. 

### Các tính năng cốt lõi:
- **Nhận diện khuôn mặt tự động (Local Face Recognition):** Nhận diện giáo viên ngay khi bước vào tầm nhìn camera, tự động tải đúng hồ sơ (Profile), bài giảng gần nhất và tùy chọn cá nhân.
- **Tương tác cử chỉ không chạm (Air Gesture & Air Cursor):** Sử dụng MediaPipe Hands (21 3D Landmarks) để xác định đầu ngón tay trỏ điều khiển con trỏ mượt mà theo thời gian thực.
- **Vẽ trong không gian (Air Drawing) & Bảng trắng (Whiteboard):** Cho phép viết, vẽ, gạch chân, khoanh tròn, ghi chú hình học không cần chạm vào màn hình hay dùng chuột.
- **Smart Shape Recognition:** Tự động nhận diện hình học (đường thẳng, hình tròn, chữ nhật, tam giác, mũi tên) với thuật toán AI hình học cục bộ.
- **Trình duyệt web tích hợp + Lớp phủ AirTech (Web + Air Drawing Overlay):** Mở tài liệu, YouTube, Wikipedia, LMS trực tiếp trong phần mềm và dùng cử chỉ tay vẽ chú thích, khoanh nội dung và xuất ảnh ghi chú tức thời.
- **Hoạt động 100% Local-First / Offline:** Toàn bộ cơ sở dữ liệu (SQLite WebAssembly + IndexedDB) và mô hình AI chạy trực tiếp trong máy tính, không đòi hỏi server backend, không cần Docker, không cần Internet.
- **An toàn & Riêng tư (Privacy by Design):** Không gửi dữ liệu camera hoặc khuôn mặt lên đám mây; hỗ trợ xóa dữ liệu cá nhân theo yêu cầu.

---

## 2. Kiến trúc Local-First

Ứng dụng hoạt động theo kiến trúc khép kín hoàn toàn trên máy trạm:

```text
┌─────────────────────────────────────────────────────────────┐
│                    AIRTECH AI DESKTOP                       │
├──────────────┬──────────────┬──────────────┬────────────────┤
│  AI Engine   │  UI / Canvas │    Camera    │ Local Storage  │
│  • Face AI   │  • Infinite  │  • MediaPipe │  • SQLite WASM │
│  • Hand AI   │  • Overlay   │  • 30 FPS    │  • IndexedDB   │
│  • Gestures  │  • Drawing   │  • Low-lat   │  • Settings    │
└──────────────┴──────────────┴──────────────┴────────────────┘
```

---

## 3. Bảng cử chỉ tay mặc định (Gesture Mapping)

| Cử chỉ | Biểu tượng | Hành động trong hệ thống |
| :--- | :---: | :--- |
| **Giơ 1 ngón trỏ** | ☝️ | Di chuyển Air Cursor / Vẽ nét (Draw) |
| **Nắm chặt bàn tay** | ✊ | Kích hoạt công cụ Tẩy (Eraser) |
| **Giơ 2 ngón (Chữ V)** | ✌️ | Chuyển đổi nhanh công cụ (Tool Switch) |
| **Gạt tay sang phải** | 👉 / ➡️ | Chuyển slide kế tiếp (Next Slide) |
| **Gạt tay sang trái** | 👈 / ⬅️ | Quay lại slide trước (Previous Slide) |
| **Mở cả bàn tay** | 🖐️ | Tạm dừng vẽ / Chế độ Con trỏ di chuyển (Pointer) |

---

## 4. Hướng dẫn khởi chạy ứng dụng

### 4.1. Khởi chạy nhanh (Một cú click chuột trên Windows)
Nhấp đúp chuột vào file:
```cmd
AirTechAI.bat
```
Phần mềm sẽ tự động kiểm tra bản build và mở cửa sổ ứng dụng desktop toàn màn hình.

### 4.2. Khởi chạy bằng dòng lệnh
Yêu cầu đã cài đặt **Node.js >= 18**:

```bash
# 1. Cài đặt các gói phụ thuộc
npm install

# 2. Biên dịch gói ứng dụng
npm run build

# 3. Khởi chạy ứng dụng Desktop
npm run start
# Hoặc khởi chạy môi trường phát triển web preview:
npm run dev
```

---

## 5. Dữ liệu mẫu (Sample Data) có sẵn

Ứng dụng được cấu hình tự động tạo sẵn dữ liệu mẫu ngay ở lần chạy đầu tiên:
- **Giáo viên mẫu:** Thầy Nguyễn Văn An (Mã: `GV001`, Môn: `Toán học & Vật lý`).
- **Bài học mẫu 1:** *Hàm số bậc hai và Đồ thị Parabol* (Toán 10) với các nét vẽ mô phỏng đồ thị toán học.
- **Bài học mẫu 2:** *Định luật II Newton - Lực và Gia tốc* (Vật lý 10) với công thức và sơ đồ lực.

---

## 6. Chế độ kiểm tra hệ thống (Diagnostics Mode)

Giáo viên hoặc kỹ thuật viên có thể bấm vào biểu tượng **Activity (Nhịp tim)** ở góc phải thanh tiêu đề để mở bảng Diagnostics:
- Kiểm tra kết nối Camera (30 FPS).
- Kiểm tra Hand Tracking Landmark Model & Face Recognition.
- Kiểm tra Embedded SQLite & IndexedDB Storage.
- Kiểm tra GPU WebGL Hardware Acceleration.
- Đo lường FPS thời gian thực và Xuất file báo cáo lỗi (`Export Diagnostic Log`).

---

## 7. Giấy phép & Bản quyền

Phát triển bởi đội ngũ kỹ sư **AIRTECH AI**. Bản quyền năm 2026.
Tất cả các quyền được bảo lưu.
# AirTech-AI
