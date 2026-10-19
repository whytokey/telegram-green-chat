export const getApiUrl = (id) => {
  const cleanId = id.trim();
  if (cleanId.length >= 4) {
    return `https://${cleanId.slice(0, 4)}.api.green-api.com`;
  }
  return 'https://api.green-api.com';
};

export const isTelegramInstance = (id) => id.trim().startsWith('4100');

export const formatDisplayTitle = (chatId) => {
  if (!chatId) return '';
  return String(chatId).replace('@c.us', '');
};

export const fetchWithRetry = async (url, options = {}, retries = 3) => {
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

export const resolveTelegramAccount = async (idInstance, apiTokenInstance, rawInput) => {
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

export const sendGreenMessage = async (idInstance, apiTokenInstance, chatId, message) => {
  const cleanId = idInstance.trim();
  const cleanToken = apiTokenInstance.trim();
  const apiUrl = getApiUrl(cleanId);
  const url = `${apiUrl}/waInstance${cleanId}/sendMessage/${cleanToken}`;

  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Ошибка отправки (HTTP ${response.status}) ${errText}`);
  }

  return response.json();
};
