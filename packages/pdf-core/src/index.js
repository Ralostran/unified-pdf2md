'use strict'

const fs = require('fs')
const path = require('path')
const { createDocumentFromMarkdown } = require('../../review-engine/src')

function loadOpenGovConverter () {
  try {
    return require('@opendocsg/pdf2md')
  } catch (error) {
    const err = new Error('Missing @opendocsg/pdf2md. Run `npm install` at the monorepo root, or inject a converter for tests/adapters.')
    err.cause = error
    throw err
  }
}

async function convertPdfBufferToMarkdown (pdfBuffer, { callbacks, converter } = {}) {
  const activeConverter = converter || loadOpenGovConverter()
  const input = pdfBuffer instanceof Uint8Array ? pdfBuffer : new Uint8Array(pdfBuffer)
  return activeConverter(input, callbacks)
}

async function convertPdfToMarkdown (inputPath, { outputPath, callbacks, converter } = {}) {
  if (!inputPath) throw new Error('inputPath is required')
  const pdfBuffer = fs.readFileSync(inputPath)
  const markdown = await convertPdfBufferToMarkdown(pdfBuffer, { callbacks, converter })
  if (outputPath) {
    fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true })
    fs.writeFileSync(outputPath, markdown, 'utf8')
  }
  return markdown
}

async function convertPdfToDocument (inputPath, { callbacks, converter } = {}) {
  const markdown = await convertPdfToMarkdown(inputPath, { callbacks, converter })
  return createDocumentFromMarkdown(markdown, { sourcePath: inputPath, sourceType: 'pdf' })
}

module.exports = {
  convertPdfBufferToMarkdown,
  convertPdfToMarkdown,
  convertPdfToDocument,
  loadOpenGovConverter
}
