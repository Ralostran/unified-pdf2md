'use strict'

const crypto = require('crypto')
const schema = require('./schema/document.schema.json')

const SCHEMA_VERSION = '1.0.0'

function nowIso () {
  return new Date().toISOString()
}

function makeId (prefix, seed) {
  if (seed) {
    const digest = crypto.createHash('sha1').update(String(seed)).digest('hex').slice(0, 12)
    return `${prefix}_${digest}`
  }
  return `${prefix}_${crypto.randomUUID()}`
}

function createDocument ({ sourceType = 'unknown', sourcePath, converter, title, language } = {}) {
  const timestamp = nowIso()
  return {
    schemaVersion: SCHEMA_VERSION,
    metadata: {
      source: {
        type: sourceType,
        ...(sourcePath ? { path: sourcePath } : {}),
        ...(converter ? { converter } : {})
      },
      ...(title ? { title } : {}),
      ...(language ? { language } : {}),
      createdAt: timestamp,
      updatedAt: timestamp
    },
    pages: []
  }
}

function createPage ({ index, width, height, safeArea } = {}) {
  if (!Number.isInteger(index) || index < 0) {
    throw new TypeError('Page index must be a non-negative integer')
  }
  return {
    id: makeId('page', `page:${index}`),
    index,
    ...(typeof width === 'number' ? { width } : {}),
    ...(typeof height === 'number' ? { height } : {}),
    ...(safeArea ? { safeArea } : {}),
    blocks: []
  }
}

function createBlock ({ pageId, order, text, type = 'text', bbox, markdown, visible = true, body = true, safe = true, source, classification } = {}) {
  if (!pageId) throw new TypeError('Block pageId is required')
  if (typeof order !== 'number') throw new TypeError('Block order must be a number')
  if (typeof text !== 'string') throw new TypeError('Block text must be a string')
  return {
    id: makeId('block', `${pageId}:${order}:${text}`),
    pageId,
    order,
    type,
    text,
    ...(markdown ? { markdown } : {}),
    ...(bbox ? { bbox } : {}),
    spans: [],
    visible,
    body,
    safe,
    classification: classification || { method: 'unknown', reason: 'not classified' },
    links: {},
    ...(source ? { source } : {})
  }
}

function cloneDocument (document) {
  return JSON.parse(JSON.stringify(document))
}

function getAllBlocks (document) {
  return document.pages.flatMap(page => page.blocks)
}

function findBlock (document, blockId) {
  for (const page of document.pages) {
    const index = page.blocks.findIndex(block => block.id === blockId)
    if (index !== -1) return { page, block: page.blocks[index], index }
  }
  return null
}

function touchDocument (document) {
  document.metadata = document.metadata || { source: { type: 'unknown' }, createdAt: nowIso() }
  document.metadata.updatedAt = nowIso()
  return document
}

function validateDocument (document) {
  const errors = []
  if (!document || typeof document !== 'object') errors.push('document must be an object')
  if (document && document.schemaVersion !== SCHEMA_VERSION) errors.push(`schemaVersion must be ${SCHEMA_VERSION}`)
  if (!document?.metadata?.source?.type) errors.push('metadata.source.type is required')
  if (!Array.isArray(document?.pages)) errors.push('pages must be an array')

  const ids = new Set()
  for (const page of document?.pages || []) {
    if (!page.id) errors.push('page.id is required')
    if (ids.has(page.id)) errors.push(`duplicate id: ${page.id}`)
    ids.add(page.id)
    if (!Number.isInteger(page.index) || page.index < 0) errors.push(`page ${page.id} has invalid index`)
    if (!Array.isArray(page.blocks)) errors.push(`page ${page.id} blocks must be an array`)
    for (const block of page.blocks || []) {
      if (!block.id) errors.push(`block on page ${page.id} missing id`)
      if (ids.has(block.id)) errors.push(`duplicate id: ${block.id}`)
      ids.add(block.id)
      if (block.pageId !== page.id) errors.push(`block ${block.id} pageId does not match parent page`)
      if (typeof block.order !== 'number') errors.push(`block ${block.id} order must be a number`)
      if (typeof block.text !== 'string') errors.push(`block ${block.id} text must be a string`)
      for (const key of ['visible', 'body', 'safe']) {
        if (typeof block[key] !== 'boolean') errors.push(`block ${block.id} ${key} must be a boolean`)
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

module.exports = {
  SCHEMA_VERSION,
  schema,
  nowIso,
  makeId,
  createDocument,
  createPage,
  createBlock,
  cloneDocument,
  getAllBlocks,
  findBlock,
  touchDocument,
  validateDocument
}
