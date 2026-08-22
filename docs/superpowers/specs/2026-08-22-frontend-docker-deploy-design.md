# 前端 Docker 自动部署设计（league-akari-web）

> 日期：2026-08-22
> 状态：已批准（用户逐节确认）
> 参考文档：`D:\IDE\project\league-akari-server\DEPLOY_HANDOVER.md`（后端交接文档，含 17 条踩坑记录）

## 1. 背景与目标

后端仓库（league-akari-server）已完成「推送 GitHub → 自动部署云服务器 Docker」的 CI/CD 落地。本设计将同一套架构迁移到前端仓库（league-akari-web），并修正交接文档模板中不适配前端实际的四处问题。

**目标**：`git push main` 后自动构建前端 Docker 镜像 → 推送阿里云 ACR → SSH 部署到云服务器 `/opt/league-akari/web/`，健康检查失败自动回滚。

**非目标**：HTTPS/域名接入（后续可加宿主机 nginx 统一入口）、CI 跑测试（用户决策：跳过，只构建）。

## 2. 决策记录

| # | 决策 | 选择 | 理由 |
|---|---|---|---|
| 1 | API 连通方式 | **nginx 反代 `/api`**（容器内 nginx → 宿主机 8081） | 免 CORS；API 地址不烧进镜像，换环境无需重新构建；前端代码统一相对路径 |
| 2 | 实施方式 | **模板 + 前端修正** | 照搬后端架构保持运维心智统一，同时修正模板四处不适配点（见第 6 节） |
| 3 | CI 测试 | **跳过测试，只构建** | 与后端一致，追求 CI 最快；`vue-tsc -b` 类型检查内置于构建命令，作为隐性质量闸 |
| 4 | GitHub 现状 | 仓库已有，Variables/Secrets 未配 | 实现计划须包含手工配置 checklist（第 7 节） |

## 3. 部署架构总览

```
git push main
   │
   ▼
GitHub Actions（境外 Runner）
   ├─ job1: build-and-push
   │    ├─ 配置预检（缺 Variable/Secret 点名报错，防静默登录 docker.io）
   │    ├─ docker build（linux/amd64，容器内 npm ci + npm run build，含 vue-tsc 类型检查）
   │    └─ 推阿里云 ACR：SHA 标签 + latest 别名
   │
   └─ job2: deploy（SSH，两步走：scp 传代码 → ssh 远程执行）
        ├─ 同步代码到 /opt/league-akari/web/repo（整体替换，config/ 永不被 CI 触碰）
        ├─ docker login ACR
        └─ ./deploy.sh
             ├─ docker compose pull（按 SHA 拉镜像，不追 latest）
             ├─ up -d --force-recreate
             ├─ 健康检查 http://127.0.0.1:8082/（120s / 每 10s 一次）
             ├─ 失败 → 打 failed- 标签 + 自动回滚上一版本
             └─ 成功 → 清理旧镜像（保留当前 + 上一 + 最近 3 个 failed）

请求链路（生产）：
浏览器 → 服务器:8082 → 前端容器 nginx :80
                      ├─ /api/* → host.docker.internal:8081（后端容器，宿主机端口映射）→ 免 CORS
                      └─ 其他   → dist 静态文件（history 路由 try_files 兜底）
```

与后端差异：无数据库依赖；`.env` 基本为空（deploy.sh 依赖其存在）；健康检查为 nginx 首页 200；容器端口 80（宿主映射 8082，避开已占用的 8081）。

## 4. 前端代码改动（3 个现有文件 + 1 个新模块，TDD）

核心思路：API 地址默认改为**空字符串（相对路径）**。生产由 nginx 反代 `/api`，开发由 vite proxy 转发，环境差异全部由基础设施层消化，前端代码不再出现写死的 `http://localhost:8081`。

1. **新增 `src/api/config.ts`**——统一 API base 出口（消除 `http.ts` 与 `matches.ts` 两处重复定义）：
   ```ts
   // 默认空字符串 = 相对路径：生产由 nginx 反代 /api，开发由 vite proxy 转发
   // 保留 VITE_API_BASE_URL 作为逃生舱（如需直连其他后端环境时注入）
   export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? ''
   ```
2. **`src/api/http.ts`**：`baseURL` 改为从 `config.ts` 导入（axios 空串 baseURL 即请求当前源）；修正注释中过时的「默认 localhost:8080」描述。
3. **`src/api/matches.ts`**（第 87 行附近）：SSE 请求的 `baseURL` 改从 `config.ts` 导入，删除本地重复定义。
4. **`vite.config.ts`**：`server` 段（现有 `port: 5177`）追加：
   ```ts
   proxy: { '/api': 'http://localhost:8081' }   // 开发环境转发到本机后端
   ```

**测试**：按 TDD 先写 `src/api/__tests__/config.test.ts`（默认空串、`VITE_API_BASE_URL` 注入覆盖两个用例）再实现。已验证现有测试不依赖旧默认值，不受影响。

## 5. 新增部署文件（7 个，仓库根目录）

| 文件 | 来源 | 关键差异点 |
|---|---|---|
| `.github/workflows/deploy.yml` | 照搬交接文档 3.1 模板 | 删掉「Runner 上 npm ci + build」与 Node setup 步骤（Docker 内构建，避免重复构建约 2 分钟）；**scp 从全量同步改为精确同步 `deploy.sh,docker-compose.yml`**（模板 `source: "."` 会把前端仓库 node_modules 数百 MB 从境外 Runner 传到国内服务器，Java 仓库无此问题、前端必须改）；保留配置预检、concurrency、SHA+latest 标签、scp/ssh 两步结构 |
| `Dockerfile` | 模板微调 | 多阶段：`node:20-alpine`（`npm ci` + `npm run build`）→ `nginx:alpine`；COPY `nginx.conf` 到 `/etc/nginx/conf.d/default.conf`；HEALTHCHECK 用 wget `/` |
| `nginx.conf` | 新写 | 见第 6 节 |
| `docker-compose.yml` | 模板微调 | `league-akari-web`、端口 `8082:80`、`extra_hosts: host.docker.internal:host-gateway`（反代必需）、`${IMAGE_REPOSITORY:?}`/`${IMAGE_TAG:?}` 必填校验、`TZ: Asia/Shanghai`；变量注入沿用后端模式（deploy.sh `--env-file` 传入服务器 `config/.env`，compose 不写 `env_file` 指令） |
| `deploy.sh` | 复制后端仓库同名文件 | 改 2 个常量：`DEPLOY_ROOT=/opt/league-akari/web`、`HEALTH_URL=http://127.0.0.1:8082/`；**另需替换 4 处硬编码 compose 服务名 `league-akari-server` → `league-akari-web`**（`compose pull`/`up`/`logs`/回滚 `up`，交接文档未提及）；回滚日志文案去掉数据库表述；版本记录/回滚/failed 标签/镜像清理逻辑原样保留 |
| `.dockerignore` | 新写 | 排除 `node_modules`、`dist`、`.git`、`*.log`、`docs`、`.worktrees` 等，避免巨上下文拖慢构建 |
| `.env.example` | 模板 | 基本为空 + 注释（前端无敏感运行时配置；API 地址由 nginx 反代解决，无需构建时注入） |

## 6. nginx.conf 设计（含三处模板修正）

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  # Vite 产物文件名带 contenthash，可安全长缓存
  location /assets/ {
    expires 30d;
    add_header Cache-Control "public, immutable";
  }

  # API 反代到宿主机上后端容器（8081）
  location /api/ {
    # 修正①：不带尾部斜杠——后端 controller 自带 /api 前缀（@RequestMapping("/api/matches")），必须原样转发
    proxy_pass http://host.docker.internal:8081;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    # 修正②：SSE 流式必需——禁用缓冲，否则 AI 分析前端收不到实时数据
    proxy_buffering off;
    proxy_cache off;
    # AI 分析可能持续数分钟，读超时须大于后端最长处理时间（默认 60s 会掐断流）
    proxy_read_timeout 300s;
  }

  # 修正③：history 路由兜底（本项目用 createWebHistory，非可选）
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

| # | 交接文档模板问题 | 本设计的修正 |
|---|---|---|
| ① | 第 7 章示例 `proxy_pass ...:8081/;` 带尾斜杠，会把 `/api/matches` 剥成 `/matches` → 404 | 去掉尾斜杠，原样转发（已核实后端 `MatchController` 为 `@RequestMapping("/api/matches")`） |
| ② | 未覆盖 SSE；nginx 默认 `proxy_buffering on` 会缓冲流式响应 | `proxy_buffering off` + `proxy_read_timeout 300s` |
| ③ | history 兜底在 Dockerfile 模板中是注释掉的可选项 | 必配 `try_files ... /index.html`（前端路由为 `createWebHistory()`） |
| ④ | workflow 模板 `scp source: "."` 全量同步（Java 仓库无副作用，前端仓库会把 node_modules 数百 MB 传到国内服务器） | scp 精确同步 `deploy.sh,docker-compose.yml`（部署仅需这 2 个文件，KB 级秒传；nginx.conf/Dockerfile 只在 GitHub Runner 构建镜像时使用，无需上服务器） |

## 7. 一次性手工步骤 checklist（不进仓库）

1. **阿里云 ACR 控制台**：`ikunlol` 命名空间下新建镜像仓库 `league-akari-web`（个人版实例域名格式 `crpi-<ID>.<地域>.personal.cr.aliyuncs.com`，从控制台复制）。
2. **GitHub 仓库 Settings → Secrets and variables → Actions**：
   - Variables：`ALIYUN_REGISTRY`、`ALIYUN_NAMESPACE`、`IMAGE_NAME=league-akari-web`（值抄后端仓库，IMAGE_NAME 除外）
   - Secrets：`ALIYUN_USERNAME`、`ALIYUN_PASSWORD`（值抄后端仓库）；`SERVER_HOST`、`SERVER_PORT`、`SERVER_USER`、`SERVER_SSH_KEY`（值抄后端仓库——部署密钥对复用同一对，公钥已在服务器 authorized_keys）
3. **服务器一次性初始化**（root 执行）：
   ```bash
   mkdir -p /opt/league-akari/web/repo /opt/league-akari/web/config
   chown -R ubuntu:ubuntu /opt/league-akari/web          # 必须 -R 递归（坑 #16）
   sudo -u ubuntu touch /opt/league-akari/web/config/.env # 空文件即可，deploy.sh 依赖其存在
   sudo -u ubuntu chmod 600 /opt/league-akari/web/config/.env
   ```
4. **部署后验证**：`docker ps --filter name=league-akari-web`（healthy）、`curl -f http://127.0.0.1:8082/`、`cat /opt/league-akari/web/config/current-image`、浏览器访问 `http://<服务器IP>:8082/` 并确认对局数据加载（反代链路通）；二次推送验证幂等。

## 8. 错误处理与回滚

- **自动回滚**：deploy.sh 健康检查失败 → 给当前镜像打 `failed-` 标签 → 拉起 `previous-image` 版本；成功则更新版本记录并清理镜像（保留当前 + 上一 + 最近 3 个 failed，`latest` 显式保留）。
- **CI 防呆**（踩坑对策全部内置）：配置预检步骤（坑 #3）、`scp` 后 `chmod +x deploy.sh`（坑 #11）、compose `${VAR:?}`/`${VAR:-}` 插值语法（坑 #14）、`chown -R` 递归授权（坑 #15）、ssh script 不引用 Runner 环境变量（坑 #9）。
- **已知风险**：服务器 2 核 2G 只承担运行（构建在 GitHub Runner）；GitHub Actions 偶发卡住时重跑即可（坑 #17）。

## 9. 测试策略

- **CI**：不跑 vitest（决策 #3）；`npm run build` 内含 `vue-tsc -b` 类型检查，类型错误阻断部署。
- **代码改动**：`config.ts` 按 TDD 先写 `src/api/__tests__/config.test.ts`（与被测文件路径一致），红→绿后动 `http.ts`/`matches.ts`。
- **部署验收**：第 7 节第 4 条验证清单 + 手动触发 `workflow_dispatch` 验证幂等。

## 10. 验收标准

1. `git push main` 后 GitHub Actions 全绿，服务器容器 healthy，`curl :8082` 返回前端页面。
2. 页面对局数据正常加载（nginx `/api` 反代链路通，无 CORS 报错）。
3. AI 对局分析流式输出实时到达前端（SSE 未被缓冲、未被超时掐断）。
4. 刷新任意子路径路由不 404（history 兜底生效）。
5. `/opt/league-akari/web/config/current-image` 记录部署版本；人为制造健康检查失败可自动回滚到上一版本。
