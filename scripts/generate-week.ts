/**
 * Generate a weekly journal (周记) from this week's Telegram messages.
 *
 * 流程: 读 Cloudflare Worker /inbox → 直连 Telegram 下载图片 → 调智谱 GLM 生成正文
 *      → 写 src/content/posts/weeks/{年}/{年}-Week{N}.md → 清空 /inbox
 *
 * 运行: pnpm tsx scripts/generate-week.ts   (由 .github/workflows/auto-week.yml 周日定时调用)
 *
 * 环境变量:
 *   WORKER_URL / WORKER_SECRET  — 读取并清空 Worker /inbox
 *   TG_BOT_TOKEN                — 直连 Telegram getFile 下载图片（GH Actions runner 在境外，可直连）
 *   GLM_API_KEY                 — 智谱 BigModel (OpenAI 兼容) key
 *   GLM_MODEL (可选)            — 默认 glm-4.6；可设为 glm-4-flash 等
 *   TZ                          — 由 workflow 设为 Asia/Shanghai，让 dayjs 取北京时间
 *
 * 本周 inbox 为空时不写文件、不提交（避免空周记）。编号逻辑与 scripts/new-week.ts 一致。
 */

import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import dayjs from 'dayjs'
import { themeConfig } from '../src/config'

const WEEKS_DIR = 'src/content/posts/weeks'
const IMAGES_DIR = 'public/images/weeks'

function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    console.error(`❌ 缺少环境变量 ${key}`)
    process.exit(1)
  }
  return value
}

const WORKER_URL = requireEnv('WORKER_URL')
const WORKER_SECRET = requireEnv('WORKER_SECRET')
const TG_BOT_TOKEN = requireEnv('TG_BOT_TOKEN')
const GLM_API_KEY = requireEnv('GLM_API_KEY')
const GLM_MODEL = process.env.GLM_MODEL || 'glm-4.6'

interface TgPhotoSize {
  file_id: string
  width: number
  height: number
}

interface TgMessage {
  message_id: number
  date: number
  text?: string
  caption?: string
  photo?: TgPhotoSize[]
}

/** 从 Worker 读取本周所有消息（已按时间排序） */
async function fetchInbox(): Promise<TgMessage[]> {
  const res = await fetch(`${WORKER_URL}/inbox`, {
    headers: { Authorization: `Bearer ${WORKER_SECRET}` },
  })
  if (!res.ok)
    throw new Error(`读取 inbox 失败: ${res.status} ${await res.text()}`)
  const data = (await res.json()) as { messages?: TgMessage[] }
  return data.messages ?? []
}

/** 通过 Telegram getFile 下载图片，返回字节 */
async function downloadTgPhoto(fileId: string): Promise<Uint8Array> {
  const metaRes = await fetch(
    `https://api.telegram.org/bot${TG_BOT_TOKEN}/getFile?file_id=${fileId}`,
  )
  const meta = (await metaRes.json()) as { ok?: boolean, result?: { file_path?: string } }
  if (!meta.ok || !meta.result?.file_path)
    throw new Error(`getFile 失败: ${JSON.stringify(meta)}`)

  const fileRes = await fetch(
    `https://api.telegram.org/file/bot${TG_BOT_TOKEN}/${meta.result.file_path}`,
  )
  if (!fileRes.ok)
    throw new Error(`下载图片失败: ${fileRes.status}`)
  return new Uint8Array(await fileRes.arrayBuffer())
}

/** 调智谱 GLM (OpenAI 兼容接口) 生成周记正文 */
async function generateBody(transcript: string): Promise<string> {
  const res = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GLM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GLM_MODEL,
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content:
            '你是一个帮我写个人周记的助手。我会给你本周在 Telegram 里随手记下的碎片（文字 + 图片占位 [图片N]）。'
            + '请据此写一篇自然、真诚的周记 markdown **正文**：不要输出 frontmatter，不要用代码块包裹。'
            + '可以自由分节（如 工作 / 生活 / 周末 / 感想），不必每节都有；保留我提到的具体细节和语气，适度润色但不要编造没有的事实。'
            + '想在合适位置放图片时，写 [图片N] 占位（由后处理替换为真实图片），不必引用全部图片。'
            + '篇幅适中，结尾可有一句感想。',
        },
        { role: 'user', content: transcript },
      ],
    }),
  })
  if (!res.ok)
    throw new Error(`GLM 调用失败: ${res.status} ${await res.text()}`)
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  const content = data.choices?.[0]?.message?.content ?? ''
  return content
    .trim()
    .replace(/^```(?:markdown|md)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
}

/** 计算目标文件名与路径，编号逻辑与 scripts/new-week.ts 一致（当年目录 max + 1） */
function resolveTarget(): { fullPath: string, title: string, abbrlink: string } {
  const currentYear = String(dayjs().year())
  const weeksDir = join(WEEKS_DIR, currentYear)
  if (!existsSync(weeksDir))
    mkdirSync(weeksDir, { recursive: true })

  const files = readdirSync(weeksDir).filter(f => f.endsWith('.md'))
  const weekPattern = new RegExp(`^${currentYear}-Week(\\d+)(?:-.*)?\\.md$`, 'i')
  let nextWeek = 1
  if (files.length > 0) {
    const nums = files
      .map((f) => {
        const m = f.match(weekPattern)
        return m ? Number.parseInt(m[1], 10) : 0
      })
      .filter(n => n > 0)
    if (nums.length > 0)
      nextWeek = Math.max(...nums) + 1
  }

  const title = `${currentYear}-Week${nextWeek}`
  const abbrlink = title.toLowerCase().replace(/\s+/g, '-')
  return { fullPath: join(weeksDir, `${title}.md`), title, abbrlink }
}

async function main(): Promise<void> {
  // 1. 读取消息
  const messages = await fetchInbox()
  if (messages.length === 0) {
    console.log('ℹ️  本周 inbox 为空，跳过生成。')
    return
  }
  console.log(`📩 读取到 ${messages.length} 条消息`)

  // 2. 算目标文件
  const year = String(dayjs().year())
  const { fullPath, title, abbrlink } = resolveTarget()
  const imgDir = join(IMAGES_DIR, year)
  if (!existsSync(imgDir))
    mkdirSync(imgDir, { recursive: true })

  // 3. 下载图片 + 拼接 transcript
  let imgIndex = 0
  const imageMap = new Map<number, string>() // 图片序号 -> 公开路径
  const lines: string[] = []

  for (const msg of messages) {
    const when = dayjs.unix(msg.date).format('MM-DD HH:mm')
    const text = (msg.text ?? msg.caption ?? '').trim()

    if (msg.photo && msg.photo.length > 0) {
      const largest = msg.photo[msg.photo.length - 1] // photo 数组按尺寸升序，取最大
      const n = imgIndex + 1
      try {
        const bytes = await downloadTgPhoto(largest.file_id)
        writeFileSync(join(imgDir, `img${n}.jpg`), bytes)
        imgIndex = n
        const publicPath = `/images/weeks/${year}/img${n}.jpg`
        imageMap.set(n, publicPath)
        lines.push(`「${when}」 [图片${n}]${text ? ` ${text}` : ''}`)
        console.log(`🖼️  下载图片${n} -> ${publicPath}`)
      }
      catch (error) {
        console.error(`⚠️  图片下载失败，跳过: ${(error as Error).message}`)
        if (text)
          lines.push(`「${when}」 ${text}`) // 图片挂了也保留文字
      }
    }
    else if (text) {
      lines.push(`「${when}」 ${text}`)
    }
  }

  if (lines.length === 0) {
    console.log('ℹ️  没有可用的文字/图片内容，跳过生成。')
    return
  }

  // 4. 调 GLM 生成正文
  console.log('🤖 调用 GLM 生成周记…')
  let body = await generateBody(lines.join('\n'))

  // 5. 后处理: [图片N] -> ![](...)；未被引用的图片追加到文末
  const referenced = new Set<number>()
  body = body.replace(/\[图\s*片?\s*(\d+)\]/g, (_match, n: string) => {
    const idx = Number.parseInt(n, 10)
    const path = imageMap.get(idx)
    if (path) {
      referenced.add(idx)
      return `![图片${idx}](${path})`
    }
    return '' // 引用了不存在的图片，移除占位
  })
  const unreferenced = [...imageMap.entries()].filter(([i]) => !referenced.has(i))
  if (unreferenced.length > 0)
    body += `\n\n${unreferenced.map(([i, path]) => `![图片${i}](${path})`).join('\n')}`

  // 6. 写文件
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

${body}
`
  writeFileSync(fullPath, content)
  console.log(`✅ 周记已生成: ${fullPath} (abbrlink=${abbrlink})`)

  // 7. 清空 inbox（仅生成成功后）
  const delRes = await fetch(`${WORKER_URL}/inbox`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${WORKER_SECRET}` },
  })
  if (!delRes.ok)
    console.error(`⚠️  清空 inbox 失败: ${delRes.status}（下周可能重复这些消息）`)
  else
    console.log('🧹 inbox 已清空')
}

main().catch((error) => {
  console.error('❌ 生成失败:', error)
  process.exit(1)
})
