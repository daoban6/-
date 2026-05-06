// API配置文件 - 通过后端API访问数据
const API_BASE_URL = '/api';

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

// 构建请求头
function getHeaders() {
  const headers = {
    'Content-Type': 'application/json'
  };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// 登录 - 调用后端API进行验证
async function login(username, password) {
  try {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ username, password })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || '登录失败');
    }

    setToken(result.token);
    setCurrentUser({
      id: result.user.id,
      username: result.user.username,
      name: result.user.name || result.user.username,
      role: result.user.role,
      department: result.user.department
    });

    return { success: true, user: getCurrentUser(), token: result.token };
  } catch (error) {
    throw new Error(error.message);
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
    const response = await fetch(`${API_BASE_URL}/users`, {
      method: 'GET',
      headers: getHeaders()
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || '获取用户列表失败');
    }
    return { data: Array.isArray(result) ? result : [] };
  },
  create: async (userData) => {
    const response = await fetch(`${API_BASE_URL}/users`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(userData)
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || '创建用户失败');
    }
    return { data: result };
  },
  update: async (id, userData) => {
    const response = await fetch(`${API_BASE_URL}/users/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(userData)
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || '更新用户失败');
    }
    return { data: result };
  },
  delete: async (id) => {
    const response = await fetch(`${API_BASE_URL}/users/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || '删除用户失败');
    }
    return { success: true };
  },
  changePassword: async (id, passwordData) => {
    const response = await fetch(`${API_BASE_URL}/users/${id}/password`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(passwordData)
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || '修改密码失败');
    }
    return { data: result };
  }
};

// 物料管理API
const MaterialAPI = {
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/materials?${queryString}`, {
      method: 'GET',
      headers: getHeaders()
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || '获取物料列表失败');
    }
    return result;
  },
  get: async (id) => {
    const response = await fetch(`${API_BASE_URL}/materials/${id}`, {
      method: 'GET',
      headers: getHeaders()
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || '获取物料失败');
    }
    return result;
  },
  create: async (data) => {
    const response = await fetch(`${API_BASE_URL}/materials`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || '创建物料失败');
    }
    return result;
  },
  update: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/materials/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || '更新物料失败');
    }
    return result;
  },
  delete: async (id) => {
    const response = await fetch(`${API_BASE_URL}/materials/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || '删除物料失败');
    }
    return { success: true };
  },
  updateQuantity: async (id, quantity) => {
    const response = await fetch(`${API_BASE_URL}/materials/${id}/quantity`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ quantity })
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || '更新库存失败');
    }
    return result;
  },
  export: async (status) => {
    const response = await fetch(`${API_BASE_URL}/materials/export${status ? `?status=${status}` : ''}`, {
      method: 'GET',
      headers: getHeaders()
    });
    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || '导出失败');
    }
    return response.blob();
  },
  import: async (base64Data) => {
    const response = await fetch(`${API_BASE_URL}/materials/import`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ base64Data })
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || '导入失败');
    }
    return result;
  }
};

// 领用记录API
const UsageAPI = {
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/usage?${queryString}`, {
      method: 'GET',
      headers: getHeaders()
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || '获取领用记录失败');
    }
    return result;
  },
  getStats: async () => {
    const response = await fetch(`${API_BASE_URL}/usage/stats`, {
      method: 'GET',
      headers: getHeaders()
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || '获取统计数据失败');
    }
    return result;
  },
  create: async (data) => {
    const response = await fetch(`${API_BASE_URL}/usage`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || '创建领用记录失败');
    }
    return result;
  },
  update: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/usage/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || '更新领用记录失败');
    }
    return result;
  },
  delete: async (id) => {
    const response = await fetch(`${API_BASE_URL}/usage/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || '删除领用记录失败');
    }
    return { success: true };
  },
  export: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/usage/export?${queryString}`, {
      method: 'GET',
      headers: getHeaders()
    });
    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || '导出失败');
    }
    return response.blob();
  }
};

// 导出API对象
const API = {
  login,
  logout,
  isLoggedIn,
  getToken,
  setToken,
  getCurrentUser,
  setCurrentUser,
  User: UserAPI,
  Material: MaterialAPI,
  Usage: UsageAPI
};

export default API;