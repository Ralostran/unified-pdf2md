'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { convertPdfBufferToMarkdown, convertPdfToDocument } = require('../packages/pdf-core')

test('convertPdfBufferToMarkdown supports injected converter for smoke tests', async () => {
  const markdown = await convertPdfBufferToMarkdown(Buffer.from('%PDF fixture'), {
    converter: async () => 'Title\n\nBody paragraph'
  })
  assert.equal(markdown, 'Title\n\nBody paragraph')
})

test('convertPdfToDocument maps converter output to unified review document', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'unified-pdf2md-'))
  const pdf = path.join(tmp, 'sample.pdf')
  fs.writeFileSync(pdf, '%PDF fixture')
  const doc = await convertPdfToDocument(pdf, {
    converter: async () => 'Title\n\nBody paragraph'
  })
  assert.equal(doc.schemaVersion, '1.0.0')
  assert.equal(doc.pages[0].blocks.length, 2)
  assert.equal(doc.pages[0].blocks[0].text, 'Title')
})
