# 前端 Docker 自动部署实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** `git push main` 后自动构建前端 Docker 镜像（阿里云 ACR，SHA 标签）并 SSH 部署到云服务器 `/opt/league-akari/web/`（8082 端口），健康检查失败自动回滚。

**架构：** 照搬后端已验证的 SSH 部署架构（GitHub Actions 境外 Runner 构建 amd64 镜像 → 推阿里云 ACR → scp 精确同步部署文件 → ssh 远程执行 deploy.sh，健康检查失败打 failed- 标签并自动回滚）。前端代码 API base 改为相对路径：生产由容器内 nginx 反代 `/api` 到宿主机 8081（免 CORS、SSE 不缓冲、history 路由兜底），开发由 vite proxy 转发。

**技术栈：** Vue 3 + Vite 6 + TypeScript + vitest；Docker 多阶段构建（node:20-alpine 构建 + nginx:alpine 运行）；GitHub Actions（appleboy/scp-action + ssh-action）；阿里云个人版 ACR。

**规格：** `docs/superpowers/specs/2026-08-22-frontend-docker-deploy-design.md`（含 4 处交接文档模板修正的依据）

**参考原件：** `D:\IDE\project\league-akari-server\` 下的 `deploy.sh`、`docker-compose.yml`、`.github/workflows/deploy.yml`（本计划已内嵌前端版完整内容，无需再读原件）

---

### 任务 1：API base 统一模块 `src/api/config.ts`（TDD）

**文件：**
- 创建：`src/api/config.ts`
- 创建（测试）：`src/api/__tests__/config.test.ts`
- 修改：`src/env.d.ts`（补 `ImportMetaEnv` 类型声明）

**背景：** 当前 `http.ts:13` 与 `matches.ts:87` 两处重复定义 `import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8081'`。改为默认空字符串（相对路径）：生产走 nginx 反代，开发走 vite proxy，`VITE_API_BASE_URL` 保留为逃生舱。

- [ ] **步骤 1：编写失败的测试**

创建 `src/api/__tests__/config.test.ts`（与被测文件路径一致，仓库测试约定为 `src/**/*.test.ts`）：

```ts
// API base 配置单测：验证默认相对路径与逃生舱覆盖两种行为
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('API_BASE_URL', () => {
  beforeEach(() => {
    // 每个用例前清掉环境 stub 并重置模块缓存，保证 import 时重新求值默认值
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('默认为空字符串（相对路径：生产走 nginx 反代，开发走 vite proxy）', async () => {
    const { API_BASE_URL } = await import('@/api/config')
    expect(API_BASE_URL).toBe('')
  })

  it('注入 VITE_API_BASE_URL 时覆盖默认值（逃生舱：直连其他后端环境）', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://192.168.31.90:8081')
    const { API_BASE_URL } = await import('@/api/config')
    expect(API_BASE_URL).toBe('http://192.168.31.90:8081')
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run src/api/__tests__/config.test.ts`
预期：FAIL，报错模块 `@/api/config` 不存在（Cannot find module）

- [ ] **步骤 3：编写最少实现代码**

创建 `src/api/config.ts`：

```ts
/**
 * API 基础地址统一出口：http.ts 与 matches.ts 共用，消除两处重复定义
 * - 默认空字符串 = 相对路径：生产由容器内 nginx 反代 /api 到宿主机 8081，开发由 vite proxy 转发
 * - 保留 VITE_API_BASE_URL 作为逃生舱：需要直连其他后端环境时注入
 */
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? ''
```

- [ ] **步骤 4：补全环境变量类型声明**

`src/env.d.ts` 末尾追加（让 `vue-tsc` 能对 `VITE_API_BASE_URL` 做类型检查）：

```ts
// 声明本项目自定义的环境变量类型（Vite 约定的接口增强）
interface ImportMetaEnv {
  /** API 基础地址逃生舱：不配置时为相对路径（生产 nginx 反代 / 开发 vite proxy） */
  readonly VITE_API_BASE_URL?: string
}
```

- [ ] **步骤 5：运行测试验证通过**

运行：`npx vitest run src/api/__tests__/config.test.ts`
预期：PASS（2 个用例全绿）

- [ ] **步骤 6：Commit**

```bash
git add src/api/config.ts src/api/__tests__/config.test.ts src/env.d.ts
git commit -m "feat: 新增 API base 统一配置模块（默认相对路径）"
```

---

### 任务 2：`http.ts` / `matches.ts` 接入统一模块 + vite 开发代理

**文件：**
- 修改：`src/api/http.ts:12-13`
- 修改：`src/api/matches.ts:87-88`
- 修改：`vite.config.ts:17-20`（server 段）

- [ ] **步骤 1：修改 `http.ts`**

将第 6-16 行区域改为（新增 config 导入、替换本地 baseURL 定义、修正过时注释）：

```ts
import { API_BASE_URL } from '@/api/config'
import { createLogger } from '@/utils/logger'
import axios from 'axios'

// 创建带 'HTTP' 标签的日志器，方便按来源过滤控制台日志
const logger = createLogger('HTTP')

// 创建 axios 实例：baseURL 默认空串（相对路径，由部署层转发），10 秒超时防止请求长时间挂起
const http = axios.create({ baseURL: API_BASE_URL, timeout: 10000 })
```

（即删除原第 12-13 行的本地定义与注释，`axios.create` 一行改为使用 `API_BASE_URL`。）

- [ ] **步骤 2：修改 `matches.ts` 的 SSE 地址构造**

将 `analyzeMatch` 内（第 87-88 行附近）：

```ts
  const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8081'
  const url = `${baseURL}/api/matches/${gameId}/ai-analysis`
```

改为：

```ts
  // 统一从 config 模块取基础地址（默认相对路径，走 nginx 反代/vite proxy）
  const url = `${API_BASE_URL}/api/matches/${gameId}/ai-analysis`
```

并在文件顶部 import 区新增：`import { API_BASE_URL } from '@/api/config'`

- [ ] **步骤 3：`vite.config.ts` 增加开发代理**

将 `server` 段改为：

```ts
  server: {
    // 开发服务器端口：固定 5177，便于本地调试
    port: 5177,
    // 开发环境 API 代理：前端代码用相对路径 /api，开发时转发到本机后端 8081
    // （与生产环境容器内 nginx 反代行为对齐，代码无需区分环境）
    proxy: {
      '/api': 'http://localhost:8081'
    }
  }
```

- [ ] **步骤 4：跑全量测试确认无回归**

运行：`npm test`
预期：全部 PASS（已验证现有测试不依赖旧默认值 `http://localhost:8081`；若个别用例因 mock 路径断言失败，按其断言方式把期望路径改为 `/api/...` 形式修正测试）

- [ ] **步骤 5：类型检查**

运行：`npm run typecheck`
预期：无错误

- [ ] **步骤 6：（可选，若本机后端在跑）手动验证开发链路**

运行：`npm run dev` → 浏览器打开 `http://localhost:5177`，DevTools Network 确认 `/api` 请求经 5177 转发到 8081 且返回数据。

- [ ] **步骤 7：Commit**

```bash
git add src/api/http.ts src/api/matches.ts vite.config.ts
git commit -m "refactor: API 地址统一走 config 模块并改为相对路径"
```

---

### 任务 3：`Dockerfile` + `nginx.conf` + `.dockerignore`（本地构建验证）

**文件：**
- 创建：`Dockerfile`
- 创建：`nginx.conf`
- 创建：`.dockerignore`

**前置：** 需要本机 Docker Desktop；若不可用，跳过步骤 4-5 的本地验证，依靠任务 7 首次 CI 构建兜底（vue-tsc 类型检查内含于构建）。

- [ ] **步骤 1：创建 `nginx.conf`**

```nginx
# 前端生产 nginx 配置：静态托管 + /api 反代 + history 路由兜底
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  # Vite 产物文件名带 contenthash，内容变化即换名，可安全长缓存
  location /assets/ {
    expires 30d;
    add_header Cache-Control "public, immutable";
  }

  # API 反代到宿主机上后端容器映射的 8081 端口（免 CORS）
  location /api/ {
    # 注意：proxy_pass 不带尾部斜杠——后端 controller 自带 /api 前缀
    # （@RequestMapping("/api/matches")），必须原样转发；带斜杠会剥掉前缀导致 404
    proxy_pass http://host.docker.internal:8081;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    # SSE 流式必需：禁用缓冲，否则 AI 对局分析前端收不到实时数据
    proxy_buffering off;
    proxy_cache off;
    # AI 分析可能持续数分钟，读超时须大于后端最长处理时间（默认 60s 会掐断流）
    proxy_read_timeout 300s;
  }

  # history 路由兜底：刷新/直达子路径时返回 index.html，交给 vue-router 解析
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

- [ ] **步骤 2：创建 `Dockerfile`**

```dockerfile
# 构建阶段：Node 编译 TypeScript 并打包静态产物
# npm run build = vue-tsc -b && vite build，类型错误会导致构建失败（隐性质量闸）
FROM node:20-alpine AS builder
WORKDIR /app
# 先复制依赖清单再安装：利用 Docker 层缓存，代码变更时不重装 node_modules
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# 运行阶段：nginx 托管静态文件并反代后端 API（alpine 自带 wget 做健康检查）
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# 覆盖默认站点配置：history 兜底 + /api 反代 + SSE 不缓冲
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=5s --retries=3 --start-period=10s \
  CMD wget -q --spider http://127.0.0.1/ || exit 1
```

- [ ] **步骤 3：创建 `.dockerignore`**

```
# 依赖与本地构建产物（镜像内在容器内重新构建，无需进入构建上下文）
node_modules
dist
# 版本控制与本地状态
.git
.worktrees
# 文档与临时文件
docs
*.log
*.md
# 环境文件（生产配置在服务器 config/ 目录，永不进镜像）
.env*
```

- [ ] **步骤 4：本地构建镜像验证**

运行：`docker build -t league-akari-web:local .`
预期：构建成功。重点确认：`npm ci` 无错、`npm run build` 通过（vue-tsc 类型检查通过）、nginx 阶段完成。

- [ ] **步骤 5：本地跑容器验证 nginx 行为**

```bash
docker run -d --name web-local -p 18080:80 \
  --add-host=host.docker.internal:host-gateway league-akari-web:local
curl -fsS http://127.0.0.1:18080/ | head -5          # 预期：返回 index.html
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/some/route  # 预期：200（history 兜底）
docker rm -f web-local
```

（可选加强：若本机后端 8081 在跑，`curl http://127.0.0.1:18080/api/...` 真实接口验证反代；否则反代链路留待任务 7 服务器端到端验证。）

- [ ] **步骤 6：Commit**

```bash
git add Dockerfile nginx.conf .dockerignore
git commit -m "feat: 前端 Docker 镜像构建配置（nginx 反代 + SSE + history 兜底）"
```

---

### 任务 4：`docker-compose.yml` + `.env.example` + `deploy.sh`

**文件：**
- 创建：`docker-compose.yml`
- 创建：`.env.example`
- 创建：`deploy.sh`

**背景：** `deploy.sh` 基于后端版本 `D:\IDE\project\league-akari-server\deploy.sh`，共 7 处适配：2 个常量（`DEPLOY_ROOT`、`HEALTH_URL`）、4 处 compose 服务名（`league-akari-server` → `league-akari-web`）、1 处回滚日志文案（前端无数据库迁移）。**其余逻辑（版本记录、回滚、failed 标签、镜像清理）与后端逐行一致，不得改动。**

- [ ] **步骤 1：创建 `docker-compose.yml`**

```yaml
services:
  league-akari-web:
    # 镜像地址与版本由 deploy.sh 通过 --env-file + 环境变量注入，缺失即报错
    image: ${IMAGE_REPOSITORY:?IMAGE_REPOSITORY is required}:${IMAGE_TAG:?IMAGE_TAG is required}
    container_name: league-akari-web
    restart: unless-stopped
    ports:
      - "8082:80" # 8081 已被后端占用，前端用 8082
    environment:
      TZ: Asia/Shanghai
    extra_hosts:
      # nginx 反代通过宿主机映射端口访问后端容器（与后端访问 lol-mysql 同机制）
      - "host.docker.internal:host-gateway"
```

- [ ] **步骤 2：创建 `.env.example`**

```dotenv
# 前端生产配置示例：当前无敏感运行时配置，服务器上保持空文件即可。
# 注意：API 地址不需要在此配置——生产由容器内 nginx 反代 /api 到宿主机 8081，
# 镜像构建时不注入任何 VITE_* 变量。此文件的存在是 deploy.sh 的前置要求。
```

- [ ] **步骤 3：创建 `deploy.sh`**（完整内容如下，改动处已用 `# ← 前端适配` 标注）

```bash
#!/usr/bin/env bash
set -Eeuo pipefail

# 固定部署目录：仓库可被同步覆盖，生产配置与版本状态始终在目录外。
DEPLOY_ROOT="/opt/league-akari/web" # ← 前端适配：独立于后端目录
REPO_DIR="${DEPLOY_ROOT}/repo"
CONFIG_DIR="${DEPLOY_ROOT}/config"
ENV_FILE="${CONFIG_DIR}/.env"
COMPOSE_FILE="${REPO_DIR}/docker-compose.yml"
CURRENT_FILE="${CONFIG_DIR}/current-image"
PREVIOUS_FILE="${CONFIG_DIR}/previous-image"
FAILED_PREFIX="failed-$(date +%Y%m%d%H%M%S)-"
HEALTH_URL="http://127.0.0.1:8082/" # ← 前端适配：nginx 首页即健康检查
HEALTH_TIMEOUT_SECONDS=120
HEALTH_INTERVAL_SECONDS=10

log() {
  printf '[deploy] %s\n' "$*"
}

fail() {
  log "ERROR: $*"
  exit 1
}

[[ -f "${ENV_FILE}" ]] || fail "缺少生产配置：${ENV_FILE}"
[[ -f "${COMPOSE_FILE}" ]] || fail "缺少 Compose 文件：${COMPOSE_FILE}"

# 当前镜像由 workflow 传入，避免部署脚本自行猜测版本。
: "${IMAGE_REPOSITORY:?IMAGE_REPOSITORY is required}"
: "${IMAGE_TAG:?IMAGE_TAG is required}"
export IMAGE_REPOSITORY IMAGE_TAG

compose() {
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" "$@"
}

previous_image=''
if [[ -s "${CURRENT_FILE}" ]]; then
  previous_image="$(tr -d '\r\n' < "${CURRENT_FILE}")"
fi

log "拉取镜像 ${IMAGE_REPOSITORY}:${IMAGE_TAG}"
compose pull league-akari-web # ← 前端适配：compose 服务名

# 保存当前版本，首次部署没有回滚目标时保留空值。
if [[ -n "${previous_image}" ]]; then
  printf '%s\n' "${previous_image}" > "${PREVIOUS_FILE}"
  log "记录可回滚版本：${previous_image}"
else
  rm -f "${PREVIOUS_FILE}"
  log "首次部署，没有可回滚版本"
fi

printf '%s:%s\n' "${IMAGE_REPOSITORY}" "${IMAGE_TAG}" > "${CURRENT_FILE}.pending"
compose up -d --no-build --force-recreate league-akari-web # ← 前端适配：compose 服务名

is_healthy() {
  curl --fail --silent --show-error "${HEALTH_URL}" >/dev/null 2>&1
}

cleanup_images() {
  # 仅清理未被容器使用的旧 SHA 镜像，保留当前、上一个和最近三个失败标签。
  local current previous latest failed_image_count
  current="$(cat "${CURRENT_FILE}")"
  previous=''
  latest="${IMAGE_REPOSITORY}:latest"
  [[ -f "${PREVIOUS_FILE}" ]] && previous="$(cat "${PREVIOUS_FILE}")"
  failed_image_count=0
  while IFS= read -r image; do
    [[ "${image}" == "${current}" || "${image}" == "${previous}" || "${image}" == "${latest}" ]] && continue
    if [[ "${image}" == *":failed-"* ]]; then
      failed_image_count=$((failed_image_count + 1))
      if (( failed_image_count <= 3 )); then
        continue
      fi
    fi
    docker image rm "${image}" || true
  done < <(docker image ls --format '{{.Repository}}:{{.Tag}}' "${IMAGE_REPOSITORY}")
}

log "等待健康检查，最多 ${HEALTH_TIMEOUT_SECONDS} 秒"
for ((elapsed=0; elapsed<HEALTH_TIMEOUT_SECONDS; elapsed+=HEALTH_INTERVAL_SECONDS)); do
  if is_healthy; then
    mv "${CURRENT_FILE}.pending" "${CURRENT_FILE}"
    log "部署成功：${IMAGE_REPOSITORY}:${IMAGE_TAG}"
    cleanup_images
    exit 0
  fi
  sleep "${HEALTH_INTERVAL_SECONDS}"
done

log "健康检查失败，输出应用状态和日志"
compose ps
compose logs --tail=200 league-akari-web || true # ← 前端适配：compose 服务名

failed_image="${IMAGE_REPOSITORY}:${FAILED_PREFIX}${IMAGE_TAG}"
docker image tag "${IMAGE_REPOSITORY}:${IMAGE_TAG}" "${failed_image}" || true
rm -f "${CURRENT_FILE}.pending"

if [[ -n "${previous_image}" ]]; then
  log "回滚到 ${previous_image}"
  export IMAGE_REPOSITORY="${previous_image%:*}"
  export IMAGE_TAG="${previous_image##*:}"
  compose up -d --no-build --force-recreate league-akari-web # ← 前端适配：compose 服务名
  if is_healthy; then
    printf '%s\n' "${previous_image}" > "${CURRENT_FILE}"
    log "回滚成功，前端已恢复上一版本" # ← 前端适配：无数据库迁移表述
  else
    log "ERROR: 回滚后健康检查仍失败，请人工处理"
  fi
else
  log "首次部署失败，不执行回滚；失败镜像已标记为 ${failed_image}"
fi

exit 1
```

- [ ] **步骤 4：deploy.sh 语法检查**

运行：`bash -n deploy.sh`
预期：无输出（语法合法）。注意：Windows 下文件为 LF 行尾，若报 `\r` 相关错误需转 LF。

- [ ] **步骤 5：compose 配置校验（需本机 Docker）**

```bash
IMAGE_REPOSITORY=crpi-example.cn-beijing.personal.cr.aliyuncs.com/ikunlol/league-akari-web \
IMAGE_TAG=test docker compose --env-file .env.example config --quiet
```
预期：退出码 0（必填变量校验与插值合法）。

- [ ] **步骤 6：Commit**

```bash
git add docker-compose.yml .env.example deploy.sh
git commit -m "feat: 前端 compose 与自动回滚部署脚本"
```

---

### 任务 5：GitHub Actions workflow

**文件：**
- 创建：`.github/workflows/deploy.yml`

**背景：** 基于后端 workflow 改造：删除 Java 构建步骤（Docker 内构建）、scp 改精确同步（**关键修正：模板 `source: "."` 会把前端仓库 node_modules 数百 MB 传到国内服务器；部署仅需 `deploy.sh` + `docker-compose.yml` 两个文件，nginx.conf/Dockerfile 只在 Runner 构建镜像时使用**）、目录改为 `/opt/league-akari/web`。

- [ ] **步骤 1：创建 `.github/workflows/deploy.yml`**

```yaml
name: build-and-deploy

on:
  push:
    branches:
      - main
  workflow_dispatch:

# 同一时间只保留最新一次部署，旧任务自动取消
concurrency:
  group: league-akari-web-production
  cancel-in-progress: true

env:
  IMAGE_REPOSITORY: ${{ vars.ALIYUN_REGISTRY }}/${{ vars.ALIYUN_NAMESPACE }}/${{ vars.IMAGE_NAME }}

jobs:
  build-and-push:
    name: 构建并推送 amd64 镜像
    runs-on: ubuntu-latest
    permissions:
      contents: read
    outputs:
      image_tag: ${{ steps.version.outputs.image_tag }}
    steps:
      - name: 检出代码
        uses: actions/checkout@v4

      # 配置预检：任何 Variables/Secrets 缺失时立刻报错，
      # 避免 docker/login-action 静默回退登录 docker.io 导致 401
      - name: 检查 GitHub Actions 配置
        env:
          ALIYUN_REGISTRY: ${{ vars.ALIYUN_REGISTRY }}
          ALIYUN_NAMESPACE: ${{ vars.ALIYUN_NAMESPACE }}
          IMAGE_NAME: ${{ vars.IMAGE_NAME }}
          ALIYUN_USERNAME: ${{ secrets.ALIYUN_USERNAME }}
          ALIYUN_PASSWORD: ${{ secrets.ALIYUN_PASSWORD }}
        run: |
          set -Eeuo pipefail
          test -n "${ALIYUN_REGISTRY}" || { echo "❌ 缺少 Variable: ALIYUN_REGISTRY（阿里云镜像仓库域名）"; exit 1; }
          test -n "${ALIYUN_NAMESPACE}" || { echo "❌ 缺少 Variable: ALIYUN_NAMESPACE（阿里云命名空间）"; exit 1; }
          test -n "${IMAGE_NAME}" || { echo "❌ 缺少 Variable: IMAGE_NAME（镜像仓库名）"; exit 1; }
          test -n "${ALIYUN_USERNAME}" || { echo "❌ 缺少 Secret: ALIYUN_USERNAME"; exit 1; }
          test -n "${ALIYUN_PASSWORD}" || { echo "❌ 缺少 Secret: ALIYUN_PASSWORD"; exit 1; }
          echo "✓ 配置完整，镜像地址：${ALIYUN_REGISTRY}/${ALIYUN_NAMESPACE}/${IMAGE_NAME}"

      # 前端无需在 Runner 上构建：Docker 多阶段构建内完成 npm ci + npm run build
      # （vue-tsc 类型检查内含，类型错误会阻断镜像构建）

      - name: 计算镜像版本
        id: version
        shell: bash
        run: echo "image_tag=${GITHUB_SHA}" >> "${GITHUB_OUTPUT}"

      - name: 登录阿里云容器镜像仓库
        uses: docker/login-action@v3
        with:
          registry: ${{ vars.ALIYUN_REGISTRY }}
          username: ${{ secrets.ALIYUN_USERNAME }}
          password: ${{ secrets.ALIYUN_PASSWORD }}

      - name: 构建并推送镜像
        uses: docker/build-push-action@v6
        with:
          context: .
          file: ./Dockerfile
          platforms: linux/amd64
          push: true
          tags: |
            ${{ env.IMAGE_REPOSITORY }}:${{ steps.version.outputs.image_tag }}
            ${{ env.IMAGE_REPOSITORY }}:latest

  deploy:
    name: 通过 SSH 部署到云服务器
    needs: build-and-push
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - name: 检出本次提交
        uses: actions/checkout@v4

      # 精确同步：只传部署所需两个文件（deploy.sh + docker-compose.yml）。
      # 不用 source: "."——那会把 node_modules 数百 MB 传到国内服务器（后端 Java 仓库无此问题）
      - name: 上传部署文件到云服务器
        uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.SERVER_HOST }}
          port: ${{ secrets.SERVER_PORT }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          source: "deploy.sh,docker-compose.yml"
          target: "/tmp/league-akari-web-deploy"

      # 注意：envs 参数声明要传给远程脚本的环境变量；
      # script 在远程服务器执行，不能引用 GITHUB_WORKSPACE 等 Runner 变量
      - name: 在云服务器执行部署
        uses: appleboy/ssh-action@v1
        env:
          IMAGE_REPOSITORY: ${{ env.IMAGE_REPOSITORY }}
          IMAGE_TAG: ${{ needs.build-and-push.outputs.image_tag }}
          ALIYUN_REGISTRY: ${{ vars.ALIYUN_REGISTRY }}
          ALIYUN_USERNAME: ${{ secrets.ALIYUN_USERNAME }}
          ALIYUN_PASSWORD: ${{ secrets.ALIYUN_PASSWORD }}
        with:
          host: ${{ secrets.SERVER_HOST }}
          port: ${{ secrets.SERVER_PORT }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          envs: IMAGE_REPOSITORY,IMAGE_TAG,ALIYUN_REGISTRY,ALIYUN_USERNAME,ALIYUN_PASSWORD
          script: |
            set -Eeuo pipefail
            sudo mkdir -p /opt/league-akari/web/repo /opt/league-akari/web/config
            # 必须递归 chown，否则 config 子目录属主仍是 root
            sudo chown -R "$USER":"$USER" /opt/league-akari/web
            test -f /opt/league-akari/web/config/.env || { echo "❌ 缺少 /opt/league-akari/web/config/.env，请先创建"; exit 1; }
            rm -rf /opt/league-akari/web/repo
            mkdir -p /opt/league-akari/web/repo
            cp -a /tmp/league-akari-web-deploy/. /opt/league-akari/web/repo/
            rm -rf /tmp/league-akari-web-deploy
            docker login "${ALIYUN_REGISTRY}" -u "${ALIYUN_USERNAME}" -p "${ALIYUN_PASSWORD}"
            cd /opt/league-akari/web/repo
            # scp 不保留可执行权限，必须先 chmod
            chmod +x deploy.sh
            ./deploy.sh
```

- [ ] **步骤 2：YAML 语法校验**

运行：`npx --yes yaml-lint .github/workflows/deploy.yml`
预期：Valid YAML（一次性执行校验，不把 yaml-lint 写进 package.json）

- [ ] **步骤 3：对照审查 checklist**

逐项确认（坑 #3/#9/#10/#11 的对策）：
- [ ] 配置预检步骤存在且 5 个变量逐一 `test -n`
- [ ] `concurrency.group` 为 `league-akari-web-production`（不与后端冲突）
- [ ] 镜像标签为 SHA + latest 两个
- [ ] scp `source` 为 `"deploy.sh,docker-compose.yml"`（不是 `"."`）
- [ ] ssh script 内无 `GITHUB_*` / `env.IMAGE_REPOSITORY` 引用（变量全部经 `envs:` 透传）
- [ ] 无 `script_stop` 参数（v1 已移除）
- [ ] 远程执行前有 `chmod +x deploy.sh`

- [ ] **步骤 4：Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "feat: GitHub Actions 自动构建部署流水线（scp 精确同步 + SSH 部署）"
```

---

### 任务 6：部署运维手册 `DEPLOY.md`

**文件：**
- 创建：`DEPLOY.md`（仓库根目录，与后端 `DEPLOY_HANDOVER.md` 同级习惯）

- [ ] **步骤 1：创建 `DEPLOY.md`**

````markdown
# 前端部署运维手册（league-akari-web）

> 架构与踩坑细节见后端交接文档 `league-akari-server/DEPLOY_HANDOVER.md`；本手册只记前端特有的操作。

## 部署架构速览

`git push main` → GitHub Actions 构建 amd64 镜像（node:20-alpine 构建 + nginx:alpine 运行）
→ 推阿里云 ACR（SHA + latest）→ scp 精确同步 `deploy.sh` + `docker-compose.yml` 到服务器
→ SSH 执行 `./deploy.sh`：拉镜像 → 重建容器 → 健康检查 `http://127.0.0.1:8082/` → 失败自动回滚。

请求链路：浏览器 `:8082` → 容器内 nginx → `/api/*` 反代 `host.docker.internal:8081`（后端），其余走 dist 静态文件（history 路由兜底）。

## 一次性配置清单（已完成则跳过）

1. **阿里云 ACR**：`ikunlol` 命名空间建镜像仓库 `league-akari-web`（个人版域名 `crpi-*.personal.cr.aliyuncs.com`，控制台复制）
2. **GitHub Variables**：`ALIYUN_REGISTRY`、`ALIYUN_NAMESPACE`、`IMAGE_NAME=league-akari-web`（前两个值同后端仓库）
3. **GitHub Secrets**：`ALIYUN_USERNAME`、`ALIYUN_PASSWORD`（同后端仓库）；`SERVER_HOST`、`SERVER_PORT`、`SERVER_USER`、`SERVER_SSH_KEY`（同后端仓库，部署密钥对复用）
4. **服务器**（root，一次性）：
   ```bash
   mkdir -p /opt/league-akari/web/repo /opt/league-akari/web/config
   chown -R ubuntu:ubuntu /opt/league-akari/web           # 必须 -R
   sudo -u ubuntu touch /opt/league-akari/web/config/.env  # 空文件即可
   sudo -u ubuntu chmod 600 /opt/league-akari/web/config/.env
   ```

## 部署后验证清单

```bash
docker ps --filter name=league-akari-web            # STATUS 应为 healthy
curl -f http://127.0.0.1:8082/                       # 返回前端页面
cat /opt/league-akari/web/config/current-image       # 记录本次部署版本
docker logs --tail=50 league-akari-web               # 无异常日志
```

浏览器访问 `http://<服务器IP>:8082/`：对局数据正常加载（反代通）、AI 分析流式实时输出（SSE 未被缓冲）、刷新子路径不 404（history 兜底）。

## 常用运维命令

```bash
# 查看当前运行版本
cat /opt/league-akari/web/config/current-image

# 手动回滚到上一版本
cd /opt/league-akari/web/repo
export IMAGE_REPOSITORY=<完整镜像地址> IMAGE_TAG=$(cat /opt/league-akari/web/config/previous-image | cut -d: -f2)
./deploy.sh

# 查看镜像清单（含 failed- 标记）/ 清理悬空镜像
docker images | grep league-akari-web
docker image prune -f
```

## 已规避的坑（详见后端交接文档第 6 章）

- nginx `proxy_pass` 不带尾斜杠（后端路径自带 `/api` 前缀，带斜杠 404）
- `proxy_buffering off` + `proxy_read_timeout 300s`（SSE 流式不被缓冲、不超时）
- `try_files ... /index.html`（history 路由兜底，本项目用 createWebHistory）
- scp 精确同步 2 个部署文件（全量同步会传 node_modules 数百 MB）
- workflow 配置预检（防 Variables 缺失时静默登录 docker.io）
````

- [ ] **步骤 2：Commit**

```bash
git add DEPLOY.md
git commit -m "docs: 前端部署运维手册"
```

---

### 任务 7：手工配置执行 + 首次部署端到端验证

**文件：** 无代码改动（本任务为控制台/服务器操作 + 一次触发部署的 push）

**注意：** 步骤 1-3 为人工控制台操作（AI 无法代替）；步骤 4 的 `git push` 会触发**真实生产部署**，执行前需用户确认。首次部署在任务 1-6 全部 commit 并合入 main 后进行。

- [ ] **步骤 1：阿里云 ACR 建仓（人工）**

控制台「容器镜像服务 → 个人版实例 → 命名空间 `ikunlol` → 创建镜像仓库」：名称 `league-akari-web`，私有，本地仓库。

- [ ] **步骤 2：GitHub 配置 Variables / Secrets（人工）**

仓库 Settings → Secrets and variables → Actions：
- Variables：`ALIYUN_REGISTRY`、`ALIYUN_NAMESPACE`、`IMAGE_NAME=league-akari-web`（值照抄后端仓库）
- Secrets：`ALIYUN_USERNAME`、`ALIYUN_PASSWORD`、`SERVER_HOST`、`SERVER_PORT`、`SERVER_USER`、`SERVER_SSH_KEY`（值照抄后端仓库）

- [ ] **步骤 3：服务器初始化（人工，root）**

执行 `DEPLOY.md`「一次性配置清单」第 4 条的 4 行命令。

- [ ] **步骤 4：触发首次部署（需用户确认）**

```bash
git push origin main
```
观察 GitHub Actions：job1「构建并推送 amd64 镜像」→ job2「通过 SSH 部署到云服务器」全绿。

- [ ] **步骤 5：按验收标准逐项验证（服务器 + 浏览器）**

对照规格第 10 节：
1. `docker ps --filter name=league-akari-web` → healthy
2. `curl -f http://127.0.0.1:8082/` → 前端页面
3. 浏览器：对局数据加载正常（无 CORS 报错）
4. AI 对局分析：流式输出实时到达（SSE 正常）
5. 刷新任一子路径路由 → 不 404
6. `cat /opt/league-akari/web/config/current-image` → 记录了本次 SHA

- [ ] **步骤 6：二次推送验证幂等（需用户确认）**

本地做一处可见的小改动（如页面文案）→ `git push origin main` → Actions 全绿 → 浏览器确认变更生效（验证滚动更新与幂等）。
