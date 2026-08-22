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

# 4. 设置 secret（自定义随机串 / 按注释取值）
#    SECRET_TOKEN:  webhook 路径校验
#    WORKER_SECRET: /inbox 鉴权（与 GitHub Secret 同值）
#    TG_BOT_TOKEN:  出站回复消息（与 GitHub Secret 同值）
#    GH_PAT:        fine-grained PAT（仅 roc80/retypeset-blog，权限只勾 Actions: Read and write）
npx wrangler secret put SECRET_TOKEN
npx wrangler secret put WORKER_SECRET
npx wrangler secret put TG_BOT_TOKEN
npx wrangler secret put GH_PAT

# 5. 把你的 chat id 填进 wrangler.toml 的 [vars] TG_OWNER_CHAT_ID
#    查法：先给 bot 发条消息，再 curl -H "Authorization: Bearer <WORKER_SECRET>" <WORKER_URL>/inbox 看 chat.id
#    （改 vars 后需重新 npx wrangler deploy）
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
| POST | `/webhook/{SECRET_TOKEN}` | Telegram 推送入口，存消息到 KV；`/genweek` 命令走触发分支不入库 |
| GET | `/inbox` (Bearer WORKER_SECRET) | 返回全部消息，按时间排序（只含消息 key，排除防抖锁等元数据） |
| DELETE | `/inbox` (Bearer WORKER_SECRET) | 清空全部消息（不动防抖锁） |

## Bot 命令（/genweek）

主人（chat id 与 `TG_OWNER_CHAT_ID` 一致）在私聊里发：

| 命令 | 行为 |
|---|---|
| `/genweek` | 触发周记生成（默认逻辑：周五/六/日生成本周，其余生成上周） |
| `/genweek -1` | 生成上周 |
| `/genweek 2026-W33` | 生成指定 ISO 周 |

- 触发方式：Worker 调 GitHub `workflow_dispatch`（fine-grained PAT），bot 秒回「🚀 已触发」+ 进度链接
- 命令消息不写入 KV（不混进周记素材）；未授权 chat 静默忽略
- 10 分钟防抖：间隔太短回「⏳ 已触发过」；重复 run 还会被 workflow 的 `concurrency` 取消
- 指定周受 KV 14 天 TTL 限制：太久远的周消息已过期，run 会因 inbox 无该周消息而空跑
- 前置条件：master 上的 workflow 已声明 `inputs.week`（带参数的 dispatch 才不会 422），所以先合代码再配命令

## 本地调试

`worker/telegram-inbox/.dev.vars` 写入本地密钥（根 .gitignore 已忽略，勿提交）：

```
SECRET_TOKEN=dev-secret
WORKER_SECRET=dev-worker-secret
TG_BOT_TOKEN=xxx
GH_PAT=xxx
TG_OWNER_CHAT_ID=123456789
```

`npx wrangler dev` 后用 curl 模拟 Telegram update：

```bash
# 普通消息（入库）
curl -X POST http://localhost:8787/webhook/dev-secret -H 'Content-Type: application/json' \
  -d '{"update_id":1,"message":{"message_id":1,"date":1755800000,"text":"测试","chat":{"id":123456789}}}'

# 命令（不入库，真实触发 GitHub dispatch + Telegram 回复）
curl -X POST http://localhost:8787/webhook/dev-secret -H 'Content-Type: application/json' \
  -d '{"update_id":2,"message":{"message_id":2,"date":1755800100,"text":"/genweek -1","chat":{"id":123456789},"entities":[{"offset":0,"length":8,"type":"bot_command"}]}}'

# GET /inbox 应只含普通消息、排序正常
curl -H "Authorization: Bearer dev-worker-secret" http://localhost:8787/inbox
```
