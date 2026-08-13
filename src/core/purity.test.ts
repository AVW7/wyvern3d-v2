import { describe, expect, it } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

function scanDirectory(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir)
  for (const file of files) {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)
    if (stat.isDirectory()) {
      scanDirectory(filePath, fileList)
    } else if (filePath.endsWith('.ts') && !filePath.endsWith('.test.ts')) {
      fileList.push(filePath)
    }
  }
  return fileList
}

describe('core purity gate', () => {
  it('contains no process.env, Math.random, or Date.now in src/core', () => {
    const coreDir = path.resolve(__dirname)
    const files = scanDirectory(coreDir)
    expect(files.length).toBeGreaterThan(10)

    const violations: { file: string; match: string }[] = []

    const patterns = [
      { regex: /process\.env/, name: 'process.env' },
      { regex: /Math\.random\s*\(/, name: 'Math.random()' },
      { regex: /Date\.now\s*\(/, name: 'Date.now()' },
    ]

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8')
      for (const pattern of patterns) {
        if (pattern.regex.test(content)) {
          violations.push({ file: path.relative(coreDir, file), match: pattern.name })
        }
      }
    }

    expect(violations).toEqual([])
  })
})
