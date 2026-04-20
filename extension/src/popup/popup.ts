// Popup UI — управление переводом через всплывающую панель расширения

import type { TranslationStyle, Topic } from '../types'

// Состояние кнопки "Показать оригинал" / "Показать перевод"
let showingOriginal = false

function show(el: HTMLElement | null): void {
  el?.classList.remove('hidden')
}

function hide(el: HTMLElement | null): void {
  el?.classList.add('hidden')
}

async function init(): Promise<void> {
  const btnTranslate = document.getElementById('btn-translate') as HTMLButtonElement
  const btnAutoTranslate = document.getElementById('btn-auto-translate') as HTMLButtonElement
  const btnShowOriginal = document.getElementById('btn-show-original') as HTMLButtonElement
  const topicDisplay = document.getElementById('topic-display') as HTMLDivElement
  const topicText = document.getElementById('topic-text') as HTMLSpanElement
  const progressEl = document.getElementById('progress') as HTMLDivElement
  const progressText = document.getElementById('progress-text') as HTMLSpanElement
  const errorMessage = document.getElementById('error-message') as HTMLDivElement
  const errorText = document.getElementById('error-text') as HTMLParagraphElement
  const openSettings = document.getElementById('open-settings') as HTMLAnchorElement
  const styleRadios = document.querySelectorAll<HTMLInputElement>('input[name="style"]')

  // Загрузить настройки из chrome.storage.local
  const settings = await chrome.storage.local.get([
    'proxyUrl',
    'translationStyle',
    'autoTranslate',
  ])

  // Если нет proxyUrl — показать ошибку сразу
  if (!settings.proxyUrl) {
    errorText.textContent = 'Не указан URL прокси-сервера. Настройте расширение.'
    show(errorMessage)
  }

  // Установить активный стиль из настроек
  const savedStyle: TranslationStyle = settings.translationStyle ?? 'нейтральный'
  for (const radio of Array.from(styleRadios)) {
    if (radio.value === savedStyle) {
      radio.checked = true
      break
    }
  }

  // Установить состояние кнопки автоперевода
  if (settings.autoTranslate) {
    btnAutoTranslate.classList.add('active')
  }

  // Обработчик: Перевести страницу
  btnTranslate.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id == null) return
    chrome.runtime.sendMessage({ type: 'TRANSLATE_PAGE', tabId: tab.id })
    show(progressEl)
    progressText.textContent = '0 / ?'
    hide(errorMessage)
  })

  // Обработчик: Автоперевод (toggle)
  btnAutoTranslate.addEventListener('click', () => {
    const enabled = !btnAutoTranslate.classList.contains('active')
    if (enabled) {
      btnAutoTranslate.classList.add('active')
    } else {
      btnAutoTranslate.classList.remove('active')
    }
    chrome.runtime.sendMessage({ type: 'TOGGLE_AUTO_TRANSLATE', enabled })
  })

  // Обработчик: Показать оригинал / Показать перевод
  btnShowOriginal.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id == null) return

    if (!showingOriginal) {
      chrome.tabs.sendMessage(tab.id, { type: 'RESTORE_ORIGINAL' })
      btnShowOriginal.textContent = 'Показать перевод'
      showingOriginal = true
    } else {
      chrome.tabs.sendMessage(tab.id, { type: 'SHOW_TRANSLATION' })
      btnShowOriginal.textContent = 'Показать оригинал'
      showingOriginal = false
    }
  })

  // Обработчик: Изменение стиля
  for (const radio of Array.from(styleRadios)) {
    radio.addEventListener('change', () => {
      if (radio.checked) {
        chrome.runtime.sendMessage({
          type: 'CHANGE_STYLE',
          style: radio.value as TranslationStyle,
        })
      }
    })
  }

  // Открыть настройки
  openSettings.addEventListener('click', (e) => {
    e.preventDefault()
    chrome.runtime.openOptionsPage()
  })

  // Слушать сообщения от background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'PROGRESS_UPDATE') {
      const { done, total, topic } = message as {
        type: 'PROGRESS_UPDATE'
        done: number
        total: number
        topic: Topic
      }
      show(progressEl)
      progressText.textContent = `${done} / ${total}`

      if (topic) {
        topicText.textContent = topic
        show(topicDisplay)
      }
    }

    if (message.type === 'TRANSLATION_ERROR') {
      const { message: msg, openOptions } = message as {
        type: 'TRANSLATION_ERROR'
        message: string
        openOptions?: boolean
      }
      errorText.textContent = msg
      show(errorMessage)

      if (openOptions) {
        show(openSettings)
      } else {
        hide(openSettings)
      }
    }
  })
}

document.addEventListener('DOMContentLoaded', init)
