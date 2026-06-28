require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const BRAIN_DB_PATH = process.env.BRAIN_DB_PATH || '/var/www/html/brain.db';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('ERROR: GEMINI_API_KEY is not set in .env');
  process.exit(1);
}

app.use(cors({ origin: '*' }));
app.use(express.json());

// Đọc brain.db và cache lại — refresh mỗi 10 phút
let brainContext = '';
function loadBrain() {
  try {
    const db = new Database(BRAIN_DB_PATH, { readonly: true });
    const brand  = db.prepare('SELECT title, content FROM brand_voice').all();
    const biz    = db.prepare('SELECT title, content FROM business').all();
    const know   = db.prepare('SELECT title, content FROM knowledge').all();
    db.close();

    const fmt = (rows) => rows.map(r => `- ${r.title}: ${r.content}`).join('\n');
    brainContext = `
=== THÔNG TIN DOANH NGHIỆP ===
${fmt(biz)}

=== PHONG CÁCH GIAO TIẾP ===
${fmt(brand)}

=== KIẾN THỨC NỀN ===
${fmt(know)}`.trim();

    console.log('Brain loaded:', brand.length, 'brand_voice,', biz.length, 'business,', know.length, 'knowledge entries');
  } catch (err) {
    console.warn('Brain DB not available:', err.message);
    brainContext = '';
  }
}

loadBrain();
setInterval(loadBrain, 10 * 60 * 1000);

// Lấy giá nhiều coin từ Binance
async function getCryptoPrices() {
  const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'];
  try {
    const results = await Promise.all(
      symbols.map(s =>
        fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${s}`)
          .then(r => r.json())
      )
    );
    return results.map(r => ({
      symbol: r.symbol.replace('USDT', ''),
      price: parseFloat(r.lastPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      change24h: parseFloat(r.priceChangePercent).toFixed(2),
      high24h: parseFloat(r.highPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      low24h: parseFloat(r.lowPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      volume24h: parseFloat(r.quoteVolume).toLocaleString('en-US', { maximumFractionDigits: 0 })
    }));
  } catch (err) {
    console.error('Binance API error:', err.message);
    return [];
  }
}

function buildPriceContext(prices) {
  if (!prices.length) return 'Không lấy được giá thị trường lúc này.';
  const lines = prices.map(p =>
    `${p.symbol}: $${p.price} (${p.change24h >= 0 ? '+' : ''}${p.change24h}% 24h | High: $${p.high24h} | Low: $${p.low24h} | Vol: $${p.volume24h})`
  );
  return `Giá crypto REALTIME (cập nhật lúc ${new Date().toLocaleTimeString('vi-VN')}):\n${lines.join('\n')}`;
}

app.post('/api/chat', async (req, res) => {
  const { message, history = [] } = req.body;
  if (!message) return res.status(400).json({ error: 'Thiếu message' });

  try {
    const prices = await getCryptoPrices();
    const priceContext = buildPriceContext(prices);

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-lite',
      systemInstruction: `Bạn là Trợ lý Crazii — AI tư vấn chính thức của website crazii.trading.
Nhiệm vụ: hỗ trợ khách hàng về thị trường crypto, phân tích giá, giải đáp thắc mắc về dịch vụ Crazii Trading.
Trả lời bằng tiếng Việt, ngắn gọn và thân thiện. Nếu khách hỏi tiếng Anh thì trả lời tiếng Anh.

${brainContext ? brainContext + '\n' : ''}
=== GIÁ THỊ TRƯỜNG REALTIME ===
${priceContext}`
    });

    const chat = model.startChat({
      history: history.map(h => ({
        role: h.role,
        parts: [{ text: h.text }]
      }))
    });

    const result = await chat.sendMessage(message);
    const reply = result.response.text();

    res.json({ reply });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: 'Lỗi server: ' + err.message });
  }
});

// Health check
app.get('/api/prices', async (req, res) => {
  const prices = await getCryptoPrices();
  res.json(prices);
});

app.listen(PORT, () => {
  console.log(`Crazii Chatbot Server running on port ${PORT}`);
});
