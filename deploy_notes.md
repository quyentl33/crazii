# Deploy Notes — Crazii Chatbot

## Biến môi trường cần có trên VPS

Tạo file `/opt/crazii-chatbot/.env` với nội dung:

```
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3001
```

## Lệnh chạy server

```bash
# Cài dependencies
cd /opt/crazii-chatbot
npm install

# Chạy với PM2 (khuyến nghị — tự restart khi crash)
pm2 start server.js --name crazii-chatbot
pm2 save
pm2 startup  # để PM2 tự chạy khi VPS reboot

# Hoặc chạy thẳng
node server.js
```

## Cổng lắng nghe

- Mặc định: **3001**
- Ghi đè bằng biến môi trường `PORT`

## Nginx proxy

Nginx tại `/etc/nginx/sites-enabled/crazii.trading` đã được cấu hình proxy:
```
location /api/ → http://127.0.0.1:3001
```

## Kiểm tra server đang chạy

```bash
pm2 status
pm2 logs crazii-chatbot
curl http://localhost:3001/api/prices
```
