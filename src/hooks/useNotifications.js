import { useEffect } from 'react';
import { getApiUrl } from '../api/greenApi';

export function useNotifications({ isAuthorized, idInstance, apiTokenInstance, onIncomingMessage }) {
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
              onIncomingMessage(
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
  }, [isAuthorized, idInstance, apiTokenInstance, onIncomingMessage]);
}
