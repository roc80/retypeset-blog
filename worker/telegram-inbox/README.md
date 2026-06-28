# telegram-inbox (Cloudflare Worker)

接收 Telegram Bot 的 webhook，把消息存进 Cloudflare KV，供 GitHub Actions 周日定时拉取生成周记。

> 本目录是**独立的 Cloudflare Worker 部署单元**，不属于 Astro 站点构建（`src/index.ts` 用 `// @ts-nocheck` 跳过仓库的 tsc 检查）。

## 一次性部署

需要 Cloudflare 账号（免费）。

```bash
cd worker/telegram-inbox

# 1. 登录 Cloudflare
npx wrangler login

# 2. 创建 KV namespace，把返回的 id 填进 wrangler.toml 的 [[kv_namespaces]].id
npx wrangler kv namespace create INBOX

# 3. 部署 Worker
npx wrangler deploy

# 4. 设置两个 secret（自定义随机串）
#    SECRET_TOKEN: webhook 路径校验
#    WORKER_SECRET: /inbox 鉴权（与 GitHub Secret 同值）
npx wrangler secret put SECRET_TOKEN
npx wrangler secret put WORKER_SECRET
```

部署后得到地址，形如 `https://telegram-inbox.<你的子域>.workers.dev`。

> 直接用最新版 wrangler 也行：把上面命令里的 `npx wrangler` 换成 `npx wrangler@latest`。

## 注册 Telegram webhook

把 Bot 的消息推到本 Worker（`<SECRET_TOKEN>` 用上一步设置的）：

```bash
curl "https://api.telegram.org/bot<TG_BOT_TOKEN>/setWebhook?url=https://telegram-inbox.<你的子域>.workers.dev/webhook/<SECRET_TOKEN>"
```

## 验证

手机给 Bot 发条消息后：

```bash
curl -H "Authorization: Bearer <WORKER_SECRET>" https://telegram-inbox.<你的子域>.workers.dev/inbox
```

应返回 `{ "messages": [ ... ] }`。清空用 `curl -X DELETE -H "Authorization: Bearer <WORKER_SECRET>" .../inbox`。

## 端点

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/webhook/{SECRET_TOKEN}` | Telegram 推送入口，存消息到 KV |
| GET | `/inbox` (Bearer WORKER_SECRET) | 返回全部消息，按时间排序 |
| DELETE | `/inbox` (Bearer WORKER_SECRET) | 清空全部消息 |
