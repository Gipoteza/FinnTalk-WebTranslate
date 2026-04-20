// Обход DOM в глубину и извлечение текстовых узлов
// Исключает содержимое тегов <script>, <style>, <noscript>
// Пропускает узлы с менее чем 3 символами
// Требования: 8.1, 8.3

/** Теги, содержимое которых не должно переводиться */
const EXCLUDED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT'])

/**
 * Обходит DOM-дерево в глубину и собирает все текстовые узлы,
 * пригодные для перевода.
 *
 * @param root - корневой узел для обхода (по умолчанию document.body)
 * @returns массив текстовых узлов с текстом длиной >= 3 символов
 */
export function extractTextNodes(root: Node = document.body): Text[] {
  const result: Text[] = []
  walkNode(root, result)
  return result
}

/**
 * Рекурсивный обход узла в глубину.
 * Пропускает исключённые теги и короткие текстовые узлы.
 */
function walkNode(node: Node, result: Text[]): void {
  // Пропускаем исключённые теги (script, style, noscript)
  if (node.nodeType === 1 /* ELEMENT_NODE */) {
    const tagName = (node as Element).tagName
    if (EXCLUDED_TAGS.has(tagName)) {
      return
    }
  }

  // Если это текстовый узел — проверяем длину и добавляем
  if (node.nodeType === 3 /* TEXT_NODE */) {
    const text = node.nodeValue ?? ''
    // Пропускаем узлы с менее чем 3 символами (требование 8.3)
    if (text.trim().length >= 3) {
      result.push(node as Text)
    }
    return
  }

  // Рекурсивно обходим дочерние узлы
  for (const child of Array.from(node.childNodes)) {
    walkNode(child, result)
  }
}
