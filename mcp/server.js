import 'dotenv/config';
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import Database from 'better-sqlite3';
import { z } from 'zod';

// ─── Config ────────────────────────────────────────────────────────────────
const PORT            = parseInt(process.env.MCP_PORT || '3001');
const HOST            = '127.0.0.1';
const BRAIN_DB_PATH   = process.env.BRAIN_DB_PATH   || '/var/www/html/brain.db';
const TG_BOT_TOKEN    = process.env.TELEGRAM_BOT_TOKEN  || '';
const TG_CHANNEL_ID   = process.env.TELEGRAM_CHANNEL_ID || '';

// ─── Database ───────────────────────────────────────────────────────────────
const db = new Database(BRAIN_DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS signals (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    coin         TEXT    NOT NULL,
    direction    TEXT    NOT NULL,
    entry        REAL    NOT NULL,
    stop_loss    REAL    NOT NULL,
    take_profit  TEXT    NOT NULL,
    timeframe    TEXT    NOT NULL,
    note         TEXT    DEFAULT '',
    status       TEXT    DEFAULT 'open',
    result       TEXT,
    close_price  REAL,
    tp_hit       INTEGER,
    pnl_percent  REAL,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at    DATETIME
  )
`);

// ─── Helpers ────────────────────────────────────────────────────────────────
function ts() {
  return new Date().toISOString();
}

function log(tool, brief) {
  console.log(`[${ts()}] [${tool}] ${brief}`);
}

async function sendTelegram(text) {
  if (!TG_BOT_TOKEN || !TG_CHANNEL_ID) return { ok: false, reason: 'no credentials' };
  try {
    const r = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHANNEL_ID, text, parse_mode: 'HTML' })
    });
    return await r.json();
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

function pct(value, base) {
  return ((value - base) / base * 100).toFixed(2);
}

// ─── MCP Server factory ─────────────────────────────────────────────────────
// New instance per request — keeps stateless HTTP transport simple.
function buildServer() {
  const server = new McpServer({ name: 'crazii-mcp', version: '1.0.0' });

  // ── Tool 1: send_signal_alert ─────────────────────────────────────────────
  server.tool(
    'send_signal_alert',
    'Format và gửi tín hiệu BUY/SELL lên Telegram. Lưu vào DB để tracking win rate.',
    {
      coin:         z.string().min(1).max(20).describe('VD: BTC, ETH, SOL'),
      direction:    z.enum(['LONG', 'SHORT', 'long', 'short']).describe('LONG hoặc SHORT'),
      entry:        z.number().positive().describe('Giá vào lệnh'),
      stop_loss:    z.number().positive().describe('Giá cắt lỗ'),
      take_profit:  z.array(z.number().positive()).min(1).max(3).describe('Mảng 1-3 mức TP'),
      timeframe:    z.string().min(1).describe('VD: 15m, 1h, 4h'),
      note:         z.string().max(300).optional().describe('Ghi chú thêm (tùy chọn)'),
    },
    async ({ coin, direction, entry, stop_loss, take_profit, timeframe, note }) => {
      const dir  = direction.toUpperCase();
      const sym  = coin.toUpperCase();

      // Validate SL vs Entry
      if (dir === 'LONG'  && stop_loss >= entry)
        return { content: [{ type: 'text', text: '❌ Lỗi validation: LONG — stop_loss phải nhỏ hơn entry.' }], isError: true };
      if (dir === 'SHORT' && stop_loss <= entry)
        return { content: [{ type: 'text', text: '❌ Lỗi validation: SHORT — stop_loss phải lớn hơn entry.' }], isError: true };

      // Validate TPs direction
      const tpOk = take_profit.every(tp => dir === 'LONG' ? tp > entry : tp < entry);
      if (!tpOk)
        return { content: [{ type: 'text', text: `❌ Lỗi validation: TP phải ${dir === 'LONG' ? 'lớn hơn' : 'nhỏ hơn'} entry cho lệnh ${dir}.` }], isError: true };

      const slPct  = Math.abs(pct(stop_loss, entry));
      const tp1Pct = Math.abs(pct(take_profit[0], entry));
      const rr     = (parseFloat(tp1Pct) / parseFloat(slPct)).toFixed(1);

      const now      = new Date();
      const timeStr  = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      const dateStr  = now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const emoji    = dir === 'LONG' ? '🟢' : '🔴';

      let msg = `${emoji} <b>${dir} ${sym}/USDT | ${timeframe.toUpperCase()}</b>\n\n`;
      msg += `📍 Entry:     $${entry.toLocaleString('en-US')}\n`;
      msg += `🛡 Stop Loss: $${stop_loss.toLocaleString('en-US')} (-${slPct}%)\n`;
      take_profit.forEach((tp, i) => {
        const sign = dir === 'LONG' ? '+' : '-';
        const p    = Math.abs(pct(tp, entry));
        msg += `🎯 TP${i + 1}:       $${tp.toLocaleString('en-US')} (${sign}${p}%)\n`;
      });
      msg += `\nR:R = 1:${rr} | Risk: ${slPct}%\n`;
      msg += `⏰ ${timeStr} — ${dateStr}\n`;
      if (note) msg += `\n📌 ${note}\n`;
      msg += `\nCrazii Trading 🦊`;

      // Save to DB
      const ins = db.prepare(
        `INSERT INTO signals (coin, direction, entry, stop_loss, take_profit, timeframe, note)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      const { lastInsertRowid } = ins.run(sym, dir, entry, stop_loss, JSON.stringify(take_profit), timeframe, note || '');

      // Send Telegram
      const tg = await sendTelegram(msg);
      const tgLine = tg.ok
        ? `✅ Đã gửi Telegram`
        : `⚠️ Chưa gửi Telegram (${tg.reason || tg.description || 'lỗi không xác định'})`;

      const preview = msg.replace(/<b>|<\/b>/g, '**');
      const out = `${tgLine}\nSignal ID: #${lastInsertRowid}\n\n${'─'.repeat(30)}\n${preview}`;

      log('send_signal_alert', `${dir} ${sym} entry=${entry} sl=${stop_loss} | ID=${lastInsertRowid}`);
      return { content: [{ type: 'text', text: out }] };
    }
  );

  // ── Tool 2: log_and_close_signal ─────────────────────────────────────────
  server.tool(
    'log_and_close_signal',
    'Đóng tín hiệu đang mở, ghi kết quả, tính win rate tháng và gửi thông báo Telegram.',
    {
      coin:        z.string().min(1).max(20).describe('Tên coin, VD: BTC'),
      result:      z.enum(['win', 'loss', 'breakeven']).describe('Kết quả lệnh'),
      close_price: z.number().positive().describe('Giá đóng thực tế'),
      tp_hit:      z.number().int().min(1).max(3).optional().describe('TP đã chạm: 1, 2, hoặc 3'),
    },
    async ({ coin, result, close_price, tp_hit }) => {
      const sym = coin.toUpperCase();

      // Find most recent open signal
      const signal = db.prepare(
        `SELECT * FROM signals WHERE coin = ? AND status = 'open' ORDER BY created_at DESC LIMIT 1`
      ).get(sym);

      if (!signal)
        return {
          content: [{ type: 'text', text: `❌ Không tìm thấy lệnh đang mở cho ${sym}. Dùng send_signal_alert để gửi tín hiệu trước.` }],
          isError: true
        };

      // Calculate PnL
      const rawPnl = signal.direction === 'LONG'
        ? (close_price - signal.entry) / signal.entry * 100
        : (signal.entry - close_price) / signal.entry * 100;
      const pnlPct = rawPnl.toFixed(2);

      // Update DB
      db.prepare(
        `UPDATE signals SET status='closed', result=?, close_price=?, tp_hit=?, pnl_percent=?, closed_at=CURRENT_TIMESTAMP WHERE id=?`
      ).run(result, close_price, tp_hit ?? null, rawPnl, signal.id);

      // Monthly win rate
      const now        = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const stats      = db.prepare(
        `SELECT
           COUNT(*) as total,
           SUM(CASE WHEN result='win'       THEN 1 ELSE 0 END) as wins,
           SUM(CASE WHEN result='loss'      THEN 1 ELSE 0 END) as losses,
           SUM(CASE WHEN result='breakeven' THEN 1 ELSE 0 END) as bes
         FROM signals WHERE status='closed' AND closed_at >= ?`
      ).get(monthStart);

      const wr       = stats.total > 0 ? (stats.wins / stats.total * 100).toFixed(1) : '0';
      const resEmoji = result === 'win' ? '✅' : result === 'loss' ? '❌' : '⚡';
      const pnlSign  = rawPnl >= 0 ? '+' : '';
      const tpLabel  = tp_hit ? ` (TP${tp_hit} ✓)` : '';
      const monthName = now.toLocaleString('vi-VN', { month: 'long' });

      let msg = `${resEmoji} <b>KẾT QUẢ — ${signal.direction} ${sym}</b>\n\n`;
      msg += `Vào: $${signal.entry.toLocaleString('en-US')} → Ra: $${close_price.toLocaleString('en-US')}${tpLabel}\n`;
      msg += `Lợi nhuận: ${pnlSign}${pnlPct}%\n\n`;
      msg += `📊 Win Rate ${monthName}: ${stats.wins}W / ${stats.losses}L / ${stats.bes}BE = <b>${wr}%</b>\n`;
      msg += `Tổng tín hiệu tháng: ${stats.total}\n\n`;
      msg += `Crazii Trading 🦊`;

      const tg     = await sendTelegram(msg);
      const tgLine = tg.ok ? '✅ Đã gửi Telegram' : `⚠️ Chưa gửi Telegram (${tg.reason || tg.description || 'lỗi'})`;

      const preview = msg.replace(/<b>|<\/b>/g, '**');
      const out = `${tgLine}\n\n${'─'.repeat(30)}\n${preview}`;

      log('log_and_close_signal', `${sym} ${result} close=${close_price} PnL=${pnlSign}${pnlPct}% WR=${wr}%`);
      return { content: [{ type: 'text', text: out }] };
    }
  );

  // ── Tool 3: onboard_new_subscriber ───────────────────────────────────────
  server.tool(
    'onboard_new_subscriber',
    'Sinh tin nhắn chào mừng và hướng dẫn setup cá nhân hóa cho subscriber mới.',
    {
      name:         z.string().min(1).max(100).describe('Tên khách hàng'),
      plan:         z.enum(['monthly', 'annual']).describe('monthly hoặc annual'),
      experience:   z.enum(['beginner', 'intermediate', 'experienced']).describe('Kinh nghiệm trading'),
      market_focus: z.string().max(100).optional().describe('crypto, forex, cả hai... (tùy chọn)'),
    },
    async ({ name, plan, experience, market_focus }) => {
      const planLabel = plan === 'annual'
        ? 'Gói năm — 8,900,000 VNĐ (tiết kiệm đến 70%)'
        : 'Gói tháng — 999,000 VNĐ';

      const market = market_focus || 'crypto';

      const expDesc = {
        beginner:     'mới bắt đầu chưa có kinh nghiệm trading',
        intermediate: 'đã có ít kinh nghiệm trading',
        experienced:  'đã có nhiều kinh nghiệm trading',
      }[experience];

      const tips = {
        beginner: [
          'Chỉ theo dõi BTC và ETH trước — đừng phân tán',
          'Mỗi lệnh risk tối đa 2% vốn',
          'KHÔNG vào lệnh khi chưa có mũi tên',
          'Chụp màn hình mọi lệnh để mình review cùng',
        ],
        intermediate: [
          'Có thể theo dõi thêm SOL, BNB ngoài BTC/ETH',
          'Risk mỗi lệnh 1–3% vốn',
          'Ưu tiên xem khung 4H trước khi trade khung nhỏ hơn',
          'Gửi log lệnh cuối ngày để mình coach',
        ],
        experienced: [
          'Tự chọn coin thanh khoản cao phù hợp chiến lược của bạn',
          'Điều chỉnh risk theo hệ thống quản lý vốn cá nhân',
          'Kết hợp phân tích của bạn với tín hiệu Crazii để filter',
          'Share insight — mình học từ bạn cũng nhiều 😄',
        ],
      }[experience];

      const tipLines = tips.map((t, i) => `${i + 1}. ${t}`).join('\n');

      const msg = [
        `Chào mừng ${name} vào Crazii Trading! 🦊`,
        '',
        `Bạn vừa chọn đúng rồi. Setup 5 phút là xài được ngay:`,
        '',
        `1. Tải TradingView (web hoặc app điện thoại)`,
        `2. Add Crazii indicator: https://crazii.com?refCode=93685280`,
        `3. Vào nhóm Telegram nhận tín hiệu: https://t.me/craziitrading1`,
        '',
        `Vì bạn ${expDesc} và quan tâm thị trường ${market}, mình recommend:`,
        tipLines,
        '',
        `Gói của bạn: ${planLabel}`,
        '',
        `Mình sẽ review lệnh đầu tiên của bạn cùng nhé!`,
        `Có gì cứ nhắn thẳng cho mình 24/7 💪`,
      ].join('\n');

      log('onboard_new_subscriber', `name=${name} plan=${plan} exp=${experience} market=${market}`);
      return {
        content: [{
          type: 'text',
          text: `✅ Tin nhắn onboarding cho ${name} (${plan} / ${experience})\n\n${'─'.repeat(30)}\n\n${msg}`
        }]
      };
    }
  );

  return server;
}

// ─── Stdio mode (GoClaw subprocess) ─────────────────────────────────────────
const STDIO_MODE = process.argv.includes('--stdio');

if (STDIO_MODE) {
  // GoClaw launches this as a subprocess — communicate via stdin/stdout
  const server    = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Keep process alive; transport closes when GoClaw disconnects
} else {
  // ─── HTTP mode (standalone / curl testing) ─────────────────────────────────
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    const open   = db.prepare("SELECT COUNT(*) as n FROM signals WHERE status='open'").get();
    const closed = db.prepare("SELECT COUNT(*) as n FROM signals WHERE status='closed'").get();
    res.json({ status: 'ok', server: 'crazii-mcp', version: '1.0.0', signals: { open: open.n, closed: closed.n } });
  });

  async function handleMcp(req, res) {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const server    = buildServer();
    res.on('close', () => { transport.close(); server.close(); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error(`[${ts()}] MCP error:`, err.message);
      if (!res.headersSent) res.status(500).json({ error: err.message });
    }
  }

  app.post('/mcp', handleMcp);
  app.get('/mcp',  handleMcp);
  app.delete('/mcp', handleMcp);

  app.listen(PORT, HOST, () => {
    console.log(`[${ts()}] Crazii MCP Server → http://${HOST}:${PORT}`);
    console.log(`[${ts()}] Brain DB         → ${BRAIN_DB_PATH}`);
    console.log(`[${ts()}] Telegram         → ${TG_BOT_TOKEN ? 'configured' : 'not configured'}`);
  });
}
