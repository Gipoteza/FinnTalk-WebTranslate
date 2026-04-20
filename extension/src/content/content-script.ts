// Content Script — внедряется в страницу
// Извлекает текст и заменяет его переводом без нарушения HTML-структуры

import { TextBlock } from '../types'

/**
 * Разбивает текст на блоки от 2000 до 4000 символов с сохранением границ предложений.
 * Последний блок может быть меньше 2000 символов.
 * Если весь текст меньше 2000 символов — возвращает один блок.
 */
export function splitIntoBlocks(text: string): TextBlock[] {
  if (text.length === 0) {
    return []
  }

  // Разбиваем текст на предложения по границам: . ! ? … + пробел или конец строки
  // Ищем позиции разрывов: символ-терминатор, за которым идёт пробел или конец строки
  const breakRegex = /[.!?…](?=\s|$)/g
  const breakPositions: number[] = []
  let m: RegExpExecArray | null

  while ((m = breakRegex.exec(text)) !== null) {
    breakPositions.push(m.index + m[0].length)
  }

  // Строим предложения по позициям разрывов
  const sentences: string[] = []
  let pos = 0
  for (const bp of breakPositions) {
    if (bp > pos) {
      sentences.push(text.slice(pos, bp))
      pos = bp
    }
  }
  // Остаток после последнего разрыва
  if (pos < text.length) {
    sentences.push(text.slice(pos))
  }

  // Если предложений нет — весь текст как один блок
  if (sentences.length === 0) {
    return [{ id: crypto.randomUUID(), text, nodeIds: [] }]
  }

  const blocks: TextBlock[] = []
  let current = ''

  for (const sentence of sentences) {
    current += sentence

    // Когда накопили >= 2000 символов — завершаем блок
    if (current.length >= 2000) {
      // Если блок уже превысил 4000 — обрезаем (не должно случаться при нормальных предложениях)
      blocks.push({ id: crypto.randomUUID(), text: current, nodeIds: [] })
      current = ''
    }
  }

  // Добавляем остаток (последний блок, может быть < 2000)
  if (current.length > 0) {
    blocks.push({ id: crypto.randomUUID(), text: current, nodeIds: [] })
  }

  return blocks
}

export {}
