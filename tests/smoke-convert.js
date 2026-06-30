'use strict'

const assert = require('node:assert/strict')
const { convertPdfBufferToMarkdown } = require('../packages/pdf-core')

async function main () {
  const markdown = await convertPdfBufferToMarkdown(Buffer.from('%PDF smoke'), {
    converter: async () => '# Smoke\n\nThis is a mocked conversion fixture.'
  })
  assert.match(markdown, /Smoke/)
  console.log('Smoke convert passed with injected converter.')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
