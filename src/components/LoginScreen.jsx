import Icon from './Icon';

export default function LoginScreen({
  idInstance,
  setIdInstance,
  apiTokenInstance,
  setApiTokenInstance,
  error,
  onLogin,
}) {
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

          <form onSubmit={onLogin}>
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
