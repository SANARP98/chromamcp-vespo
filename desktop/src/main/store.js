/**
 * store.js — Simple JSON settings store in app userData.
 * No extra dependencies — just fs + JSON.
 */

import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import { homedir } from 'os'

const defaults = {
  openaiApiKey: '',
  dbPath: join(homedir(), '.vespo', 'lancedb'),
  localhostApiEnabled: false,
  localhostApiPort: 3847,
  launchOnLogin: false
}

function settingsPath() {
  return join(app.getPath('userData'), 'settings.json')
}

export async function getSettings() {
  try {
    const raw = await readFile(settingsPath(), 'utf-8')
    return { ...defaults, ...JSON.parse(raw) }
  } catch {
    return { ...defaults }
  }
}

export async function saveSettings(partial) {
  const current = await getSettings()
  const merged = { ...current, ...partial }
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(settingsPath(), JSON.stringify(merged, null, 2), 'utf-8')
  return merged
}
