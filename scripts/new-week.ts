/**
 * Create a new weekly post with frontmatter
 * Usage: pnpm new-week [filename]
 * Example: pnpm new-week /2026/Week-13.md
 */

import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join, dirname, parse } from 'node:path'
import process from 'node:process'
import dayjs from 'dayjs'
import { themeConfig } from '../src/config'

// Get custom filename from argument
const customPath = process.argv[2]

let fullPath: string
let fileName: string

if (customPath) {
  // Use custom filename from argument
  // Handle different path formats
  let relativePath = customPath

  // Windows Git Bash converts /2026/xxx.md to D:/path/to/2026/xxx.md
  // Extract relative path from absolute Windows path
  if (/^[A-Za-z]:/.test(customPath)) {
    // Absolute Windows path - extract the part after the drive's root
    const parts = customPath.replace(/^[A-Za-z]:[\\/]?/, '').split(/[\\/]/)
    // Find the year folder (4 digits) and everything after it
    const yearIndex = parts.findIndex(p => /^\d{4}$/.test(p))
    if (yearIndex >= 0) {
      relativePath = parts.slice(yearIndex).join('/')
    }
    else {
      // Fallback to just filename
      relativePath = parse(customPath).base
    }
  }
  else if (customPath.startsWith('/')) {
    // /2026/Week-13.md -> 2026/Week-13.md
    relativePath = customPath.slice(1)
  }

  fullPath = join('src/content/posts/weeks', relativePath)

  // Create parent directory if needed
  const dir = dirname(fullPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  fileName = parse(fullPath).name
}
else {
  // Original auto-calculated logic
  const currentYear = String(dayjs().year())
  const weeksDir = join('src/content/posts/weeks', currentYear)

  // Create year directory if not exists
  if (!existsSync(weeksDir)) {
    mkdirSync(weeksDir, { recursive: true })
  }

  // Find the latest week file
  const files = readdirSync(weeksDir).filter(f => f.endsWith('.md'))
  const weekPattern = new RegExp('^' + currentYear + '-Week(\\\\d+)(?:-.*)?\\\\.md\\$', 'i')

  let nextWeek = 1

  if (files.length > 0) {
    const weekNumbers = files
      .map(f => {
        const match = f.match(weekPattern)
        return match ? parseInt(match[1], 10) : 0
      })
      .filter(n => n > 0)

    if (weekNumbers.length > 0) {
      const maxWeek = Math.max(...weekNumbers)
      nextWeek = maxWeek + 1
    }
  }

  fileName = `${currentYear}-Week${nextWeek}.md`
  fullPath = join(weeksDir, fileName)
}

// Check if file already exists
if (existsSync(fullPath)) {
  console.error(`❌ File already exists: ${fullPath}`)
  process.exit(1)
}

// Prepare file content
// Extract title from filename (remove .md extension)
const title = fileName.replace(/\.md$/, '')

// For abbrlink, convert to lowercase and replace spaces with hyphens
const abbrlink = title.toLowerCase().replace(/\s+/g, '-')

const content = `---
title: ${title}
pubDate: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}
description: ''
updated: ''
tags:
  - 周记
draft: false
pin: 0
toc: ${themeConfig.global.toc}
lang: ''
abbrlink: '${abbrlink}'
---
`

// Write to file
try {
  writeFileSync(fullPath, content)
  console.log(`✅ Week post created: ${fullPath}`)
}
catch (error) {
  console.error('❌ Failed to create post:', error)
  process.exit(1)
}
