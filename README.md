# 辅料管理系统

一个用于工厂车间辅料管理的全栈应用，支持物料库存管理、领用记录跟踪、Excel导入导出等功能。

## 功能特性

- 🏭 **物料库存管理** - 实时查看和管理辅料库存
- 📋 **领退料记录** - 记录和跟踪物料领用、退料操作
- 🔐 **三级权限** - 超级管理员、管理员、普通员工
- 📊 **统计分析** - 物料使用量排行、月度/季度趋势图表
- 📤 **Excel导入导出** - 支持批量导入物料和导出统计报告
- 🔄 **实时同步** - 多人操作数据实时统一同步

## 技术栈

- **前端**: HTML5, CSS3, JavaScript, Tailwind CSS 3
- **后端**: Node.js, Express, Vercel Serverless Functions
- **数据库**: Supabase (PostgreSQL)
- **认证**: JWT (JSON Web Tokens)
- **图表**: Chart.js
- **Excel处理**: SheetJS (xlsx)

## 项目结构

```
辅料看板/
├── api/                    # 后端API
│   ├── index.js            # 主API入口
│   └── supabase.js         # Supabase配置
├── index.html              # 主页面（库存管理）
├── usage-tracking.html     # 领用记录页面
├── api-config.js           # 前端API配置
├── script.js               # 前端主逻辑
├── style.css               # 自定义样式
├── package.json            # 项目依赖配置
├── vercel.json             # Vercel部署配置
├── .env.example            # 环境变量示例
└── .gitignore              # Git忽略文件
```

## 快速开始

### 前置条件

1. 注册 [Supabase](https://supabase.com/) 账号
2. 注册 [Vercel](https://vercel.com/) 账号
3. 注册 [GitHub](https://github.com/) 账号

### 步骤

1. **创建Supabase项目**
   - 登录Supabase，创建新项目
   - 在项目设置中获取 API URL 和 API Key

2. **配置环境变量**
   - 复制 `.env.example` 为 `.env`
   - 填写 Supabase 的 URL、API Key 和 JWT_SECRET

3. **创建数据库表**
   - 在Supabase的SQL编辑器中执行以下SQL：

```sql
-- 创建用户表
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(100),
  role VARCHAR(20) DEFAULT 'employee',
  department VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建物料表
CREATE TABLE materials (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  spec VARCHAR(100),
  unit VARCHAR(20) NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 0,
  warningValue DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'normal',
  category VARCHAR(50),
  location VARCHAR(100),
  remark TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建领用记录表
CREATE TABLE usage_records (
  id SERIAL PRIMARY KEY,
  record_type VARCHAR(20) NOT NULL,
  contract_number VARCHAR(100),
  project_name VARCHAR(100),
  material_id INT REFERENCES materials(id),
  material_code VARCHAR(50),
  material_name VARCHAR(100),
  material_spec VARCHAR(100),
  material_unit VARCHAR(20),
  quantity DECIMAL(10,2) NOT NULL,
  user_name VARCHAR(100),
  date DATE NOT NULL,
  remark TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_materials_code ON materials(code);
CREATE INDEX idx_usage_records_date ON usage_records(date);
CREATE INDEX idx_usage_records_material_id ON usage_records(material_id);

-- 插入初始超级管理员
INSERT INTO users (username, password, name, role) 
VALUES ('admin', '$2a$10$N9qo8uLOickgx2ZMRZoMye.IjzqAKL9xL5jvMFVdNJHvGCgTq/VEq', '超级管理员', 'super_admin');
```

> 注意：初始密码为 `admin123`（已加密）

4. **部署到Vercel**
   - 将项目推送到GitHub仓库
   - 在Vercel中导入项目
   - 在Vercel环境变量中配置：
     - SUPABASE_URL
     - SUPABASE_KEY
     - JWT_SECRET

## API接口

### 用户认证

- `POST /api/login` - 用户登录
- `POST /api/logout` - 用户登出

### 用户管理（管理员）

- `GET /api/users` - 获取用户列表
- `POST /api/users` - 创建新用户
- `PUT /api/users/:id` - 更新用户信息
- `DELETE /api/users/:id` - 删除用户

### 物料管理

- `GET /api/materials` - 获取物料列表
- `POST /api/materials` - 创建物料
- `PUT /api/materials/:id` - 更新物料
- `DELETE /api/materials/:id` - 删除物料
- `POST /api/materials/import` - 导入Excel物料数据
- `GET /api/materials/export` - 导出物料数据

### 领用记录

- `GET /api/usage` - 获取领用记录
- `POST /api/usage` - 创建领用记录
- `DELETE /api/usage/:id` - 删除领用记录
- `GET /api/usage/stats` - 获取统计数据

## 权限说明

| 权限 | 超级管理员 | 管理员 | 普通员工 |
|------|-----------|--------|----------|
| 查看物料 | ✅ | ✅ | ✅ |
| 修改物料 | ✅ | ✅ | ❌ |
| 删除物料 | ✅ | ✅ | ❌ |
| 导入物料 | ✅ | ✅ | ❌ |
| 领用物料 | ✅ | ✅ | ✅ |
| 退料 | ✅ | ✅ | ✅ |
| 删除记录 | ✅ | ✅ | ❌ |
| 查看记录 | ✅ | ✅ | ✅ |
| 管理用户 | ✅ | ✅ | ❌ |
| 创建用户 | ✅ | ✅ | ❌ |

## 许可证

MIT License