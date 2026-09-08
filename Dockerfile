# 构建阶段：Node 编译 TypeScript 并打包静态产物
# npm run build = vue-tsc -b && vite build，类型错误会导致构建失败（隐性质量闸）
FROM node:20-alpine AS builder
WORKDIR /app
# 先复制依赖清单再安装：利用 Docker 层缓存，代码变更时不重装 node_modules
COPY package.json package-lock.json ./
RUN npm ci
# 同步本地化图标（ADR 0004）：从 CDragon/DDragon/gtimg 下载到 public/icons/
# 独立成层——清单与依赖不变时命中 Docker layer cache，日常构建不重复下载约 25MB 图标。
# 仅复制脚本的依赖闭包（scripts + icon-url/game-resource/logger；logger 为前二者的传递依赖）
COPY scripts scripts/
COPY src/utils/icon-url.ts src/utils/game-resource.ts src/utils/logger.ts src/utils/
RUN npm run sync:icons
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
