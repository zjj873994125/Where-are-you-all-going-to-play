# Docker 部署文档

## 文件说明

- `Dockerfile` - Docker 镜像构建文件
- `nginx.conf` - Nginx 配置文件
- `.dockerignore` - Docker 构建时忽略的文件
- `docker-compose.yml` - Docker Compose 配置
- `deploy.sh` - 部署脚本
- `.env.example` - 环境变量配置模板

## 快速开始

### 本地部署

```bash
# 赋予执行权限
chmod +x deploy.sh

# 方式1：使用部署脚本（推荐）
./deploy.sh deploy

# 方式2：使用 Docker Compose
docker-compose up -d

# 方式3：手动构建运行
docker build -t meetpoint:latest .
docker run -d -p 38080:80 --name meetpoint-web meetpoint:latest
```

访问: http://localhost:38080

## 远程部署

### 1. 配置服务器

确保服务器已安装：
- Docker
- Docker Compose（可选）

### 2. 配置 SSH 免密登录

```bash
# 生成本地密钥（如果没有）
ssh-keygen -t rsa

# 复制公钥到服务器
ssh-copy-id root@your-server-ip
```

### 3. 修改配置

编辑 `deploy.sh`，修改服务器 IP：

```bash
SERVER_IP="your-server-ip"  # 改为实际IP
```

### 4. 执行部署

```bash
./deploy.sh remote
```

## 常用命令

```bash
# 查看容器状态
docker ps

# 查看日志
docker logs -f meetpoint-web

# 进入容器
docker exec -it meetpoint-web sh

# 停止容器
docker stop meetpoint-web

# 启动容器
docker start meetpoint-web

# 重启容器
docker restart meetpoint-web

# 删除容器
docker rm -f meetpoint-web

# 删除镜像
docker rmi meetpoint:latest
```

## 环境变量

复制 `.env.example` 为 `.env` 并根据需要修改配置：

```bash
cp .env.example .env
```

## 端口说明

- `38080` - 默认访问端口（可在 deploy.sh 中修改）
