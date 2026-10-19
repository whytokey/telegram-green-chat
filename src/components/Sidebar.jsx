import { useRef } from 'react';
import Icon from './Icon';

export default function Sidebar({
  idInstance,
  chats,
  activeChatId,
  messagesByChat,
  phoneInput,
  setPhoneInput,
  isCreatingChat,
  error,
  onCreateChat,
  onSelectChat,
  onLogout,
}) {
  const newChatInputRef = useRef(null);

  return (
    <>
      <nav className="rail" aria-label="Приложение">
        <span className="brand-mark"><Icon name="chat" /></span>
        <button className="icon-button" onClick={onLogout} title="Выйти">
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

        <form className="new-chat" onSubmit={onCreateChat}>
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
                  onClick={() => onSelectChat(chat.chatId)}
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
          <button className="icon-button" onClick={onLogout} title="Выйти">
            <Icon name="exit" size={19} />
          </button>
        </footer>
      </aside>
    </>
  );
}
