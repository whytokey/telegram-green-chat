import { useState, useEffect, useRef } from 'react';
import './App.css';

const getApiUrl = (id) => {
  const cleanId = id.trim();
  if (cleanId.length >= 4) {
    return `https://${cleanId.slice(0, 4)}.api.green-api.com`;
  }
  return 'https://api.green-api.com';
};

const isTelegramInstance = (id) => id.trim().startsWith('4100');

const formatDisplayTitle = (chatId) => {
  if (!chatId) return '';
  return String(chatId).replace('@c.us', '');
};

const fetchWithRetry = async (url, options = {}, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, options);
    if (res.status === 429 && i < retries - 1) {
      await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
      continue;
    }
    return res;
  }
  return fetch(url, options);
};

function Icon({ name, size = 22 }) {
  const paths = {
    chat: 'M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5a8.5 8.5 0 0 1 4.7-7.6A8.4 8.4 0 0 1 12.5 3h.5a8.5 8.5 0 0 1 8 8v.5Z',
    send: 'm22 2-7 20-4-9L2 9 22 2ZM22 2 11 13',
    plus: 'M12 5v14M5 12h14',
    back: 'm15 18-6-6 6-6',
    exit: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
    lock: 'M5 10h14v11H5V10ZM8 10V7a4 4 0 0 1 8 0v3',
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name] || paths.chat} />
    </svg>
  );
}

export default function App() {
  const [idInstance, setIdInstance] = useState(
    () => localStorage.getItem('idInstance') || ''
  );
  const [apiTokenInstance, setApiTokenInstance] = useState(
    () => localStorage.getItem('apiTokenInstance') || ''
  );
  const [isAuthorized, setIsAuthorized] = useState(
    () => Boolean(localStorage.getItem('idInstance') && localStorage.getItem('apiTokenInstance'))
  );

  const [phoneInput, setPhoneInput] = useState('');
  const [chats, setChats] = useState([]); // [{ chatId, title, rawPhone }]
  const [activeChatId, setActiveChatId] = useState(null);
  const [messagesByChat, setMessagesByChat] = useState({}); // { [chatId]: [{ id, text, sender, time }] }
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [error, setError] = useState('');

  const messagesEndRef = useRef(null);
  const newChatInputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesByChat, activeChatId]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (!idInstance.trim() || !apiTokenInstance.trim()) {
      setError('Введите idInstance и apiTokenInstance');
      return;
    }
    localStorage.setItem('idInstance', idInstance.trim());
    localStorage.setItem('apiTokenInstance', apiTokenInstance.trim());
    setError('');
    setIsAuthorized(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('idInstance');
    localStorage.removeItem('apiTokenInstance');
    setIsAuthorized(false);
    setChats([]);
    setActiveChatId(null);
    setMessagesByChat({});
    setError('');
  };

  const resolveTelegramAccount = async (rawInput) => {
    const cleanId = idInstance.trim();
    const cleanToken = apiTokenInstance.trim();
    const apiUrl = getApiUrl(cleanId);
    const checkUrl = `${apiUrl}/waInstance${cleanId}/checkAccount/${cleanToken}`;
    const digits = rawInput.replace(/\D/g, '');

    if (!rawInput.startsWith('@') && !digits) {
      throw new Error('Введите номер телефона (например, 79991234567) или @username');
    }

    const payloads = rawInput.startsWith('@')
      ? [{ username: rawInput }, { username: rawInput.replace(/^@/, '') }]
      : [
          { phoneNumber: Number(digits), force: true },
          { phoneNumber: Number(digits) },
        ];

    let lastStatus = 0;
    for (const payload of payloads) {
      const res = await fetchWithRetry(checkUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      lastStatus = res.status;

      if (res.ok) {
        const data = await res.json();
        if (data?.exist && data?.chatId) {
          return {
            chatId: String(data.chatId),
            title: data.username ? `@${data.username.replace(/^@/, '')}` : `+${digits}`,
            rawPhone: digits,
          };
        }
        if (data?.status === false) {
          throw new Error('Лимит запросов Telegram к проверке номера. Подождите минуту и попробуйте снова.');
        }
      }
    }

    if (lastStatus === 401 || lastStatus === 403) {
      throw new Error('Неверный idInstance или apiTokenInstance (ошибка авторизации 401/403).');
    }

    try {
      const stateUrl = `${apiUrl}/waInstance${cleanId}/getStateInstance/${cleanToken}`;
      const stateRes = await fetch(stateUrl);
      if (stateRes.ok) {
        const stateData = await stateRes.json();
        if (stateData?.stateInstance && stateData.stateInstance !== 'authorized') {
          throw new Error(
            `Инстанс не авторизован в GREEN-API (статус: ${stateData.stateInstance}). Подключите Telegram в console.green-api.com.`
          );
        }
      }
    } catch (stateErr) {
      if (stateErr.message?.includes('Инстанс не авторизован')) throw stateErr;
    }

    throw new Error(
      'Аккаунт Telegram с таким номером не найден или скрыт настройками приватности Telegram.'
    );
  };

  const handleCreateChat = async (e) => {
    e.preventDefault();
    const raw = phoneInput.trim();
    if (!raw || isCreatingChat) return;

    setError('');
    setIsCreatingChat(true);

    const cleanId = idInstance.trim();

    try {
      let resolvedChatId = '';
      let resolvedTitle = raw;
      let rawPhone = raw.replace(/\D/g, '');

      if (isTelegramInstance(cleanId)) {
        const resolved = await resolveTelegramAccount(raw);
        resolvedChatId = resolved.chatId;
        resolvedTitle = resolved.title;
        rawPhone = resolved.rawPhone;
      } else {
        const digits = raw.replace(/\D/g, '');
        if (!digits) {
          throw new Error('Введите корректный номер телефона (например, 79991234567)');
        }
        resolvedChatId = raw.includes('@') ? raw : `${digits}@c.us`;
        resolvedTitle = `+${formatDisplayTitle(resolvedChatId)}`;
      }

      setChats((prev) => {
        if (prev.some((c) => c.chatId === resolvedChatId)) return prev;
        return [{ chatId: resolvedChatId, title: resolvedTitle, rawPhone }, ...prev];
      });
      setActiveChatId(resolvedChatId);
      setPhoneInput('');
    } catch (err) {
      setError(err.message || 'Ошибка при создании чата');
    } finally {
      setIsCreatingChat(false);
    }
  };

  const appendMessage = (chatId, newMsg, senderTitle) => {
    const normalizedChatId = String(chatId);

    setMessagesByChat((prev) => {
      const chatMessages = prev[normalizedChatId] || [];
      if (newMsg.id && chatMessages.some((m) => m.id === newMsg.id)) {
        return prev;
      }
      return {
        ...prev,
        [normalizedChatId]: [...chatMessages, newMsg],
      };
    });

    setChats((prev) => {
      if (prev.some((c) => c.chatId === normalizedChatId)) return prev;
      return [
        {
          chatId: normalizedChatId,
          title: senderTitle || formatDisplayTitle(normalizedChatId),
        },
        ...prev,
      ];
    });
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!messageText.trim() || !activeChatId || isSending) return;

    const textToSend = messageText.trim();
    const cleanId = idInstance.trim();
    const cleanToken = apiTokenInstance.trim();
    const apiUrl = getApiUrl(cleanId);

    setMessageText('');
    setIsSending(true);
    setError('');

    try {
      let targetChatId = String(activeChatId);

      if (isTelegramInstance(cleanId) && targetChatId.endsWith('@c.us')) {
        const resolved = await resolveTelegramAccount(targetChatId.replace('@c.us', ''));
        targetChatId = resolved.chatId;
        setChats((prev) =>
          prev.map((c) =>
            c.chatId === activeChatId ? { ...c, chatId: targetChatId, title: resolved.title } : c
          )
        );
        setActiveChatId(targetChatId);
      }

      const url = `${apiUrl}/waInstance${cleanId}/sendMessage/${cleanToken}`;
      const response = await fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: targetChatId,
          message: textToSend,
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`Ошибка отправки (HTTP ${response.status}) ${errText}`);
      }

      const data = await response.json();
      appendMessage(targetChatId, {
        id: data?.idMessage || `${Date.now()}`,
        text: textToSend,
        sender: 'me',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    } catch (err) {
      setError(
        err.message || 'Не удалось отправить сообщение. Проверьте авторизацию инстанса в GREEN-API.'
      );
      setMessageText(textToSend);
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    if (!isAuthorized) return;

    let isMounted = true;
    const abortController = new AbortController();

    const pollNotifications = async () => {
      const cleanId = idInstance.trim();
      const cleanToken = apiTokenInstance.trim();
      const apiUrl = getApiUrl(cleanId);

      while (isMounted) {
        try {
          const receiveUrl = `${apiUrl}/waInstance${cleanId}/receiveNotification/${cleanToken}?receiveTimeout=5`;
          const response = await fetch(receiveUrl, {
            method: 'GET',
            signal: abortController.signal,
          });

          if (!response.ok) {
            await new Promise((r) => setTimeout(r, 3000));
            continue;
          }

          const data = await response.json();

          if (!data || !data.receiptId) {
            await new Promise((r) => setTimeout(r, 1000));
            continue;
          }

          const { receiptId, body } = data;

          if (body?.typeWebhook === 'incomingMessageReceived') {
            const senderChatId = body.senderData?.chatId || body.senderData?.sender;
            const senderName = body.senderData?.chatName || body.senderData?.senderName;
            const msgType = body.messageData?.typeMessage;

            let incomingText = '';
            if (msgType === 'textMessage') {
              incomingText = body.messageData?.textMessageData?.textMessage || '';
            } else if (msgType === 'extendedTextMessage') {
              incomingText = body.messageData?.extendedTextMessageData?.text || '';
            }

            if (senderChatId && incomingText) {
              appendMessage(
                String(senderChatId),
                {
                  id: body.idMessage || `in-${receiptId}`,
                  text: incomingText,
                  sender: 'them',
                  time: new Date((body.timestamp || Date.now() / 1000) * 1000).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                },
                senderName
              );
            }
          }

          const deleteUrl = `${apiUrl}/waInstance${cleanId}/deleteNotification/${cleanToken}/${receiptId}`;
          await fetch(deleteUrl, {
            method: 'DELETE',
            signal: abortController.signal,
          });
        } catch (err) {
          if (err.name === 'AbortError') break;
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    };

    pollNotifications();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [isAuthorized, idInstance, apiTokenInstance]);

  if (!isAuthorized) {
    return (
      <main className="login-shell">
        <section className="intro">
          <div className="brand">
            <span className="brand-mark"><Icon name="chat" /></span> GREEN / CHAT
          </div>
          <div>
            <span className="eyebrow">REACT · TELEGRAM · GREEN-API</span>
            <h1>Тестовое задание для Green-api</h1>
          </div>
          <div className="intro-note">
            <Icon name="lock" size={18} />
            <span>Введите учетные данные вашего инстанса из личного кабинета GREEN-API.</span>
          </div>
        </section>

        <section className="login-panel">
          <div className="login-box">
            <span className="eyebrow">ПОДКЛЮЧЕНИЕ АККАУНТА</span>
            <h2>Ваш Telegram.<br />В новом окне.</h2>
            <p className="muted">Введите учетные данные вашего инстанса из личного кабинета GREEN-API.</p>

            {error && <p className="error" role="alert">{error}</p>}

            <form onSubmit={handleLogin}>
              <label htmlFor="instance">idInstance</label>
              <input
                id="instance"
                type="text"
                placeholder="Например: 410022771071"
                value={idInstance}
                onChange={(e) => setIdInstance(e.target.value)}
                required
              />

              <label htmlFor="token">apiTokenInstance</label>
              <input
                id="token"
                type="password"
                placeholder="Ваш токен доступа"
                value={apiTokenInstance}
                onChange={(e) => setApiTokenInstance(e.target.value)}
                required
              />

              <button type="submit" className="primary full">
                Войти в чат <Icon name="send" size={18} />
              </button>
            </form>
          </div>
        </section>
      </main>
    );
  }

  const activeChat = chats.find((c) => c.chatId === activeChatId);
  const currentMessages = activeChatId ? messagesByChat[activeChatId] || [] : [];

  return (
    <main className={`workspace ${activeChatId ? 'has-active' : ''}`}>
      <nav className="rail" aria-label="Приложение">
        <span className="brand-mark"><Icon name="chat" /></span>
        <button className="icon-button" onClick={handleLogout} title="Выйти">
          <Icon name="exit" />
        </button>
      </nav>

      <aside className="sidebar">
        <header className="sidebar-header">
          <div>
            <span className="eyebrow">GREEN / CHAT</span>
            <h1>Сообщения <span>{chats.length}</span></h1>
          </div>
          <button
            className="icon-button"
            title="Новый чат"
            onClick={() => newChatInputRef.current?.focus()}
          >
            <Icon name="plus" />
          </button>
        </header>

        <form className="new-chat" onSubmit={handleCreateChat}>
          <label htmlFor="recipient">Новый чат по номеру или @username</label>
          <div>
            <input
              ref={newChatInputRef}
              id="recipient"
              type="text"
              placeholder="Номер (79991234567) или @username"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              disabled={isCreatingChat}
            />
            <button type="submit" className="new-chat-button" title="Создать чат" disabled={isCreatingChat}>
              {isCreatingChat ? '…' : <Icon name="plus" size={20} />}
            </button>
          </div>
          {error && <p className="error" role="alert">{error}</p>}
        </form>

        <div className="chat-list">
          {chats.length === 0 ? (
            <p className="sidebar-empty">
              Введите номер телефона выше, чтобы начать диалог
            </p>
          ) : (
            chats.map((chat) => {
              const list = messagesByChat[chat.chatId] || [];
              const lastMsg = list[list.length - 1];
              return (
                <button
                  key={chat.chatId}
                  type="button"
                  className={`chat-item ${activeChatId === chat.chatId ? 'selected' : ''}`}
                  onClick={() => {
                    setError('');
                    setActiveChatId(chat.chatId);
                  }}
                >
                  <span className="avatar">{chat.title.slice(-2).toUpperCase()}</span>
                  <span className="chat-copy">
                    <span className="chat-top">
                      <strong>{chat.title}</strong>
                      {lastMsg && <time>{lastMsg.time}</time>}
                    </span>
                    <span className="chat-preview">
                      {lastMsg ? lastMsg.text : 'Нет сообщений'}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>

        <footer className="sidebar-footer">
          <span className="connection-dot live" />
          <div>
            <strong>Instance: {idInstance}</strong>
            <span>Получение включено</span>
          </div>
          <button className="icon-button" onClick={handleLogout} title="Выйти">
            <Icon name="exit" size={19} />
          </button>
        </footer>
      </aside>

      <div className="chat-main">
        {!activeChatId ? (
          <section className="empty-state">
            <span className="empty-art"><Icon name="chat" size={60} /></span>
            <span className="eyebrow">ВАШЕ ПРОСТРАНСТВО ДЛЯ ОБЩЕНИЯ</span>
            <h2>На связи.</h2>
            <p>Выберите существующий чат или создайте новый по номеру телефона</p>
          </section>
        ) : (
          <section className="conversation">
            <header className="conversation-header">
              <button
                className="icon-button mobile-back"
                onClick={() => setActiveChatId(null)}
                aria-label="К списку чатов"
              >
                <Icon name="back" />
              </button>
              <span className="avatar small">
                {(activeChat?.title || activeChatId).slice(-2).toUpperCase()}
              </span>
              <div>
                <h2>{activeChat?.title || formatDisplayTitle(activeChatId)}</h2>
                <p>ID: {activeChatId} · GREEN-API</p>
              </div>
            </header>

            <div className="messages">
              {currentMessages.length === 0 ? (
                <div className="chat-start">
                  <Icon name="chat" size={32} />
                  <h3>Начните разговор</h3>
                  <p>Напишите первое сообщение получателю {activeChat?.title || activeChatId}</p>
                </div>
              ) : (
                currentMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`message-row ${msg.sender === 'me' ? 'out' : 'in'}`}
                  >
                    <article className="bubble">
                      <p>{msg.text}</p>
                      <div className="message-meta">
                        <time>{msg.time}</time>
                        {msg.sender === 'me' && (
                          <span className="delivery read">Отправлено</span>
                        )}
                      </div>
                    </article>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <footer className="composer-area">
              <form className="composer" onSubmit={handleSendMessage}>
                <textarea
                  placeholder="Написать сообщение..."
                  value={messageText}
                  rows={1}
                  disabled={isSending}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      if (!isSending && messageText.trim()) {
                        handleSendMessage(e);
                      }
                    }
                  }}
                />
                <button
                  className="send-button"
                  type="submit"
                  disabled={!messageText.trim() || isSending}
                  aria-label="Отправить"
                >
                  <Icon name="send" size={21} />
                </button>
              </form>
              <div className="composer-hint">
                <span>Enter — отправить · Shift + Enter — новая строка</span>
                <span>{messageText.length} / 4096</span>
              </div>
            </footer>
          </section>
        )}
      </div>
    </main>
  );
}