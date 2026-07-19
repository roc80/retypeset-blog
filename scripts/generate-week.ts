/**
 * Generate a weekly journal (周记) from this week's Telegram messages.
 *
 * 流程: 读 Cloudflare Worker /inbox → 按"当前 ISO 周"过滤 → 直连 Telegram 下载图片 → 调智谱 GLM 生成正文
 *      → 写 src/content/posts/weeks/{年}/{年}-Week{N}.md
 *
 * 幂等: inbox 不再清空（靠 Worker KV 写入时设的 14 天 TTL 自动过期）。本周内任意时刻生成，
 *      都会按 ISO 周过滤出本周全部消息；跨周消息自动排除，不会混入。按 ISO 周同名文件覆盖。
 *
 * 运行: pnpm tsx scripts/generate-week.ts   (由 .github/workflows/auto-week.yml 周日定时调用)
 *
 * 环境变量:
 *   WORKER_URL / WORKER_SECRET  — 读取并清空 Worker /inbox
 *   TG_BOT_TOKEN                — 直连 Telegram getFile 下载图片（GH Actions runner 在境外，可直连）
 *   GLM_API_KEY                 — 智谱 BigModel (OpenAI 兼容) key
 *   GLM_MODEL (可选)            — 默认 glm-5.1；可设为 glm-4-flash 等
 *   TZ                          — 由 workflow 设为 Asia/Shanghai，让 dayjs 取北京时间
 *
 * 本周 inbox 为空时不写文件、不提交（避免空周记）。
 * 周记名按真实周次（ISO week）：如 2026-06-28 是第 26 周 → 2026-Week26。
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { delimiter, join } from 'node:path'
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
const GLM_MODEL = process.env.GLM_MODEL || 'glm-5.1'

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

/**
 * 判断给定 Unix 时间戳(秒)是否属于"当前 ISO 周"。
 * 用 isoWeekYear + isoWeek 配套判定，跨年边界（12 月底 / 1 月初）也正确。
 * inbox 不再清空，靠此函数按周过滤，保证本周任意时刻生成都拿到本周完整消息（幂等）。
 */
function isCurrentIsoWeek(unixTs: number): boolean {
  const t = dayjs.unix(unixTs)
  const now = dayjs()
  return t.isoWeekYear() === now.isoWeekYear() && t.isoWeek() === now.isoWeek()
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
  // —— Prompt 构建（结构化：规则用数组维护，追加新要求只需往 rules 里加一条，编号自动续上）——

  // 输入格式说明
  const inputFormat
    = '你帮我写个人周记。我会把你本周在 Telegram 里记下的碎片逐条发给你，'
      + '每条格式为：「MM-DD HH:mm」 内容；内容可能是纯文字、[图片N] 占位，或 [图片N] 后跟一句该图片的文字说明。'
      + '我发的文字和图片是交叉出现的，一段文字和它附近的图片通常相互关联。'

  // 规则列表（数组顺序即正文里的编号顺序）
  const rules = [
    '严格记流水账：忠于我给的内容，按时间顺序写成通顺的日记，不要添加修饰、感悟、总结或升华，不要"润色"，不要编造我没提到的事。',
    '行首的「MM-DD HH:mm」只用于排序和判断是否换天——正文里绝对不要出现具体几点几分（如 00:36、11:53），也不要写出日期或重复消息发送时间。',
    '图片占位 `[图片N]` 必须逐字原样保留：方括号、"图片"、序号 N 都不变，不要改名、删除、合并，更不要改写成 `[image-...]` 或任何别的形式；序号 N 之外的图片信息（如时间戳）不要写进正文。',
    '严格按消息顺序交叉排版文字与图片：每段文字和它前后相邻的 `[图片N]` 要保持在消息流里的相对位置（图片与紧邻的文字相互关联），绝不能把文字全部堆到前面、把 `[图片N]` 全部堆到后面或挪到文末。',
    '把零碎句子组织成连贯、可读的段落，平铺直叙，不要逐条罗列时间戳；合并段落时 `[图片N]` 必须留在对应文字原本的位置，不能因排版而被挪走。',
    '不要自行添加任何小标题。',
    '不同日期（按行首 MM-DD 判断）的内容之间，用单独一行的水平分割线 `---` 隔开；同一天的内容连续写、不要加分割线。`---` 必须独占一行、前后各留一个空行，正文最开头和最末尾都不要放 `---`。',
    '只输出纯净的 Markdown 正文：不要使用代码块（```）、行内代码、HTML 标签或 HTML 实体。',
    '正文里出现的英文冒号 ":" 一律替换为中文冒号 "："。',
    '严格检查并纠正中文错别字与英文拼写错误（包括我消息里的笔误），但不要改变原意。',
  ]

  const systemContent = [
    inputFormat,
    '',
    '要求：',
    ...rules.map((rule, i) => `${i + 1}. ${rule}`),
    '',
  ].join('\n')

  // 流式 + 重试：glm-5.1 是思考型模型、响应慢，非流式时服务端必须把整篇生成完才回 header，
  // 容易撞 undici headersTimeout（默认 300s）整体失败、连带已下载的图片白费。改流式让 header 秒回
  // 规避该错误；再对瞬时网络故障（超时 / 连接重置 / 5xx / 429）退避重试。
  const MAX_RETRIES = 3
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const raw = await requestGLM(systemContent, transcript)
      return raw
        .trim()
        .replace(/^```(?:markdown|md)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim()
    }
    catch (error) {
      if (attempt === MAX_RETRIES || !isRetryable(error))
        throw error
      const backoffMs = 5000 * 2 ** (attempt - 1) // 5s, 10s
      console.warn(`⚠️  GLM 第 ${attempt}/${MAX_RETRIES} 次失败，${backoffMs / 1000}s 后重试：${(error as Error).message}`)
      await new Promise(resolve => setTimeout(resolve, backoffMs))
    }
  }
  // 仅在 MAX_RETRIES 被调到 0 时理论可达，兜底
  throw new Error('GLM 调用重试次数耗尽')
}

/**
 * 单次流式调用 GLM，边读边累积 delta.content 返回。
 * 思考型模型会先吐 reasoning_content（思考过程），这里只收集正式正文 content，思考过程丢弃。
 */
async function requestGLM(systemContent: string, transcript: string): Promise<string> {
  const res = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GLM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GLM_MODEL,
      temperature: 0.3,
      stream: true,
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: transcript },
      ],
    }),
  })
  if (!res.ok) {
    // 错误响应是普通 JSON、不是 SSE；记下 status 让上层按 4xx/5xx 决定是否重试
    const err = new Error(`GLM 调用失败: ${res.status} ${await res.text()}`) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  if (!res.body)
    throw new Error('GLM 返回空响应体')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''
  let chunk = await reader.read()
  while (!chunk.done) {
    buffer += decoder.decode(chunk.value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? '' // 末行可能被分块截断，留到下次拼接
    for (const line of lines) {
      const data = line.trim()
      if (!data.startsWith('data:'))
        continue
      const payload = data.slice(5).trim()
      if (!payload || payload === '[DONE]')
        continue
      let parsed: { choices?: { delta?: { content?: string } }[] }
      try {
        parsed = JSON.parse(payload)
      }
      catch {
        continue // keep-alive / 非 JSON 注释行，忽略
      }
      const delta = parsed.choices?.[0]?.delta?.content
      if (delta)
        content += delta
    }
    chunk = await reader.read()
  }
  return content
}

/** 判断错误是否值得重试：网络层失败（fetch failed / 超时 / 连接重置）或 HTTP 5xx / 429。 */
function isRetryable(error: unknown): boolean {
  const status = (error as { status?: number })?.status
  if (typeof status === 'number')
    return status === 429 || status >= 500
  if (error instanceof Error) {
    const code
      = (error as { cause?: { code?: string } }).cause?.code
        ?? (error as { code?: string }).code
    if (typeof code === 'string' && /TIMEOUT|RESET|REFUSED|UNREACHABLE|EAI_AGAIN|EPIPE/.test(code))
      return true
    return error.message.includes('fetch failed')
  }
  return false
}

/**
 * 确定性清洗 GLM 生成的正文，使其通过 MarkdownLint 校验：
 * 1. 规范水平分割线：所有 `---`/`***`/`___` 归一为 `---`，并强制前后各空一行
 *    （否则「文字\n---」会被解析成 Setext 二级标题，分割线被吃掉、文字变标题）；
 * 2. 去除每行行尾空白（MD009）；
 * 3. 合并连续空行为单个（MD012）；
 * 4. 去掉正文首尾多余空行与首尾多余的 `---`，保证以单个换行结尾（MD047）。
 * 只作用于正文 body，不含 frontmatter。
 */
function cleanMarkdown(body: string): string {
  const isHr = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/
  const lines = body.replace(/\r\n/g, '\n').split('\n')

  // 行尾去空白；水平线归一为 ---
  const normalized = lines.map(line => (isHr.test(line) ? '---' : line.replace(/[ \t]+$/, '')))

  // 确保每条 --- 前后都有空行，同时合并连续空行
  const spaced: string[] = []
  for (const line of normalized) {
    if (line === '---') {
      if (spaced[spaced.length - 1] !== '')
        spaced.push('')
      spaced.push('---')
      spaced.push('')
    }
    else {
      if (line === '' && spaced[spaced.length - 1] === '')
        continue
      spaced.push(line)
    }
  }

  const trimBlanks = (arr: string[]): string[] => {
    while (arr.length && arr[0] === '')
      arr.shift()
    while (arr.length && arr[arr.length - 1] === '')
      arr.pop()
    return arr
  }

  let cleaned = trimBlanks(spaced)
  // 分割线只用于天与天之间，首尾不应出现单独的 ---
  if (cleaned[0] === '---')
    cleaned = trimBlanks(cleaned.slice(1))
  if (cleaned[cleaned.length - 1] === '---')
    cleaned = trimBlanks(cleaned.slice(0, -1))

  return `${cleaned.join('\n')}\n`
}

/**
 * 对生成的 md 文件先跑 markdownlint-cli2 --fix 自动修复可修复的规则，再校验一次。
 * node_modules/.bin 注入 PATH 以兼容本地与 CI；返回是否通过及残留输出。
 */
function markdownlintFile(filePath: string): { ok: boolean, output: string } {
  const binDir = join(process.cwd(), 'node_modules', '.bin')
  const env = { ...process.env, PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}` }
  const run = (args: string[]) =>
    spawnSync('markdownlint-cli2', args, { env, shell: true, encoding: 'utf8' })

  // 1. 自动修复（行尾空白、连续空行、分割线风格、文件结尾换行等）
  run(['--fix', filePath])
  // 2. 校验，确认是否仍有 markdownlint 无法自动修复的残留问题
  const verify = run([filePath])
  const output = `${verify.stdout || ''}${verify.stderr || ''}`.trim()
  return { ok: verify.status === 0, output }
}

/**
 * 计算目标文件名与路径：周记名用真实周次（ISO week），如 2026-06-28 → 2026-Week26。
 *  isoWeekYear 与 isoWeek 配套使用，跨年边界（12 月底 / 1 月初）也正确。
 */
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
  // 1. 读取消息并按"当前 ISO 周"过滤（inbox 不清空，跨周消息自动排除，保证本周幂等）
  const all = await fetchInbox()
  const messages = all.filter(msg => isCurrentIsoWeek(msg.date))
  if (messages.length === 0) {
    console.log(`ℹ️  本周 inbox 为空（历史消息 ${all.length} 条），跳过生成。`)
    return
  }
  console.log(`📩 读取到 ${all.length} 条消息，本周占 ${messages.length} 条`)

  // 2. 算目标文件（周记名 = 真实周次）；图片年份与之保持一致
  const year = String(dayjs().isoWeekYear())
  const { fullPath, title, abbrlink } = resolveTarget()
  const imgDir = join(IMAGES_DIR, year)
  if (!existsSync(imgDir))
    mkdirSync(imgDir, { recursive: true })

  // 3. 下载图片 + 拼接 transcript
  let imgIndex = 0
  const imageMap = new Map<number, { path: string, stamp: string }>() // 图片序号 -> {公开路径, 发送时刻时间戳}
  const lines: string[] = []

  for (const msg of messages) {
    const when = dayjs.unix(msg.date).format('MM-DD HH:mm')
    const text = (msg.text ?? msg.caption ?? '').trim()

    if (msg.photo && msg.photo.length > 0) {
      const largest = msg.photo[msg.photo.length - 1] // photo 数组按尺寸升序，取最大
      const n = imgIndex + 1
      try {
        const bytes = await downloadTgPhoto(largest.file_id)
        // 发送时刻时间戳：文件名用它(+ message_id 防同秒碰撞)，图片 alt 也用它命名（替代「图片N」）
        const stamp = dayjs.unix(msg.date).format('YYYYMMDD-HHmmss')
        const fileName = `${stamp}-${msg.message_id}.jpg`
        writeFileSync(join(imgDir, fileName), bytes)
        imgIndex = n
        const publicPath = `/images/weeks/${year}/${fileName}`
        imageMap.set(n, { path: publicPath, stamp })
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
  body = body.replace(/\[图\s*(?:片\s*)?(\d+)\]/g, (_match, n: string) => {
    const idx = Number.parseInt(n, 10)
    const img = imageMap.get(idx)
    if (img) {
      referenced.add(idx)
      return `![${img.stamp}](${img.path})` // 图片名用发送时刻时间戳，不用「图片N」
    }
    return '' // 引用了不存在的图片，移除占位
  })
  const unreferenced = [...imageMap.entries()].filter(([i]) => !referenced.has(i))
  if (unreferenced.length > 0)
    body += `\n\n${unreferenced.map(([, img]) => `![${img.stamp}](${img.path})`).join('\n')}`

  // 6. 清洗正文（分割线前后空行 / 去行尾空白 / 合并空行）使其通过 MarkdownLint
  body = cleanMarkdown(body)

  // 7. 写文件：frontmatter 与正文之间空一行，正文由 cleanMarkdown 保证以单个换行结尾
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
---\n\n${body}`
  writeFileSync(fullPath, content)

  // 8. MarkdownLint 自动修复 + 校验（通过 .markdownlint.json 规则；MD013 行长度已关，适配中文长段）
  const { ok, output } = markdownlintFile(fullPath)
  if (ok)
    console.log(`✅ MarkdownLint 校验通过: ${fullPath}`)
  else
    console.warn(`⚠️  MarkdownLint 仍有无法自动修复的问题，请人工检查 ${fullPath}:\n${output}`)

  console.log(`✅ 周记已生成: ${fullPath} (abbrlink=${abbrlink})`)

  // 注：inbox 不再清空（不再调用 DELETE /inbox）。消息靠 Worker KV 写入时的 14 天 TTL 自动过期，
  // 本周内任意时刻重跑都会按 ISO 周过滤出本周完整消息（同周同名文件覆盖，幂等）；失败重跑也安全，
  // 因为消息从不主动删除。跨周后旧消息在 14 天内会被 TTL 清掉，或被本周过滤排除、不混入。
}

main().catch((error) => {
  console.error('❌ 生成失败:', error)
  process.exit(1)
})
