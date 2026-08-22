// @ts-nocheck
/**
 * Cloudflare Worker: Telegram Inbox
 * 接收 Telegram Bot 的 webhook，把每条 message 存入 KV；
 * 对外提供鉴权的 /inbox（GET 读取 / DELETE 清空）给 GitHub Actions 调用。
 * 识别 /genweek 命令：鉴权后触发 GitHub Actions workflow_dispatch，并 sendMessage 回执。
 *
 * 这是独立的 Cloudflare Worker 部署单元，不属于 Astro 站点构建；
 * 类型由 Cloudflare 运行时提供，故用 @ts-nocheck 跳过仓库的严格 tsc 检查。
 *
 * 部署: cd worker/telegram-inbox && npx wrangler deploy
 * KV:   先 `wrangler kv namespace create INBOX`，把 id 填进 wrangler.toml
 * 密钥: wrangler secret put SECRET_TOKEN / WORKER_SECRET / TG_BOT_TOKEN / GH_PAT
 */

// 消息 key 形如 `${date}-${message_id}`（数字-数字）；genweek:lock 等元数据 key 不匹配，不进 /inbox
const MSG_KEY = /^\d+-\d+$/

export interface Env {
  INBOX: KVNamespace
  SECRET_TOKEN: string // webhook 路径校验
  WORKER_SECRET: string // /inbox 端点的 Bearer
  TG_BOT_TOKEN: string // 出站回复消息（与 GitHub Secret 同值）
  GH_PAT: string // fine-grained PAT（仅本仓库 Actions: Read and write），触发 workflow_dispatch
  TG_OWNER_CHAT_ID: string // 允许触发命令的 chat id（wrangler.toml [vars]）
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)

    // ① Telegram webhook 入口: POST /webhook/{SECRET_TOKEN}
    if (url.pathname.startsWith('/webhook/')) {
      if (url.pathname !== `/webhook/${env.SECRET_TOKEN}`)
        return new Response('forbidden', { status: 403 })

      try {
        const update = await req.json()
        const msg = update?.message
        // 只处理 message（忽略 edited_message / channel_post 等，按需扩展）
        if (msg && msg.message_id && msg.date) {
          const cmd = parseBotCommand(msg)
          if (cmd) {
            // 命令不入库（避免混进周记素材），单独处理并回复
            await handleCommand(msg, cmd, env)
          }
          else {
            const key = `${msg.date}-${msg.message_id}`
            // 14 天后自动过期，作为兜底清理（正常由周日任务清空）
            await env.INBOX.put(key, JSON.stringify(msg), { expirationTtl: 14 * 24 * 60 * 60 })
          }
        }
      }
      catch {
        // 解析失败也返回 200，避免 Telegram 反复重试坏数据
      }
      return Response.json({ ok: true })
    }

    // ② /inbox: GET 读取全部 / DELETE 清空（GitHub Actions 用 Bearer 调用）
    if (url.pathname === '/inbox') {
      if (req.headers.get('Authorization') !== `Bearer ${env.WORKER_SECRET}`)
        return new Response('forbidden', { status: 403 })

      if (req.method === 'GET') {
        const list = await env.INBOX.list()
        // 只取消息 key：genweek:lock 等元数据没有 date 字段，混进来会污染排序与周记素材
        const keys = list.keys.filter(k => MSG_KEY.test(k.name)).map(k => k.name)
        const values = await Promise.all(keys.map(k => env.INBOX.get(k)))
        const messages = values
          .filter((v): v is string => Boolean(v))
          .map(v => JSON.parse(v))
          .sort((a, b) => a.date - b.date)
        return Response.json({ messages })
      }

      if (req.method === 'DELETE') {
        const list = await env.INBOX.list()
        const keys = list.keys.filter(k => MSG_KEY.test(k.name)).map(k => k.name)
        await Promise.all(keys.map(k => env.INBOX.delete(k)))
        return Response.json({ ok: true, cleared: keys.length })
      }

      return new Response('method not allowed', { status: 405 })
    }

    return new Response('not found', { status: 404 })
  },
}

/**
 * 解析 message 开头的 bot 命令，非命令返回 null。
 * 双层判定：① Telegram entities 标记首实体为 bot_command（服务端判定）；
 * ② 首个空白分隔 token 整体是 /cmd(@bot) 形态。
 * "/etc/hosts 改了" 这类正文虽会被 entities 标出 "/etc"，但 token 含第二个 /，不匹配 → 照常入库。
 */
function parseBotCommand(msg) {
  const e0 = msg.entities?.[0]
  if (!msg.text || !e0 || e0.type !== 'bot_command' || e0.offset !== 0)
    return null
  const firstToken = msg.text.split(/\s+/)[0]
  if (!/^\/[A-Za-z0-9_]+(@[A-Za-z0-9_]+)?$/.test(firstToken))
    return null
  return {
    name: firstToken.split('@')[0].slice(1).toLowerCase(), // 'genweek'
    args: msg.text.slice(firstToken.length).trim(), // '-1' / '2026-W33' / ''
  }
}

/** 处理命令：鉴权 → 参数校验 → 防抖锁 → dispatch GitHub workflow → 回执 */
async function handleCommand(msg, cmd, env) {
  const chatId = msg.chat?.id
  const send = text => reply(env, chatId, text)

  // 只允许主人触发；陌生人静默忽略（不回复，防探测）
  if (String(chatId) !== env.TG_OWNER_CHAT_ID) {
    console.log(`⛔ 未授权 chat: ${chatId}`)
    return
  }

  if (cmd.name !== 'genweek')
    return send('🤖 只认识 /genweek，可选参数：-1（上周）或 2026-W33（指定 ISO 周）')

  const week = cmd.args
  if (week && !/^-\d+$/.test(week) && !/^\d{4}-W\d{1,2}$/.test(week))
    return send('⚠️ 参数无效，支持：/genweek、/genweek -1、/genweek 2026-W33')

  // 轻量防抖：10 分钟内只放行一次（KV 最终一致属 best-effort；重复 dispatch 再由 workflow concurrency 兜底）
  if (await env.INBOX.get('genweek:lock'))
    return send('⏳ 10 分钟内已触发过，请稍后再试（进度: https://github.com/roc80/retypeset-blog/actions/workflows/auto-week.yml）')
  await env.INBOX.put('genweek:lock', String(Date.now()), { expirationTtl: 600 })

  // 触发 GitHub Actions；无参数时不带 inputs（兼容未声明 inputs 的旧 workflow）
  let res
  try {
    res = await fetch(
      'https://api.github.com/repos/roc80/retypeset-blog/actions/workflows/auto-week.yml/dispatches',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.GH_PAT}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(week ? { ref: 'master', inputs: { week } } : { ref: 'master' }),
        signal: AbortSignal.timeout(8000),
      },
    )
  }
  catch (e) {
    return send(`❌ 触发请求失败: ${e}`)
  }

  // dispatch 成功恒为 204 无响应体；401/403 基本是 PAT 问题，404 多为 PAT 未勾选本仓库，422 是 workflow 未声明 inputs
  if (res.status === 204) {
    return send(`🚀 已触发周记生成${week ? `（${week}）` : ''}\n进度: https://github.com/roc80/retypeset-blog/actions/workflows/auto-week.yml`)
  }
  return send(`❌ 触发失败 HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
}

/** 回复消息（纯文本，不用 parse_mode 免转义）；回复失败只记日志，不影响 webhook 返回 200 */
async function reply(env, chatId, text) {
  if (!chatId)
    return
  try {
    await fetch(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(8000),
    })
  }
  catch (e) {
    console.log(`sendMessage 失败: ${e}`)
  }
}
