/**
 * Create a new weekly post with frontmatter
 * Usage: pnpm new-week
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import dayjs from 'dayjs'
import { themeConfig } from '../src/config'

const currentYear = String(dayjs().year())
const weeksDir = join('src/content/posts/weeks', currentYear)

// Create year directory if not exists
if (!existsSync(weeksDir)) {
  mkdirSync(weeksDir, { recursive: true })
}

// Find the latest week file
const files = readdirSync(weeksDir).filter(f => f.endsWith('.md'))
const weekPattern = new RegExp(`^${currentYear}-Week(\\d+)(?:-.*)?\\.md$`, 'i')

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

const fileName = `${currentYear}-Week${nextWeek}.md`
const fullPath = join(weeksDir, fileName)

// Check if file already exists
if (existsSync(fullPath)) {
  console.error(`❌ File already exists: ${fullPath}`)
  process.exit(1)
}

// Prepare file content
const content = `---
title: ${currentYear}-Week${nextWeek}
pubDate: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}
description: ''
updated: ''
tags:
  - 周记
draft: false
pin: 0
toc: ${themeConfig.global.toc}
lang: ''
abbrlink: '${currentYear}-week${nextWeek}'
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
