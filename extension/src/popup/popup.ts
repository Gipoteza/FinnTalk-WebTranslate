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
  const progressEl = document.getElementById('progress') as HTMLDivElement
  const progressText = document.getElementById('progress-text') as HTMLSpanElement
  const errorMessage = document.getElementById('error-message') as HTMLDivElement
  const errorText = document.getElementById('error-text') as HTMLParagraphElement
  const openSettings = document.getElementById('open-settings') as HTMLAnchorElement

  const settings = await chrome.storage.local.get(['autoTranslate'])
  if (settings.autoTranslate) {
    btnAutoTranslate.classList.add('active')
  }

  btnTranslate.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id == null) return
    chrome.runtime.sendMessage({ type: 'TRANSLATE_PAGE', tabId: tab.id })
    show(progressEl)
    progressText.textContent = '0 / ?'
    hide(errorMessage)
  })

  btnAutoTranslate.addEventListener('click', () => {
    const enabled = !btnAutoTranslate.classList.contains('active')
    if (enabled) {
      btnAutoTranslate.classList.add('active')
    } else {
      btnAutoTranslate.classList.remove('active')
    }
    chrome.runtime.sendMessage({ type: 'TOGGLE_AUTO_TRANSLATE', enabled })
  })

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

  openSettings.addEventListener('click', (e) => {
    e.preventDefault()
    chrome.runtime.openOptionsPage()
  })

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'PROGRESS_UPDATE') {
      const { done, total } = message as { type: 'PROGRESS_UPDATE'; done: number; total: number }
      show(progressEl)
      progressText.textContent = `${done} / ${total}`
    }
    if (message.type === 'TRANSLATION_ERROR') {
      const { message: msg, openOptions } = message as { type: 'TRANSLATION_ERROR'; message: string; openOptions?: boolean }
      errorText.textContent = msg
      show(errorMessage)
      if (openOptions) { show(openSettings) } else { hide(openSettings) }
    }
  })
}

document.addEventListener('DOMContentLoaded', init)
