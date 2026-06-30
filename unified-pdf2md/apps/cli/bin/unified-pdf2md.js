#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
function requireWorkspacePackage (packageName, relativePath) {
  try {
    return require(packageName)
  } catch (_) {
    return require(relativePath)
  }
}

const { convertPdfToDocument, convertPdfToMarkdown } = requireWorkspacePackage('@unified-pdf2md/pdf-core', '../../../packages/pdf-core/src')
const { exportMarkdown, translateDocument } = requireWorkspacePackage('@unified-pdf2md/review-engine', '../../../packages/review-engine/src')
const { translateWithCommand } = require('../src/translator-command')

function parseArgs (argv) {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith('-')) {
      args._.push(arg)
      continue
    }
    const key = arg.replace(/^--?/, '')
    const next = argv[i + 1]
    if (!next || next.startsWith('-')) {
      args[key] = true
    } else {
      args[key] = next
      i++
    }
  }
  return args
}

function usage () {
  return `unified-pdf2md

Commands:
  unified-pdf2md convert input.pdf -o out.md [--review-json out.review.json]
  unified-pdf2md review input.pdf [-o paper.review.json]
  unified-pdf2md export input.review.json -o out.md [--translated] [--body-only] [--safe-only]
  unified-pdf2md translate input.review.json --to ko -o translated.review.json [--translator-command "cmd"]

Compatibility:
  unified-pdf2md convert-folder --inputFolderPath in --outputFolderPath out [--recursive]
`
}

function writeJson (filePath, value) {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8')
}

function readReviewJson (filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

async function commandConvert (args) {
  const inputPath = args._[1]
  if (!inputPath) throw new Error('convert requires input.pdf')
  const outputPath = args.o || args.output
  const reviewJsonPath = args['review-json']
  if (!outputPath && !reviewJsonPath) throw new Error('convert requires -o out.md and/or --review-json out.review.json')
  if (outputPath) await convertPdfToMarkdown(inputPath, { outputPath })
  if (reviewJsonPath) {
    const document = await convertPdfToDocument(inputPath)
    writeJson(reviewJsonPath, document)
  }
  if (outputPath) console.log(`Wrote ${outputPath}`)
  if (reviewJsonPath) console.log(`Wrote ${reviewJsonPath}`)
}

async function commandReview (args) {
  const inputPath = args._[1]
  if (!inputPath) throw new Error('review requires input.pdf')
  const outPath = args.o || args.output || inputPath.replace(/\.pdf$/i, '') + '.review.json'
  const document = await convertPdfToDocument(inputPath)
  writeJson(outPath, document)
  console.log(`Wrote ${outPath}`)
  console.log('Interactive UI contract is ready. Launch a reviewer app against this JSON, or use `unified-pdf2md export` after edits.')
}

async function commandExport (args) {
  const inputPath = args._[1]
  if (!inputPath) throw new Error('export requires input.review.json')
  const outputPath = args.o || args.output
  if (!outputPath) throw new Error('export requires -o out.md')
  const document = readReviewJson(inputPath)
  const markdown = exportMarkdown(document, {
    useTranslation: Boolean(args.translated),
    bodyOnly: Boolean(args['body-only']),
    safeOnly: Boolean(args['safe-only']),
    visibleOnly: args.visible === false ? false : true
  })
  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true })
  fs.writeFileSync(outputPath, markdown, 'utf8')
  console.log(`Wrote ${outputPath}`)
}

async function commandTranslate (args) {
  const inputPath = args._[1]
  if (!inputPath) throw new Error('translate requires input.review.json or input.pdf')
  const targetLang = args.to || args.target
  if (!targetLang) throw new Error('translate requires --to <language>')
  const outputPath = args.o || args.output || inputPath.replace(/(\.review)?\.json$/i, '') + `.${targetLang}.review.json`
  let document
  if (/\.pdf$/i.test(inputPath)) {
    document = await convertPdfToDocument(inputPath)
  } else {
    document = readReviewJson(inputPath)
  }
  const command = args['translator-command'] || process.env.UNIFIED_PDF2MD_TRANSLATE_COMMAND
  const translated = await translateDocument(document, payload => translateWithCommand(payload, command), { targetLang })
  writeJson(outputPath, translated)
  console.log(`Wrote ${outputPath}`)
}

async function commandConvertFolder (args) {
  const inputFolder = args.inputFolderPath || args.input
  const outputFolder = args.outputFolderPath || args.output
  if (!inputFolder) throw new Error('convert-folder requires --inputFolderPath')
  if (!outputFolder) throw new Error('convert-folder requires --outputFolderPath')
  const recursive = Boolean(args.recursive)
  const files = listPdfFiles(inputFolder, recursive)
  for (const filePath of files) {
    const rel = path.relative(inputFolder, filePath).replace(/\.pdf$/i, '.md')
    const out = path.join(outputFolder, rel)
    await convertPdfToMarkdown(filePath, { outputPath: out })
    console.log(`Wrote ${out}`)
  }
}

function listPdfFiles (folder, recursive) {
  const entries = fs.readdirSync(folder, { withFileTypes: true })
  const results = []
  for (const entry of entries) {
    const full = path.join(folder, entry.name)
    if (entry.isDirectory() && recursive) results.push(...listPdfFiles(full, recursive))
    if (entry.isFile() && /\.pdf$/i.test(entry.name)) results.push(full)
  }
  return results
}

async function main () {
  const args = parseArgs(process.argv.slice(2))
  const command = args._[0]
  if (!command || args.h || args.help) {
    console.log(usage())
    return
  }
  const commands = {
    convert: commandConvert,
    review: commandReview,
    export: commandExport,
    translate: commandTranslate,
    'convert-folder': commandConvertFolder
  }
  if (!commands[command]) throw new Error(`Unknown command: ${command}\n\n${usage()}`)
  await commands[command](args)
}

main().catch(error => {
  console.error(`Error: ${error.message}`)
  process.exitCode = 1
})
