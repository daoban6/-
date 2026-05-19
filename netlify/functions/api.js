const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config();

// Supabase 配置
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 服务角色客户端（用于绕过行级安全）
let supabaseService = supabase;
try {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceRoleKey && serviceRoleKey.trim() !== '' && serviceRoleKey !== 'your-service-role-key-here') {
    if (serviceRoleKey.startsWith('eyJhbGci')) {
      supabaseService = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
      console.log('Using service role client for operation logs');
    } else {
      console.warn('Invalid service role key format, using regular client');
    }
  } else {
    console.log('Service role key not configured or default value, using regular client');
  }
} catch (error) {
  console.error('Failed to create service role client:', error);
  supabaseService = supabase;
}

// JWT 密钥
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// 验证JWT
const verifyToken = async (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.userId)
      .single();
    return error ? null : user;
  } catch {
    return null;
  }
};

// 响应函数
const respond = (statusCode, body, headers = {}) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...headers
  },
  body: JSON.stringify(body)
});

// 处理 OPTIONS 请求
const handleOptions = () => respond(200, {});

// 初始化数据库表结构
const initDatabaseSchema = async () => {
  try {
    // 尝试添加字段，但不依赖 execute_sql RPC
    console.log('Skipping database schema initialization (execute_sql RPC not available)');
  } catch (err) {
    console.error('initDatabaseSchema error:', err);
  }
};

// 初始化默认管理员
const initDefaultAdmin = async () => {
  try {
    // 先初始化数据库表结构
    await initDatabaseSchema();
    
    const { data: users, error } = await supabase.from('users').select('id').limit(1);
    
    if (error) {
      console.error('Error checking users:', error);
      return;
    }
    
    if (!users || users.length === 0) {
      const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'gh888888', 10);
      const { data: newUser, error: insertError } = await supabase.from('users').insert({
        username: 'admin',
        password: hashedPassword,
        name: '管理员',
        role: 'super_admin',
        department: '系统'
      }).select().single();
      
      if (insertError) {
        console.error('Error creating admin user:', insertError);
      } else {
        console.log('Default admin user created:', newUser);
      }
    }
  } catch (err) {
    console.error('initDefaultAdmin error:', err);
  }
};

// 登录处理
const handleLogin = async (body) => {
  const { username, password } = body;
  
  try {
    // 检查是否需要初始化管理员
    await initDefaultAdmin();
    
    console.log('Login attempt for username:', username);
    
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Database error:', error);
      return respond(500, { error: '数据库连接错误' });
    }

    if (!user) {
      console.log('User not found:', username);
      return respond(401, { error: '用户名或密码错误' });
    }

    console.log('User found:', user.username, ', role:', user.role);
    
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      console.log('Password validation failed for user:', username);
      return respond(401, { error: '用户名或密码错误' });
    }

    const token = jwt.sign({ userId: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

    return respond(200, {
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
    console.error('Login error:', error);
    return respond(500, { error: '服务器内部错误' });
  }
};

// 获取当前用户
const handleGetUser = async (user) => {
  return respond(200, {
    id: user.id,
    username: user.username,
    role: user.role,
    createdAt: user.created_at
  });
};

// 获取所有用户
const handleGetUsers = async (user) => {
  if (user.role !== 'super_admin') {
    return respond(403, { error: '需要超级管理员权限' });
  }

  const { data: users, error } = await supabase
    .from('users')
    .select('id, username, name, role, department, created_at')
    .order('created_at', { ascending: false });

  if (error) return respond(500, { error: error.message });
  return respond(200, users);
};

// 创建用户
const handleCreateUser = async (user, body) => {
  if (user.role !== 'admin' && user.role !== 'super_admin') {
    return respond(403, { error: '需要管理员权限' });
  }

  const { username, password, role = 'user', name, department } = body;

  if (!username || !password) {
    return respond(400, { error: '用户名和密码不能为空' });
  }

  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .single();

  if (existingUser) {
    return respond(400, { error: '用户名已存在' });
  }

  if (!['user', 'admin'].includes(role)) {
    return respond(400, { error: '无效的角色，只能创建普通用户或管理员' });
  }

  // 不允许创建超级管理员
  if (role === 'super_admin') {
    return respond(403, { error: '不能创建超级管理员' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const { data: newUser, error } = await supabase
    .from('users')
    .insert({ username, password: hashedPassword, role, name: name || username, department: department || '' })
    .select()
    .single();

  if (error) return respond(500, { error: error.message });

  return respond(201, {
    id: newUser.id,
    username: newUser.username,
    name: newUser.name,
    role: newUser.role,
    department: newUser.department,
    createdAt: newUser.created_at
  });
};

// 更新用户
const handleUpdateUser = async (user, params, body) => {
  if (user.role !== 'super_admin') {
    return respond(403, { error: '需要超级管理员权限' });
  }

  const { id } = params;
  const { role, name, department } = body;

  // 获取要更新的用户信息
  const { data: targetUser, error: fetchError } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError) {
    return respond(500, { error: '获取用户信息失败' });
  }

  // 不能修改自己的权限
  if (user.id === Number(id)) {
    return respond(403, { error: '不能修改自己的权限' });
  }

  // 不能给其他用户授予超级管理员权限
  if (role === 'super_admin' && targetUser.role !== 'super_admin') {
    return respond(403, { error: '不能授予超级管理员权限' });
  }

  const updateData = {};
  // 允许将超级管理员降级为其他角色，但不允许将其他角色升级为超级管理员
  if (role && role !== 'super_admin' && ['user', 'admin'].includes(role)) {
    updateData.role = role;
  }
  if (name !== undefined) updateData.name = name;
  if (department !== undefined) updateData.department = department;

  if (Object.keys(updateData).length === 0) {
    return respond(400, { error: '没有提供更新内容' });
  }

  const { data: updatedUser, error } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) return respond(500, { error: error.message });
  return respond(200, updatedUser);
};

// 删除用户
const handleDeleteUser = async (user, params) => {
  if (user.role !== 'super_admin') {
    return respond(403, { error: '需要超级管理员权限' });
  }

  const { id } = params;
  if (parseInt(id) === user.id) {
    return respond(400, { error: '不能删除自己' });
  }

  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', id);

  if (error) return respond(500, { error: error.message });
  return respond(200, { success: true, message: '用户已删除' });
};

// 修改密码
const handleChangePassword = async (user, params, body) => {
  const { id } = params;
  const { oldPassword, newPassword } = body;

  if (parseInt(id) !== user.id && user.role !== 'super_admin') {
    return respond(403, { error: '只能修改自己的密码' });
  }

  const { data: targetUser, error: fetchError } = await supabase
    .from('users')
    .select('password')
    .eq('id', id)
    .single();

  if (fetchError) return respond(500, { error: fetchError.message });

  if (user.role !== 'super_admin') {
    const isValid = await bcrypt.compare(oldPassword, targetUser.password);
    if (!isValid) {
      return respond(401, { error: '旧密码错误' });
    }
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  const { error } = await supabase
    .from('users')
    .update({ password: hashedPassword })
    .eq('id', id);

  if (error) return respond(500, { error: error.message });
  return respond(200, { success: true, message: '密码修改成功' });
};

// 获取物料列表
const handleGetMaterials = async (user, query) => {
  const { code, name, spec, page = 1, limit = 10 } = query;
  
  let supabaseQuery = supabase.from('materials').select('*', { count: 'exact' });

  if (code) supabaseQuery = supabaseQuery.ilike('code', `%${code}%`);
  if (name) supabaseQuery = supabaseQuery.ilike('name', `%${name}%`);
  if (spec) supabaseQuery = supabaseQuery.ilike('spec', `%${spec}%`);

  supabaseQuery = supabaseQuery.order('code', { ascending: true });

  const { data: materials, count, error } = await supabaseQuery
    .range((page - 1) * limit, page * limit - 1);

  if (error) return respond(500, { error: error.message });

  return respond(200, {
    data: materials,
    total: count,
    page: parseInt(page),
    limit: parseInt(limit)
  });
};

// 获取单个物料
const handleGetMaterial = async (user, params) => {
  const { id } = params;

  const { data: material, error } = await supabase
    .from('materials')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return respond(500, { error: error.message });
  return respond(200, material);
};

// 创建物料
const handleCreateMaterial = async (user, body) => {
  if (user.role !== 'admin' && user.role !== 'super_admin') {
    return respond(403, { error: '需要管理员权限' });
  }

  const { code, name, spec, quantity, unit, location, warning_value, max_quantity, remark } = body;

  if (!code || !name || !spec || quantity === undefined || !unit) {
    return respond(400, { error: '必填字段不能为空' });
  }

  const { data: existing } = await supabase
    .from('materials')
    .select('id')
    .eq('code', code)
    .single();

  if (existing) {
    return respond(400, { error: '物料编码已存在' });
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
      warningvalue: parseFloat(warning_value) || 0, // 兼容旧字段
      max_quantity: parseFloat(max_quantity) || 0,
      remark: remark || '',
      created_by: user.id,
      updated_by: user.id,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) return respond(500, { error: error.message });
  return respond(201, material);
};

// 更新物料
const handleUpdateMaterial = async (user, params, body) => {
  if (user.role !== 'admin' && user.role !== 'super_admin') {
    return respond(403, { error: '需要管理员权限' });
  }

  const { id } = params;
  const { code, name, spec, quantity, unit, location, warning_value, max_quantity } = body;

  console.log('Updating material:', id, body);

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
      max_quantity: parseFloat(max_quantity) || 0,
      updated_by: user.id,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Update material error:', error);
    return respond(500, { error: error.message });
  }
  return respond(200, material);
};

// 删除物料
const handleDeleteMaterial = async (user, params) => {
  console.log('handleDeleteMaterial called, user:', user?.username, 'role:', user?.role);
  
  if (!user) {
    console.error('User not authenticated');
    return respond(401, { error: '未授权' });
  }
  
  if (user.role !== 'admin' && user.role !== 'super_admin') {
    console.error('User role not allowed:', user.role);
    return respond(403, { error: '需要管理员权限' });
  }

  const { id } = params;
  console.log('Deleting material with id:', id);

  const { error } = await supabase
    .from('materials')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Delete material error:', error);
    // 处理外键约束错误
    if (error.message && error.message.includes('foreign key constraint')) {
      return respond(400, { error: '无法删除该物料，存在引用该物料的领用或退料记录' });
    }
    return respond(500, { error: error.message });
  }
  
  console.log('Material deleted successfully, id:', id);
  return respond(200, { success: true, message: '物料已删除' });
};

// 更新物料库存
const handleUpdateMaterialQuantity = async (user, params, body) => {
  if (user.role !== 'admin' && user.role !== 'super_admin') {
    return respond(403, { error: '需要管理员权限' });
  }

  const { id } = params;
  const { quantity } = body;

  const { data: material, error } = await supabase
    .from('materials')
    .update({
      quantity: parseFloat(quantity),
      updated_by: user.id
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return respond(500, { error: error.message });
  return respond(200, material);
};

// 导入物料
const handleImportMaterials = async (user, body) => {
  console.log('handleImportMaterials called, user:', user?.username, 'role:', user?.role);
  
  if (!user) {
    console.error('User not authenticated');
    return respond(401, { error: '未授权' });
  }
  
  if (user.role !== 'admin' && user.role !== 'super_admin') {
    console.error('User role not allowed:', user.role);
    return respond(403, { error: '需要管理员权限' });
  }

  const { base64Data } = body;

  if (!base64Data) {
    console.error('base64Data is empty');
    return respond(400, { error: '请上传Excel文件' });
  }

  try {
    console.log('Parsing Excel file...');
    const buffer = Buffer.from(base64Data, 'base64');
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(worksheet);

    if (!data || data.length === 0) {
      console.error('Excel file has no data');
      return respond(400, { error: 'Excel文件中没有数据' });
    }

    console.log('Excel data loaded, rows:', data.length);

    const materials = data.map((item, index) => ({
      code: item['物料编码'] || item['code'] || `TEMP_${Date.now()}_${index}`,
      name: item['物料名称'] || item['name'] || '',
      spec: item['物料规格'] || item['spec'] || '',
      quantity: parseFloat(item['现有数量'] || item['quantity'] || 0),
      max_quantity: parseFloat(item['库存峰值'] || item['max_quantity'] || 0),
      unit: item['单位'] || item['unit'] || '',
      location: item['货架库位'] || item['location'] || '',
      warning_value: parseFloat(item['预警值'] || item['warning_value'] || 0),
      created_by: user.id,
      updated_by: user.id,
      updated_at: new Date().toISOString()
    })).filter(m => m.name && m.code);

    if (materials.length === 0) {
      console.error('No valid material data after filtering');
      return respond(400, { error: '没有有效的物料数据' });
    }

    console.log('Valid materials after filtering:', materials.length);

    // 去重：如果存在重复的物料编码，保留最后一条
    const seenCodes = new Set();
    const uniqueMaterials = [];
    for (let i = materials.length - 1; i >= 0; i--) {
      const m = materials[i];
      if (!seenCodes.has(m.code)) {
        seenCodes.add(m.code);
        uniqueMaterials.unshift(m);
      }
    }

    console.log('Unique materials after deduplication:', uniqueMaterials.length);

    // 使用 upsert：如果物料编码已存在则更新，否则插入
    console.log('Starting upsert operation...');
    const { data: result, error } = await supabase
      .from('materials')
      .upsert(uniqueMaterials, {
        onConflict: ['code'],
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      console.error('Supabase upsert error:', error);
      return respond(500, { error: error.message });
    }
    
    console.log('Upsert successful, count:', result?.length);
    return respond(200, { success: true, count: result.length, data: result });
  } catch (error) {
    console.error('Import materials error:', error);
    return respond(500, { error: error.message });
  }
};

// 批量更新库存
const handleBatchUpdateQuantity = async (user, body) => {
  console.log('handleBatchUpdateQuantity called, user:', user?.username, 'role:', user?.role);
  
  if (!user) {
    console.error('User not authenticated');
    return respond(401, { error: '未授权' });
  }
  
  if (user.role !== 'admin' && user.role !== 'super_admin') {
    console.error('User role not allowed:', user.role);
    return respond(403, { error: '需要管理员权限' });
  }

  const { base64Data } = body;

  if (!base64Data) {
    console.error('base64Data is empty');
    return respond(400, { error: '请上传Excel文件' });
  }

  try {
    console.log('Parsing Excel file for batch update...');
    const buffer = Buffer.from(base64Data, 'base64');
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(worksheet);

    if (!data || data.length === 0) {
      console.error('Excel file has no data');
      return respond(400, { error: 'Excel文件中没有数据' });
    }

    console.log('Excel data loaded, rows:', data.length);

    let successCount = 0;
    let failCount = 0;
    const updatedMaterials = [];

    for (const item of data) {
      const code = item['物料编码'] || item['code'] || '';
      const quantity = parseFloat(item['现有数量'] || item['quantity'] || item['数量']);
      const warningValue = parseFloat(item['预警值'] || item['warning_value']);

      // 必须有物料编码
      if (!code) {
        failCount++;
        continue;
      }

      // 构建更新对象（至少需要数量或预警值）
      const updateData = {
        updated_by: user.id,
        updated_at: new Date().toISOString()
      };

      // 数量是必需的，如果没有则跳过
      if (!isNaN(quantity)) {
        updateData.quantity = quantity;
      } else {
        failCount++;
        continue;
      }

      // 预警值是可选的
      if (!isNaN(warningValue)) {
        updateData.warning_value = warningValue;
      }

      const { error } = await supabase
        .from('materials')
        .update(updateData)
        .eq('code', code);

      if (error) {
        console.error('Update quantity error for code:', code, error);
        failCount++;
      } else {
        successCount++;
        updatedMaterials.push({ code, quantity, warning_value: warningValue });
      }
    }

    console.log('Batch update completed:', successCount, 'success,', failCount, 'failed');
    return respond(200, { 
      success: true, 
      message: `成功更新 ${successCount} 条记录，失败 ${failCount} 条记录`,
      updatedCount: successCount,
      failedCount: failCount
    });
  } catch (error) {
    console.error('Batch update quantity error:', error);
    return respond(500, { error: error.message });
  }
};

// 导出物料
const handleExportMaterials = async (user, query) => {
  try {
    const { status } = query;
    console.log('Export materials called with status:', status);

    let supabaseQuery = supabase.from('materials').select('*');
  
    // 先获取所有数据，在JS中处理状态筛选
    if (status === 'shortage') {
      // 库存不足的情况可以直接查询
      supabaseQuery = supabaseQuery.lte('quantity', 0);
    }

    const { data: materials, error } = await supabaseQuery.order('code', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      return respond(500, { error: error.message });
    }
  
    // 在JS中进行状态筛选
    let filteredMaterials = materials;
    if (status && ['normal', 'warning'].includes(status)) {
      filteredMaterials = materials.filter(m => {
        if (status === 'normal') {
          return m.quantity > (m.warning_value || 0);
        } else if (status === 'warning') {
          return m.quantity <= (m.warning_value || 0) && m.quantity > 0;
        }
        return true;
      });
    }

    const worksheetData = filteredMaterials.map(m => ({
      '物料编码': m.code,
      '物料名称': m.name,
      '物料规格': m.spec,
      '现有数量': m.quantity,
      '库存峰值': m.max_quantity || 0,
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

    console.log('Export successful, buffer length:', buffer.length);
    
    return respond(200, {
      success: true,
      data: buffer.toString('base64'),
      filename: `辅料信息_${new Date().toISOString().split('T')[0]}.xlsx`
    });
  } catch (error) {
    console.error('Export materials error:', error);
    return respond(500, { error: error.message });
  }
};

// 获取领用记录
const handleGetUsageRecords = async (user, query) => {
  const { contractNumber, projectName, materialName, dateStart, dateEnd, page = 1, limit = 10 } = query;

  let supabaseQuery = supabase.from('usage_records').select('*, materials(code, name, spec, unit)', { count: 'exact' });

  if (contractNumber) supabaseQuery = supabaseQuery.ilike('contract_number', `%${contractNumber}%`);
  if (projectName) supabaseQuery = supabaseQuery.ilike('project_name', `%${projectName}%`);
  if (materialName) supabaseQuery = supabaseQuery.ilike('material_name', `%${materialName}%`);
  if (dateStart) supabaseQuery = supabaseQuery.gte('date', dateStart);
  if (dateEnd) supabaseQuery = supabaseQuery.lte('date', dateEnd);

  supabaseQuery = supabaseQuery.order('date', { ascending: false });

  let { data: records, count, error } = await supabaseQuery
    .range((page - 1) * limit, page * limit - 1);

  if (error) return respond(500, { error: error.message });

  // 关联查询创建者姓名
  if (records && records.length > 0) {
    const userIds = [...new Set(records.filter(r => r.created_by).map(r => r.created_by))];
    
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, name')
        .in('id', userIds);
      
      const userMap = {};
      users.forEach(u => { userMap[u.id] = u.name; });
      
      records = records.map(r => ({
        ...r,
        created_by_name: userMap[r.created_by] || '-'
      }));
    } else {
      records = records.map(r => ({
        ...r,
        created_by_name: '-'
      }));
    }
  }

  return respond(200, {
    data: records,
    total: count,
    page: parseInt(page),
    limit: parseInt(limit)
  });
};

// 获取领用统计
const handleGetUsageStats = async (user) => {
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

  return respond(200, {
    today: todayCount || 0,
    week: weekCount || 0,
    month: monthCount || 0,
    total: totalCount || 0
  });
};

// 创建领用记录
const handleCreateUsageRecord = async (user, body) => {
  if (user.role !== 'admin' && user.role !== 'super_admin') {
    return respond(403, { error: '需要管理员权限' });
  }

  const { recordType, record_no, batch_id, contractNumber, projectName, materialId, materialCode, materialName, materialSpec, materialUnit, quantity, userName, date, remark } = body;

  if (!contractNumber || !projectName || !materialId || quantity === undefined || !userName) {
    return respond(400, { error: '必填字段不能为空' });
  }

  // 使用当前时间
  const recordDate = new Date().toISOString();

  const { data: record, error: recordError } = await supabase
    .from('usage_records')
    .insert({
      record_type: recordType,
      record_no: record_no,
      batch_id: batch_id,
      contract_number: contractNumber,
      project_name: projectName,
      material_id: parseInt(materialId),
      material_code: materialCode,
      material_name: materialName,
      material_spec: materialSpec,
      material_unit: materialUnit,
      quantity: parseFloat(quantity),
      user_name: userName,
      date: recordDate,
      remark: remark || '',
      created_by: user.id
    })
    .select()
    .single();

  if (recordError) return respond(500, { error: recordError.message });

  // 更新物料库存
  const qty = parseFloat(quantity);
  const matId = parseInt(materialId);
  
  if (recordType === 'usage') {
    // 领料：减少库存
    const { data: material, error: fetchError } = await supabase
      .from('materials')
      .select('quantity')
      .eq('id', matId)
      .single();
    
    if (!fetchError && material) {
      const newQuantity = parseFloat(material.quantity) - qty;
      const { error: updateError } = await supabase
        .from('materials')
        .update({ 
          quantity: newQuantity,
          updated_by: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', matId);
      
      if (updateError) {
        console.error('更新库存失败:', updateError);
      }
    }
  } else {
    // 退料：增加库存
    const { data: material, error: fetchError } = await supabase
      .from('materials')
      .select('quantity')
      .eq('id', matId)
      .single();
    
    if (!fetchError && material) {
      const newQuantity = parseFloat(material.quantity) + qty;
      const { error: updateError } = await supabase
        .from('materials')
        .update({ 
          quantity: newQuantity,
          updated_by: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', matId);
      
      if (updateError) {
        console.error('更新库存失败:', updateError);
      }
    }
  }

  return respond(201, record);
};

// 更新领用记录
const handleUpdateUsageRecord = async (user, params, body) => {
  if (user.role !== 'admin' && user.role !== 'super_admin') {
    return respond(403, { error: '需要管理员权限' });
  }

  const { id } = params;
  const { recordType, contractNumber, projectName, materialId, materialCode, materialName, materialSpec, materialUnit, quantity, userName, date, remark } = body;

  const { data: oldRecord, error: fetchError } = await supabase
    .from('usage_records')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError) return respond(500, { error: fetchError.message });

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
      updated_by: user.id
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return respond(500, { error: error.message });

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

  return respond(200, record);
};

// 删除领用记录
const handleDeleteUsageRecord = async (user, params) => {
  console.log('handleDeleteUsageRecord called, user:', user?.username, 'role:', user?.role);
  
  if (!user) {
    console.error('User not authenticated');
    return respond(401, { error: '未授权' });
  }
  
  if (user.role !== 'super_admin') {
    console.error('User role not allowed:', user.role);
    return respond(403, { error: '需要超级管理员权限' });
  }

  const { id } = params;
  console.log('Deleting usage record with id:', id);

  const { data: record, error: fetchError } = await supabase
    .from('usage_records')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError) {
    console.error('Fetch usage record error:', fetchError);
    // 处理记录不存在的情况
    if (fetchError.message && fetchError.message.includes('Cannot coerce')) {
      return respond(404, { error: '记录不存在' });
    }
    return respond(500, { error: fetchError.message });
  }
  
  if (!record) {
    console.error('Usage record not found');
    return respond(404, { error: '记录不存在' });
  }

  // 删除前恢复库存
  const matId = record.material_id;
  const qty = parseFloat(record.quantity);
  
  if (record.record_type === 'usage') {
    // 删除领料记录：恢复库存
    const { data: material, error: matError } = await supabase
      .from('materials')
      .select('quantity')
      .eq('id', matId)
      .single();
    
    if (!matError && material) {
      const newQuantity = parseFloat(material.quantity) + qty;
      await supabase
        .from('materials')
        .update({ 
          quantity: newQuantity,
          updated_by: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', matId);
    }
  } else {
    // 删除退料记录：减少库存
    const { data: material, error: matError } = await supabase
      .from('materials')
      .select('quantity')
      .eq('id', matId)
      .single();
    
    if (!matError && material) {
      const newQuantity = parseFloat(material.quantity) - qty;
      await supabase
        .from('materials')
        .update({ 
          quantity: newQuantity,
          updated_by: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', matId);
    }
  }

  const { error } = await supabase
    .from('usage_records')
    .delete()
    .eq('id', id);

  if (error) return respond(500, { error: error.message });
  return respond(200, { success: true, message: '领用记录已删除' });
};

// 格式化日期函数
function formatDateForExport(dateString) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  
  // 检查是否需要添加Z后缀来正确处理UTC时间
  let utcDate;
  if (dateString.includes('T') && !dateString.includes('Z')) {
    utcDate = new Date(dateString + 'Z');
  } else {
    utcDate = date;
  }
  
  return `${utcDate.getFullYear()}-${String(utcDate.getMonth() + 1).padStart(2, '0')}-${String(utcDate.getDate()).padStart(2, '0')} ${String(utcDate.getHours()).padStart(2, '0')}:${String(utcDate.getMinutes()).padStart(2, '0')}:${String(utcDate.getSeconds()).padStart(2, '0')}`;
}

// 导出领用记录
const handleExportUsageRecords = async (user, query) => {
  const { dateStart, dateEnd } = query;

  let supabaseQuery = supabase.from('usage_records').select('*');

  if (dateStart) supabaseQuery = supabaseQuery.gte('date', dateStart);
  if (dateEnd) supabaseQuery = supabaseQuery.lte('date', dateEnd);

  const { data: records, error } = await supabaseQuery.order('date', { ascending: false });

  if (error) return respond(500, { error: error.message });

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
    '日期': formatDateForExport(r.created_at || r.date),
    '备注': r.remark,
    '操作人': r.created_by
  }));

  const worksheet = xlsx.utils.json_to_sheet(worksheetData);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, '领用记录');

  const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=领用记录_${new Date().toISOString().split('T')[0]}.xlsx`,
      'Access-Control-Allow-Origin': '*'
    },
    body: buffer.toString('base64'),
    isBase64Encoded: true
  };
};

// 创建操作日志表（如果不存在）
const ensureLogTable = async () => {
  try {
    const { data, error } = await supabase.from('operation_logs').select('id').limit(1);
    if (error && error.code === '42P01') {
      console.log('Creating operation_logs table...');
    }
  } catch (err) {
    console.error('ensureLogTable error:', err);
  }
};

// 创建操作日志（使用服务角色绕过行级安全）
const handleCreateOperationLog = async (user, body) => {
  await ensureLogTable();
  
  const { type, fileName, details, success, message } = body;
  
  let { data: log, error } = await supabaseService
    .from('operation_logs')
    .insert({
      type,
      file_name: fileName,
      details: details ? JSON.stringify(details) : null,
      success,
      message,
      operator_id: user.id,
      operator_name: user.name || user.username,
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  // 如果服务角色客户端失败，尝试使用常规客户端
  if (error && supabaseService !== supabase) {
    console.warn('Service role client failed, trying regular client:', error.message);
    ({ data: log, error } = await supabase
      .from('operation_logs')
      .insert({
        type,
        file_name: fileName,
        details: details ? JSON.stringify(details) : null,
        success,
        message,
        operator_id: user.id,
        operator_name: user.name || user.username,
        created_at: new Date().toISOString()
      })
      .select()
      .single());
  }

  if (error) return respond(500, { error: error.message });
  return respond(201, log);
};

// 获取操作日志列表（使用服务角色绕过行级安全）
const handleGetOperationLogs = async (user, query) => {
  await ensureLogTable();
  
  const { page = 1, limit = 20 } = query;
  
  let { data: logs, count, error } = await supabaseService
    .from('operation_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  // 如果服务角色客户端失败，尝试使用常规客户端
  if (error && supabaseService !== supabase) {
    console.warn('Service role client failed, trying regular client:', error.message);
    ({ data: logs, count, error } = await supabase
      .from('operation_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1));
  }

  if (error) return respond(500, { error: error.message });
  
  const parsedLogs = logs.map(log => ({
    ...log,
    details: log.details ? JSON.parse(log.details) : null
  }));
  
  return respond(200, {
    data: parsedLogs,
    total: count,
    page: parseInt(page),
    limit: parseInt(limit)
  });
};

// 删除操作日志（使用服务角色绕过行级安全）
const handleDeleteOperationLog = async (user, params) => {
  if (user.role !== 'super_admin') {
    return respond(403, { error: '需要超级管理员权限' });
  }
  
  const { id } = params;
  
  let { error } = await supabaseService
    .from('operation_logs')
    .delete()
    .eq('id', id);

  // 如果服务角色客户端失败，尝试使用常规客户端
  if (error && supabaseService !== supabase) {
    console.warn('Service role client failed, trying regular client:', error.message);
    ({ error } = await supabase
      .from('operation_logs')
      .delete()
      .eq('id', id));
  }

  if (error) return respond(500, { error: error.message });
  return respond(200, { success: true, message: '日志已删除' });
};

// 清空操作日志（使用服务角色绕过行级安全）
const handleClearOperationLogs = async (user) => {
  if (user.role !== 'super_admin') {
    return respond(403, { error: '需要超级管理员权限' });
  }
  
  let { error } = await supabaseService
    .from('operation_logs')
    .delete();

  // 如果服务角色客户端失败，尝试使用常规客户端
  if (error && supabaseService !== supabase) {
    console.warn('Service role client failed, trying regular client:', error.message);
    ({ error } = await supabase
      .from('operation_logs')
      .delete());
  }

  if (error) return respond(500, { error: error.message });
  return respond(200, { success: true, message: '所有日志已清空' });
};

// 健康检查
const handleHealth = async () => {
  try {
    const { data, error } = await supabase.from('users').select('id').limit(1);
    if (error) {
      return respond(200, { 
        status: 'partial', 
        timestamp: new Date().toISOString(),
        dbConnected: false,
        error: error.message 
      });
    }
    return respond(200, { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      dbConnected: true,
      hasUsers: data && data.length > 0 
    });
  } catch (err) {
    return respond(500, { 
      status: 'error', 
      timestamp: new Date().toISOString(),
      error: err.message 
    });
  }
};

// 主处理程序
exports.handler = async (event, context) => {
  const { httpMethod, path, headers, queryStringParameters, pathParameters, body } = event;

  // 处理 OPTIONS 请求
  if (httpMethod === 'OPTIONS') {
    return handleOptions();
  }

  // 解析路径
  const pathParts = path.replace(/^\/api\//, '').split('/');
  const resource = pathParts[0];
  const id = pathParts[1];

  // 解析请求体
  let parsedBody = {};
  if (body) {
    try {
      // 处理 base64 编码的请求体（包含中文时会被 base64 编码）
      if (event.isBase64Encoded) {
        const decodedBody = Buffer.from(body, 'base64').toString('utf-8');
        parsedBody = JSON.parse(decodedBody);
      } else {
        parsedBody = JSON.parse(body);
      }
    } catch (error) {
      console.error('Error parsing request body:', error);
      parsedBody = {};
    }
  }

  // 获取 token
  const authHeader = headers.authorization || headers.Authorization;
  const token = authHeader ? authHeader.split(' ')[1] : null;

  // 登录接口不需要认证
  if (resource === 'login' && httpMethod === 'POST') {
    return handleLogin(parsedBody);
  }

  // 健康检查不需要认证
  if (resource === 'health' && httpMethod === 'GET') {
    return handleHealth();
  }

  // 公开接口：不需要认证即可访问
  if (resource === 'materials' && httpMethod === 'GET') {
    if (pathParts[1] === 'export') {
      return handleExportMaterials(null, queryStringParameters);
    }
    return handleGetMaterials(null, queryStringParameters);
  }
  
  if (resource === 'materials' && id && httpMethod === 'GET') {
    return handleGetMaterial(null, { id });
  }
  
  if (resource === 'usage' && httpMethod === 'GET' && !pathParts[1]) {
    return handleGetUsageRecords(null, queryStringParameters);
  }
  
  if (resource === 'usage' && httpMethod === 'GET' && pathParts[1] === 'stats') {
    return handleGetUsageStats(null);
  }
  
  if (resource === 'usage' && httpMethod === 'GET' && pathParts[1] === 'export') {
    return handleExportUsageRecords(null, queryStringParameters);
  }
  
  // 验证 token（修改操作需要认证）
  const user = await verifyToken(token);
  if (!user) {
    return respond(401, { error: '未授权' });
  }

  // 路由处理
  switch (resource) {
    case 'user':
      if (httpMethod === 'GET') return handleGetUser(user);
      break;
    case 'users':
      if (httpMethod === 'GET') return handleGetUsers(user);
      if (httpMethod === 'POST') return handleCreateUser(user, parsedBody);
      if (id && httpMethod === 'PUT') {
        if (pathParts[2] === 'password') return handleChangePassword(user, { id }, parsedBody);
        return handleUpdateUser(user, { id }, parsedBody);
      }
      if (id && httpMethod === 'DELETE') return handleDeleteUser(user, { id });
      break;
    case 'materials':
      if (httpMethod === 'POST') {
        if (pathParts[1] === 'import') return handleImportMaterials(user, parsedBody);
        if (pathParts[1] === 'update-quantity') return handleBatchUpdateQuantity(user, parsedBody);
        return handleCreateMaterial(user, parsedBody);
      }
      if (id && httpMethod === 'PUT') {
        if (pathParts[2] === 'quantity') return handleUpdateMaterialQuantity(user, { id }, parsedBody);
        return handleUpdateMaterial(user, { id }, parsedBody);
      }
      if (id && httpMethod === 'DELETE') return handleDeleteMaterial(user, { id });
      break;
    case 'usage':
      if (httpMethod === 'GET') {
        if (pathParts[1] === 'stats') return handleGetUsageStats(user);
      }
      if (httpMethod === 'POST') return handleCreateUsageRecord(user, parsedBody);
      if (id && httpMethod === 'PUT') return handleUpdateUsageRecord(user, { id }, parsedBody);
      if (id && httpMethod === 'DELETE') return handleDeleteUsageRecord(user, { id });
      break;
    case 'operation-logs':
      if (httpMethod === 'GET') return handleGetOperationLogs(user, queryStringParameters);
      if (httpMethod === 'POST') return handleCreateOperationLog(user, parsedBody);
      if (id && httpMethod === 'DELETE') return handleDeleteOperationLog(user, { id });
      if (!id && httpMethod === 'DELETE') return handleClearOperationLogs(user);
      break;
  }

  return respond(404, { error: 'Not found' });
};
