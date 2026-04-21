// Фоновый сервис-воркер — центральный координатор расширения
// Управляет жизненным циклом перевода, очередью запросов и состоянием

import { ApiClient } from './api-client'
import { RequestQueue } from './queue'
import { normalizeTopic, buildSystemPrompt } from './topic-detector'
import type {
  TextBlock,
  TranslationState,
  ExtensionSettings,
  IncomingMessage,
  Topic,
} from '../types'

// ─── Вспомогательные функции ────────────────────────────────────────────────

function logError(requestId: string, code: number | string, message: string): void {
  console.error(
    `[FinnishTranslator] ERROR ${new Date().toISOString()} requestId=${requestId} code=${code} message=${message}`
  )
}

/** Возвращает блоки начиная с currentIndex (включительно) */
export function getBlocksToProcess(blocks: TextBlock[], currentIndex: number): TextBlock[] {
  return blocks.slice(currentIndex)
}

// ─── Загрузка настроек ──────────────────────────────────────────────────────

async function loadSettings(): Promise<ExtensionSettings> {
  return new Promise(resolve => {
    chrome.storage.local.get(
      {
        proxyUrl: 'https://finntalk-webtranslate-production.up.railway.app',
        model: 'gpt-4o-mini',
        requestsPerMinute: 20,
        qualityCheckEnabled: false,
        translationStyle: 'нейтральный',
        autoTranslate: false,
      },
      result => resolve(result as ExtensionSettings)
    )
  })
}

// ─── Состояние в chrome.storage.session ─────────────────────────────────────

async function saveState(state: TranslationState): Promise<void> {
  return new Promise(resolve => {
    chrome.storage.session.set({ translationState: state }, resolve)
  })
}

async function loadState(tabId: number): Promise<TranslationState | null> {
  return new Promise(resolve => {
    chrome.storage.session.get('translationState', result => {
      const state = result.translationState as TranslationState | undefined
      if (state && state.tabId === tabId) {
        resolve(state)
      } else {
        resolve(null)
      }
    })
  })
}

// ─── Singleton очереди и клиента ─────────────────────────────────────────────

let queue: RequestQueue | null = null
let apiClient: ApiClient | null = null

async function getQueueAndClient(): Promise<{ queue: RequestQueue; client: ApiClient }> {
  const settings = await loadSettings()
  if (!queue) {
    queue = new RequestQueue()
  }
  // Пересоздаём клиент при каждом вызове, чтобы подхватить актуальные настройки
  apiClient = new ApiClient(settings.proxyUrl, settings.model)
  return { queue, client: apiClient }
}

// ─── Обработка TRANSLATE_PAGE ────────────────────────────────────────────────

async function handleTranslatePage(tabId: number): Promise<void> {
  const requestId = `translate-${tabId}-${Date.now()}`

  // 1. Загружаем настройки
  const settings = await loadSettings()

  // 2. Проверяем наличие proxyUrl
  if (!settings.proxyUrl) {
    chrome.runtime.sendMessage({
      type: 'TRANSLATION_ERROR',
      message: 'Укажите URL Railway-прокси в настройках расширения.',
      openOptions: true,
    })
    return
  }

  // 3. Инициализируем состояние
  const initialState: TranslationState = {
    tabId,
    topic: null,
    style: settings.translationStyle,
    blocks: [],
    currentBlockIndex: 0,
    status: 'detecting',
  }
  await saveState(initialState)

  // 4. Запрашиваем извлечение текста из content script
  let extracted: { rawText: string; blocks: TextBlock[] }
  try {
    extracted = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_TEXT' }, response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else {
          resolve(response)
        }
      })
    })
  } catch (err: any) {
    logError(requestId, 'NETWORK', err.message ?? String(err))
    // Если content script не загружен — скорее всего страница не перезагружена после установки
    const isConnectionError = err.message?.includes('Could not establish connection') ||
      err.message?.includes('Receiving end does not exist')
    chrome.runtime.sendMessage({
      type: 'TRANSLATION_ERROR',
      message: isConnectionError
        ? 'Перезагрузите страницу (F5) и попробуйте снова.'
        : `Не удалось получить текст страницы: ${err.message}`,
    })
    return
  }

  const { rawText, blocks } = extracted

  // 5. Определяем тематику
  const { queue: q, client } = await getQueueAndClient()
  let topic: Topic
  try {
    const rawTopic = await q.enqueue(() => client.detectTopic(rawText))
    topic = normalizeTopic(rawTopic as unknown as string)
  } catch (err: any) {
    const code: number | string = err.code ?? 'NETWORK'
    logError(requestId, code, err.message ?? String(err))
    if (err.code === 401) {
      chrome.runtime.sendMessage({ type: 'TRANSLATION_ERROR', message: 'Ошибка авторизации. Проверьте OPENAI_API_KEY на Railway.', openOptions: true })
    } else if (err.code === 429) {
      chrome.runtime.sendMessage({ type: 'TRANSLATION_ERROR', message: 'Превышен лимит запросов. Попробуйте позже.' })
    } else {
      chrome.runtime.sendMessage({ type: 'TRANSLATION_ERROR', message: `Ошибка определения тематики: ${err.message}` })
    }
    return
  }

  chrome.runtime.sendMessage({ type: 'PROGRESS_UPDATE', done: 0, total: 1, topic })

  // 6. Переводим весь текст ОДНИМ запросом (быстро, без разбивки на блоки)
  const systemPrompt = buildSystemPrompt(topic, settings.translationStyle)
  let translatedText: string
  try {
    // Ограничиваем текст до 12000 символов чтобы уложиться в лимит токенов
    const textToTranslate = rawText.slice(0, 12000)
    translatedText = await q.enqueue(() => client.translateBlock(textToTranslate, systemPrompt))
  } catch (err: any) {
    const code: number | string = err.code ?? 'NETWORK'
    logError(requestId, code, err.message ?? String(err))
    if (err.code === 401) {
      chrome.runtime.sendMessage({ type: 'TRANSLATION_ERROR', message: 'Ошибка авторизации. Проверьте OPENAI_API_KEY на Railway.', openOptions: true })
    } else if (err.code === 429) {
      chrome.runtime.sendMessage({ type: 'TRANSLATION_ERROR', message: 'Превышен лимит запросов. Попробуйте позже.' })
    } else {
      chrome.runtime.sendMessage({ type: 'TRANSLATION_ERROR', message: `Ошибка перевода: ${err.message}` })
    }
    return
  }

  chrome.runtime.sendMessage({ type: 'PROGRESS_UPDATE', done: 1, total: 1, topic })

  // 7. Отправляем перевод в content script одним сообщением
  try {
    await new Promise<void>((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, {
        type: 'APPLY_TRANSLATION',
        translatedParts: [translatedText],
      }, response => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message))
        else resolve()
      })
    })
  } catch (err: any) {
    logError(requestId, 'APPLY', err.message ?? String(err))
    chrome.runtime.sendMessage({ type: 'TRANSLATION_ERROR', message: 'Перезагрузите страницу (F5) и попробуйте снова.' })
    return
  }

  // 8. Завершение
  const finalState = await loadState(tabId)
  if (finalState) await saveState({ ...finalState, status: 'done' })
}

// ─── Обработчик сообщений ────────────────────────────────────────────────────

if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener(
    (message: IncomingMessage, _sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => {
      if (message.type === 'TRANSLATE_PAGE') {
        handleTranslatePage(message.tabId).catch(err => {
          logError(`translate-${message.tabId}`, 'UNHANDLED', String(err))
        })
        sendResponse({ ok: true })
        return true
      }

      if (message.type === 'TOGGLE_AUTO_TRANSLATE') {
        chrome.storage.local.set({ autoTranslate: message.enabled }, () => {
          sendResponse({ ok: true })
        })
        return true
      }

      if (message.type === 'CHANGE_STYLE') {
        chrome.storage.local.set({ translationStyle: message.style }, () => {
          sendResponse({ ok: true })
        })
        return true
      }

      return false
    }
  )
}
