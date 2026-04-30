// API配置文件 - 直接连接Supabase
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.43.4/+esm';

// Supabase配置
const SUPABASE_URL = 'https://vuvchznwbjycszerhkre.supabase.co';
const SUPABASE_KEY = 'sb_publishable_VAahD_wXv8EHQZKu_Jit9A_guZ6066w';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// JWT密钥（用于本地token验证）
const JWT_SECRET = 'my-secret-key-12345';

// 获取token
function getToken() {
  return localStorage.getItem('token');
}

// 设置token
function setToken(token) {
  localStorage.setItem('token', token);
}

// 移除token
function removeToken() {
  localStorage.removeItem('token');
}

// 获取当前用户
function getCurrentUser() {
  const userStr = localStorage.getItem('currentUser');
  return userStr ? JSON.parse(userStr) : null;
}

// 设置当前用户
function setCurrentUser(user) {
  localStorage.setItem('currentUser', JSON.stringify(user));
}

// 移除当前用户
function removeCurrentUser() {
  localStorage.removeItem('currentUser');
}

// 检查是否已登录
function isLoggedIn() {
  return !!getToken();
}

// 登录
async function login(username, password) {
  try {
    // 在数据库中查找用户
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !user) {
      throw new Error('用户名或密码错误');
    }

    // 验证密码（比较数据库中的密码）
    if (password !== user.password) {
      throw new Error('用户名或密码错误');
    }

    // 生成JWT token
    const token = generateToken(user.id);
    setToken(token);
    setCurrentUser({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      department: user.department
    });

    return { success: true, user: getCurrentUser(), token };
  } catch (error) {
    throw new Error(error.message);
  }
}

// 生成JWT token
function generateToken(userId) {
  const payload = { userId, exp: Date.now() + 24 * 60 * 60 * 1000 };
  return btoa(JSON.stringify(payload));
}

// 验证token
function verifyToken(token) {
  try {
    const payload = JSON.parse(atob(token));
    return payload.userId;
  } catch {
    return null;
  }
}

// 登出
function logout() {
  removeToken();
  removeCurrentUser();
}

// 用户管理API
const UserAPI = {
  getAll: async () => {
    const { data, error } = await supabase.from('users').select('*');
    if (error) throw error;
    return { data: Array.isArray(data) ? data : [] };
  },
  create: async (userData) => {
    const { data, error } = await supabase
      .from('users')
      .insert({
        username: userData.username,
        password: userData.password,
        name: userData.name,
        role: userData.role || 'employee',
        department: userData.department
      })
      .select()
      .single();
    if (error) throw error;
    return { data };
  },
  update: async (id, userData) => {
    const { data, error } = await supabase
      .from('users')
      .update({
        name: userData.name,
        role: userData.role,
        department: userData.department
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return { data };
  },
  delete: async (id) => {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  },
  changePassword: async (id, passwordData) => {
    const { data, error } = await supabase
      .from('users')
      .update({ password: passwordData.newPassword })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return { data };
  }
};

// 物料管理API
const MaterialAPI = {
  getAll: async (params = {}) => {
    let query = supabase.from('materials').select('*', { count: 'exact' });
    
    if (params.status) {
      query = query.eq('status', params.status);
    }
    if (params.search) {
      query = query.or(`code.ilike.%${params.search}%,name.ilike.%${params.search}%,spec.ilike.%${params.search}%`);
    }
    if (params.category) {
      query = query.eq('category', params.category);
    }
    
    const page = parseInt(params.page) || 1;
    const limit = parseInt(params.limit) || 10;
    
    const { data, count, error } = await query
      .order('code', { ascending: true })
      .range((page - 1) * limit, page * limit - 1);
    
    if (error) throw error;
    return { data, total: count, page, limit };
  },
  get: async (id) => {
    const { data, error } = await supabase.from('materials').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },
  create: async (data) => {
    const { data: result, error } = await supabase
      .from('materials')
      .insert({
        code: data.code,
        name: data.name,
        spec: data.spec,
        unit: data.unit,
        quantity: parseFloat(data.quantity) || 0,
        warningValue: parseFloat(data.warning_value) || 0,
        status: 'normal',
        category: data.category,
        location: data.location,
        remark: data.remark
      })
      .select()
      .single();
    if (error) throw error;
    return result;
  },
  update: async (id, data) => {
    const { data: result, error } = await supabase
      .from('materials')
      .update({
        name: data.name,
        spec: data.spec,
        unit: data.unit,
        warningValue: parseFloat(data.warning_value) || 0,
        category: data.category,
        location: data.location,
        remark: data.remark,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return result;
  },
  delete: async (id) => {
    const { error } = await supabase.from('materials').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  },
  updateQuantity: async (id, quantity) => {
    // 获取物料信息
    const { data: material, error: getError } = await supabase
      .from('materials')
      .select('*')
      .eq('id', id)
      .single();
    
    if (getError) throw getError;
    
    const { data: result, error } = await supabase
      .from('materials')
      .update({ 
        quantity: parseFloat(quantity),
        status: calculateStatus(parseFloat(quantity), parseFloat(material.warningValue))
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return result;
  },
  export: async (status) => {
    let query = supabase.from('materials').select('*');
    if (status) {
      query = query.eq('status', status);
    }
    const { data, error } = await query.order('code', { ascending: true });
    if (error) throw error;
    return data;
  },
  import: async (base64Data) => {
    if (!base64Data) {
      throw new Error('请上传Excel文件');
    }

    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const workbook = XLSX.read(bytes, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (!data || data.length === 0) {
      throw new Error('Excel文件中没有数据');
    }

    const materials = data.map((item, index) => ({
      code: item['物料编码'] || item['code'] || item['物料编号'] || `TEMP_${Date.now()}_${index}`,
      name: item['物料名称'] || item['name'] || '',
      spec: item['物料规格'] || item['spec'] || item['规格'] || '',
      quantity: parseFloat(item['现有数量'] || item['quantity'] || item['数量'] || 0),
      unit: item['单位'] || item['unit'] || '',
      location: item['货架库位'] || item['location'] || item['库位'] || '',
      warning_value: parseFloat(item['预警值'] || item['warning_value'] || item['最低库存'] || 0),
      category: item['类别'] || item['category'] || '',
      remark: item['备注'] || item['remark'] || ''
    })).filter(m => m.name && m.code);

    if (materials.length === 0) {
      throw new Error('没有有效的物料数据');
    }

    const { data: inserted, error } = await supabase
      .from('materials')
      .insert(materials)
      .select();

    if (error) throw error;

    return { success: true, count: inserted.length, data: inserted };
  }
};

// 计算库存状态
function calculateStatus(quantity, warningValue) {
  if (quantity <= 0) return 'shortage';
  if (quantity < warningValue) return 'warning';
  return 'normal';
}

// 领用记录API
const UsageAPI = {
  getAll: async (params = {}) => {
    let query = supabase.from('usage_records').select('*', { count: 'exact' });
    
    if (params.contractNumber) {
      query = query.ilike('contract_number', `%${params.contractNumber}%`);
    }
    if (params.projectName) {
      query = query.ilike('project_name', `%${params.projectName}%`);
    }
    if (params.dateStart) {
      query = query.gte('date', params.dateStart);
    }
    if (params.dateEnd) {
      query = query.lte('date', params.dateEnd);
    }
    
    const page = parseInt(params.page) || 1;
    const limit = parseInt(params.limit) || 10;
    
    const { data, count, error } = await query
      .order('date', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    
    if (error) throw error;
    return { data, total: count, page, limit };
  },
  getStats: async () => {
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

    return {
      today: todayCount || 0,
      week: weekCount || 0,
      month: monthCount || 0,
      total: totalCount || 0
    };
  },
  create: async (data) => {
    // 创建领用记录
    const { data: record, error } = await supabase
      .from('usage_records')
      .insert({
        record_type: data.recordType,
        contract_number: data.contractNumber,
        project_name: data.projectName,
        material_id: parseInt(data.materialId),
        material_code: data.materialCode,
        material_name: data.materialName,
        material_spec: data.materialSpec,
        material_unit: data.materialUnit,
        quantity: parseFloat(data.quantity),
        user_name: data.userName,
        date: data.date,
        remark: data.remark || ''
      })
      .select()
      .single();

    if (error) throw error;

    // 更新物料库存
    const { data: material, error: materialError } = await supabase
      .from('materials')
      .select('*')
      .eq('id', parseInt(data.materialId))
      .single();

    if (materialError) throw materialError;

    const newQuantity = data.recordType === 'usage' 
      ? parseFloat(material.quantity) - parseFloat(data.quantity)
      : parseFloat(material.quantity) + parseFloat(data.quantity);

    await supabase
      .from('materials')
      .update({
        quantity: newQuantity,
        status: calculateStatus(newQuantity, parseFloat(material.warningValue))
      })
      .eq('id', parseInt(data.materialId));

    return record;
  },
  delete: async (id) => {
    // 获取原记录
    const { data: record, error: fetchError } = await supabase
      .from('usage_records')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // 恢复物料库存
    const { data: material, error: materialError } = await supabase
      .from('materials')
      .select('*')
      .eq('id', record.material_id)
      .single();

    if (materialError) throw materialError;

    const newQuantity = record.record_type === 'usage'
      ? parseFloat(material.quantity) + parseFloat(record.quantity)
      : parseFloat(material.quantity) - parseFloat(record.quantity);

    await supabase
      .from('materials')
      .update({
        quantity: newQuantity,
        status: calculateStatus(newQuantity, parseFloat(material.warningValue))
      })
      .eq('id', record.material_id);

    // 删除记录
    const { error } = await supabase.from('usage_records').delete().eq('id', id);
    if (error) throw error;

    return { success: true };
  },
  export: async (params = {}) => {
    let query = supabase.from('usage_records').select('*');
    
    if (params.recordType) {
      query = query.eq('record_type', params.recordType);
    }
    if (params.dateStart) {
      query = query.gte('date', params.dateStart);
    }
    if (params.dateEnd) {
      query = query.lte('date', params.dateEnd);
    }
    
    const { data, error } = await query.order('date', { ascending: false });
    if (error) throw error;
    return data;
  }
};

// 健康检查
async function healthCheck() {
  try {
    const { data, error } = await supabase.from('users').select('id').limit(1);
    if (error) throw error;
    return { status: 'ok' };
  } catch {
    return { status: 'error' };
  }
}

// 导出API
const API = {
  login,
  logout,
  User: UserAPI,
  Material: MaterialAPI,
  Usage: UsageAPI,
  healthCheck,
  isLoggedIn,
  getCurrentUser
};

export default API;