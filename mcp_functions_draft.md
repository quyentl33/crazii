# MCP Functions — Crazii Trading
> 3 functions đã chọn để build. Mỗi function có spec đầy đủ + ví dụ trigger từ Telegram.

---

## #1 — `send_signal_alert`

**Mô tả:** Format và gửi tín hiệu BUY/SELL ra kênh Telegram subscriber theo template chuẩn Crazii.

**Input params:**
| Tên | Kiểu | Mô tả |
|---|---|---|
| `coin` | string | VD: `"BTC"`, `"ETH"`, `"SOL"` |
| `direction` | enum | `"LONG"` hoặc `"SHORT"` |
| `entry` | float | Giá vào lệnh |
| `stop_loss` | float | Giá cắt lỗ |
| `take_profit` | float[] | 1-3 mức chốt lời |
| `timeframe` | string | VD: `"15m"`, `"1h"`, `"4h"` |
| `note` | string (optional) | Ghi chú thêm |

**Output dự kiến:**
```
🟢 LONG BTC/USDT | 4H

📍 Entry: $59,800
🛡 Stop Loss: $58,500 (-2.2%)
🎯 TP1: $61,000 (+2%)
🎯 TP2: $62,500 (+4.5%)
🎯 TP3: $64,000 (+7.2%)

R:R = 1:2 | Risk: 2.2%
⏰ 07:32 — 29/06/2026

Crazii Trading 🦊
```

**Tình huống dùng hàng ngày:** Sáng phân tích xong → nhắn 1 câu → tín hiệu đẹp chuẩn template gửi thẳng vào group subscriber.

**Ví dụ câu nhắn Telegram trigger function:**
```
signal BTC long entry 59800 sl 58500 tp 61000 62500 64000 tf 4h
```
```
/signal ETH SHORT 1570 sl 1620 tp 1500 1450 tf 1h ghi_chú: momentum yếu, chờ xác nhận
```
```
BTC long 59800 sl 58500 tp1 61000 tp2 62500
```
> Bot hiểu nhiều kiểu viết tự nhiên, không cần nhớ cú pháp cứng.

---

## #2 — `log_and_close_signal`

**Mô tả:** Đóng tín hiệu + ghi kết quả vào log + tự tính win rate tháng → gửi thông báo kết quả về group.

**Input params:**
| Tên | Kiểu | Mô tả |
|---|---|---|
| `coin` | string | VD: `"BTC"` |
| `result` | enum | `"win"`, `"loss"`, `"breakeven"` |
| `close_price` | float | Giá đóng thực tế |
| `tp_hit` | int (optional) | TP nào đã hit: `1`, `2`, hoặc `3` |

**Output dự kiến:**
```
✅ KẾT QUẢ — BTC LONG

Vào: $59,800 → Ra: $61,050 (TP1 ✓)
Lợi nhuận: +2.1%

📊 Win Rate tháng 6: 14W / 3L / 1BE = 82.4%
Tổng tín hiệu: 18 | Tháng còn lại: 2 ngày

Crazii Trading 🦊
```

**Tình huống dùng hàng ngày:** Thị trường chạm TP → nhắn 1 câu → kết quả đẹp gửi group, win rate cập nhật tự động, có số để chốt đơn khách mới.

**Ví dụ câu nhắn Telegram trigger function:**
```
close BTC win 61050 tp1
```
```
/close ETH loss 1620
```
```
đóng SOL thắng 155 tp2
```
```
BTC breakeven 59800
```
> Nhắn khi thị trường chạm SL, TP, hoặc tự quyết định thoát — bot ghi vào log và tính win rate tự động.

---

## #5 — `onboard_new_subscriber`

**Mô tả:** Khi có khách mới trả tiền → sinh ngay tin nhắn chào mừng + hướng dẫn setup cá nhân hóa theo kinh nghiệm và thị trường quan tâm của họ.

**Input params:**
| Tên | Kiểu | Mô tả |
|---|---|---|
| `name` | string | Tên khách hàng |
| `plan` | enum | `"monthly"` hoặc `"annual"` |
| `experience` | enum | `"beginner"`, `"intermediate"`, `"experienced"` |
| `market_focus` | string (optional) | VD: `"crypto"`, `"forex"`, `"cả hai"` |

**Output dự kiến:**
```
Chào mừng Thanh Lan vào Crazii Trading! 🦊

Bạn vừa chọn đúng rồi. Setup 5 phút là xài được ngay:

1️⃣ Tải TradingView (app hoặc web)
2️⃣ Thêm Crazii indicator: [link]
3️⃣ Vào nhóm Telegram nhận tín hiệu: [link]

Vì bạn mới bắt đầu với Crypto, ngày đầu mình recommend:
→ Chỉ theo dõi BTC và ETH trước
→ Mỗi lệnh risk tối đa 2% vốn
→ KHÔNG vào lệnh khi chưa có mũi tên

Mình sẽ review lệnh đầu tiên của bạn cùng nhé!
Có gì cứ nhắn thẳng cho mình 24/7.
```

**Tình huống dùng hàng ngày:** Khách chuyển khoản xong → nhắn bot tên + gói → copy paste gửi họ ngay, không cần gõ lại từ đầu, không bao giờ quên bước nào.

**Ví dụ câu nhắn Telegram trigger function:**
```
onboard Thanh Lan monthly beginner crypto
```
```
/welcome "Minh Tuấn" annual intermediate forex
```
```
khách mới: Đức Hùng, gói năm, có kinh nghiệm, trade cả crypto lẫn vàng
```
> Bot hiểu tên có dấu cách nếu để trong ngoặc kép, hoặc viết tự nhiên kiểu câu cuối.

---

## Thứ tự build đề xuất

```
Tuần 1: send_signal_alert    ← Dùng được ngay, tạo value cho subscriber
Tuần 2: log_and_close_signal ← Cần send_signal_alert trước để có data log
Tuần 3: onboard_new_subscriber ← Độc lập, build sau cũng được
```
