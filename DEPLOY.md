# 前端部署运维手册（league-akari-web）

> 架构与踩坑细节见后端交接文档 `league-akari-server/DEPLOY_HANDOVER.md`；本手册只记前端特有的操作。

## 部署架构速览

`git push main` → GitHub Actions 构建 amd64 镜像（node:20-alpine 构建 + nginx:alpine 运行）
→ 推阿里云 ACR（SHA + latest）→ scp 精确同步 `deploy.sh` + `docker-compose.yml` 到服务器
→ SSH 执行 `./deploy.sh`：拉镜像 → 重建容器 → 健康检查 `http://127.0.0.1:8002/` → 失败自动回滚。

请求链路：浏览器 `:8002`（HTTP，注意无 TLS，勿用 https）→ 容器内 nginx → `/api/*` 反代 `host.docker.internal:8081`（后端），其余走 dist 静态文件（history 路由兜底）。

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
curl -f http://127.0.0.1:8002/                       # 返回前端页面
cat /opt/league-akari/web/config/current-image       # 记录本次部署版本
docker logs --tail=50 league-akari-web               # 无异常日志
```

浏览器访问 `http://<服务器IP>:8002/`（HTTP 协议，服务器安全组需放行 8002/TCP）：对局数据正常加载（反代通）、AI 分析流式实时输出（SSE 未被缓冲）、刷新子路径不 404（history 兜底）。

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
- `proxy_buffering off` + `proxy_http_version 1.1` + `proxy_read_timeout 300s`（SSE 流式不被缓冲、不超时）
- `try_files ... /index.html`（history 路由兜底，本项目用 createWebHistory）
- scp 精确同步 2 个部署文件（全量同步会传 node_modules 数百 MB）
- workflow 配置预检（防 Variables 缺失时静默登录 docker.io）
