(function () {
  const SERVER_URL = 'https://crazii.trading';

  const style = document.createElement('style');
  style.textContent = `
    #crazii-chat-btn {
      position: fixed; bottom: 24px; right: 24px; z-index: 9999;
      width: 56px; height: 56px; border-radius: 50%; border: none; cursor: pointer;
      background: linear-gradient(135deg, #C9941A, #E8B84B);
      box-shadow: 0 4px 20px rgba(201,148,26,0.5);
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s;
    }
    #crazii-chat-btn:hover { transform: scale(1.1); }
    #crazii-chat-btn svg { width: 26px; height: 26px; fill: white; }

    #crazii-chat-window {
      position: fixed; bottom: 90px; right: 24px; z-index: 9998;
      width: 360px; height: 500px; border-radius: 16px; overflow: hidden;
      background: #ffffff; border: 1px solid rgba(201,148,26,0.25);
      box-shadow: 0 8px 40px rgba(0,0,0,0.15);
      display: none; flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    #crazii-chat-window.open { display: flex; }

    #crazii-chat-header {
      background: linear-gradient(135deg, #C9941A, #E8B84B);
      padding: 14px 16px; display: flex; align-items: center; gap: 10px;
    }
    #crazii-chat-header .avatar {
      width: 32px; height: 32px; border-radius: 50%; background: rgba(255,255,255,0.25);
      display: flex; align-items: center; justify-content: center; font-size: 16px;
    }
    #crazii-chat-header .info { flex: 1; }
    #crazii-chat-header .name { color: white; font-weight: 600; font-size: 14px; }
    #crazii-chat-header .status { color: rgba(255,255,255,0.85); font-size: 11px; }
    #crazii-chat-close {
      background: none; border: none; cursor: pointer; color: white; font-size: 20px; padding: 0;
    }

    #crazii-chat-messages {
      flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px;
      background: #F8F9FA; scrollbar-width: thin; scrollbar-color: #E8B84B transparent;
    }
    .crazii-msg {
      max-width: 80%; padding: 10px 14px; border-radius: 14px; font-size: 13px; line-height: 1.5;
      white-space: pre-wrap; word-break: break-word;
    }
    .crazii-msg.user {
      background: linear-gradient(135deg, #C9941A, #E8B84B);
      color: white; align-self: flex-end; border-bottom-right-radius: 4px;
    }
    .crazii-msg.bot {
      background: #ffffff; color: #111827; align-self: flex-start; border-bottom-left-radius: 4px;
      border: 1px solid rgba(201,148,26,0.2);
    }
    .crazii-msg.typing { color: #A07314; font-style: italic; }

    #crazii-chat-input-area {
      padding: 12px; border-top: 1px solid rgba(201,148,26,0.2);
      display: flex; gap: 8px; align-items: flex-end; background: #ffffff;
    }
    #crazii-chat-input {
      flex: 1; background: #F8F9FA; border: 1px solid rgba(201,148,26,0.3); border-radius: 10px;
      color: #111827; padding: 10px 12px; font-size: 13px; resize: none; outline: none;
      max-height: 100px; font-family: inherit;
    }
    #crazii-chat-input:focus { border-color: #C9941A; }
    #crazii-chat-input::placeholder { color: #9CA3AF; }
    #crazii-chat-send {
      width: 38px; height: 38px; border-radius: 10px; border: none; cursor: pointer;
      background: linear-gradient(135deg, #C9941A, #E8B84B);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    #crazii-chat-send svg { width: 16px; height: 16px; fill: white; }
    #crazii-chat-send:disabled { opacity: 0.5; cursor: not-allowed; }

    #crazii-chat-suggestions {
      display: flex; flex-wrap: wrap; gap: 6px; padding: 0 16px 10px; background: #F8F9FA;
    }
    .crazii-suggestion {
      background: #ffffff; border: 1px solid rgba(201,148,26,0.4); border-radius: 20px;
      color: #A07314; font-size: 11px; padding: 5px 12px; cursor: pointer;
      transition: all 0.15s;
    }
    .crazii-suggestion:hover { background: #C9941A; color: white; border-color: #C9941A; }
  `;
  document.head.appendChild(style);

  // Chat button
  const btn = document.createElement('button');
  btn.id = 'crazii-chat-btn';
  btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>`;
  document.body.appendChild(btn);

  // Chat window
  const win = document.createElement('div');
  win.id = 'crazii-chat-window';
  win.innerHTML = `
    <div id="crazii-chat-header">
      <div class="avatar">🤖</div>
      <div class="info">
        <div class="name">Trợ lý Crazii</div>
        <div class="status">● AI tư vấn</div>
      </div>
      <button id="crazii-chat-close">×</button>
    </div>
    <div id="crazii-chat-messages">
      <div class="crazii-msg bot">Chào mừng bạn đến với Crazii Trading! 👋
Mình là Trợ lý Crazii — sẵn sàng hỗ trợ bạn theo dõi thị trường, phân tích giá crypto và giải đáp mọi thắc mắc về giao dịch.
Bạn cần hỗ trợ gì cứ nhắn mình nhé!</div>
    </div>
    <div id="crazii-chat-suggestions">
      <span class="crazii-suggestion" data-link="true">Đăng ký tài khoản</span>
      <span class="crazii-suggestion" data-link="true">Nhóm Telegram hỗ trợ</span>
    </div>
    <div id="crazii-chat-input-area">
      <textarea id="crazii-chat-input" rows="1" placeholder="Hỏi về giá crypto..."></textarea>
      <button id="crazii-chat-send">
        <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
      </button>
    </div>
  `;
  document.body.appendChild(win);

  const messages = win.querySelector('#crazii-chat-messages');
  const input = win.querySelector('#crazii-chat-input');
  const sendBtn = win.querySelector('#crazii-chat-send');
  let chatHistory = [];

  btn.addEventListener('click', () => win.classList.toggle('open'));
  win.querySelector('#crazii-chat-close').addEventListener('click', () => win.classList.remove('open'));

  const suggestionLinks = {
    'Đăng ký tài khoản': 'https://crazii.com?refCode=93685280',
    'Nhóm Telegram hỗ trợ': 'https://t.me/craziitrading1'
  };

  win.querySelectorAll('.crazii-suggestion').forEach(s => {
    s.addEventListener('click', () => {
      const link = suggestionLinks[s.textContent.trim()];
      if (link) {
        window.open(link, '_blank');
      } else {
        input.value = s.textContent;
        sendMessage();
      }
    });
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  sendBtn.addEventListener('click', sendMessage);

  function addMessage(text, role) {
    const div = document.createElement('div');
    div.className = `crazii-msg ${role}`;
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  }

  async function sendMessage() {
    const text = input.value.trim();
    if (!text || sendBtn.disabled) return;

    // Ẩn suggestions sau lần hỏi đầu
    win.querySelector('#crazii-chat-suggestions').style.display = 'none';

    addMessage(text, 'user');
    chatHistory.push({ role: 'user', text });
    input.value = '';
    sendBtn.disabled = true;

    const typing = addMessage('Đang xử lý...', 'bot typing');

    try {
      const res = await fetch(`${SERVER_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: chatHistory.slice(-10) })
      });
      const data = await res.json();
      const reply = data.reply || data.error || 'Có lỗi xảy ra.';
      typing.textContent = reply;
      typing.classList.remove('typing');
      chatHistory.push({ role: 'model', text: reply });
    } catch {
      typing.textContent = 'Không kết nối được server. Vui lòng thử lại.';
      typing.classList.remove('typing');
    }

    sendBtn.disabled = false;
    input.focus();
  }
})();
