// API配置文件
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

// API请求封装
async function apiRequest(method, endpoint, data = null, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    method,
    headers,
    ...options
  };

  if (data) {
    config.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(url, config);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || '请求失败');
    }

    return result;
  } catch (error) {
    // 如果token过期，清除本地存储
    if (error.message.includes('token') || error.message.includes('登录')) {
      removeToken();
      removeCurrentUser();
    }
    throw error;
  }
}

// 登录
async function login(username, password) {
  const result = await apiRequest('POST', '/login', { username, password });
  if (result.success) {
    setToken(result.token);
    setCurrentUser(result.user);
  }
  return result;
}

// 登出
function logout() {
  removeToken();
  removeCurrentUser();
}

// 获取当前用户信息
async function getUserInfo() {
  return apiRequest('GET', '/user');
}

// 用户管理API
const UserAPI = {
  getAll: () => apiRequest('GET', '/users'),
  create: (userData) => apiRequest('POST', '/users', userData),
  update: (id, userData) => apiRequest('PUT', `/users/${id}`, userData),
  delete: (id) => apiRequest('DELETE', `/users/${id}`),
  changePassword: (id, passwordData) => apiRequest('PUT', `/users/${id}/password`, passwordData)
};

// 物料管理API
const MaterialAPI = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest('GET', `/materials${query ? '?' + query : ''}`);
  },
  get: (id) => apiRequest('GET', `/materials/${id}`),
  create: (data) => apiRequest('POST', '/materials', data),
  update: (id, data) => apiRequest('PUT', `/materials/${id}`, data),
  delete: (id) => apiRequest('DELETE', `/materials/${id}`),
  updateQuantity: (id, quantity) => apiRequest('PUT', `/materials/${id}/quantity`, { quantity }),
  import: (base64Data) => apiRequest('POST', '/materials/import', { base64Data }),
  export: (status) => {
    const token = getToken();
    return fetch(`${API_BASE_URL}/materials/export${status ? '?status=' + status : ''}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }
};

// 领用记录API
const UsageAPI = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest('GET', `/usage${query ? '?' + query : ''}`);
  },
  getStats: () => apiRequest('GET', '/usage/stats'),
  create: (data) => apiRequest('POST', '/usage', data),
  update: (id, data) => apiRequest('PUT', `/usage/${id}`, data),
  delete: (id) => apiRequest('DELETE', `/usage/${id}`),
  export: (dateStart, dateEnd) => {
    const token = getToken();
    let url = `${API_BASE_URL}/usage/export`;
    const params = [];
    if (dateStart) params.push(`dateStart=${dateStart}`);
    if (dateEnd) params.push(`dateEnd=${dateEnd}`);
    if (params.length) url += '?' + params.join('&');
    return fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }
};

// 健康检查
async function healthCheck() {
  return apiRequest('GET', '/health');
}

// 初始化数据库（仅首次使用）
async function initDatabase(adminPassword) {
  return apiRequest('POST', '/init', { adminPassword });
}

// 导出API
const API = {
  login,
  logout,
  getUserInfo,
  User: UserAPI,
  Material: MaterialAPI,
  Usage: UsageAPI,
  healthCheck,
  initDatabase,
  isLoggedIn,
  getCurrentUser
};

export default API;
