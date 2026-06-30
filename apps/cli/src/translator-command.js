'use strict'

const { spawn } = require('child_process')

function splitCommand (command) {
  const parts = String(command || '').match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || []
  return parts.map(part => part.replace(/^['"]|['"]$/g, ''))
}

async function translateWithCommand (payload, command = process.env.UNIFIED_PDF2MD_TRANSLATE_COMMAND) {
  if (!command) {
    throw new Error('No translator command configured. Set UNIFIED_PDF2MD_TRANSLATE_COMMAND or pass --translator-command.')
  }
  const [binary, ...args] = splitCommand(command)
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => { stdout += chunk.toString('utf8') })
    child.stderr.on('data', chunk => { stderr += chunk.toString('utf8') })
    child.on('error', reject)
    child.on('close', code => {
      if (code !== 0) return reject(new Error(`Translator exited with code ${code}: ${stderr.trim()}`))
      const trimmed = stdout.trim()
      if (!trimmed) return reject(new Error('Translator produced no output'))
      try {
        const parsed = JSON.parse(trimmed)
        resolve(parsed.translatedText || parsed.text || trimmed)
      } catch (_) {
        resolve(trimmed)
      }
    })
    child.stdin.write(JSON.stringify(payload))
    child.stdin.end()
  })
}

module.exports = { translateWithCommand }
