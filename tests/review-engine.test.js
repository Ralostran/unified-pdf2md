'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('fs')
const path = require('path')
const {
  exportMarkdown,
  setVisibility,
  setBody,
  mergeBlocks,
  splitBlock,
  moveBlock,
  chainBlocks,
  createDocumentFromMarkdown
} = require('../packages/review-engine')

function fixture () {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/sample.review.json'), 'utf8'))
}

test('visibility and body filtering are respected during markdown export', () => {
  const doc = fixture()
  const markdown = exportMarkdown(doc, { bodyOnly: true })
  assert.equal(markdown, 'This is the first half of one paragraph.\n')
  const withHiddenVisible = setVisibility(doc, ['b4'], true)
  const bodyOnly = exportMarkdown(withHiddenVisible, { bodyOnly: true })
  assert.equal(bodyOnly, 'This is the first half of one paragraph.\n')
  const captionAsBody = setBody(withHiddenVisible, ['b4'], true)
  assert.match(exportMarkdown(captionAsBody, { bodyOnly: true }), /Figure 1/)
})

test('merge and split preserve deterministic order', () => {
  const doc = fixture()
  const merged = mergeBlocks(doc, ['b2', 'b3'])
  assert.match(exportMarkdown(merged, { bodyOnly: true }), /This is the first half of one paragraph\./)
  const mergedBlock = merged.pages[0].blocks.find(block => block.text.includes('one paragraph'))
  const split = splitBlock(merged, mergedBlock.id, { separator: ' of ' })
  const bodyBlocks = split.pages[0].blocks.filter(block => block.body)
  assert.equal(bodyBlocks.length, 2)
  assert.equal(bodyBlocks[0].order, 1)
  assert.equal(bodyBlocks[1].order, 2)
})

test('move and chain support reviewer ordering workflow', () => {
  const doc = createDocumentFromMarkdown('Alpha\n\nBeta\n\nGamma')
  const [a, b, c] = doc.pages[0].blocks
  const moved = moveBlock(doc, c.id, a.id, 'before')
  assert.equal(moved.pages[0].blocks[0].text, 'Gamma')
  const chained = chainBlocks(moved, moved.pages[0].blocks[1].id, moved.pages[0].blocks[2].id)
  assert.match(exportMarkdown(chained, { bodyOnly: true }), /Alpha Beta/)
})
