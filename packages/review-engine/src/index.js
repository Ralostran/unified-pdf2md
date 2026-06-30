'use strict'

const {
  cloneDocument,
  createBlock,
  createDocument,
  createPage,
  findBlock,
  getAllBlocks,
  makeId,
  nowIso,
  touchDocument,
  validateDocument
} = require('../../document-model/src')

function ensureValidDocument (document) {
  const result = validateDocument(document)
  if (!result.valid) {
    throw new Error(`Invalid document: ${result.errors.join('; ')}`)
  }
}

function normalizeOrders (page) {
  page.blocks.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
  page.blocks.forEach((block, index) => { block.order = index })
}

function normalizeDocument (document, { mutate = false } = {}) {
  const doc = mutate ? document : cloneDocument(document)
  ensureValidDocument(doc)
  doc.pages.sort((a, b) => a.index - b.index)
  doc.pages.forEach(normalizeOrders)
  return touchDocument(doc)
}

function createDocumentFromMarkdown (markdown, { sourcePath, sourceType = 'markdown' } = {}) {
  const doc = createDocument({ sourceType, sourcePath, converter: 'markdown-adapter' })
  const pages = String(markdown || '').split(/<!--\s*PAGE_BREAK\s*-->/i)
  pages.forEach((pageMarkdown, pageIndex) => {
    const page = createPage({ index: pageIndex })
    const chunks = pageMarkdown
      .split(/\n{2,}/)
      .map(chunk => chunk.trim())
      .filter(Boolean)
    chunks.forEach((chunk, blockIndex) => {
      const type = /^#{1,6}\s/.test(chunk) ? 'heading' : 'text'
      page.blocks.push(createBlock({
        pageId: page.id,
        order: blockIndex,
        type,
        text: chunk.replace(/^#{1,6}\s+/, ''),
        markdown: chunk,
        source: { origin: 'opengovsg', pageNumber: pageIndex + 1 },
        classification: { method: 'heuristic', reason: 'created from markdown paragraphs', confidence: 0.8 }
      }))
    })
    doc.pages.push(page)
  })
  return normalizeDocument(doc, { mutate: true })
}

function intersectsOrContains (inner, outer) {
  if (!inner || !outer) return true
  const ix2 = inner.x + inner.width
  const iy2 = inner.y + inner.height
  const ox2 = outer.x + outer.width
  const oy2 = outer.y + outer.height
  return inner.x >= outer.x && inner.y >= outer.y && ix2 <= ox2 && iy2 <= oy2
}

function applySafeArea (document, safeAreaByPageIndex, { mutate = false } = {}) {
  const doc = mutate ? document : cloneDocument(document)
  for (const page of doc.pages) {
    const safeArea = safeAreaByPageIndex?.[page.index] || safeAreaByPageIndex?.default || page.safeArea
    if (!safeArea) continue
    page.safeArea = safeArea
    for (const block of page.blocks) {
      block.safe = intersectsOrContains(block.bbox, safeArea)
      block.classification = {
        ...(block.classification || {}),
        method: 'deterministic',
        reason: block.safe ? 'block bounding box is inside safe area' : 'block bounding box is outside safe area'
      }
    }
  }
  return normalizeDocument(doc, { mutate: true })
}

function setVisibility (document, blockIds, visible, { mutate = false } = {}) {
  const doc = mutate ? document : cloneDocument(document)
  for (const id of blockIds) {
    const found = findBlock(doc, id)
    if (!found) throw new Error(`Block not found: ${id}`)
    found.block.visible = Boolean(visible)
  }
  return touchDocument(doc)
}

function toggleVisibility (document, blockIds, options) {
  const doc = options?.mutate ? document : cloneDocument(document)
  for (const id of blockIds) {
    const found = findBlock(doc, id)
    if (!found) throw new Error(`Block not found: ${id}`)
    found.block.visible = !found.block.visible
  }
  return touchDocument(doc)
}

function setBody (document, blockIds, body, { mutate = false } = {}) {
  const doc = mutate ? document : cloneDocument(document)
  for (const id of blockIds) {
    const found = findBlock(doc, id)
    if (!found) throw new Error(`Block not found: ${id}`)
    if (found.block.type === 'image') continue
    found.block.body = Boolean(body)
  }
  return touchDocument(doc)
}

function toggleBody (document, blockIds, options) {
  const doc = options?.mutate ? document : cloneDocument(document)
  for (const id of blockIds) {
    const found = findBlock(doc, id)
    if (!found) throw new Error(`Block not found: ${id}`)
    if (found.block.type === 'image') continue
    found.block.body = !found.block.body
  }
  return touchDocument(doc)
}

function mergeBlocks (document, blockIds, { preserveLineBreaks = false, mutate = false } = {}) {
  if (!Array.isArray(blockIds) || blockIds.length < 2) {
    throw new Error('mergeBlocks requires at least two block ids')
  }
  const doc = mutate ? document : cloneDocument(document)
  const foundBlocks = blockIds.map(id => findBlock(doc, id))
  if (foundBlocks.some(item => !item)) throw new Error('Cannot merge: one or more block ids were not found')
  const firstPageId = foundBlocks[0].page.id
  if (foundBlocks.some(item => item.page.id !== firstPageId)) {
    throw new Error('mergeBlocks only merges blocks on the same page; use chainBlocks for cross-page continuity')
  }
  const page = foundBlocks[0].page
  const sorted = foundBlocks.map(item => item.block).sort((a, b) => a.order - b.order)
  const separator = preserveLineBreaks ? '\n' : ' '
  const mergedText = sorted.map(block => block.text.trim()).filter(Boolean).join(separator)
  const first = sorted[0]
  const merged = {
    ...first,
    id: makeId('block', `merged:${blockIds.join('|')}:${mergedText}`),
    text: mergedText,
    markdown: undefined,
    source: {
      ...(first.source || {}),
      origin: first.source?.origin || 'manual',
      originalIds: sorted.flatMap(block => block.source?.originalIds || [block.id])
    },
    classification: { method: 'manual', reason: preserveLineBreaks ? 'joined by reviewer with line breaks' : 'concatenated by reviewer' },
    links: {}
  }
  const ids = new Set(blockIds)
  page.blocks = page.blocks.filter(block => !ids.has(block.id))
  page.blocks.push(merged)
  return normalizeDocument(doc, { mutate: true })
}

function splitBlock (document, blockId, { separator = '\n', mutate = false } = {}) {
  const doc = mutate ? document : cloneDocument(document)
  const found = findBlock(doc, blockId)
  if (!found) throw new Error(`Block not found: ${blockId}`)
  const parts = found.block.text.split(separator).map(part => part.trim()).filter(Boolean)
  if (parts.length < 2) return doc
  const original = found.block
  const replacements = parts.map((part, offset) => ({
    ...original,
    id: makeId('block', `split:${original.id}:${offset}:${part}`),
    order: original.order + offset / 1000,
    text: part,
    markdown: undefined,
    source: {
      ...(original.source || {}),
      origin: original.source?.origin || 'manual',
      originalIds: original.source?.originalIds || [original.id]
    },
    classification: { method: 'manual', reason: 'split by reviewer' },
    links: {}
  }))
  found.page.blocks.splice(found.index, 1, ...replacements)
  return normalizeDocument(doc, { mutate: true })
}

function moveBlock (document, movingBlockId, targetBlockId, position = 'after', { mutate = false } = {}) {
  if (!['before', 'after'].includes(position)) throw new Error('position must be before or after')
  const doc = mutate ? document : cloneDocument(document)
  const moving = findBlock(doc, movingBlockId)
  const target = findBlock(doc, targetBlockId)
  if (!moving) throw new Error(`Moving block not found: ${movingBlockId}`)
  if (!target) throw new Error(`Target block not found: ${targetBlockId}`)
  if (moving.page.id !== target.page.id) throw new Error('moveBlock only reorders inside the same page')
  const page = moving.page
  page.blocks.splice(moving.index, 1)
  const targetIndex = page.blocks.findIndex(block => block.id === targetBlockId)
  page.blocks.splice(position === 'before' ? targetIndex : targetIndex + 1, 0, moving.block)
  page.blocks.forEach((block, index) => { block.order = index })
  return touchDocument(doc)
}

function chainBlocks (document, fromBlockId, toBlockId, { separator = 'space', mutate = false } = {}) {
  if (!['space', 'newline'].includes(separator)) throw new Error('separator must be space or newline')
  const doc = mutate ? document : cloneDocument(document)
  const from = findBlock(doc, fromBlockId)
  const to = findBlock(doc, toBlockId)
  if (!from) throw new Error(`Source block not found: ${fromBlockId}`)
  if (!to) throw new Error(`Target block not found: ${toBlockId}`)
  if (!from.block.body || !to.block.body) throw new Error('Only body blocks can be chained')
  from.block.links = { ...(from.block.links || {}), nextBlockId: to.block.id, chainSeparator: separator }
  to.block.links = { ...(to.block.links || {}), previousBlockId: from.block.id }
  return touchDocument(doc)
}

function unchainBlock (document, blockId, { mutate = false } = {}) {
  const doc = mutate ? document : cloneDocument(document)
  const found = findBlock(doc, blockId)
  if (!found) throw new Error(`Block not found: ${blockId}`)
  const nextId = found.block.links?.nextBlockId
  const prevId = found.block.links?.previousBlockId
  if (nextId) {
    const next = findBlock(doc, nextId)
    if (next?.block?.links) delete next.block.links.previousBlockId
  }
  if (prevId) {
    const prev = findBlock(doc, prevId)
    if (prev?.block?.links) {
      delete prev.block.links.nextBlockId
      delete prev.block.links.chainSeparator
    }
  }
  found.block.links = {}
  return touchDocument(doc)
}

function orderedBlocks (document, { visibleOnly = true, bodyOnly = false, safeOnly = false } = {}) {
  const blocks = []
  for (const page of [...document.pages].sort((a, b) => a.index - b.index)) {
    const pageBlocks = [...page.blocks].sort((a, b) => a.order - b.order)
    for (const block of pageBlocks) {
      if (visibleOnly && !block.visible) continue
      if (bodyOnly && !block.body) continue
      if (safeOnly && !block.safe) continue
      blocks.push(block)
    }
  }
  return blocks
}

function reconstructReadingOrder (document, options = {}) {
  ensureValidDocument(document)
  const blocks = orderedBlocks(document, options)
  if (!options.respectChains) return blocks
  const byId = new Map(getAllBlocks(document).map(block => [block.id, block]))
  const seen = new Set()
  const result = []
  for (const block of blocks) {
    if (seen.has(block.id) || block.links?.previousBlockId) continue
    const chain = []
    let current = block
    while (current && !seen.has(current.id)) {
      if (options.visibleOnly !== false && !current.visible) break
      if (options.bodyOnly && !current.body) break
      chain.push(current)
      seen.add(current.id)
      current = current.links?.nextBlockId ? byId.get(current.links.nextBlockId) : null
    }
    result.push(chain)
  }
  return result
}

function blockToMarkdown (block, { useTranslation = false } = {}) {
  const text = useTranslation && block.translation?.text ? block.translation.text : (block.markdown || block.text)
  if (block.type === 'heading' && !/^#{1,6}\s/.test(text)) return `## ${text.trim()}`
  if (block.type === 'image') return block.markdown || `![${block.text || block.id}]()`
  if (block.type === 'table' || block.type === 'equation') return block.markdown || block.text
  return text.trim()
}

function exportMarkdown (document, options = {}) {
  const chains = reconstructReadingOrder(document, { ...options, respectChains: true })
  const paragraphs = []
  for (const chain of chains) {
    if (Array.isArray(chain)) {
      const texts = []
      for (let index = 0; index < chain.length; index++) {
        const block = chain[index]
        const separator = index > 0
          ? (chain[index - 1].links?.chainSeparator === 'newline' ? '\n' : ' ')
          : ''
        texts.push(separator + blockToMarkdown(block, options))
      }
      paragraphs.push(texts.join('').trim())
    } else {
      paragraphs.push(blockToMarkdown(chain, options))
    }
  }
  const markdown = paragraphs.filter(Boolean).join('\n\n')
  return options.trailingNewline === false ? markdown : markdown + '\n'
}

async function translateDocument (document, translator, { targetLang, sourceLang = 'auto', blockIds, mutate = false } = {}) {
  if (typeof translator !== 'function') throw new TypeError('translator must be an async function')
  if (!targetLang) throw new Error('targetLang is required')
  const doc = mutate ? document : cloneDocument(document)
  const wanted = blockIds ? new Set(blockIds) : null
  for (const block of orderedBlocks(doc, { visibleOnly: true, bodyOnly: true })) {
    if (wanted && !wanted.has(block.id)) continue
    block.translation = { sourceLang, targetLang, status: 'pending', updatedAt: nowIso() }
    try {
      const translatedText = await translator({ text: block.text, sourceLang, targetLang, blockId: block.id })
      block.translation = {
        sourceLang,
        targetLang,
        text: String(translatedText),
        provider: translator.name || 'custom',
        status: 'translated',
        updatedAt: nowIso()
      }
    } catch (error) {
      block.translation = {
        sourceLang,
        targetLang,
        status: 'failed',
        error: error.message,
        updatedAt: nowIso()
      }
      throw error
    }
  }
  doc.metadata.targetLanguage = targetLang
  return touchDocument(doc)
}

module.exports = {
  normalizeDocument,
  createDocumentFromMarkdown,
  applySafeArea,
  setVisibility,
  toggleVisibility,
  setBody,
  toggleBody,
  mergeBlocks,
  splitBlock,
  moveBlock,
  chainBlocks,
  unchainBlock,
  reconstructReadingOrder,
  exportMarkdown,
  translateDocument
}
