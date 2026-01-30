# 中点选址地图工具 - 使用说明

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置高德地图 API Key

#### 获取 API Key
1. 访问 [高德开放平台](https://console.amap.com/)
2. 注册/登录账号
3. 进入「应用管理」->「我的应用」
4. 创建新应用，添加 Key
5. 选择「Web端(JS API)」

#### 配置 Key

编辑 `index.html` 文件，替换以下内容：

```html
<script type="text/javascript">
  window._AMapSecurityConfig = {
    securityJsCode: 'YOUR_SECURITY_JS_CODE',  // 替换为你的安全密钥
  }
</script>
<script src="https://webapi.amap.com/maps?v=2.0&key=YOUR_AMAP_KEY"></script>
```

将 `YOUR_SECURITY_JS_CODE` 和 `YOUR_AMAP_KEY` 替换为你在高德平台获取的值。

### 3. 启动开发服务器

```bash
npm run dev
```

### 4. 构建生产版本

```bash
npm run build
```

构建产物在 `dist` 目录。

## 功能说明

### 核心功能

1. **地图展示**
   - 高德地图 JS API 2.0
   - 支持缩放、拖动

2. **添加地点**
   - 搜索地点名称/地址
   - 点击地图添加
   - 至少添加 2 个地点

3. **中点计算**
   - 自动计算几何中点（经纬度平均值）
   - 地图上特殊标记显示

4. **附近场所搜索**
   - 预设类型：餐厅、咖啡厅、商场、酒吧
   - 自定义关键词搜索
   - 可选半径：500m/1km/2km/3km

5. **导航跳转**
   - 点击场所跳转高德地图导航
   - 支持驾车、步行、公交

## 项目结构

```
大家去哪玩/
├── src/
│   ├── components/        # React 组件
│   │   ├── MapView.tsx    # 地图组件
│   │   ├── LocationPanel.tsx  # 地点添加面板
│   │   └── POIList.tsx    # 场所列表
│   ├── types/             # TypeScript 类型定义
│   ├── utils/             # 工具函数
│   ├── App.tsx            # 主应用
│   └── main.tsx           # 入口文件
├── public/                # 静态资源
├── index.html             # HTML 模板
├── vite.config.ts         # Vite 配置
├── tsconfig.json          # TypeScript 配置
└── package.json           # 项目配置
```

## 技术栈

- **前端框架**: React 19
- **构建工具**: Vite 6
- **类型系统**: TypeScript 5.7
- **地图 API**: 高德地图 JS API 2.0
- **样式**: 原生 CSS + Tailwind 类名风格

## 浏览器支持

- Chrome (推荐)
- Firefox
- Safari
- Edge

## 注意事项

1. 高德 API Key 需要配置正确的域名白名单
2. 免费版 API 有日调用量限制
3. 建议在生产环境使用域名限制保护 Key
