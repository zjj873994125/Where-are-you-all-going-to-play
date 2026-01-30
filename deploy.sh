#!/usr/bin/env bash

# 项目配置
PROJECT_NAME="大家去哪玩"
IMAGE_NAME="meetpoint"
CONTAINER_NAME="meetpoint-web"
PORT=38080
SERVER_IP="your-server-ip"  # 请修改为实际服务器IP

# 镜像标签
IMAGE_TAG="${IMAGE_NAME}:latest"

# 项目路径（服务器上的路径）
REMOTE_PATH="/root/docker/Where-are-you-all-going-to-play"
# 如果是本地部署，不需要 SSH
LOCAL_DEPLOY=true

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

echo_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# 本地构建和部署
deploy_local() {
    echo_info "========================================="
    echo "  ${PROJECT_NAME} 本地部署"
    echo "========================================="

    # 构建镜像
    echo_info ">>> 构建 Docker 镜像..."
    docker build -t $IMAGE_TAG . || {
        echo_error "Docker 构建失败"
        exit 1
    }

    # 停止并删除旧容器
    echo_info ">>> 停止旧容器..."
    docker stop $CONTAINER_NAME 2>/dev/null || true
    docker rm $CONTAINER_NAME 2>/dev/null || true

    # 启动新容器
    echo_info ">>> 启动新容器..."
    docker run -d \
        --name $CONTAINER_NAME \
        -p ${PORT}:80 \
        --restart unless-stopped \
        $IMAGE_TAG || {
        echo_error "容器启动失败"
        exit 1
    }

    echo_info ">>> 部署成功！"
    echo ""
    echo "访问地址: http://localhost:${PORT}"
    echo ""
    echo "其他命令:"
    echo "  查看日志: docker logs -f $CONTAINER_NAME"
    echo "  停止容器: docker stop $CONTAINER_NAME"
    echo "  重启容器: docker restart $CONTAINER_NAME"
    echo "  删除容器: docker rm -f $CONTAINER_NAME"
}

# 远程部署到服务器
deploy_remote() {
    echo_info "========================================="
    echo "  ${PROJECT_NAME} 远程部署"
    echo "========================================="
    echo ""
    echo_warn "请确保:"
    echo "  1. 已配置服务器 SSH 免密登录"
    echo "  2. 服务器 IP: ${SERVER_IP}"
    echo "  3. 服务器已安装 Docker 和 Docker Compose"
    echo ""

    # 构建
    echo_info ">>> 构建 Docker 镜像..."
    docker build -t $IMAGE_TAG . || {
        echo_error "Docker 构建失败"
        exit 1
    }

    # 保存镜像
    echo_info ">>> 保存镜像到 tar 文件..."
    docker save $IMAGE_TAG | gzip > ${IMAGE_NAME}.tar.gz || {
        echo_error "镜像导出失败"
        exit 1
    }

    # 上传并部署
    echo_info ">>> 上传并部署到服务器..."
    scp ${IMAGE_NAME}.tar.gz root@${SERVER_IP}:/tmp/
    ssh root@${SERVER_IP} << 'ENDSSH'
        # 停止旧容器
        docker stop $CONTAINER_NAME 2>/dev/null || true
        docker rm $CONTAINER_NAME 2>/dev/null || true

        # 加载镜像
        docker load < /tmp/${IMAGE_NAME}.tar.gz

        # 启动容器
        docker run -d \
            --name $CONTAINER_NAME \
            -p ${PORT}:80 \
            --restart unless-stopped \
            $IMAGE_TAG

        # 清理临时文件
        rm -f /tmp/${IMAGE_NAME}.tar.gz
        docker image prune -f
ENDSSH

    # 清理本地临时文件
    rm -f ${IMAGE_NAME}.tar.gz

    echo_info ">>> 部署成功！"
    echo ""
    echo "访问地址: http://${SERVER_IP}:${PORT}"
}

# 构建镜像
build() {
    echo_info ">>> 构建 Docker 镜像..."
    docker build -t $IMAGE_TAG .
    echo_info ">>> 构建完成"
}

# 推送镜像到镜像仓库
push() {
    REGISTRY="your-registry.com"  # 修改为你的镜像仓库地址
    docker tag $IMAGE_TAG ${REGISTRY}/${IMAGE_TAG}
    docker push ${REGISTRY}/${IMAGE_TAG}
}

# 帮助信息
show_help() {
    echo "用法: ./deploy.sh [命令]"
    echo ""
    echo "命令:"
    echo "  build       - 构建 Docker 镜像"
    echo "  deploy      - 本地部署（默认）"
    echo "  remote      - 远程部署到服务器"
    echo "  push        - 推送镜像到仓库"
    echo "  test        - 测试钉钉通知"
    echo ""
    echo "示例:"
    echo "  ./deploy.sh build      # 只构建镜像"
    echo "  ./deploy.sh deploy      # 本地部署"
    echo "  ./deploy.sh remote      # 远程部署"
}

# 主函数
case "${1:-deploy}" in
    build)
        build
        ;;
    deploy)
        deploy_local
        ;;
    remote)
        deploy_remote
        ;;
    push)
        push
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo_error "未知命令: $1"
        show_help
        exit 1
        ;;
esac
