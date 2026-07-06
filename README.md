# Masya Agent — сайт

Статический сайт без сборки: HTML + CSS + JS. Хостится на Firebase Hosting (бесплатный тариф Spark).

## Связь с Hugging Face

Открой `js/config.js` и замени **одну строку**:

```js
HF_SPACE_URL: "https://YOUR-USERNAME-masya-agent.hf.space",
```

Точный адрес твоего Space: открой Space на huggingface.co → меню «⋯» → «Embed this Space» → Direct URL.
Больше нигде ссылки менять не нужно.

## Деплой на Firebase

```bash
npm install -g firebase-tools
firebase login
cd site
firebase init hosting   # выбери существующий проект, public: "." , SPA: No
firebase deploy
```

Файл `firebase.json` уже настроен (кэширование шрифтов и картинок).

## Локальный просмотр

Любой статический сервер, например:

```bash
npx serve .
```

## Структура

```
site/
├── index.html          # лендинг + чат (одна страница)
├── css/style.css       # стили, темы dark/light, анимации
├── js/config.js        # <<< HF_SPACE_URL меняется здесь
├── js/app.js           # логика: чат, стриминг SSE, темы, анимации
├── assets/             # логотип, шрифт Inter
└── firebase.json       # конфиг Firebase Hosting
```
