const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Supabase 配置
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// JWT 密钥
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// 中间件：验证JWT
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '未提供token' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: '用户不存在' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ error: '无效的token' });
  }
};

// 中间件：验证管理员权限
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
};

// 中间件：验证超级管理员权限
const requireSuperAdmin = (req, res, next) => {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: '需要超级管理员权限' });
  }
  next();
};

// 登录接口
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const token = jwt.sign({ userId: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        department: user.department,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取当前用户信息
app.get('/api/user', authenticateToken, (req, res) => {
  res.json({
    id: req.user.id,
    username: req.user.username,
    role: req.user.role,
    createdAt: req.user.created_at
  });
});

// 用户管理 - 获取所有用户（仅超级管理员）
app.get('/api/users', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, username, name, role, department, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 用户管理 - 创建新用户（仅管理员）
app.post('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, password, role = 'user', name, department } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: '无效的角色' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { data: newUser, error } = await supabase
      .from('users')
      .insert({ username, password: hashedPassword, role, name: name || username, department: department || '' })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      id: newUser.id,
      username: newUser.username,
      name: newUser.name,
      role: newUser.role,
      department: newUser.department,
      createdAt: newUser.created_at
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 用户管理 - 更新用户（仅超级管理员）
app.put('/api/users/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, name, department } = req.body;

    const updateData = {};
    if (role && ['user', 'admin', 'super_admin'].includes(role)) {
      updateData.role = role;
    }
    if (name !== undefined) {
      updateData.name = name;
    }
    if (department !== undefined) {
      updateData.department = department;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: '没有提供更新内容' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      department: user.department
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 用户管理 - 删除用户（仅超级管理员）
app.delete('/api/users/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: '不能删除自己' });
    }

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true, message: '用户已删除' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 用户管理 - 修改密码
app.put('/api/users/:id/password', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { oldPassword, newPassword } = req.body;

    if (parseInt(id) !== req.user.id && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: '只能修改自己的密码' });
    }

    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('password')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    if (req.user.role !== 'super_admin') {
      const isValid = await bcrypt.compare(oldPassword, user.password);
      if (!isValid) {
        return res.status(401).json({ error: '旧密码错误' });
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const { error } = await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true, message: '密码修改成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 物料管理 - 获取所有物料
app.get('/api/materials', authenticateToken, async (req, res) => {
  try {
    const { code, name, spec, page = 1, limit = 10 } = req.query;
    
    let query = supabase.from('materials').select('*', { count: 'exact' });

    if (code) query = query.ilike('code', `%${code}%`);
    if (name) query = query.ilike('name', `%${name}%`);
    if (spec) query = query.ilike('spec', `%${spec}%`);

    query = query.order('code', { ascending: true });

    const { data: materials, count, error } = await query
      .range((page - 1) * limit, page * limit - 1);

    if (error) throw error;

    res.json({
      data: materials,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 物料管理 - 获取单个物料
app.get('/api/materials/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: material, error } = await supabase
      .from('materials')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    res.json(material);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 物料管理 - 创建物料（管理员）
app.post('/api/materials', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { code, name, spec, quantity, unit, location, warning_value } = req.body;

    if (!code || !name || !spec || quantity === undefined || !unit) {
      return res.status(400).json({ error: '必填字段不能为空' });
    }

    const { data: existing } = await supabase
      .from('materials')
      .select('id')
      .eq('code', code)
      .single();

    if (existing) {
      return res.status(400).json({ error: '物料编码已存在' });
    }

    const { data: material, error } = await supabase
      .from('materials')
      .insert({
        code,
        name,
        spec,
        quantity: parseFloat(quantity),
        unit,
        location: location || '',
        warning_value: parseFloat(warning_value) || 0,
        created_by: req.user.id
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(material);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 物料管理 - 更新物料（管理员）
app.put('/api/materials/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, spec, quantity, unit, location, warning_value } = req.body;

    const { data: material, error } = await supabase
      .from('materials')
      .update({
        code,
        name,
        spec,
        quantity: parseFloat(quantity),
        unit,
        location: location || '',
        warning_value: parseFloat(warning_value) || 0,
        updated_by: req.user.id
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json(material);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 物料管理 - 删除物料（管理员）
app.delete('/api/materials/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('materials')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true, message: '物料已删除' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 物料管理 - 快速更新库存（管理员）
app.put('/api/materials/:id/quantity', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    const { data: material, error } = await supabase
      .from('materials')
      .update({
        quantity: parseFloat(quantity),
        updated_by: req.user.id
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json(material);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Excel导入物料（管理员）
app.post('/api/materials/import', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { base64Data } = req.body;

    if (!base64Data) {
      return res.status(400).json({ error: '请上传Excel文件' });
    }

    const buffer = Buffer.from(base64Data, 'base64');
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(worksheet);

    if (!data || data.length === 0) {
      return res.status(400).json({ error: 'Excel文件中没有数据' });
    }

    const materials = data.map((item, index) => ({
      code: item['物料编码'] || item['code'] || `TEMP_${Date.now()}_${index}`,
      name: item['物料名称'] || item['name'] || '',
      spec: item['物料规格'] || item['spec'] || '',
      quantity: parseFloat(item['现有数量'] || item['quantity'] || 0),
      unit: item['单位'] || item['unit'] || '',
      location: item['货架库位'] || item['location'] || '',
      warning_value: parseFloat(item['预警值'] || item['warning_value'] || 0),
      created_by: req.user.id
    })).filter(m => m.name && m.code);

    if (materials.length === 0) {
      return res.status(400).json({ error: '没有有效的物料数据' });
    }

    const { data: inserted, error } = await supabase
      .from('materials')
      .insert(materials)
      .select();

    if (error) throw error;

    res.json({ success: true, count: inserted.length, data: inserted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Excel导出物料
app.get('/api/materials/export', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;

    let query = supabase.from('materials').select('*');
    
    if (status && ['normal', 'warning', 'shortage'].includes(status)) {
      if (status === 'normal') {
        query = query.gt('quantity', 'warning_value');
      } else if (status === 'warning') {
        query = query.lte('quantity', 'warning_value').gt('quantity', 0);
      } else if (status === 'shortage') {
        query = query.lte('quantity', 0);
      }
    }

    const { data: materials, error } = await query.order('code', { ascending: true });

    if (error) throw error;

    const worksheetData = materials.map(m => ({
      '物料编码': m.code,
      '物料名称': m.name,
      '物料规格': m.spec,
      '现有数量': m.quantity,
      '单位': m.unit,
      '货架库位': m.location,
      '预警值': m.warning_value,
      '状态': m.quantity > (m.warning_value || 0) ? '正常' : (m.quantity > 0 ? '预警' : '不足'),
      '创建时间': m.created_at
    }));

    const worksheet = xlsx.utils.json_to_sheet(worksheetData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, '辅料信息');

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=辅料信息_${new Date().toISOString().split('T')[0]}.xlsx`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 领用记录 - 获取所有记录
app.get('/api/usage', authenticateToken, async (req, res) => {
  try {
    const { contractNumber, projectName, materialName, dateStart, dateEnd, page = 1, limit = 10 } = req.query;

    let query = supabase.from('usage_records').select('*, materials(code, name, spec, unit)', { count: 'exact' });

    if (contractNumber) query = query.ilike('contract_number', `%${contractNumber}%`);
    if (projectName) query = query.ilike('project_name', `%${projectName}%`);
    if (materialName) query = query.ilike('material_name', `%${materialName}%`);
    if (dateStart) query = query.gte('date', dateStart);
    if (dateEnd) query = query.lte('date', dateEnd);

    query = query.order('date', { ascending: false });

    const { data: records, count, error } = await query
      .range((page - 1) * limit, page * limit - 1);

    if (error) throw error;

    res.json({
      data: records,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 领用记录 - 获取统计数据
app.get('/api/usage/stats', authenticateToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { count: todayCount } = await supabase
      .from('usage_records')
      .select('id', { count: 'exact' })
      .gte('date', today);

    const { count: weekCount } = await supabase
      .from('usage_records')
      .select('id', { count: 'exact' })
      .gte('date', weekAgo);

    const { count: monthCount } = await supabase
      .from('usage_records')
      .select('id', { count: 'exact' })
      .gte('date', monthAgo);

    const { count: totalCount } = await supabase
      .from('usage_records')
      .select('id', { count: 'exact' });

    res.json({
      today: todayCount || 0,
      week: weekCount || 0,
      month: monthCount || 0,
      total: totalCount || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 领用记录 - 创建记录（管理员）
app.post('/api/usage', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { recordType, contractNumber, projectName, materialId, materialCode, materialName, materialSpec, materialUnit, quantity, userName, date, remark } = req.body;

    if (!contractNumber || !projectName || !materialId || quantity === undefined || !userName || !date) {
      return res.status(400).json({ error: '必填字段不能为空' });
    }

    const { data: record, error: recordError } = await supabase
      .from('usage_records')
      .insert({
        record_type: recordType,
        contract_number: contractNumber,
        project_name: projectName,
        material_id: parseInt(materialId),
        material_code: materialCode,
        material_name: materialName,
        material_spec: materialSpec,
        material_unit: materialUnit,
        quantity: parseFloat(quantity),
        user_name: userName,
        date,
        remark: remark || '',
        created_by: req.user.id
      })
      .select()
      .single();

    if (recordError) throw recordError;

    if (recordType === 'usage') {
      await supabase.rpc('decrement_material_quantity', {
        material_id: parseInt(materialId),
        amount: parseFloat(quantity)
      });
    } else {
      await supabase.rpc('increment_material_quantity', {
        material_id: parseInt(materialId),
        amount: parseFloat(quantity)
      });
    }

    res.status(201).json(record);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 领用记录 - 更新记录（管理员）
app.put('/api/usage/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { recordType, contractNumber, projectName, materialId, materialCode, materialName, materialSpec, materialUnit, quantity, userName, date, remark } = req.body;

    const { data: oldRecord, error: fetchError } = await supabase
      .from('usage_records')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    if (oldRecord.record_type === 'usage') {
      await supabase.rpc('increment_material_quantity', {
        material_id: oldRecord.material_id,
        amount: oldRecord.quantity
      });
    } else {
      await supabase.rpc('decrement_material_quantity', {
        material_id: oldRecord.material_id,
        amount: oldRecord.quantity
      });
    }

    const { data: record, error } = await supabase
      .from('usage_records')
      .update({
        record_type: recordType,
        contract_number: contractNumber,
        project_name: projectName,
        material_id: parseInt(materialId),
        material_code: materialCode,
        material_name: materialName,
        material_spec: materialSpec,
        material_unit: materialUnit,
        quantity: parseFloat(quantity),
        user_name: userName,
        date,
        remark: remark || '',
        updated_by: req.user.id
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if (recordType === 'usage') {
      await supabase.rpc('decrement_material_quantity', {
        material_id: parseInt(materialId),
        amount: parseFloat(quantity)
      });
    } else {
      await supabase.rpc('increment_material_quantity', {
        material_id: parseInt(materialId),
        amount: parseFloat(quantity)
      });
    }

    res.json(record);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 领用记录 - 删除记录（管理员）
app.delete('/api/usage/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: record, error: fetchError } = await supabase
      .from('usage_records')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    if (record.record_type === 'usage') {
      await supabase.rpc('increment_material_quantity', {
        material_id: record.material_id,
        amount: record.quantity
      });
    } else {
      await supabase.rpc('decrement_material_quantity', {
        material_id: record.material_id,
        amount: record.quantity
      });
    }

    const { error } = await supabase
      .from('usage_records')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true, message: '领用记录已删除' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Excel导出领用记录
app.get('/api/usage/export', authenticateToken, async (req, res) => {
  try {
    const { dateStart, dateEnd } = req.query;

    let query = supabase.from('usage_records').select('*');

    if (dateStart) query = query.gte('date', dateStart);
    if (dateEnd) query = query.lte('date', dateEnd);

    const { data: records, error } = await query.order('date', { ascending: false });

    if (error) throw error;

    const worksheetData = records.map(r => ({
      '记录类型': r.record_type === 'usage' ? '领料' : '退料',
      '项目合同号': r.contract_number,
      '项目名称': r.project_name,
      '物料编码': r.material_code,
      '物料名称': r.material_name,
      '物料规格': r.material_spec,
      '数量': r.quantity,
      '单位': r.material_unit,
      '领退料人': r.user_name,
      '日期': r.date,
      '备注': r.remark,
      '操作人': r.created_by
    }));

    const worksheet = xlsx.utils.json_to_sheet(worksheetData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, '领用记录');

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=领用记录_${new Date().toISOString().split('T')[0]}.xlsx`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Vercel Serverless Functions 需要的导出
module.exports = (req, res) => {
  app(req, res);
};

module.exports.default = (req, res) => {
  app(req, res);
};
