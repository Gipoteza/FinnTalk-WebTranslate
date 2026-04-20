// Замена текста в DOM с сохранением оригинальных узлов
// Хранит оригиналы в Map<string, Text> для функции "Показать оригинал"
// Требования: 2.3, 5.4, 8.2, 8.4

/**
 * Запись о текстовом узле: хранит оригинальное значение и ссылку на узел.
 */
interface NodeRecord {
  /** Ссылка на текстовый узел в DOM */
  node: Text
  /** Оригинальное значение узла до перевода */
  originalValue: string
  /** Переведённое значение (заполняется после replaceBlock) */
  translatedValue: string | null
}

/**
 * TextReplacer управляет заменой текстовых узлов в DOM.
 *
 * Хранит оригинальные значения узлов в Map<blockId, NodeRecord[]>,
 * позволяя переключаться между оригиналом и переводом без изменения
 * HTML-структуры страницы.
 */
export class TextReplacer {
  /**
   * Карта: blockId → массив записей о текстовых узлах блока.
   * Каждый блок может содержать несколько текстовых узлов.
   */
  private readonly blocks = new Map<string, NodeRecord[]>()

  /**
   * Регистрирует текстовые узлы для блока.
   * Должен вызываться до replaceBlock для сохранения оригиналов.
   *
   * @param blockId - идентификатор блока
   * @param nodes - текстовые узлы, входящие в блок
   */
  registerBlock(blockId: string, nodes: Text[]): void {
    const records: NodeRecord[] = nodes.map((node) => ({
      node,
      originalValue: node.nodeValue ?? '',
      translatedValue: null,
    }))
    this.blocks.set(blockId, records)
  }

  /**
   * Заменяет текст блока переведённым текстом.
   * Изменяет только nodeValue текстовых узлов, не затрагивая HTML-структуру.
   *
   * Если блок содержит несколько узлов, весь переведённый текст помещается
   * в первый узел, остальные очищаются.
   *
   * @param blockId - идентификатор блока
   * @param text - переведённый текст
   */
  replaceBlock(blockId: string, text: string): void {
    const records = this.blocks.get(blockId)
    if (!records || records.length === 0) {
      return
    }

    // Сохраняем перевод и обновляем DOM
    records[0].translatedValue = text
    records[0].node.nodeValue = text

    // Остальные узлы блока очищаем (их текст уже включён в первый узел)
    for (let i = 1; i < records.length; i++) {
      records[i].translatedValue = ''
      records[i].node.nodeValue = ''
    }
  }

  /**
   * Восстанавливает оригинальный текст всех зарегистрированных блоков.
   * Требование 5.4, 8.4.
   */
  restoreOriginal(): void {
    for (const records of this.blocks.values()) {
      for (const record of records) {
        record.node.nodeValue = record.originalValue
      }
    }
  }

  /**
   * Отображает переведённый текст для всех блоков, у которых есть перевод.
   * Используется для переключения обратно к переводу после restoreOriginal().
   * Требование 5.5.
   */
  showTranslation(): void {
    for (const records of this.blocks.values()) {
      for (const record of records) {
        if (record.translatedValue !== null) {
          record.node.nodeValue = record.translatedValue
        }
      }
    }
  }

  /**
   * Возвращает количество зарегистрированных блоков.
   */
  get blockCount(): number {
    return this.blocks.size
  }

  /**
   * Проверяет, зарегистрирован ли блок с данным идентификатором.
   */
  hasBlock(blockId: string): boolean {
    return this.blocks.has(blockId)
  }
}
