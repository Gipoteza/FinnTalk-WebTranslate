// Options Page — настройки расширения (прокси URL, модель, лимиты, проверка качества)

import { ExtensionSettings, GptModel, TranslationStyle } from '../types'

const DEFAULT_SETTINGS: ExtensionSettings = {
  proxyUrl: 'https://finntalk-webtranslate-production.up.railway.app',
  model: 'gpt-4o-mini',
  requestsPerMinute: 20,
  qualityCheckEnabled: false,
  translationStyle: 'нейтральный',
  autoTranslate: false,
}

// Сериализация настроек в plain object для хранения
export function serializeSettings(settings: Partial<ExtensionSettings>): Record<string, unknown> {
  return { ...settings } as Record<string, unknown>
}

// Десериализация настроек из plain object с применением дефолтных значений
export function deserializeSettings(raw: Record<string, unknown>): ExtensionSettings {
  return {
    proxyUrl: typeof raw['proxyUrl'] === 'string' ? raw['proxyUrl'] : DEFAULT_SETTINGS.proxyUrl,
    model: isGptModel(raw['model']) ? raw['model'] : DEFAULT_SETTINGS.model,
    requestsPerMinute:
      typeof raw['requestsPerMinute'] === 'number'
        ? raw['requestsPerMinute']
        : DEFAULT_SETTINGS.requestsPerMinute,
    qualityCheckEnabled:
      typeof raw['qualityCheckEnabled'] === 'boolean'
        ? raw['qualityCheckEnabled']
        : DEFAULT_SETTINGS.qualityCheckEnabled,
    translationStyle: isTranslationStyle(raw['translationStyle'])
      ? raw['translationStyle']
      : DEFAULT_SETTINGS.translationStyle,
    autoTranslate:
      typeof raw['autoTranslate'] === 'boolean'
        ? raw['autoTranslate']
        : DEFAULT_SETTINGS.autoTranslate,
  }
}

function isGptModel(value: unknown): value is GptModel {
  return value === 'gpt-4o' || value === 'gpt-4o-mini' || value === 'gpt-3.5-turbo'
}

function isTranslationStyle(value: unknown): value is TranslationStyle {
  return value === 'буквальный' || value === 'литературный' || value === 'нейтральный'
}

// Сохранить настройки в chrome.storage.local
export function saveSettings(settings: Partial<ExtensionSettings>): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set(serializeSettings(settings), () => resolve())
  })
}

// Загрузить настройки из chrome.storage.local
export function loadSettings(): Promise<ExtensionSettings> {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (raw) => {
      resolve(deserializeSettings(raw as Record<string, unknown>))
    })
  })
}

// Инициализация страницы настроек
function initOptionsPage(): void {
  const proxyUrlInput = document.getElementById('proxy-url') as HTMLInputElement
  const modelSelect = document.getElementById('model') as HTMLSelectElement
  const requestsPerMinuteInput = document.getElementById('requests-per-minute') as HTMLInputElement
  const qualityCheckInput = document.getElementById('quality-check') as HTMLInputElement
  const btnSave = document.getElementById('btn-save') as HTMLButtonElement
  const saveStatus = document.getElementById('save-status') as HTMLDivElement

  // Загрузить и заполнить поля
  loadSettings().then((settings) => {
    proxyUrlInput.value = settings.proxyUrl
    modelSelect.value = settings.model
    requestsPerMinuteInput.value = String(settings.requestsPerMinute)
    qualityCheckInput.checked = settings.qualityCheckEnabled
  })

  // Сохранить при нажатии кнопки
  btnSave.addEventListener('click', () => {
    const settings: Partial<ExtensionSettings> = {
      proxyUrl: proxyUrlInput.value.trim(),
      model: modelSelect.value as GptModel,
      requestsPerMinute: parseInt(requestsPerMinuteInput.value, 10) || DEFAULT_SETTINGS.requestsPerMinute,
      qualityCheckEnabled: qualityCheckInput.checked,
    }

    saveSettings(settings).then(() => {
      saveStatus.classList.remove('hidden')
      setTimeout(() => saveStatus.classList.add('hidden'), 2000)
    })
  })
}

// Запустить только в браузере (не в тестах)
if (typeof document !== 'undefined' && typeof chrome !== 'undefined' && chrome.storage) {
  document.addEventListener('DOMContentLoaded', initOptionsPage)
}
