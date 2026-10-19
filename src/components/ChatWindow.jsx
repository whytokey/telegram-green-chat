import { useEffect, useRef } from 'react';
import Icon from './Icon';
import { formatDisplayTitle } from '../api/greenApi';

export default function ChatWindow({
  activeChatId,
  activeChat,
  messages,
  messageText,
  setMessageText,
  isSending,
  onSendMessage,
  onBack,
}) {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeChatId]);

  if (!activeChatId) {
    return (
      <div className="chat-main">
        <section className="empty-state">
          <span className="empty-art"><Icon name="chat" size={60} /></span>
          <span className="eyebrow">ВАШЕ ПРОСТРАНСТВО ДЛЯ ОБЩЕНИЯ</span>
          <h2>На связи.</h2>
          <p>Выберите существующий чат или создайте новый по номеру телефона</p>
        </section>
      </div>
    );
  }

  return (
    <div className="chat-main">
      <section className="conversation">
        <header className="conversation-header">
          <button
            className="icon-button mobile-back"
            onClick={onBack}
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
          {messages.length === 0 ? (
            <div className="chat-start">
              <Icon name="chat" size={32} />
              <h3>Начните разговор</h3>
              <p>Напишите первое сообщение получателю {activeChat?.title || activeChatId}</p>
            </div>
          ) : (
            messages.map((msg) => (
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
          <form className="composer" onSubmit={onSendMessage}>
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
                    onSendMessage(e);
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
    </div>
  );
}
