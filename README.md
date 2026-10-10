# Хелпер — Telegram Mini App для решения школьных задач по фотографии

Production-ready MVP: пользователь открывает Mini App, фотографирует (или загружает) задачу из учебника, а ИИ распознаёт условие, определяет предмет, решает задачу и выдаёт пошаговое объяснение.

---

## 1. Функциональность

- 📷 фотографирование / 📁 загрузка фото из галереи
- 🔍 экран подтверждения с режимом объяснения
- ⏳ красивый экран загрузки с этапами
- ✅ экран результата с формулами (KaTeX), копированием ответа/решения
- 🕘 история решений
- ⚖️ баланс и пакеты решений
- 💳 mock-платёжный провайдер + подготовка к Telegram Stars
- 🎁 реферальная программа
- 🧭 онбординг — показывается один раз новым пользователям (отметка хранится в БД)
- ✉️ регистрация и вход по email + паролю (вне Telegram)
- 🌓 тема — автоматически из Telegram (светлая/тёмная)

## 2. Стек

| Слой          | Технология                                                            |
| ------------- | --------------------------------------------------------------------- |
| Frontend      | Next.js 16 (App Router), React 19, TypeScript                         |
| Стили         | Tailwind CSS v4                                                       |
| Иконки        | lucide-react                                                          |
| Telegram      | `@tma.js/sdk` (client) + `@tma.js/init-data-node` (server validation) |
| Валидация     | Zod                                                                   |
| БД            | PostgreSQL + Prisma ORM                                               |
| AI            | OpenRouter (provider-абстракция)                                      |
| Хранение фото | `StorageProvider` (локально для dev, S3-совместимый — зарезервирован) |
| Платежи       | `PaymentProvider` (mock сейчас, Telegram Stars — дальше)              |
| Качество      | ESLint, Prettier, `tsc --noEmit`                                      |

## 3. Структура проекта

```
app/                  # маршруты и API
├── api/
│   ├── auth/
│   │   ├── telegram  # POST — вход по initData
│   │   ├── register  # POST — регистрация по email
│   │   └── login     # POST — вход по email
│   ├── me            # GET — текущий пользователь
│   ├── solutions     # GET/POST — список/создание
│   ├── solutions/[id]# GET — деталь решения
│   ├── balance       # GET — баланс
│   ├── packages      # GET — пакеты (цены из БД)
│   ├── payments/
│   │   ├── create    # POST — создать платёж
│   │   └── webhook   # POST — статус оплаты
│   ├── referral      # GET — реферальная ссылка
│   └── files/[...path] # раздача локальных файлов
├── result/[id]        # экран результата
├── history/           # история решений
├── balance/           # баланс и пакеты
layout.tsx, globals.css
components/            # React UI
lib/
├── telegram/          # валидация initData (сервер)
├── ai/                # AIProvider + провайдеры + cost
├── db/                # Prisma client
├── storage/           # StorageProvider (local/s3)
├── client/            # api, телеграм, оптимизация фото
└── server/            # auth, сессии, лимиты, image
services/
├── solution/          # пайплайн решения (списание кредита)
├── payment/           # платежи (mock)
├── user/             # пользователи
└── referral/          # реферальная программа
prisma/                # schema + seed
types/                 # общие типы
config/                # env-конфигурация и стоимость моделей
```

## 4. Установка

Требования:

- Node.js 20+ (рекомендуется 22)
- npm
- PostgreSQL 14+ (локально или через Docker)
- Telegram Bot (для Mini App)
- OpenRouter API key (для реального ИИ)

```bash
npm install
```

## 5. Environment variables

Скопируй `.env.example` в `.env` и заполни:

```bash
cp .env.example .env
```

| Переменная               | Назначение                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`           | строка подключения к PostgreSQL                                                                   |
| `TELEGRAM_BOT_TOKEN`     | токен бота (серверная проверка initData)                                                          |
| `TELEGRAM_BOT_USERNAME`  | username бота для реферальных ссылок                                                              |
| `AUTH_SECRET`            | секрет подписи сессий (`openssl rand -hex 32`)                                                    |
| `AI_PROVIDER`            | `mock` \| `openrouter` \| `bitcoincom`                                                            |
| `OPENROUTER_API_KEY`     | ключ OpenRouter                                                                                   |
| `OPENROUTER_MODEL`       | модель (по умолчанию `qwen/qwen3-vl-235b-a22b-instruct`)                                          |
| `OPENROUTER_CHEAP_MODEL` | дешёвая модель для режима «только ответ» (по умолчанию `google/gemini-2.5-flash-lite`)            |
| `BITCOINCOM_API_KEY`     | ключ ai.bitcoin.com (это API nano-gpt)                                                            |
| `BITCOINCOM_MODEL`       | модель (по умолчанию `qwen/qwen3-vl-235b-a22b-instruct`)                                          |
| `BITCOINCOM_CHEAP_MODEL` | дешёвая модель для «только ответ» (по умолчанию `gemini-2.5-flash-lite`)                          |
| `BITCOINCOM_BASE_URL`    | endpoint Bitcoin.com AI (по умолчанию `https://nano-gpt.com/api/v1`)                              |
| `AI_TIMEOUT_MS`          | таймаут запроса к ИИ в мс (по умолчанию `120000`)                                                 |
| `AI_RETRIES`             | повторные попытки при сетевой ошибке (по умолчанию `2`) — защита от временных сбоев сети          |
| `AI_RETRY_DELAY_MS`      | базовая задержка между повторами в мс (по умолчанию `1000`, растёт линейно: 1с, 2с, …)            |
| `AI_CHEAP_MODE`          | `true` (по умолчанию) — режим «только ответ» использует дешёвую модель; `false` — всегда основная |
| `APP_URL`                | публичный URL приложения                                                                          |
| `STORAGE_PROVIDER`       | `local` (dev) \| `s3` (future)                                                                    |
| `PAYMENT_PROVIDER`       | `mock` (сейчас) \| `telegram-stars`                                                               |
| `ALLOW_MOCK_PAYMENTS`    | разрешить mock-оплату (только dev)                                                                |

> ⚠️ Никогда не коммить реальные секреты. `.env` в `.gitignore`.
> ⚠️ `ALLOW_MOCK_PAYMENTS` принудительно выключен в production (`NODE_ENV=production`).

## 6. Запуск PostgreSQL

### Вариант А — Docker (рекомендуется)

```bash
docker run -d \
  --name gdz-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=gdz \
  -p 5432:5432 \
  -v gdz-postgres-data:/var/lib/postgresql/data \
  postgres:16-alpine
```

### Вариант Б — локально

Установи PostgreSQL и создай БД:

```bash
createdb gdz
```

Затем убедись, что `DATABASE_URL` указывает на неё.

## 7. Prisma migration

```bash
npx prisma migrate dev --name init   # создаёт таблицы из schema.prisma
npx prisma db seed                   # добавляет пакеты решений
```

Только для продакшена (без dev-интерактива):

```bash
npm run db:deploy
```

## 8. Запуск dev server

```bash
npm run dev
# → http://localhost:3000
```

Открой в браузере (не в Telegram) — приложение покажет экран входа/регистрации по email. Для входа через Telegram открой через Telegram Desktop / мобильное приложение (initData проверяется сервером).

## 9. Настройка Telegram Bot

1. Напиши [@BotFather](https://t.me/BotFather) → `/newbot` → получи токен.
2. Токен укажи в `TELEGRAM_BOT_TOKEN`.
3. (Опционально) задай username в `TELEGRAM_BOT_USERNAME` для реферальных ссылок.

## 10. Настройка Mini App

1. У BotFather: `/mybot` → твой бот → **Bot Settings** → **Menu Button** → укажи URL приложения.
2. Либо через [@BotFather → Mini App URL](https://core.telegram.org/bots/webapps).
3. Открывай: `https://t.me/<username>/app` — откроется Mini App.
4. Для локальной разработки удобно использовать `https://t.me/<username>/app?startapp=` + тестовый.

> Telegram требует HTTPS-домен для Mini App (не localhost из внешней сети). Можно использовать туннель (`npx localtunnel`? нет — `cloudflared tunnel --url http://localhost:3000`), либо `ngrok http 3000`. Укажи публичный URL в `APP_URL`.

## 11. Настройка ИИ-провайдера

Приложение умеет работать через **OpenRouter** или **Bitcoin.com AI** (ai.bitcoin.com — это OpenAI-совместимый API на базе nano-gpt). Достаточно загрузить один API-ключ нужного провайдера — провайдер подхватится автоматически (можно явно задать через `AI_PROVIDER`).

### Вариант А — OpenRouter

1. Зарегистрируйся на [openrouter.ai](https://openrouter.ai), создай ключ.
2. `OPENROUTER_API_KEY=<ключ>` в `.env` — провайдер подхватится автоматически.
3. По умолчанию основная модель — `qwen/qwen3-vl-235b-a22b-instruct` (отлично распознаёт фото задач).

### Вариант Б — Bitcoin.com AI (ai.bitcoin.com)

1. Зарегистрируйся на [ai.bitcoin.com](https://ai.bitcoin.com), создай API-ключ.
2. `BITCOINCOM_API_KEY=<ключ>` в `.env` — провайдер подхватится автоматически.
3. Ключ работает на endpoint `https://nano-gpt.com/api/v1` (по умолчанию, при необходимости переопределяется через `BITCOINCOM_BASE_URL`).

### Модели (рекомендация)

- **Основная (решение задач)** — `qwen/qwen3-vl-235b-a22b-instruct` (мультимодальная, отлично читает учебники).
- **Дешёвые задачи (режим «только ответ»)** — Gemini 2.5 Flash Lite: `google/gemini-2.5-flash-lite` (OpenRouter) / `gemini-2.5-flash-lite` (Bitcoin.com AI).

Выбор модели можно поменять через `OPENROUTER_MODEL` / `BITCOINCOM_MODEL` (и соответствующие `*_CHEAP_MODEL`). Если `AI_CHEAP_MODE=true` (по умолчанию), запросы в режиме «только ответ» автоматически идут на дешёвую модель, а в остальных режимах используется основная.

Без ключа (`AI_PROVIDER=mock`) используется встроенный mock-провайдер: весь флоу можно проверить без внешних вызовов.

## 12. Стоимость ИИ

`config/ai-models.ts` — цены на модели (USD за 1М токенов). `calculateAiCost()` считает оценку стоимости запроса; она сохраняется в `Solution` и используется для будущей аналитики экономики. Цены не хардкодятся в бизнес-логике.

## 13. Production deployment

Vercel:

```bash
npm run build
vercel
```

На Vercel обязательно задай environment variables (раздел Settings → Environment Variables). Для локального хранилища на Vercel используй S3-совместимое хранилище или ephemeral (файлы не переживут перезапуск — для продакшена подключи S3-провайдер).

## 14. Команды

```bash
npm install          # установка зависимостей (+ prisma generate)
npm run dev          # dev-сервер
npm run build        # production-сборка
npm run start        # запуск production-сборки
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run format       # Prettier
npx prisma migrate dev   # создать/применить миграцию
npx prisma studio        # GUI для БД
npx prisma db seed       # наполнение (пакеты)
```

## 15. Архитектурные решения

- **AI Provider интерфейс** (`lib/ai/provider.ts`): бизнес-логика зависит только от `AIProvider.solveProblem(image, options)`. Добавление Bitcoin.com AI = написать класс `BitcoinComProvider` и зарегистрировать в `getAIProvider()` — без изменения остального кода.
- **Списание кредита** (`services/solution`): кредит списывается атомарно с созданием решения в одной транзакции (`$transaction`). При ошибке ИИ кредит не списывается; загруженное фото удаляется. Двойное списание невозможно благодаря `updateMany` с условием `balance >= 1`.
- **Идентификация**: сервер доверяет только проверенному `initData` (HMAC-подпись + срок действия). Telegram ID из фронтенда никогда не используется напрямую. Email-аккаунты входят по паролю (хеш scrypt) и получают те же HMAC-сессии.
- **Цены**: читаются из БД (`CreditPackage`), а не из запроса. Frontend не передаёт стоимость как trusted value.
- **Платежи**: абстракция `PaymentProvider`. Сейчас `mock`; когда Telegram Stars будет доступен — новый провайдер без изменения бизнес-логики.
- **Реферальная система**: при создании пользователя реферер берётся из `start_param` (`ref_XXXX`). Награда реферу начисляется при первой успешной оплате приглашённого.
- **Rate limiting**: in-memory (достаточно для одного инстанса); для продакшена с несколькими инстансами нужен Redis.

## 16. Безопасность

- Серверная проверка Telegram initData (HMAC + expiration) — `lib/telegram/validate.ts`.
- Пароли — только scrypt с солью (`lib/server/auth.ts`); одинаковый ответ для «нет такого email» и «неверный пароль», лимиты на `/auth/login` и `/auth/register`.
- Подписанные HMAC-сессии (`AUTH_SECRET`).
- Валидация изображений на сервере: MIME allowlist + проверка magic bytes + лимит размера — несмотря на клиентскую оптимизацию.
- Rate limiting на чувствительные ручки.
- Ключи ИИ и токены — только на сервере, не логируются.
- Фото не логируются; при ошибке ИИ загруженное фото удаляется.

## 17. Примечания для продакшена

- Подмени `AUTH_SECRET` на сгенерированный.
- Для multi-instance rate limiting замени in-memory на Redis.
- Для персистентного хранения фото подключи S3-совместимый провайдер.
- Подключи реальный платёжный провайдер (Telegram Stars), когда появится доступ.
