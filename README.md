# 辅料管理系统 - 项目文档

## 📋 项目简介

辅料管理系统（Auxiliary Material Management System）是一款基于云端的企业级辅料库存管理平台，支持物料管理、领退料记录、用户权限控制、数据导出等功能。

### 技术栈
- **前端**：HTML5, CSS3, JavaScript, Tailwind CSS, Font Awesome, Chart.js
- **后端**：Node.js, Express, Netlify Functions
- **数据库**：Supabase (PostgreSQL)
- **认证**：JWT (JSON Web Tokens)
- **Excel处理**：SheetJS (XLSX)

---

## ✨ 功能说明

### 1. 物料管理
- ✅ 物料列表展示（支持分页）
- ✅ 物料搜索（按编码、名称、规格）
- ✅ 状态筛选（全部、正常、预警、不足）
- ✅ 新增物料
- ✅ 编辑物料信息
- ✅ 删除物料
- ✅ 批量导入物料（Excel）
- ✅ 批量更新库存（Excel）
- ✅ 导出物料数据（Excel/CSV）

### 2. 领退料管理
- ✅ 领退料记录列表
- ✅ 创建领料/退料记录
- ✅ 删除领退料记录（超级管理员）
- ✅ 自动更新库存数量
- ✅ 记录创建时间（UTC转本地时区）
- ✅ 导出领退料记录

### 3. 用户权限管理
- ✅ 用户登录/登出
- ✅ 角色权限控制：
  - **超级管理员**：全部权限、用户管理、删除记录
  - **管理员**：物料管理、领退料操作
  - **普通用户**：查看权限
- ✅ 用户列表展示
- ✅ 新增用户
- ✅ 编辑用户权限
- ✅ 删除用户

### 4. 数据可视化
- ✅ 库存统计卡片（总数、正常、预警、不足）
- ✅ 月度使用量趋势图
- ✅ 季度使用量统计
- ✅ 物料类型分布图

---

## 🛠 技术架构

### 数据库结构

#### users 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL | 主键 |
| username | VARCHAR | 用户名（唯一） |
| password | VARCHAR | 密码（加密存储） |
| name | VARCHAR | 姓名 |
| role | VARCHAR | 角色（super_admin/admin/user） |
| department | VARCHAR | 部门 |
| created_at | TIMESTAMP | 创建时间 |

#### materials 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL | 主键 |
| code | VARCHAR | 物料编码（唯一） |
| name | VARCHAR | 物料名称 |
| spec | VARCHAR | 物料规格 |
| quantity | DECIMAL | 现有数量 |
| unit | VARCHAR | 单位 |
| location | VARCHAR | 货架库位 |
| warning_value | DECIMAL | 预警值 |
| max_quantity | DECIMAL | 库存峰值 |
| remark | TEXT | 备注 |
| created_by | INTEGER | 创建人ID |
| updated_by | INTEGER | 更新人ID |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

#### usage_records 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL | 主键 |
| record_type | VARCHAR | 记录类型（usage/return） |
| contract_number | VARCHAR | 合同号 |
| project_name | VARCHAR | 项目名称 |
| material_id | INTEGER | 物料ID |
| material_code | VARCHAR | 物料编码 |
| material_name | VARCHAR | 物料名称 |
| material_spec | VARCHAR | 物料规格 |
| material_unit | VARCHAR | 单位 |
| quantity | DECIMAL | 数量 |
| user_name | VARCHAR | 领退料人 |
| date | TIMESTAMP | 日期（UTC时间） |
| remark | TEXT | 备注 |
| created_by | INTEGER | 创建人ID |
| created_at | TIMESTAMP | 创建时间（UTC） |

### API 接口

#### 认证接口
- `POST /api/login` - 用户登录
- `GET /api/user` - 获取当前用户信息

#### 物料接口
- `GET /api/materials` - 获取物料列表
- `GET /api/materials/:id` - 获取单个物料
- `POST /api/materials` - 创建物料
- `PUT /api/materials/:id` - 更新物料
- `DELETE /api/materials/:id` - 删除物料
- `POST /api/materials/import` - 导入物料
- `POST /api/materials/update-quantity` - 批量更新库存
- `GET /api/materials/export` - 导出物料

#### 领退料接口
- `GET /api/usage` - 获取领退料记录
- `POST /api/usage` - 创建领退料记录
- `PUT /api/usage/:id` - 更新记录
- `DELETE /api/usage/:id` - 删除记录
- `GET /api/usage/stats` - 获取统计

#### 用户接口
- `GET /api/users` - 获取用户列表
- `POST /api/users` - 创建用户
- `PUT /api/users/:id` - 更新用户
- `DELETE /api/users/:id` - 删除用户
- `PUT /api/users/:id/password` - 修改密码

---

## 📝 更新日志

详细的更新和修复记录请参考 [UPDATES.md](UPDATES.md)

---

## 🚀 部署方法

### 方案一：Netlify 部署

#### 1. 准备环境
- 安装 Node.js (v14+)
- 安装 Git
- 注册 Netlify 账号

#### 2. 部署步骤

```bash
# 1. 克隆或下载项目代码
git clone <repository-url>
cd 辅料看板

# 2. 安装依赖
npm install

# 3. 本地测试
npm run dev
# 或
npx netlify dev

# 4. 部署到Netlify
npm run deploy
```

#### 3. 配置环境变量

在 Netlify 控制台添加以下环境变量：

| 变量名 | 说明 | 示例 |
|--------|------|------|
| SUPABASE_URL | Supabase项目URL | https://xxxx.supabase.co |
| SUPABASE_KEY | Supabase API Key | eyJhbGciOiJIUzI1NiIs... |
| JWT_SECRET | JWT加密密钥 | your-secret-key-change-in-production |
| ADMIN_PASSWORD | 初始管理员密码 | gh888888 |

#### 4. 访问部署地址
部署成功后，访问 Netlify 提供的 URL 即可使用系统。

---

### 方案二：本地运行

#### 1. 准备环境
- 安装 Node.js (v14+)
- 安装 Netlify CLI（可选，首次运行时会自动提示安装）

#### 2. 安装依赖
```bash
# 进入项目目录
cd c:\Users\Administrator\Desktop\辅料看板

# 安装依赖
npm install
```

#### 3. 配置环境变量
```bash
# 复制环境变量示例文件
cp .env.example .env
```

编辑 `.env` 文件，填入你的 Supabase 配置信息：

```env
# Supabase 配置
SUPABASE_URL=https://你的项目ID.supabase.co
SUPABASE_KEY=你的Supabase API Key

# JWT 加密密钥（可自定义）
JWT_SECRET=your-secret-key-change-in-production

# 初始管理员密码
ADMIN_PASSWORD=gh888888
```

#### 4. 启动本地服务器
```bash
# 使用 Netlify CLI 启动开发服务器
npx netlify dev
```

#### 5. 访问本地服务
启动成功后，在浏览器中访问：
```
http://localhost:8888
```

#### 6. 启动成功输出示例
```
◈ Netlify Dev ◈
Server now ready on http://localhost:8888
```

#### 注意事项
- 首次启动可能需要等待依赖安装
- 如果提示缺少 Netlify CLI，按提示安装即可
- 确保网络连接正常，以便连接到 Supabase 数据库

---

## 🔧 后续维护

### 日常维护

#### 1. 数据库备份
- Supabase 提供自动备份功能
- 建议定期手动导出重要数据
- 导出路径：`Supabase Dashboard > Database > Backups`

#### 2. 日志监控
- Netlify 提供部署日志
- 监控地址：Netlify Dashboard > Deploys

#### 3. 性能优化
- 定期清理无用数据
- 合理设置索引
- 监控API响应时间

### 常见问题

#### Q1: 登录失败怎么办？
**A:** 检查以下配置：
1. 环境变量是否正确设置
2. SUPABASE_URL 和 SUPABASE_KEY 是否有效
3. 数据库是否正常运行

#### Q2: 导出Excel失败？
**A:** 可能原因：
1. 数据量过大（超过10000条）
2. 网络超时
3. 浏览器阻止弹窗

#### Q3: 时间显示不正确？
**A:** 这是时区问题，已在代码中修复。如仍有问题，检查：
1. 浏览器时区设置
2. 服务器时区配置

#### Q4: 如何重置管理员密码？
**A:** 通过数据库直接更新：
```sql
UPDATE users
SET password = '$2a$10$...' -- bcrypt加密的新密码
WHERE username = 'admin';
```

### 功能扩展建议

#### 1. 数据可视化增强
- 添加自定义时间范围筛选
- 导出图表为图片
- 添加数据对比功能

#### 2. 通知功能
- 库存预警邮件通知
- 领退料申请审批流程
- 系统公告

#### 3. 报表功能
- 月度/季度统计报表
- 物料使用趋势分析
- 成本核算

#### 4. 安全增强
- 添加登录失败次数限制
- 添加操作日志审计
- 添加数据加密存储

---

## 📂 文件结构

```
辅料看板/
├── index.html              # 主页面（物料管理）
├── usage-tracking.html     # 使用量管理页面
├── script.js                # 主页面逻辑
├── api-config.js            # API配置
├── netlify/
│   └── functions/
│       └── api.js           # 后端API
├── package.json             # 依赖配置
├── .env.example             # 环境变量示例
└── README.md                # 项目文档（本文件）
```

---

**最后更新**：2026-05-11
**文档版本**：v1.0