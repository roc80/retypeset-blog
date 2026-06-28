// @ts-nocheck
/**
 * Cloudflare Worker: Telegram Inbox
 * 接收 Telegram Bot 的 webhook，把每条 message 存入 KV；
 * 对外提供鉴权的 /inbox（GET 读取 / DELETE 清空）给 GitHub Actions 调用。
 *
 * 这是独立的 Cloudflare Worker 部署单元，不属于 Astro 站点构建；
 * 类型由 Cloudflare 运行时提供，故用 @ts-nocheck 跳过仓库的严格 tsc 检查。
 *
 * 部署: cd worker/telegram-inbox && npx wrangler deploy
 * KV:   先 `wrangler kv namespace create INBOX`，把 id 填进 wrangler.toml
 * 密钥: wrangler secret put SECRET_TOKEN  /  wrangler secret put WORKER_SECRET
 */

export interface Env {
  INBOX: KVNamespace
  SECRET_TOKEN: string // webhook 路径校验
  WORKER_SECRET: string // /inbox 端点的 Bearer
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
        // 只存 message（忽略 edited_message / channel_post 等，按需扩展）
        if (msg && msg.message_id && msg.date) {
          const key = `${msg.date}-${msg.message_id}`
          // 14 天后自动过期，作为兜底清理（正常由周日任务清空）
          await env.INBOX.put(key, JSON.stringify(msg), { expirationTtl: 14 * 24 * 60 * 60 })
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
        const values = await Promise.all(list.keys.map(k => env.INBOX.get(k.name)))
        const messages = values
          .filter((v): v is string => Boolean(v))
          .map(v => JSON.parse(v))
          .sort((a, b) => a.date - b.date)
        return Response.json({ messages })
      }

      if (req.method === 'DELETE') {
        const list = await env.INBOX.list()
        await Promise.all(list.keys.map(k => env.INBOX.delete(k.name)))
        return Response.json({ ok: true, cleared: list.keys.length })
      }

      return new Response('method not allowed', { status: 405 })
    }

    return new Response('not found', { status: 404 })
  },
}
