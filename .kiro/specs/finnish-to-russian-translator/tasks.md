# План реализации: Finnish-to-Russian Translator

## Обзор

Реализация браузерного расширения (Chrome/Firefox, Manifest V3) для перевода финских страниц на русский язык через Railway Proxy Server, который проксирует запросы к OpenAI ChatGPT API. Реализация ведётся на TypeScript.

## Задачи

- [x] 1. Настройка структуры проекта и базовых типов
  - Создать директорию `extension/` со структурой из дизайна
  - Создать файл `types.ts` с интерфейсами `TextBlock`, `TranslationState`, `ExtensionSettings` и перечислениями `Topic`, `TranslationStyle`, `GptModel`
  - Настроить `tsconfig.json` и `package.json` с зависимостями (`fast-check`, `jest`, `ts-jest`)
  - Создать `manifest.json` (Manifest V3) с объявлением `background`, `content_scripts`, `permissions` (`storage`, `activeTab`)
  - _Требования: 6.4, 6.5_

- [x] 2. Реализация Proxy Server для Railway
  - [x] 2.1 Создать `server/package.json` с зависимостями: `express`, `cors`, `typescript`, `ts-node`, `@types/express`, `@types/cors`, `@types/node`
    - _Требования: 6.5_
  - [x] 2.2 Создать `server/tsconfig.json` для Node.js (target: ES2020, module: CommonJS)
    - _Требования: 6.5_
  - [x] 2.3 Создать `server/railway.toml` с конфигурацией деплоя (startCommand: `npx ts-node index.ts`)
    - _Требования: 6.5_
  - [x] 2.4 Реализовать `server/index.ts`: Express сервер с CORS только для `chrome-extension://` origin, порт из `process.env.PORT`
    - _Требования: 6.5_
  - [x] 2.5 Реализовать `server/routes/proxy.ts`: три эндпоинта `POST /api/detect-topic`, `POST /api/translate`, `POST /api/quality-check`; каждый добавляет `Authorization: Bearer ${process.env.OPENAI_API_KEY}` и проксирует запрос к `https://api.openai.com/v1/chat/completions`
    - _Требования: 1.2, 2.2, 4.1, 6.5_
  - [x] 2.6 Создать `server/.env.example` с переменными `OPENAI_API_KEY=your_key_here` и `PORT=3000`
    - _Требования: 6.5_

- [x] 3. Реализация DOM Walker и Text Replacer
  - [x] 3.1 Реализовать `dom-walker.ts`: обход DOM в глубину, сбор текстовых узлов, исключение `<script>`, `<style>`, `<noscript>`, пропуск узлов менее 3 символов
    - _Требования: 8.1, 8.3_
  - [x]* 3.2 Property-тест для извлечения текста из DOM
    - **Свойство 1: Извлечение текста из DOM**
    - **Validates: Requirements 1.1**
  - [x]* 3.3 Property-тест для исключения script/style
    - **Свойство 14: Исключение script/style из извлечения**
    - **Validates: Requirements 8.1**
  - [x] 3.4 Реализовать `text-replacer.ts`: хранение оригинальных узлов в `Map<string, Text>`, замена `nodeValue`, методы `replaceBlock`, `restoreOriginal`, `showTranslation`
    - _Требования: 2.3, 5.4, 8.2, 8.4_
  - [x]* 3.5 Property-тест для сохранения HTML-структуры при замене текста
    - **Свойство 5: Сохранение HTML-структуры при замене текста**
    - **Validates: Requirements 2.3, 8.2**
  - [x]* 3.6 Property-тест для round-trip восстановления оригинала
    - **Свойство 9: Round-trip восстановления оригинала**
    - **Validates: Requirements 5.4, 8.4**

- [x] 4. Реализация разбивки текста на блоки
  - [x] 4.1 Реализовать функцию `splitIntoBlocks(text: string): TextBlock[]` в `content-script.ts`: блоки 2000–4000 символов с сохранением границ предложений, генерация UUID для каждого блока
    - _Требования: 2.1_
  - [ ]* 4.2 Property-тест для размера блоков текста
    - **Свойство 4: Размер блоков текста**
    - **Validates: Requirements 2.1**

- [x] 5. Реализация Content Script
  - [x] 5.1 Реализовать `content-script.ts`: методы `extractText()`, `replaceBlock()`, `restoreOriginal()`, `showTranslation()`; обработчик сообщений `chrome.runtime.onMessage` для команд `EXTRACT_TEXT` и `REPLACE_BLOCK`
    - _Требования: 1.1, 2.3, 2.4, 5.3, 5.4, 5.5_
  - [ ]* 5.2 Unit-тесты для Content Script
    - Тест: пустой DOM возвращает пустой результат
    - Тест: текстовые узлы менее 3 символов пропускаются
    - Тест: последний блок может быть меньше 2000 символов
    - _Требования: 8.3, 2.1_

- [x] 6. Контрольная точка — убедиться, что все тесты проходят
  - Убедиться, что все тесты проходят, задать вопросы пользователю при необходимости.

- [x] 7. Реализация API Client и Topic Detector
  - [x] 7.1 Реализовать `api-client.ts`: методы `detectTopic`, `translateBlock`, `qualityCheck`; все запросы через `fetch` к Railway Proxy (`proxyUrl` из настроек); API-ключ расширению неизвестен — он хранится только в переменных окружения Railway
    - _Требования: 1.2, 2.2, 4.1, 6.5_
  - [ ]* 7.2 Unit-тесты для API Client
    - Тест: структура запроса содержит модель, системный промпт и текст
    - Тест: запросы отправляются на `proxyUrl` из настроек, а не напрямую к OpenAI
    - _Требования: 6.5_
  - [x] 7.3 Реализовать `topic-detector.ts`: функцию `normalizeTopic(response: string): Topic` с маппингом восьми тематик и fallback на "бытовая"
    - _Требования: 1.3, 1.4_
  - [ ]* 7.4 Property-тест для нормализации тематики
    - **Свойство 2: Нормализация тематики**
    - **Validates: Requirements 1.3, 1.4**
  - [x] 7.5 Реализовать `buildSystemPrompt(topic: Topic, style: TranslationStyle): string` в `topic-detector.ts` согласно дизайну
    - _Требования: 1.5, 3.2_
  - [ ]* 7.6 Property-тест для системного промпта
    - **Свойство 3: Системный промпт для всех комбинаций тематики и стиля**
    - **Validates: Requirements 1.5, 3.2**

- [x] 8. Реализация очереди запросов
  - [x] 8.1 Реализовать `queue.ts`: интерфейс `RequestQueue`, метод `enqueue`, экспоненциальный backoff (1с → 2с → 4с, максимум 3 попытки), метод `pause(durationMs)` для обработки 429
    - _Требования: 7.1, 7.4_
  - [ ]* 8.2 Property-тест для повторных попыток при сетевой ошибке
    - **Свойство 12: Повторные попытки при сетевой ошибке**
    - **Validates: Requirements 7.1**
  - [ ]* 8.3 Unit-тесты для очереди
    - Тест: при HTTP 429 очередь приостанавливается на 60 секунд
    - Тест: при HTTP 401 уведомление + открытие Options Page
    - _Требования: 7.3, 7.4_

- [x] 9. Реализация Background Service Worker
  - [x] 9.1 Реализовать `service-worker.ts`: обработчики сообщений `TRANSLATE_PAGE`, `TOGGLE_AUTO_TRANSLATE`, `CHANGE_STYLE`, `TEXT_EXTRACTED`; управление `TranslationState` в `chrome.storage.session`; журналирование ошибок через `console.error` в формате `[FinnishTranslator] ERROR {timestamp} requestId={id} code={code} message={message}`
    - _Требования: 1.2, 1.3, 2.2, 2.4, 3.2, 3.4, 4.3, 7.2, 7.3, 7.4, 7.5_
  - [ ]* 9.2 Property-тест для изменения стиля
    - **Свойство 7: Изменение стиля применяется к следующим блокам**
    - **Validates: Requirements 3.4**
  - [ ]* 9.3 Property-тест для финального текста при проверке качества
    - **Свойство 8: Финальный текст при включённой проверке качества**
    - **Validates: Requirements 4.2, 4.3**
  - [ ]* 9.4 Property-тест для журналирования ошибок
    - **Свойство 13: Журналирование ошибок API**
    - **Validates: Requirements 7.5**

- [x] 10. Контрольная точка — убедиться, что все тесты проходят
  - Убедиться, что все тесты проходят, задать вопросы пользователю при необходимости.

- [x] 11. Реализация Popup UI
  - [x] 11.1 Создать `popup.html` и `popup.css`: три кнопки ("Перевести страницу", "Автоперевод", "Показать оригинал"), radio buttons для выбора стиля перевода, индикатор прогресса, отображение тематики
    - _Требования: 5.1, 5.2, 5.3, 5.6, 2.5, 3.1_
  - [x] 11.2 Реализовать `popup.js`: обработчики кнопок, отправка сообщений в Background, обновление индикатора прогресса и тематики, отображение сообщения при отсутствии `proxyUrl` с кнопкой "Открыть настройки"
    - _Требования: 5.1, 5.2, 5.3, 5.6, 2.5, 7.6_
  - [ ]* 11.3 Unit-тесты для Popup UI
    - Тест: наличие трёх кнопок управления
    - Тест: отображение сообщения при отсутствии `proxyUrl`
    - _Требования: 5.1, 5.2, 5.3, 7.6_
  - [ ]* 11.4 Property-тест для корректности индикатора прогресса
    - **Свойство 6: Корректность индикатора прогресса**
    - **Validates: Requirements 2.5**

- [x] 12. Реализация Options Page
  - [x] 12.1 Создать `options.html` и `options.css`: поле URL Railway-прокси (text input), выбор модели (select: gpt-4o, gpt-4o-mini, gpt-3.5-turbo), лимит запросов/мин (number input), переключатель проверки качества
    - _Требования: 6.1, 6.2, 6.3, 4.4_
  - [x] 12.2 Реализовать `options.js`: сохранение и загрузка настроек через `chrome.storage.local`, включая `proxyUrl`
    - _Требования: 6.1, 6.4_
  - [x]* 12.3 Property-тест для round-trip сохранения Proxy URL
    - **Свойство 11: Round-trip сохранения Proxy URL**
    - **Validates: Requirements 6.4**
  - [x]* 12.4 Unit-тесты для Options Page
    - Тест: наличие переключателя проверки качества
    - Тест: `proxyUrl` сохраняется и загружается корректно
    - _Требования: 4.4, 6.4_

- [x] 13. Реализация кэширования перевода
  - [x] 13.1 Реализовать логику кэширования в `service-worker.ts` и `content-script.ts`: переключение между оригиналом и переводом без повторных API-запросов
    - _Требования: 5.5_
  - [ ]* 13.2 Property-тест для кэширования перевода
    - **Свойство 10: Кэширование перевода**
    - **Validates: Requirements 5.5**

- [x] 14. Финальная контрольная точка — убедиться, что все тесты проходят
  - Убедиться, что все тесты проходят, задать вопросы пользователю при необходимости.

## Примечания

- Задачи, отмеченные `*`, являются опциональными и могут быть пропущены для ускорения MVP
- Каждая задача ссылается на конкретные требования для обеспечения трассируемости
- Property-тесты используют библиотеку `fast-check` с минимум 100 итерациями
- Каждый property-тест содержит тег `// Feature: finnish-to-russian-translator, Property {N}: {описание}`
- Контрольные точки обеспечивают инкрементальную валидацию
- API-ключ OpenAI хранится исключительно в переменных окружения Railway — расширение его не знает
