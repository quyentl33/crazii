# Crazii MCP Server

MCP server cho GoClaw kết nối qua HTTP localhost. Expose 3 tools:
- `send_signal_alert` — format + gửi tín hiệu BUY/SELL lên Telegram
- `log_and_close_signal` — đóng lệnh, tính win rate, gửi kết quả
- `onboard_new_subscriber` — sinh tin nhắn chào mừng subscriber mới

**Transport:** Streamable HTTP | **Port:** 3001 (localhost only)

---

## Deploy lên VPS

### 1. Upload files

```bash
# Từ máy local — upload thư mục mcp/
scp -P 24700 -r ./mcp root@103.75.184.130:/opt/crazii/
```

### 2. Cài dependencies

```bash
cd /opt/crazii/mcp
npm install
```

### 3. Tạo file .env

```bash
cp .env.example .env
nano .env
```

Điền các giá trị:
```
MCP_PORT=3001
BRAIN_DB_PATH=/var/www/html/brain.db
TELEGRAM_BOT_TOKEN=<bot token từ @BotFather>
TELEGRAM_CHANNEL_ID=<channel ID nhóm subscriber>
```

### 4. Cài systemd service

```bash
cp systemd/crazii-mcp.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable crazii-mcp
systemctl start crazii-mcp
systemctl status crazii-mcp
```

### 5. Kiểm tra

```bash
# Health check
curl http://127.0.0.1:3001/health

# List tools
curl -s -X POST http://127.0.0.1:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'

# Test send_signal_alert
curl -s -X POST http://127.0.0.1:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0","id":2,
    "method":"tools/call",
    "params":{
      "name":"send_signal_alert",
      "arguments":{
        "coin":"BTC","direction":"LONG",
        "entry":59800,"stop_loss":58500,
        "take_profit":[61000,62500,64000],
        "timeframe":"4h","note":"Test"
      }
    }
  }'
```

---

## Kết nối GoClaw

Trong GoClaw dashboard → **MCP Servers** → **Add**:

```
URL:  http://127.0.0.1:3001/mcp
Type: streamable-http
```

---

## Quản lý service

```bash
systemctl status  crazii-mcp   # xem trạng thái
systemctl restart crazii-mcp   # restart
journalctl -u crazii-mcp -f    # xem logs realtime
```

---

## Cập nhật

```bash
cd /opt/crazii
git pull
systemctl restart crazii-mcp
```
