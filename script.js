// 辅料管理看板 JavaScript - 对接云端API版本

import API from './api-config.js';

// 全局变量
let materialData = []; // 原始物料数据
let filteredData = []; // 筛选后的物料数据
let currentPage = 1; // 当前页码
const itemsPerPage = 10; // 每页显示的记录数
let editingMaterialId = null; // 当前编辑的物料ID
let isLoggedIn = false; // 登录状态
let currentUser = null; // 当前登录用户
let users = []; // 用户列表

// DOM元素
const codeSearch = document.getElementById('codeSearch');
const nameSearch = document.getElementById('nameSearch');
const specSearch = document.getElementById('specSearch');
const searchBtn = document.getElementById('searchBtn');
const resetBtn = document.getElementById('resetBtn');
const emptyResetBtn = document.getElementById('emptyResetBtn');
const materialTableBody = document.getElementById('materialTableBody');
const loading = document.getElementById('loading');
const materialTableContainer = document.getElementById('materialTableContainer');
const emptyData = document.getElementById('emptyData');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const startRange = document.getElementById('startRange');
const endRange = document.getElementById('endRange');
const totalDataCount = document.getElementById('totalDataCount');
const excelFileInput = document.getElementById('excelFileInput');
const quickImportFileInput = document.getElementById('quickImportFileInput');
const importExcelBtn = document.getElementById('importExcelBtn');
const exportExcelBtn = document.getElementById('exportExcelBtn');
const addMaterialBtn = document.getElementById('addMaterialBtn');
const lastUpdateTime = document.getElementById('lastUpdateTime');

// 登录相关DOM元素
const loginModal = document.getElementById('loginModal');
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const cancelLoginBtn = document.getElementById('cancelLoginBtn');
const loginBtn = document.getElementById('loginBtn');

// 统计卡片元素
const totalCount = document.getElementById('totalCount');
const normalStockCount = document.getElementById('normalStockCount');
const warningStockCount = document.getElementById('warningStockCount');
const shortageStockCount = document.getElementById('shortageStockCount');

// 弹窗元素
const materialModal = document.getElementById('materialModal');
const modalTitle = document.getElementById('modalTitle');
const materialForm = document.getElementById('materialForm');
const materialCode = document.getElementById('materialCode');
const materialName = document.getElementById('materialName');
const materialSpec = document.getElementById('materialSpec');
const materialQuantity = document.getElementById('materialQuantity');
const materialUnit = document.getElementById('materialUnit');
const cancelBtn = document.getElementById('cancelBtn');
const confirmBtn = document.getElementById('confirmBtn');

// 初始化函数
async function init() {
    // 隐藏登录模态框
    if (loginModal) loginModal.classList.add('hidden');
    
    // 检查登录状态
    isLoggedIn = API.isLoggedIn();
    currentUser = API.getCurrentUser();
    
    // 加载数据
    await loadData();
    
    // 更新统计信息
    updateStatistics();
    
    // 更新表格
    updateTable();
    
    // 更新最后更新时间
    updateLastUpdateTime();
    
    // 绑定事件
    bindEvents();
    
    // 绑定使用量管理按钮事件
    const usageTrackingBtn = document.getElementById('usageTrackingBtn');
    if (usageTrackingBtn) {
        usageTrackingBtn.addEventListener('click', function() {
            window.location.href = 'usage-tracking.html';
        });
    }
    
    // 初始化登录状态UI
    updateLoginStatusUI();
    
    // 根据登录状态启用或禁用编辑按钮
    if (isLoggedIn) {
        enableEditButtons();
    } else {
        disableEditButtons();
    }

    // 定时刷新数据（每30秒）
    setInterval(async () => {
        if (isLoggedIn) {
            await loadData();
            updateStatistics();
            updateTable();
            updateLastUpdateTime();
        }
    }, 30000);
}

// 加载数据
async function loadData() {
    try {
        showLoading();
        
        const params = {
            page: 1,
            limit: 1000 // 一次性加载所有数据用于本地筛选
        };
        
        const result = await API.Material.getAll(params);
        materialData = result.data || [];
        
        // 更新状态
        materialData.forEach(item => {
            const warningValue = parseFloat(item.warning_value) || 0;
            if (parseFloat(item.quantity) > warningValue) {
                item.status = 'normal';
            } else if (parseFloat(item.quantity) > 0) {
                item.status = 'warning';
            } else {
                item.status = 'shortage';
            }
        });
        
        // 按物料编码排序
        materialData.sort((a, b) => a.code.localeCompare(b.code));
        
        // 初始化筛选数据
        filteredData = [...materialData];
        
        hideLoading();
    } catch (error) {
        hideLoading();
        console.error('加载数据失败:', error);
        if (error.message.includes('token') || error.message.includes('登录')) {
            logout();
        }
    }
}

// 显示加载状态
function showLoading() {
    if (loading) loading.classList.remove('hidden');
    if (materialTableContainer) materialTableContainer.classList.add('hidden');
    if (emptyData) emptyData.classList.add('hidden');
}

// 隐藏加载状态
function hideLoading() {
    if (loading) loading.classList.add('hidden');
    if (materialTableContainer) materialTableContainer.classList.remove('hidden');
}

// 更新统计信息
function updateStatistics() {
    const total = materialData.length;
    const normal = materialData.filter(item => item.status === 'normal').length;
    const warning = materialData.filter(item => item.status === 'warning').length;
    const shortage = materialData.filter(item => item.status === 'shortage').length;
    
    if (totalCount) totalCount.textContent = total;
    if (normalStockCount) normalStockCount.textContent = normal;
    if (warningStockCount) warningStockCount.textContent = warning;
    if (shortageStockCount) shortageStockCount.textContent = shortage;
}

// 更新表格
function updateTable() {
    const maxPage = Math.ceil(filteredData.length / itemsPerPage);
    currentPage = Math.min(currentPage, maxPage);
    
    const start = (currentPage - 1) * itemsPerPage;
    const end = Math.min(start + itemsPerPage, filteredData.length);
    const pageData = filteredData.slice(start, end);
    
    // 更新分页信息
    if (startRange) startRange.textContent = filteredData.length > 0 ? start + 1 : 0;
    if (endRange) endRange.textContent = end;
    if (totalDataCount) totalDataCount.textContent = filteredData.length;
    
    // 更新分页按钮状态
    if (prevPageBtn) prevPageBtn.disabled = currentPage <= 1;
    if (nextPageBtn) nextPageBtn.disabled = currentPage >= maxPage;
    
    // 渲染表格
    renderTable(pageData);
    
    // 显示/隐藏空数据提示
    if (filteredData.length === 0) {
        if (materialTableContainer) materialTableContainer.classList.add('hidden');
        if (emptyData) emptyData.classList.remove('hidden');
    } else {
        if (materialTableContainer) materialTableContainer.classList.remove('hidden');
        if (emptyData) emptyData.classList.add('hidden');
    }
}

// 渲染表格
function renderTable(data) {
    if (!materialTableBody) return;
    
    materialTableBody.innerHTML = '';
    
    if (!data || data.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="8" class="px-6 py-12 text-center text-gray-500">暂无数据</td>';
        materialTableBody.appendChild(tr);
        return;
    }
    
    data.forEach(item => {
        const tr = document.createElement('tr');
        
        const statusClass = item.status === 'normal' ? 'status-normal' : 
                           (item.status === 'warning' ? 'status-warning' : 'status-shortage');
        const statusText = item.status === 'normal' ? '正常' : 
                          (item.status === 'warning' ? '预警' : '不足');
        
        tr.innerHTML = `
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-800">${item.code}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-800">${item.name}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-800 hidden md:table-cell">${item.spec}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-800">${item.quantity}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-800 hidden sm:table-cell">${item.unit}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-800">${item.location || '-'}</td>
            <td class="px-4 py-3 whitespace-nowrap">
                <span class="status-badge ${statusClass}">${statusText}</span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap">
                <div class="flex items-center space-x-1">
                    <button class="edit-btn action-btn" onclick="handleEditClick(${item.id})" title="编辑">
                        <i class="fa fa-edit"></i>
                        <span>编辑</span>
                    </button>
                    <button class="delete-btn action-btn" onclick="handleDeleteClick(${item.id})" title="删除">
                        <i class="fa fa-trash"></i>
                        <span>删除</span>
                    </button>
                </div>
            </td>
        `;
        
        materialTableBody.appendChild(tr);
    });
    
    // 根据登录状态更新按钮状态
    if (!isLoggedIn || (currentUser && currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
        disableEditButtons();
    }
}

// 更新最后更新时间
function updateLastUpdateTime() {
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    if (lastUpdateTime) lastUpdateTime.textContent = formattedDate;
}

// 绑定事件
function bindEvents() {
    // 搜索按钮点击事件
    if (searchBtn) searchBtn.addEventListener('click', performSearch);
    
    // 回车键触发搜索
    if (codeSearch) codeSearch.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') performSearch();
    });
    if (nameSearch) nameSearch.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') performSearch();
    });
    if (specSearch) specSearch.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') performSearch();
    });
    
    // 重置按钮点击事件
    if (resetBtn) resetBtn.addEventListener('click', resetSearch);
    if (emptyResetBtn) emptyResetBtn.addEventListener('click', resetSearch);
    
    // 分页按钮点击事件
    if (prevPageBtn) prevPageBtn.addEventListener('click', function() {
        if (currentPage > 1) {
            currentPage--;
            updateTable();
        }
    });
    if (nextPageBtn) nextPageBtn.addEventListener('click', function() {
        const maxPage = Math.ceil(filteredData.length / itemsPerPage);
        if (currentPage < maxPage) {
            currentPage++;
            updateTable();
        }
    });
    
    // 导入Excel文件事件
    if (excelFileInput) excelFileInput.addEventListener('change', function(e) {
        if (checkPermission('import_excel')) {
            const file = e.target.files[0];
            if (file) importFromExcel(file);
        } else if (!isLoggedIn) {
            openLoginModal();
            excelFileInput.value = '';
        } else {
            showToast('权限不足，无法执行此操作', 'error');
            excelFileInput.value = '';
        }
    });
    
    // 快速更新库存导入事件
    if (quickImportFileInput) quickImportFileInput.addEventListener('change', function(e) {
        if (checkPermission('quick_import')) {
            const file = e.target.files[0];
            if (file) quickImportFromExcel(file);
        } else if (!isLoggedIn) {
            openLoginModal();
            quickImportFileInput.value = '';
        } else {
            showToast('权限不足，无法执行此操作', 'error');
            quickImportFileInput.value = '';
        }
    });
    
    // 导出Excel按钮点击事件
    if (exportExcelBtn) exportExcelBtn.addEventListener('click', function() {
        if (checkPermission('export_excel')) {
            showExportOptionsModal();
        } else if (!isLoggedIn) {
            openLoginModal();
        } else {
            showToast('权限不足，无法执行此操作', 'error');
        }
    });
    
    // 新增辅料按钮点击事件
    if (addMaterialBtn) addMaterialBtn.addEventListener('click', function() {
        if (checkPermission('add_material')) {
            openAddModal();
        } else if (!isLoggedIn) {
            openLoginModal();
        } else {
            showToast('权限不足，无法执行此操作', 'error');
        }
    });
    
    // 弹窗取消按钮点击事件
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    
    // 弹窗确认按钮点击事件
    if (confirmBtn) confirmBtn.addEventListener('click', function() {
        if (materialForm && materialForm.checkValidity()) {
            saveMaterial();
        } else if (materialForm) {
            materialForm.reportValidity();
        }
    });
    
    // 点击弹窗外部关闭弹窗
    if (materialModal) materialModal.addEventListener('click', function(e) {
        if (e.target === materialModal) closeModal();
    });
    
    // 按ESC键关闭弹窗
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && materialModal && !materialModal.classList.contains('hidden')) {
            closeModal();
        }
        if (e.key === 'Escape' && loginModal && !loginModal.classList.contains('hidden')) {
            closeLoginModal();
        }
    });
    
    // 登录按钮点击事件
    if (loginBtn) loginBtn.addEventListener('click', handleLogin);
    
    // 取消登录按钮点击事件
    if (cancelLoginBtn) cancelLoginBtn.addEventListener('click', function() {
        closeLoginModal();
        showToast('已取消登录，可查看但无法修改数据', 'info');
    });
    
    // 登录表单提交事件
    if (loginForm) loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        handleLogin();
    });
    
    // 登录状态按钮点击事件
    const loginStatusBtn = document.getElementById('loginStatusBtn');
    if (loginStatusBtn) {
        loginStatusBtn.addEventListener('click', function() {
            if (isLoggedIn) {
                showLogoutConfirm();
            } else {
                openLoginModal();
            }
        });
    }
    
    // 注册相关事件
    bindRegisterEvents();
    
    // 用户管理按钮点击事件（仅管理员可见）
    const userManagementBtn = document.getElementById('userManagementBtn');
    if (userManagementBtn) {
        userManagementBtn.addEventListener('click', openUserManagementModal);
    }
    
    // 关闭用户管理模态框按钮点击事件
    const closeUserManagementModal = document.getElementById('closeUserManagementModal');
    if (closeUserManagementModal) {
        closeUserManagementModal.addEventListener('click', closeUserManagementModalFunc);
    }
    const closeUserManagementBtn = document.getElementById('closeUserManagementBtn');
    if (closeUserManagementBtn) {
        closeUserManagementBtn.addEventListener('click', closeUserManagementModalFunc);
    }
}

// 绑定注册相关事件
function bindRegisterEvents() {
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const changePasswordTab = document.getElementById('changePasswordTab');
    const loginFormElement = document.getElementById('loginForm');
    const registerFormElement = document.getElementById('registerForm');
    const changePasswordFormElement = document.getElementById('changePasswordForm');
    const loginButton = document.getElementById('loginBtn');
    const registerButton = document.getElementById('registerBtn');
    const changePasswordButton = document.getElementById('changePasswordBtn');
    const loginModalTitle = document.getElementById('loginModalTitle');
    
    // 登录标签点击事件
    if (loginTab) {
        loginTab.addEventListener('click', function() {
            loginTab.classList.add('bg-blue-100', 'text-blue-700');
            loginTab.classList.remove('text-gray-600');
            if (registerTab) {
                registerTab.classList.remove('bg-blue-100', 'text-blue-700');
                registerTab.classList.add('text-gray-600');
            }
            if (changePasswordTab) {
                changePasswordTab.classList.remove('bg-blue-100', 'text-blue-700');
                changePasswordTab.classList.add('text-gray-600');
            }
            if (loginFormElement) loginFormElement.classList.remove('hidden');
            if (registerFormElement) registerFormElement.classList.add('hidden');
            if (changePasswordFormElement) changePasswordFormElement.classList.add('hidden');
            if (loginButton) loginButton.classList.remove('hidden');
            if (registerButton) registerButton.classList.add('hidden');
            if (changePasswordButton) changePasswordButton.classList.add('hidden');
            if (loginModalTitle) loginModalTitle.textContent = '请登录以修改数据';
        });
    }
    
    // 注册标签点击事件
    if (registerTab) {
        registerTab.addEventListener('click', function() {
            registerTab.classList.add('bg-blue-100', 'text-blue-700');
            registerTab.classList.remove('text-gray-600');
            if (loginTab) {
                loginTab.classList.remove('bg-blue-100', 'text-blue-700');
                loginTab.classList.add('text-gray-600');
            }
            if (changePasswordTab) {
                changePasswordTab.classList.remove('bg-blue-100', 'text-blue-700');
                changePasswordTab.classList.add('text-gray-600');
            }
            if (registerFormElement) registerFormElement.classList.remove('hidden');
            if (loginFormElement) loginFormElement.classList.add('hidden');
            if (changePasswordFormElement) changePasswordFormElement.classList.add('hidden');
            if (registerButton) registerButton.classList.remove('hidden');
            if (loginButton) loginButton.classList.add('hidden');
            if (changePasswordButton) changePasswordButton.classList.add('hidden');
            if (loginModalTitle) loginModalTitle.textContent = '注册新用户';
        });
    }
    
    // 修改密码标签点击事件
    if (changePasswordTab) {
        changePasswordTab.addEventListener('click', function() {
            changePasswordTab.classList.add('bg-blue-100', 'text-blue-700');
            changePasswordTab.classList.remove('text-gray-600');
            if (loginTab) {
                loginTab.classList.remove('bg-blue-100', 'text-blue-700');
                loginTab.classList.add('text-gray-600');
            }
            if (registerTab) {
                registerTab.classList.remove('bg-blue-100', 'text-blue-700');
                registerTab.classList.add('text-gray-600');
            }
            if (changePasswordFormElement) changePasswordFormElement.classList.remove('hidden');
            if (loginFormElement) loginFormElement.classList.add('hidden');
            if (registerFormElement) registerFormElement.classList.add('hidden');
            if (changePasswordButton) changePasswordButton.classList.remove('hidden');
            if (loginButton) loginButton.classList.add('hidden');
            if (registerButton) registerButton.classList.add('hidden');
            if (loginModalTitle) loginModalTitle.textContent = '修改密码';
        });
    }
    
    // 注册按钮点击事件
    if (registerButton) registerButton.addEventListener('click', handleRegister);
    
    // 注册表单提交事件
    if (registerFormElement) {
        registerFormElement.addEventListener('submit', function(e) {
            e.preventDefault();
            handleRegister();
        });
    }
    
    // 修改密码按钮点击事件
    if (changePasswordButton) changePasswordButton.addEventListener('click', handleChangePassword);
    
    // 修改密码表单提交事件
    if (changePasswordFormElement) {
        changePasswordFormElement.addEventListener('submit', function(e) {
            e.preventDefault();
            handleChangePassword();
        });
    }
}

// 检查用户权限
function checkPermission(permission) {
    if (!isLoggedIn || !currentUser) {
        return permission === 'view' || permission === 'export_excel';
    }
    
    const permissions = {
        'user': ['view', 'export_excel', 'export_usage', 'export_returns', 'export_stats'],
        'admin': ['view', 'export_excel', 'export_usage', 'export_returns', 'export_stats', 'edit_inventory', 'delete_inventory', 'import_excel', 'add_material', 'add_usage', 'add_return', 'quick_import'],
        'super_admin': ['view', 'export_excel', 'export_usage', 'export_returns', 'export_stats', 'edit_inventory', 'delete_inventory', 'import_excel', 'add_material', 'add_usage', 'add_return', 'quick_import', 'manage_users']
    };
    
    const userPermissions = permissions[currentUser.role] || [];
    return userPermissions.includes(permission);
}

// 处理登录
async function handleLogin() {
    const username = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value.trim() : '';
    
    if (!username || !password) {
        showToast('请输入用户名和密码', 'error');
        return;
    }
    
    try {
        const result = await API.login(username, password);
        
        if (result.success) {
            isLoggedIn = true;
            currentUser = result.user;
            
            closeLoginModal();
            showToast('登录成功！可以进行数据修改操作', 'success');
            
            // 更新登录状态显示
            updateLoginStatusUI();
            
            // 启用编辑和删除按钮
            enableEditButtons();
            
            // 重新加载数据
            await loadData();
            updateStatistics();
            updateTable();
        } else {
            showToast('用户名或密码错误！', 'error');
        }
    } catch (error) {
        showToast('登录失败：' + error.message, 'error');
    }
}

// 打开登录模态框
function openLoginModal() {
    if (loginModal) {
        loginModal.classList.remove('hidden');
    }
    if (usernameInput) {
        usernameInput.value = '';
        usernameInput.focus();
    }
    if (passwordInput) passwordInput.value = '';
}

// 关闭登录模态框
function closeLoginModal() {
    if (loginModal) {
        loginModal.classList.add('hidden');
    }
}

// 更新登录状态UI
function updateLoginStatusUI() {
    const loginStatusBtn = document.getElementById('loginStatusBtn');
    const loginStatusText = document.getElementById('loginStatusText');
    const userManagementBtn = document.getElementById('userManagementBtn');
    
    if (isLoggedIn && currentUser) {
        if (loginStatusBtn) {
            loginStatusBtn.classList.remove('bg-gray-100', 'text-gray-700');
            loginStatusBtn.classList.add('bg-green-100', 'text-green-700');
            loginStatusBtn.onclick = showLogoutConfirm;
        }
        if (loginStatusText) {
            loginStatusText.textContent = `已登录 (${currentUser.username})`;
        }
        
        // 显示或隐藏用户管理按钮（仅超级管理员可见）
        if (userManagementBtn) {
            if (currentUser.role === 'super_admin') {
                userManagementBtn.classList.remove('hidden');
            } else {
                userManagementBtn.classList.add('hidden');
            }
        }
        
        // 根据用户角色启用或禁用编辑按钮
        if (currentUser.role === 'admin' || currentUser.role === 'super_admin') {
            enableEditButtons();
            if (importExcelBtn) {
                importExcelBtn.disabled = false;
                importExcelBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
            if (addMaterialBtn) {
                addMaterialBtn.disabled = false;
                addMaterialBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
            const quickImportBtn = document.getElementById('quickImportBtn');
            if (quickImportBtn) {
                quickImportBtn.disabled = false;
                quickImportBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        } else {
            disableEditButtons();
            if (importExcelBtn) {
                importExcelBtn.disabled = true;
                importExcelBtn.classList.add('opacity-50', 'cursor-not-allowed');
            }
            if (addMaterialBtn) {
                addMaterialBtn.disabled = true;
                addMaterialBtn.classList.add('opacity-50', 'cursor-not-allowed');
            }
            const quickImportBtn = document.getElementById('quickImportBtn');
            if (quickImportBtn) {
                quickImportBtn.disabled = true;
                quickImportBtn.classList.add('opacity-50', 'cursor-not-allowed');
            }
        }
    } else {
        if (loginStatusBtn) {
            loginStatusBtn.classList.remove('bg-green-100', 'text-green-700');
            loginStatusBtn.classList.add('bg-gray-100', 'text-gray-700');
            loginStatusBtn.onclick = openLoginModal;
        }
        if (loginStatusText) loginStatusText.textContent = '未登录';
        
        // 隐藏用户管理按钮
        if (userManagementBtn) userManagementBtn.classList.add('hidden');
        
        // 禁用编辑按钮
        disableEditButtons();
        
        // 禁用导入Excel和新增辅料按钮
        if (importExcelBtn) {
            importExcelBtn.disabled = true;
            importExcelBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
        if (addMaterialBtn) {
            addMaterialBtn.disabled = true;
            addMaterialBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
        const quickImportBtn = document.getElementById('quickImportBtn');
        if (quickImportBtn) {
            quickImportBtn.disabled = true;
            quickImportBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    }
}

// 显示登出确认
function showLogoutConfirm() {
    if (confirm('确定要登出吗？登出后将无法修改数据。')) {
        logout();
    }
}

// 登出
function logout() {
    API.logout();
    isLoggedIn = false;
    currentUser = null;
    updateLoginStatusUI();
    disableEditButtons();
    renderTable(filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage));
    showToast('已成功登出', 'info');
}

// 启用编辑按钮
function enableEditButtons() {
    const editButtons = document.querySelectorAll('.edit-btn, .delete-btn');
    editButtons.forEach(btn => {
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
        btn.disabled = false;
    });
}

// 禁用编辑按钮
function disableEditButtons() {
    const editButtons = document.querySelectorAll('.edit-btn, .delete-btn');
    editButtons.forEach(btn => {
        btn.classList.add('opacity-50', 'cursor-not-allowed');
        btn.disabled = true;
    });
}

// 处理编辑按钮点击
async function handleEditClick(id) {
    if (!isLoggedIn || !currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
        openLoginModal();
        return;
    }
    
    try {
        // 查找要编辑的物料
        const material = materialData.find(item => item.id === id);
        if (!material) {
            showToast('未找到要编辑的物料', 'error');
            return;
        }
        
        // 设置弹窗标题
        if (modalTitle) modalTitle.textContent = '编辑辅料';
        
        // 填充表单数据
        if (materialCode) materialCode.value = material.code;
        if (materialName) materialName.value = material.name;
        if (materialSpec) materialSpec.value = material.spec;
        if (materialQuantity) materialQuantity.value = material.quantity;
        if (materialUnit) materialUnit.value = material.unit;
        const materialLocation = document.getElementById('materialLocation');
        if (materialLocation) materialLocation.value = material.location || '';
        if (materialWarning) materialWarning.value = material.warning_value || '';
        
        // 设置编辑ID
        editingMaterialId = id;
        
        // 显示弹窗
        if (materialModal) materialModal.classList.remove('hidden');
    } catch (error) {
        showToast('加载物料信息失败：' + error.message, 'error');
    }
}

// 处理删除按钮点击
async function handleDeleteClick(id) {
    if (!isLoggedIn || !currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
        openLoginModal();
        return;
    }
    
    if (!confirm('确定要删除这条物料记录吗？')) {
        return;
    }
    
    try {
        await API.Material.delete(id);
        showToast('物料删除成功', 'success');
        await loadData();
        updateStatistics();
        updateTable();
    } catch (error) {
        showToast('删除失败：' + error.message, 'error');
    }
}

// 显示提示消息
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-md shadow-lg transition-all duration-300 transform translate-x-full`;
    
    switch (type) {
        case 'success':
            toast.classList.add('bg-green-500', 'text-white');
            break;
        case 'error':
            toast.classList.add('bg-red-500', 'text-white');
            break;
        case 'warning':
            toast.classList.add('bg-yellow-500', 'text-white');
            break;
        default:
            toast.classList.add('bg-blue-500', 'text-white');
    }
    
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.remove('translate-x-full'), 100);
    setTimeout(() => {
        toast.classList.add('translate-x-full');
        setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
}

// 搜索
function performSearch() {
    const code = codeSearch ? codeSearch.value.trim().toLowerCase() : '';
    const name = nameSearch ? nameSearch.value.trim().toLowerCase() : '';
    const spec = specSearch ? specSearch.value.trim().toLowerCase() : '';
    
    filteredData = materialData.filter(item => {
        const matchCode = !code || item.code.toLowerCase().includes(code);
        const matchName = !name || item.name.toLowerCase().includes(name);
        const matchSpec = !spec || item.spec.toLowerCase().includes(spec);
        return matchCode && matchName && matchSpec;
    });
    
    currentPage = 1;
    updateTable();
}

// 重置搜索
function resetSearch() {
    if (codeSearch) codeSearch.value = '';
    if (nameSearch) nameSearch.value = '';
    if (specSearch) specSearch.value = '';
    filteredData = [...materialData];
    currentPage = 1;
    updateTable();
}

// 打开新增弹窗
function openAddModal() {
    if (modalTitle) modalTitle.textContent = '新增辅料';
    
    // 清空表单
    if (materialCode) materialCode.value = '';
    if (materialName) materialName.value = '';
    if (materialSpec) materialSpec.value = '';
    if (materialQuantity) materialQuantity.value = '';
    if (materialUnit) materialUnit.value = '';
    const materialLocation = document.getElementById('materialLocation');
    if (materialLocation) materialLocation.value = '';
    if (materialWarning) materialWarning.value = '';
    
    editingMaterialId = null;
    
    if (materialModal) materialModal.classList.remove('hidden');
}

// 关闭弹窗
function closeModal() {
    if (materialModal) materialModal.classList.add('hidden');
    editingMaterialId = null;
}

// 保存物料
async function saveMaterial() {
    const code = materialCode ? materialCode.value.trim() : '';
    const name = materialName ? materialName.value.trim() : '';
    const spec = materialSpec ? materialSpec.value.trim() : '';
    const quantity = materialQuantity ? parseFloat(materialQuantity.value) : 0;
    const unit = materialUnit ? materialUnit.value.trim() : '';
    const location = document.getElementById('materialLocation') ? document.getElementById('materialLocation').value.trim() : '';
    const warningValue = materialWarning ? parseFloat(materialWarning.value) || 0 : 0;
    
    if (!code || !name || !spec || isNaN(quantity) || !unit) {
        showToast('请填写必填字段', 'error');
        return;
    }
    
    try {
        if (editingMaterialId) {
            // 更新物料
            await API.Material.update(editingMaterialId, {
                code,
                name,
                spec,
                quantity,
                unit,
                location,
                warning_value: warningValue
            });
            showToast('物料更新成功', 'success');
        } else {
            // 新增物料
            await API.Material.create({
                code,
                name,
                spec,
                quantity,
                unit,
                location,
                warning_value: warningValue
            });
            showToast('物料新增成功', 'success');
        }
        
        closeModal();
        await loadData();
        updateStatistics();
        updateTable();
    } catch (error) {
        showToast('保存失败：' + error.message, 'error');
    }
}

// 导入Excel
async function importFromExcel(file) {
    try {
        const reader = new FileReader();
        
        reader.onload = async function(e) {
            const base64Data = e.target.result.split(',')[1];
            
            try {
                await API.Material.import(base64Data);
                showToast('Excel导入成功', 'success');
                await loadData();
                updateStatistics();
                updateTable();
            } catch (error) {
                showToast('导入失败：' + error.message, 'error');
            }
        };
        
        reader.readAsDataURL(file);
    } catch (error) {
        showToast('读取文件失败：' + error.message, 'error');
    }
}

// 快速导入Excel更新库存
async function quickImportFromExcel(file) {
    try {
        const reader = new FileReader();
        
        reader.onload = async function(e) {
            const base64Data = e.target.result.split(',')[1];
            
            try {
                await API.Material.import(base64Data);
                showToast('库存更新成功', 'success');
                await loadData();
                updateStatistics();
                updateTable();
            } catch (error) {
                showToast('更新失败：' + error.message, 'error');
            }
        };
        
        reader.readAsDataURL(file);
    } catch (error) {
        showToast('读取文件失败：' + error.message, 'error');
    }
}

// 显示导出选项弹窗
function showExportOptionsModal() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h3 class="text-lg font-semibold text-gray-800">导出辅料信息</h3>
                <button id="closeExportModal" class="text-gray-400 hover:text-gray-600 focus:outline-none">
                    <i class="fa fa-times text-xl"></i>
                </button>
            </div>
            <div class="px-6 py-4">
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">选择导出范围</label>
                    <div class="grid grid-cols-2 gap-2">
                        <button id="exportAll" class="p-3 rounded-lg border-2 border-blue-500 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors font-medium">
                            <div class="text-2xl mb-1">📦</div>
                            <div class="text-sm">辅料总数</div>
                        </button>
                        <button id="exportNormal" class="p-3 rounded-lg border-2 border-green-500 bg-green-50 text-green-700 hover:bg-green-100 transition-colors font-medium">
                            <div class="text-2xl mb-1">✓</div>
                            <div class="text-sm">正常库存</div>
                        </button>
                        <button id="exportWarning" class="p-3 rounded-lg border-2 border-yellow-500 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 transition-colors font-medium">
                            <div class="text-2xl mb-1">⚠️</div>
                            <div class="text-sm">库存预警</div>
                        </button>
                        <button id="exportShortage" class="p-3 rounded-lg border-2 border-red-500 bg-red-50 text-red-700 hover:bg-red-100 transition-colors font-medium">
                            <div class="text-2xl mb-1">🚨</div>
                            <div class="text-sm">库存不足</div>
                        </button>
                    </div>
                </div>
            </div>
            <div class="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
                <button id="cancelExportBtn" class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-400">
                    取消
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const closeModal = function() {
        document.body.removeChild(modal);
    };
    
    document.getElementById('closeExportModal').addEventListener('click', closeModal);
    document.getElementById('cancelExportBtn').addEventListener('click', closeModal);
    
    document.getElementById('exportAll').addEventListener('click', async function() {
        const response = await API.Material.export();
        downloadFile(response, '辅料信息.xlsx');
        closeModal();
    });
    
    document.getElementById('exportNormal').addEventListener('click', async function() {
        const response = await API.Material.export('normal');
        downloadFile(response, '正常库存.xlsx');
        closeModal();
    });
    
    document.getElementById('exportWarning').addEventListener('click', async function() {
        const response = await API.Material.export('warning');
        downloadFile(response, '库存预警.xlsx');
        closeModal();
    });
    
    document.getElementById('exportShortage').addEventListener('click', async function() {
        const response = await API.Material.export('shortage');
        downloadFile(response, '库存不足.xlsx');
        closeModal();
    });
}

// 下载文件
function downloadFile(response, filename) {
    response.blob().then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    });
}

// 处理注册
async function handleRegister() {
    const registerUsername = document.getElementById('registerUsername') ? document.getElementById('registerUsername').value.trim() : '';
    const registerPassword = document.getElementById('registerPassword') ? document.getElementById('registerPassword').value.trim() : '';
    const confirmPassword = document.getElementById('confirmPassword') ? document.getElementById('confirmPassword').value.trim() : '';
    
    if (!registerUsername) {
        showToast('请输入用户名', 'error');
        return;
    }
    if (!registerPassword) {
        showToast('请输入密码', 'error');
        return;
    }
    if (registerPassword !== confirmPassword) {
        showToast('两次输入的密码不一致', 'error');
        return;
    }
    
    try {
        await API.User.create({ username: registerUsername, password: registerPassword, role: 'user' });
        showToast('注册成功！请登录', 'success');
        
        // 切换到登录表单
        const loginTab = document.getElementById('loginTab');
        if (loginTab) loginTab.click();
        
        // 填充用户名到登录表单
        if (usernameInput) usernameInput.value = registerUsername;
        if (passwordInput) passwordInput.focus();
    } catch (error) {
        showToast('注册失败：' + error.message, 'error');
    }
}

// 处理修改密码
async function handleChangePassword() {
    const changePasswordUsername = document.getElementById('changePasswordUsername') ? document.getElementById('changePasswordUsername').value.trim() : '';
    const oldPassword = document.getElementById('oldPassword') ? document.getElementById('oldPassword').value.trim() : '';
    const newPassword = document.getElementById('newPassword') ? document.getElementById('newPassword').value.trim() : '';
    const confirmNewPassword = document.getElementById('confirmNewPassword') ? document.getElementById('confirmNewPassword').value.trim() : '';
    
    if (!changePasswordUsername) {
        showToast('请输入用户名', 'error');
        return;
    }
    if (!newPassword) {
        showToast('请输入新密码', 'error');
        return;
    }
    if (newPassword !== confirmNewPassword) {
        showToast('两次输入的新密码不一致', 'error');
        return;
    }
    
    try {
        // 获取用户ID
        const usersResult = await API.User.getAll();
        const user = usersResult.find(u => u.username === changePasswordUsername);
        
        if (!user) {
            showToast('用户不存在', 'error');
            return;
        }
        
        await API.User.changePassword(user.id, { oldPassword, newPassword });
        showToast('密码修改成功！', 'success');
        
        // 切换到登录表单
        const loginTab = document.getElementById('loginTab');
        if (loginTab) loginTab.click();
        
        // 填充用户名到登录表单
        if (usernameInput) usernameInput.value = changePasswordUsername;
        if (passwordInput) passwordInput.focus();
    } catch (error) {
        showToast('修改密码失败：' + error.message, 'error');
    }
}

// 打开用户管理模态框
async function openUserManagementModal() {
    if (!isLoggedIn || currentUser.role !== 'super_admin') {
        showToast('只有超级管理员可以访问用户管理', 'error');
        return;
    }
    
    try {
        const usersResult = await API.User.getAll();
        users = usersResult;
        renderUserTable();
        
        const userManagementModal = document.getElementById('userManagementModal');
        if (userManagementModal) userManagementModal.classList.remove('hidden');
    } catch (error) {
        showToast('加载用户列表失败：' + error.message, 'error');
    }
}

// 关闭用户管理模态框
function closeUserManagementModalFunc() {
    const userManagementModal = document.getElementById('userManagementModal');
    if (userManagementModal) userManagementModal.classList.add('hidden');
}

// 渲染用户列表
function renderUserTable() {
    const userTableBody = document.getElementById('userTableBody');
    if (!userTableBody) return;
    
    userTableBody.innerHTML = '';
    
    users.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">${user.username}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <select class="role-select px-3 py-1 border border-gray-300 rounded-md" data-user-id="${user.id}">
                    <option value="user" ${user.role === 'user' ? 'selected' : ''}>普通用户</option>
                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>管理员</option>
                    <option value="super_admin" ${user.role === 'super_admin' ? 'selected' : ''}>超级管理员</option>
                </select>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <button class="delete-user-btn px-3 py-1 text-red-600 hover:bg-red-50 rounded-md text-sm" data-user-id="${user.id}">
                    删除
                </button>
            </td>
        `;
        
        userTableBody.appendChild(tr);
    });
    
    // 添加角色选择事件
    document.querySelectorAll('.role-select').forEach(select => {
        select.addEventListener('change', async function() {
            const userId = parseInt(this.dataset.userId);
            const newRole = this.value;
            
            try {
                await API.User.update(userId, { role: newRole });
                showToast('角色更新成功', 'success');
            } catch (error) {
                showToast('更新角色失败：' + error.message, 'error');
            }
        });
    });
    
    // 添加删除用户事件
    document.querySelectorAll('.delete-user-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const userId = parseInt(this.dataset.userId);
            
            if (userId === currentUser.id) {
                showToast('不能删除自己', 'error');
                return;
            }
            
            if (!confirm('确定要删除这个用户吗？')) {
                return;
            }
            
            try {
                await API.User.delete(userId);
                showToast('用户删除成功', 'success');
                await openUserManagementModal();
            } catch (error) {
                showToast('删除用户失败：' + error.message, 'error');
            }
        });
    });
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);
