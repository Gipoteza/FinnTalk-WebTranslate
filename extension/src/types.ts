// Типы и интерфейсы для расширения Finnish-to-Russian Translator

// Тематика страницы — определяется автоматически через ChatGPT API
export type Topic =
  | 'медицина'
  | 'юриспруденция'
  | 'финансы'
  | 'техника'
  | 'IT'
  | 'бытовая'
  | 'деловая'
  | 'разговорная'

// Стиль перевода — выбирается пользователем в Popup UI
export type TranslationStyle = 'буквальный' | 'литературный' | 'нейтральный'

// Поддерживаемые модели ChatGPT
export type GptModel = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-3.5-turbo'

// Блок текста — фрагмент страницы размером 2000–4000 символов
export interface TextBlock {
  id: string           // UUID блока
  text: string         // Оригинальный текст
  nodeIds: string[]    // Идентификаторы DOM-узлов, входящих в блок
  translated?: string  // Переведённый текст (после получения от API)
  corrected?: string   // Скорректированный текст (после проверки качества)
}

// Состояние перевода для текущей вкладки (хранится в chrome.storage.session)
export interface TranslationState {
  tabId: number
  topic: Topic | null
  style: TranslationStyle
  blocks: TextBlock[]
  currentBlockIndex: number
  status: 'idle' | 'detecting' | 'translating' | 'done' | 'error'
  errorMessage?: string
}

// Настройки расширения (хранятся в chrome.storage.local)
export interface ExtensionSettings {
  proxyUrl: string                // URL Railway-прокси (например: https://my-proxy.railway.app)
  model: GptModel                 // Модель ChatGPT (по умолчанию: gpt-4o-mini)
  requestsPerMinute: number       // Лимит запросов в минуту (по умолчанию: 20)
  qualityCheckEnabled: boolean    // Включить проверку качества (по умолчанию: false)
  translationStyle: TranslationStyle // Стиль перевода (по умолчанию: нейтральный)
  autoTranslate: boolean          // Автоперевод при загрузке страницы (по умолчанию: false)
}

// Входящие сообщения от Popup и ContentScript в Background
export type IncomingMessage =
  | { type: 'TRANSLATE_PAGE'; tabId: number }
  | { type: 'TOGGLE_AUTO_TRANSLATE'; enabled: boolean }
  | { type: 'CHANGE_STYLE'; style: TranslationStyle }
  | { type: 'TEXT_EXTRACTED'; tabId: number; text: string; blocks: TextBlock[] }

// Исходящие сообщения из Background в ContentScript и Popup
export type OutgoingMessage =
  | { type: 'EXTRACT_TEXT' }
  | { type: 'REPLACE_BLOCK'; blockId: string; text: string }
  | { type: 'RESTORE_ORIGINAL' }
  | { type: 'SHOW_TRANSLATION' }
  | { type: 'PROGRESS_UPDATE'; done: number; total: number; topic: Topic }
  | { type: 'TRANSLATION_ERROR'; message: string; openOptions?: boolean }
