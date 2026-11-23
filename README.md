# MOODMON 情绪调研网站

MOODMON 情绪潮玩 IP 设计的前期调研网站：在线问卷 + 数据看板。

- 前端：原生 HTML / CSS / JS（`public/`）
- 后端：Cloudflare Pages Functions（`functions/api/[[path]].js`）
- 数据库：Cloudflare D1（`schema.sql`）
- GitHub Pages：项目介绍页（`docs/`），指向 Cloudflare Pages 上的完整应用

## 本地开发

需要 Node.js 18+：

```bash
npm install -g wrangler
wrangler login
wrangler pages dev public
```

本地开发时如需 D1，可创建本地 D1 并执行 `schema.sql`，或在 Pages 项目设置里绑定。

## 部署到 Cloudflare Pages（完整问卷）

1. 登录 Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**；
2. 授权 GitHub，选择本仓库；
3. 构建设置：
   - Framework preset：`None`
   - Build command：留空（或 `exit 0`）
   - Build output directory：`public`
4. 创建 D1 数据库：

   ```bash
   npx wrangler d1 create moodmon-survey
   npx wrangler d1 execute moodmon-survey --remote --file=./schema.sql
   ```

5. 在 Pages 项目 **Settings → Functions → D1 database bindings** 添加：
   - Variable name：`DB`
   - D1 database：`moodmon-survey`
6. 在 **Settings → Environment variables** 添加（Production 和 Preview）：
   - `ADMIN_PASSWORD`：后台密码（请改成自己的强密码）
   - `SESSION_SECRET`：一串随机长字符串（用于登录 Cookie 签名）
7. 重新部署（Deployments → Retry deployment），访问 `https://<project>.pages.dev`；
   后台：`https://<project>.pages.dev/admin`。

## 部署 GitHub Pages（项目介绍页）

推送后 GitHub Actions 会自动部署 `docs/` 到 GitHub Pages：

- 仓库 **Settings → Pages** → Build and deployment → Source 选 **GitHub Actions**；
- 首次部署完成后地址为 `https://<用户名>.github.io/<仓库名>/`。

## 免费额度（参考）

- Cloudflare Pages：每月 500 次构建，静态请求不限量；
- Cloudflare D1：5 GB 存储、每天 500 万行读取、10 万行写入；
- GitHub Pages：公开仓库 1 GB 仓库、每月 100 GB 带宽（软限制）。

对一份 60—100 份的毕业设计问卷完全够用。

## 安全

- 不要把 `ADMIN_PASSWORD` / `SESSION_SECRET` 写进仓库；
- 后台密码上线后请在 Cloudflare Pages 环境变量中修改；
- 问卷数据仅保存在你的 D1 数据库中，不经过第三方存储。
