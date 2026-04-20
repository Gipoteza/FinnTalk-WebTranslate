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
  TranslationStyle,
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
    chrome.runtime.sendMessage({
      type: 'TRANSLATION_ERROR',
      message: `Не удалось получить текст страницы: ${err.message}`,
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
      chrome.runtime.sendMessage({
        type: 'TRANSLATION_ERROR',
        message: 'Ошибка авторизации на Railway-прокси. Проверьте OPENAI_API_KEY.',
        openOptions: true,
      })
    } else if (err.code === 429) {
      chrome.runtime.sendMessage({
        type: 'TRANSLATION_ERROR',
        message: 'Превышен лимит запросов к API. Попробуйте позже.',
      })
    } else {
      chrome.runtime.sendMessage({
        type: 'TRANSLATION_ERROR',
        message: `Сетевая ошибка при определении тематики: ${err.message}`,
      })
    }
    return
  }

  // 6. Обновляем состояние и отправляем прогресс с тематикой
  const stateAfterTopic: TranslationState = {
    tabId,
    topic,
    style: settings.translationStyle,
    blocks,
    currentBlockIndex: 0,
    status: 'translating',
  }
  await saveState(stateAfterTopic)

  chrome.runtime.sendMessage({
    type: 'PROGRESS_UPDATE',
    done: 0,
    total: blocks.length,
    topic,
  })

  // 7. Переводим каждый блок
  const blocksToProcess = getBlocksToProcess(blocks, 0)
  for (let i = 0; i < blocksToProcess.length; i++) {
    const block = blocksToProcess[i]
    const systemPrompt = buildSystemPrompt(topic, settings.translationStyle)

    let translatedText: string
    try {
      translatedText = await q.enqueue(() => client.translateBlock(block.text, systemPrompt))
    } catch (err: any) {
      const code: number | string = err.code ?? 'NETWORK'
      logError(requestId, code, err.message ?? String(err))

      if (err.code === 401) {
        chrome.runtime.sendMessage({
          type: 'TRANSLATION_ERROR',
          message: 'Ошибка авторизации на Railway-прокси. Проверьте OPENAI_API_KEY.',
          openOptions: true,
        })
      } else if (err.code === 429) {
        chrome.runtime.sendMessage({
          type: 'TRANSLATION_ERROR',
          message: 'Превышен лимит запросов к API. Попробуйте позже.',
        })
      } else {
        chrome.runtime.sendMessage({
          type: 'TRANSLATION_ERROR',
          message: `Сетевая ошибка при переводе блока ${i + 1}: ${err.message}`,
        })
      }
      return
    }

    // Опциональная проверка качества
    let finalText = translatedText
    if (settings.qualityCheckEnabled) {
      try {
        finalText = await q.enqueue(() => client.qualityCheck(block.text, translatedText))
      } catch (err: any) {
        const code: number | string = err.code ?? 'NETWORK'
        logError(requestId, code, err.message ?? String(err))
        // При ошибке quality check используем перевод без проверки
        finalText = translatedText
      }
    }

    // Отправляем замену в content script
    chrome.tabs.sendMessage(tabId, {
      type: 'REPLACE_BLOCK',
      blockId: block.id,
      text: finalText,
    })

    // Обновляем прогресс
    const done = i + 1
    chrome.runtime.sendMessage({
      type: 'PROGRESS_UPDATE',
      done,
      total: blocks.length,
      topic,
    })

    // Сохраняем текущий индекс
    const currentState = await loadState(tabId)
    if (currentState) {
      await saveState({ ...currentState, currentBlockIndex: done })
    }
  }

  // 8. Завершение
  const finalState = await loadState(tabId)
  if (finalState) {
    await saveState({ ...finalState, status: 'done' })
  }
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
