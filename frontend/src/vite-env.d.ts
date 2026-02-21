/// <reference types="vite/client" />

interface TelegramWebApp {
  initData: string;
  ready: () => void;
  expand: () => void;
}

interface TelegramWindow {
  WebApp: TelegramWebApp;
}

interface Window {
  Telegram?: TelegramWindow;
}
