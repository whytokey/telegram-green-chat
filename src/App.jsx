import { useState, useCallback } from 'react';
import './App.css';
import {
  isTelegramInstance,
  formatDisplayTitle,
  resolveTelegramAccount,
  sendGreenMessage,
} from './api/greenApi';
import { useNotifications } from './hooks/useNotifications';
import LoginScreen from './components/LoginScreen';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';

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
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messagesByChat, setMessagesByChat] = useState({});
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [error, setError] = useState('');

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

  const appendMessage = useCallback((chatId, newMsg, senderTitle) => {
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
  }, []);

  useNotifications({
    isAuthorized,
    idInstance,
    apiTokenInstance,
    onIncomingMessage: appendMessage,
  });

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
        const resolved = await resolveTelegramAccount(idInstance, apiTokenInstance, raw);
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

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!messageText.trim() || !activeChatId || isSending) return;

    const textToSend = messageText.trim();
    const cleanId = idInstance.trim();

    setMessageText('');
    setIsSending(true);
    setError('');

    try {
      let targetChatId = String(activeChatId);

      if (isTelegramInstance(cleanId) && targetChatId.endsWith('@c.us')) {
        const resolved = await resolveTelegramAccount(
          idInstance,
          apiTokenInstance,
          targetChatId.replace('@c.us', '')
        );
        targetChatId = resolved.chatId;
        setChats((prev) =>
          prev.map((c) =>
            c.chatId === activeChatId ? { ...c, chatId: targetChatId, title: resolved.title } : c
          )
        );
        setActiveChatId(targetChatId);
      }

      const data = await sendGreenMessage(idInstance, apiTokenInstance, targetChatId, textToSend);

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

  if (!isAuthorized) {
    return (
      <LoginScreen
        idInstance={idInstance}
        setIdInstance={setIdInstance}
        apiTokenInstance={apiTokenInstance}
        setApiTokenInstance={setApiTokenInstance}
        error={error}
        onLogin={handleLogin}
      />
    );
  }

  const activeChat = chats.find((c) => c.chatId === activeChatId);
  const currentMessages = activeChatId ? messagesByChat[activeChatId] || [] : [];

  return (
    <main className={`workspace ${activeChatId ? 'has-active' : ''}`}>
      <Sidebar
        idInstance={idInstance}
        chats={chats}
        activeChatId={activeChatId}
        messagesByChat={messagesByChat}
        phoneInput={phoneInput}
        setPhoneInput={setPhoneInput}
        isCreatingChat={isCreatingChat}
        error={error}
        onCreateChat={handleCreateChat}
        onSelectChat={(chatId) => {
          setError('');
          setActiveChatId(chatId);
        }}
        onLogout={handleLogout}
      />

      <ChatWindow
        activeChatId={activeChatId}
        activeChat={activeChat}
        messages={currentMessages}
        messageText={messageText}
        setMessageText={setMessageText}
        isSending={isSending}
        onSendMessage={handleSendMessage}
        onBack={() => setActiveChatId(null)}
      />
    </main>
  );
}
