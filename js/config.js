/* =====================================================================
 * Masya Agent — конфигурация сайта.
 *
 * ЕДИНСТВЕННОЕ МЕСТО, КОТОРОЕ НУЖНО ПОМЕНЯТЬ ПОСЛЕ ЗАЛИВКИ НА HF:
 *   HF_SPACE_URL — публичный URL твоего Hugging Face Space.
 *
 * Пример: если твой Space называется  username/masya-agent,
 * то URL будет:  https://username-masya-agent.hf.space
 * (точный адрес виден в Space: "Embed this Space" -> Direct URL).
 * ===================================================================== */

window.MASYA_CONFIG = {
  // >>> ЗАМЕНИ ТОЛЬКО ЭТУ СТРОКУ <<<
  HF_SPACE_URL: "https://starfallapk-masya-agent.hf.space",

  // Ниже менять не нужно — всё строится от HF_SPACE_URL автоматически.
  endpoints: {
    chat: "/api/chat",     // POST, SSE-стриминг токенов
    health: "/api/health", // GET, статус моделей
    models: "/api/models", // GET, список моделей
  },

  models: [
    {
      id: "palma",
      name: "Masya Palma",
      tag: "1.0 Beta",
      short: "Palma 1.0",
      desc: "Универсальная крупная модель уровня экономных QWEN. Общение, рассуждения, ответы на вопросы.",
      badge: "Универсальная",
      params: "1.5B параметров",
    },
    {
      id: "quaero",
      name: "Masya Quaero",
      tag: "1.1b",
      short: "Quaero 1.1b",
      desc: "Специализированная модель для поиска в интернете: находит свежую информацию и отвечает с источниками.",
      badge: "Веб-поиск",
      params: "0.6B параметров",
    },
    {
      id: "code",
      name: "Masya Code",
      tag: "1.0c",
      short: "Code 1.0c",
      desc: "Специализированная модель для написания кода: Python, JS, C++, Rust, SQL и другие языки.",
      badge: "Код",
      params: "0.5B параметров",
    },
  ],

  defaultModel: "palma",
};
