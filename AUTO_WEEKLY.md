# 周记自动化（Telegram → GLM → 自动发布）

每周日 23:00（北京时间）自动把本周发到 Telegram Bot 的文字/图片汇总成一篇周记，推送到 `master` 并上线。

## 架构

- **Cloudflare Worker**（`worker/telegram-inbox/`，境外免费）：收 Telegram webhook → 存 KV。
- **GitHub Actions**（`.github/workflows/auto-week.yml`，境外 runner）：周日定时 → 读 inbox → 下图 → 调智谱 GLM → 写周记 → push `master` + build + rsync 上线。
- 中国服务器（宝塔 nginx）只做静态托管，**不参与自动化**（规避 Telegram 被墙）。

## 一次性配置

### 1. Telegram Bot
找 [@BotFather](https://t.me/BotFather) 创建 Bot，拿到 `TG_BOT_TOKEN`。

### 2. Cloudflare Worker
按 [`worker/telegram-inbox/README.md`](./worker/telegram-inbox/README.md) 部署，记下：
- `WORKER_URL` = `https://telegram-inbox.<你的子域>.workers.dev`
- `WORKER_SECRET`（你设置的 /inbox 鉴权串）
- `SECRET_TOKEN`（webhook 路径串）

然后注册 webhook（命令见 worker README）。

### 3. 智谱 GLM
到 [open.bigmodel.cn](https://open.bigmodel.cn) 申请 `GLM_API_KEY`。默认模型 `glm-4.6`，可用仓库 Secret `GLM_MODEL` 覆盖（如 `glm-4-flash`）。

### 4. GitHub 仓库 Secrets
在仓库 **Settings → Secrets and variables → Actions** 添加：

| Secret | 值 |
|---|---|
| `WORKER_URL` | Worker 地址 |
| `WORKER_SECRET` | /inbox 鉴权串 |
| `TG_BOT_TOKEN` | Bot token |
| `GLM_API_KEY` | 智谱 key |
| `GLM_MODEL` | （可选）如 `glm-4.6` / `glm-4-flash`，留空用默认 |

> `SSH_HOST` / `SSH_USERNAME` / `SSH_PRIVATE_KEY` 已存在（部署用），无需新增。

## 验证

1. 给 Bot 发几条文字 + 图片。
2. 仓库 → Actions → **Auto Weekly Journal** → **Run workflow**（手动触发）。
3. 看 run 日志：读到 N 条消息、下图、GLM 调用、写文件、push、build、rsync。
4. 打开 `https://rocli.cn/weeks/<abbrlink>/` 确认上线；`/weeks/` 列表应出现新条目。

之后每周日 23:00 自动运行（GitHub cron 可能有几分钟延迟，属正常；仓库 60 天无活动会被暂停定时，活跃仓库不受影响）。

## 已知限制

- 本周一条消息都没有时不生成（避免空周记）。
- 自动生成的周记暂无 OG 图（仓库不生成 `/og/*.png`，分享时缩略图会 404；后续可接入 `astro-og-canvas`）。
- 周编号按真实周次（ISO week），如 2026-06-28 → 2026-Week26。
- 仅处理文字 + 图片；视频/语音/文件暂跳过。
