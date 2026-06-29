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
 * 本周 inbox 为空时不写文件、不提交（避免空周记）。
 * 周记名按真实周次（ISO week）：如 2026-06-28 是第 26 周 → 2026-Week26。
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import { themeConfig } from '../src/config'

dayjs.extend(isoWeek)

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

/** 调智谱 GLM (OpenAI 兼容接口) 生成周记正文（流水账风格：不修饰、不升华，严格按消息行文） */
async function generateBody(transcript: string): Promise<string> {
  const res = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GLM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GLM_MODEL,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            '你帮我写个人周记。我会把你本周在 Telegram 里记下的碎片逐条发给你，每条格式为：\n'
            + '「MM-DD HH:mm」 内容（文字 或 [图片N] 占位）。\n\n'
            + '要求：\n'
            + '1. 严格记流水账：忠于我给的内容，按时间顺序写成通顺的日记，'
            + '不要添加修饰、感悟、总结或升华，不要"润色"，不要编造我没提到的事。\n'
            + '2. 行首的「MM-DD HH:mm」只用于排序——正文里绝对不要出现具体几点几分（如 00:36、11:53）。'
            + '可用日期（如"6月29日"）或"周一/周二"分节，但不要硬凑小标题。\n'
            + '3. 把零碎的句子组织成连贯、可读的段落，平铺直叙，不要逐条罗列时间戳。\n'
            + '4. 图片占位 [图片N] 必须独占一行：前后不要加逗号、句号、引号或任何标点，也不要和文字写在同一行。不必引用全部图片。\n'
            + '5. 正文里出现的英文冒号 ":" 一律替换为中文冒号 "："。\n\n'
            + '示例——\n'
            + '输入：\n'
            + '「06-29 00:36」 [图片1]\n'
            + '「06-29 11:53」 这周周一测试一下周记自动生成。\n\n'
            + '输出：\n'
            + '6月29日\n\n'
            + '[图片1]\n\n'
            + '这周周一测试一下周记自动生成。\n\n'
            + '只输出 markdown 正文，不要 frontmatter，不要代码块包裹。',
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

/** 计算目标文件名与路径：周记名用真实周次（ISO week），如 2026-06-28 → 2026-Week26。
 *  isoWeekYear 与 isoWeek 配套使用，跨年边界（12 月底 / 1 月初）也正确。 */
function resolveTarget(): { fullPath: string, title: string, abbrlink: string } {
  const isoYear = dayjs().isoWeekYear()
  const isoWeekNum = dayjs().isoWeek()
  const yearStr = String(isoYear)
  const weeksDir = join(WEEKS_DIR, yearStr)
  if (!existsSync(weeksDir))
    mkdirSync(weeksDir, { recursive: true })

  const title = `${yearStr}-Week${isoWeekNum}`
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

  // 2. 算目标文件（周记名 = 真实周次）；图片年份与之保持一致
  const year = String(dayjs().isoWeekYear())
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
        // 文件名用消息时间戳(+ message_id 防同秒碰撞)；[图片N] 仍是给 GLM 引用的顺序编号
        const fileName = `${dayjs.unix(msg.date).format('YYYYMMDD-HHmmss')}-${msg.message_id}.jpg`
        writeFileSync(join(imgDir, fileName), bytes)
        imgIndex = n
        const publicPath = `/images/weeks/${year}/${fileName}`
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

  // 注：inbox 的清空已移到工作流「push 成功后」执行（见 .github/workflows/auto-week.yml 的
  // "清空 Worker inbox" 步骤）。这样即使 push 失败，消息也不会被清掉、本周内容不会丢失，
  // 下次重跑会重新生成同一周的周记（按 ISO 周，同周同名文件，幂等覆盖）。本脚本只负责生成。
}

main().catch((error) => {
  console.error('❌ 生成失败:', error)
  process.exit(1)
})
