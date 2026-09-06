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
# 覆盖默认站点配置：history 兜底 + /api 反代 + SSE 不缓冲 + /cdn 图片代理缓存
COPY nginx.conf /etc/nginx/conf.d/default.conf
# CDN 代理缓存目录：预建并授权给 nginx worker 用户（proxy_cache_path 写入需要）
RUN mkdir -p /var/cache/nginx/cdn && chown -R nginx:nginx /var/cache/nginx
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=5s --retries=3 --start-period=10s \
  CMD wget -q --spider http://127.0.0.1/ || exit 1
