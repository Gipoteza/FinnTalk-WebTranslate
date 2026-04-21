import { ApiClient } from './api-client'
import { RequestQueue } from './queue'
import type { TextBlock, TranslationState, ExtensionSettings, IncomingMessage } from '../types'

const PROXY_URL = 'https://finntalk-webtranslate-production.up.railway.app'
const SYSTEM_PROMPT = 'Ты профессиональный переводчик с финского на русский язык. Переводи точно и естественно. Возвращай только перевод без комментариев.'

function log(...args: unknown[]): void {
  console.log('[FT]', ...args)
}

function logErr(...args: unknown[]): void {
  console.error('[FT ERROR]', ...args)
}

async function loadSettings(): Promise<ExtensionSettings> {
  return new Promise(resolve => {
    chrome.storage.local.get({
      proxyUrl: PROXY_URL,
      model: 'gpt-4o-mini',
      requestsPerMinute: 20,
      qualityCheckEnabled: false,
      translationStyle: 'нейтральный',
      autoTranslate: false,
    }, result => resolve(result as ExtensionSettings))
  })
}

const queue = new RequestQueue()

async function handleTranslatePage(tabId: number): Promise<void> {
  log('handleTranslatePage tabId=', tabId)

  const settings = await loadSettings()
  const client = new ApiClient(settings.proxyUrl || PROXY_URL, settings.model)

  // 1. Получаем текст со страницы
  log('sending EXTRACT_TEXT to tab', tabId)
  let rawText: string
  let blocks: TextBlock[]
  try {
    const extracted = await new Promise<{ rawText: string; blocks: TextBlock[] }>((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_TEXT' }, response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else if (!response) {
          reject(new Error('Empty response from content script'))
        } else {
          resolve(response)
        }
      })
    })
    rawText = extracted.rawText
    blocks = extracted.blocks
    log('EXTRACT_TEXT ok, rawText.length=', rawText.length, 'blocks=', blocks.length)
  } catch (err: any) {
    logErr('EXTRACT_TEXT failed:', err.message)
    chrome.runtime.sendMessage({
      type: 'TRANSLATION_ERROR',
      message: 'Перезагрузите страницу (F5) и попробуйте снова.',
    })
    return
  }

  if (!rawText || rawText.trim().length < 10) {
    logErr('rawText too short:', rawText?.length)
    chrome.runtime.sendMessage({ type: 'TRANSLATION_ERROR', message: 'На странице не найден текст для перевода.' })
    return
  }

  chrome.runtime.sendMessage({ type: 'PROGRESS_UPDATE', done: 0, total: 1, topic: 'бытовая' })

  // 2. Переводим одним запросом
  const textToTranslate = rawText.slice(0, 12000)
  log('translating, length=', textToTranslate.length)

  let translatedText: string
  try {
    translatedText = await queue.enqueue(() => client.translateBlock(textToTranslate, SYSTEM_PROMPT))
    log('translation ok, length=', translatedText.length, 'preview=', translatedText.slice(0, 80))
  } catch (err: any) {
    logErr('translateBlock failed:', err.message, 'code=', err.code)
    const msg = err.code === 401
      ? 'Ошибка авторизации. Проверьте OPENAI_API_KEY на Railway.'
      : err.code === 429
        ? 'Превышен лимит запросов. Попробуйте позже.'
        : `Ошибка перевода: ${err.message}`
    chrome.runtime.sendMessage({ type: 'TRANSLATION_ERROR', message: msg, openOptions: err.code === 401 })
    return
  }

  chrome.runtime.sendMessage({ type: 'PROGRESS_UPDATE', done: 1, total: 1, topic: 'бытовая' })

  // 3. Применяем перевод на странице
  log('sending APPLY_TRANSLATION to tab', tabId)
  try {
    await new Promise<void>((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, {
        type: 'APPLY_TRANSLATION',
        translatedParts: [translatedText],
      }, response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else {
          log('APPLY_TRANSLATION response:', response)
          resolve()
        }
      })
    })
  } catch (err: any) {
    logErr('APPLY_TRANSLATION failed:', err.message)
    chrome.runtime.sendMessage({ type: 'TRANSLATION_ERROR', message: 'Перезагрузите страницу (F5) и попробуйте снова.' })
    return
  }

  log('translation complete')
}

chrome.runtime.onMessage.addListener((message: IncomingMessage, _sender, sendResponse) => {
  log('onMessage:', message.type)

  if (message.type === 'TRANSLATE_PAGE') {
    handleTranslatePage(message.tabId).catch(err => {
      logErr('handleTranslatePage unhandled:', err)
    })
    sendResponse({ ok: true })
    return true
  }

  if (message.type === 'TOGGLE_AUTO_TRANSLATE') {
    chrome.storage.local.set({ autoTranslate: message.enabled }, () => sendResponse({ ok: true }))
    return true
  }

  if (message.type === 'CHANGE_STYLE') {
    chrome.storage.local.set({ translationStyle: message.style }, () => sendResponse({ ok: true }))
    return true
  }

  return false
})

log('service worker loaded')
