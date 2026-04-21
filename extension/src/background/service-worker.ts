import { ApiClient } from './api-client'
import { RequestQueue } from './queue'
import type { TextBlock, ExtensionSettings } from '../types'

const PROXY_URL = 'https://finntalk-webtranslate-production.up.railway.app'
const SYSTEM_PROMPT = 'Ты профессиональный переводчик с финского на русский язык. Переводи точно и естественно. Возвращай только перевод без комментариев.'
const MAX_CHARS = 2000

const queue = new RequestQueue()

function log(...a: unknown[]): void { console.log('[FT]', ...a) }
function err(...a: unknown[]): void { console.error('[FT ERR]', ...a) }

async function getSettings(): Promise<ExtensionSettings> {
  return new Promise(r => chrome.storage.local.get({
    proxyUrl: PROXY_URL, model: 'gpt-4o-mini', requestsPerMinute: 20,
    qualityCheckEnabled: false, translationStyle: 'нейтральный', autoTranslate: false,
  }, s => r(s as ExtensionSettings)))
}

async function translate(text: string, model: string): Promise<string> {
  const client = new ApiClient(PROXY_URL, model as any)
  return queue.enqueue(() => client.translateBlock(text.slice(0, MAX_CHARS), SYSTEM_PROMPT))
}

async function handleTranslatePage(tabId: number): Promise<void> {
  log('translate tab', tabId)
  const settings = await getSettings()

  // 1. Извлекаем текст
  let rawText: string
  let blocks: TextBlock[]
  try {
    const res = await new Promise<any>((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_TEXT' }, r => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message))
        else if (!r) reject(new Error('no response'))
        else resolve(r)
      })
    })
    rawText = res.rawText
    blocks = res.blocks
    log('extracted chars=', rawText.length)
  } catch (e: any) {
    err('EXTRACT_TEXT:', e.message)
    chrome.runtime.sendMessage({ type: 'TRANSLATION_ERROR', message: 'Перезагрузите страницу (F5) и попробуйте снова.' })
    return
  }

  if (!rawText || rawText.trim().length < 5) {
    chrome.runtime.sendMessage({ type: 'TRANSLATION_ERROR', message: 'Текст для перевода не найден.' })
    return
  }

  chrome.runtime.sendMessage({ type: 'PROGRESS_UPDATE', done: 0, total: 1, topic: 'бытовая' })

  // 2. Переводим
  let translated: string
  try {
    translated = await translate(rawText, settings.model)
    log('translated chars=', translated.length)
  } catch (e: any) {
    err('translate:', e.message, 'code=', e.code)
    const msg = e.code === 401 ? 'Ошибка авторизации. Проверьте OPENAI_API_KEY на Railway.'
      : e.code === 429 ? 'Превышен лимит запросов.'
      : `Ошибка: ${e.message}`
    chrome.runtime.sendMessage({ type: 'TRANSLATION_ERROR', message: msg, openOptions: e.code === 401 })
    return
  }

  chrome.runtime.sendMessage({ type: 'PROGRESS_UPDATE', done: 1, total: 1, topic: 'бытовая' })

  // 3. Применяем
  try {
    await new Promise<void>((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { type: 'APPLY_TRANSLATION', translatedParts: [translated] }, r => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message))
        else { log('applied:', r); resolve() }
      })
    })
  } catch (e: any) {
    err('APPLY_TRANSLATION:', e.message)
    chrome.runtime.sendMessage({ type: 'TRANSLATION_ERROR', message: 'Перезагрузите страницу (F5) и попробуйте снова.' })
  }
}

chrome.runtime.onMessage.addListener((msg: any, _sender, sendResponse) => {
  log('msg:', msg.type)

  if (msg.type === 'TRANSLATE_PAGE') {
    handleTranslatePage(msg.tabId).catch(e => err('unhandled:', e))
    sendResponse({ ok: true })
    return true
  }

  if (msg.type === 'TRANSLATE_VISIBLE') {
    getSettings().then(s => translate(msg.text, s.model))
      .then(t => sendResponse({ translatedText: t }))
      .catch(e => { err('TRANSLATE_VISIBLE:', e); sendResponse({ translatedText: null }) })
    return true
  }

  if (msg.type === 'TOGGLE_AUTO_TRANSLATE') {
    chrome.storage.local.set({ autoTranslate: msg.enabled }, () => sendResponse({ ok: true }))
    return true
  }

  if (msg.type === 'CHANGE_STYLE') {
    chrome.storage.local.set({ translationStyle: msg.style }, () => sendResponse({ ok: true }))
    return true
  }

  return false
})

log('loaded')