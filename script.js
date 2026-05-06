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

// 页面初始化
async function init() {
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
    
    // 更新登录状态UI
    updateLoginStatusUI();
    
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
        showToast('加载数据失败：' + error.message, 'error');
    }
}

// 显示加载状态
function showLoading() {
    loading.style.display = 'flex';
    materialTableContainer.style.display = 'none';
}

// 隐藏加载状态
function hideLoading() {
    loading.style.display = 'none';
    materialTableContainer.style.display = 'block';
}

// 更新统计信息
function updateStatistics() {
    const total = filteredData.length;
    const normal = filteredData.filter(item => item.status === 'normal').length;
    const warning = filteredData.filter(item => item.status === 'warning').length;
    const shortage = filteredData.filter(item => item.status === 'shortage').length;
    
    totalCount.textContent = total;
    normalStockCount.textContent = normal;
    warningStockCount.textContent = warning;
    shortageStockCount.textContent = shortage;
}

// 更新表格
function updateTable() {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredData.slice(startIndex, endIndex);
    
    if (pageData.length === 0) {
        materialTableBody.innerHTML = '<tr><td colspan="9" class="text-center py-8">暂无数据</td></tr>';
        emptyData.style.display = 'block';
    } else {
        emptyData.style.display = 'none';
        materialTableBody.innerHTML = pageData.map(item => `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap">${item.code || '-'}</td>
                <td class="px-6 py-4">${item.name || '-'}</td>
                <td class="px-6 py-4">${item.spec || '-'}</td>
                <td class="px-6 py-4">${parseFloat(item.quantity || 0).toFixed(2)}</td>
                <td class="px-6 py-4">${item.unit || '-'}</td>
                <td class="px-6 py-4">${parseFloat(item.warning_value || 0).toFixed(2)}</td>
                <td class="px-6 py-4">${item.location || '-'}</td>
                <td class="px-6 py-4">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(item.status)}">
                        ${getStatusText(item.status)}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex space-x-2">
                        <button class="edit-btn px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50" data-id="${item.id}">
                            <i class="fa fa-edit"></i>
                        </button>
                        <button class="delete-btn px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50" data-id="${item.id}">
                            <i class="fa fa-trash"></i>
                        </button>
                        <button class="use-btn px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50" data-id="${item.id}">
                            <i class="fa fa-arrow-down"></i>
                        </button>
                        <button class="return-btn px-3 py-1 bg-purple-500 text-white text-sm rounded hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50" data-id="${item.id}">
                            <i class="fa fa-arrow-up"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
        
        // 绑定表格操作按钮事件
        bindTableEvents();
    }
    
    updatePagination();
}

// 获取状态样式类
function getStatusClass(status) {
    switch(status) {
        case 'normal':
            return 'bg-green-100 text-green-800';
        case 'warning':
            return 'bg-yellow-100 text-yellow-800';
        case 'shortage':
            return 'bg-red-100 text-red-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
}

// 获取状态文本
function getStatusText(status) {
    switch(status) {
        case 'normal':
            return '正常';
        case 'warning':
            return '预警';
        case 'shortage':
            return '不足';
        default:
            return '未知';
    }
}

// 更新分页
function updatePagination() {
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, filteredData.length);
    
    startRange.textContent = start;
    endRange.textContent = end;
    totalDataCount.textContent = filteredData.length;
    
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage >= totalPages;
}

// 绑定事件
function bindEvents() {
    // 搜索按钮点击事件
    searchBtn.addEventListener('click', search);
    
    // 重置按钮点击事件
    resetBtn.addEventListener('click', resetSearch);
    
    // 空数据重置按钮
    if (emptyResetBtn) {
        emptyResetBtn.addEventListener('click', function() {
            document.getElementById('excelFileInput').click();
        });
    }
    
    // 导入Excel按钮点击事件
    importExcelBtn.addEventListener('click', function() {
        excelFileInput.click();
    });
    
    // 快速更新库存按钮点击事件
    const quickImportBtn = document.getElementById('quickImportBtn');
    if (quickImportBtn) {
        quickImportBtn.addEventListener('click', function() {
            quickImportFileInput.click();
        });
    }
    
    // 导出Excel按钮点击事件
    exportExcelBtn.addEventListener('click', showExportOptionsModal);
    
    // 新增辅料按钮点击事件
    addMaterialBtn.addEventListener('click', openMaterialModal);
    
    // 使用量管理按钮点击事件
    const usageTrackingBtn = document.getElementById('usageTrackingBtn');
    if (usageTrackingBtn) {
        usageTrackingBtn.addEventListener('click', function() {
            window.location.href = 'usage-tracking.html';
        });
    }
    
    // 初始化登录状态UI
    updateLoginStatusUI();
    
    // 绑定登录相关事件
    bindLoginEvents();
    
    // 分页按钮事件
    prevPageBtn.addEventListener('click', prevPage);
    nextPageBtn.addEventListener('click', nextPage);
    
    // Excel文件选择事件
    excelFileInput.addEventListener('change', handleExcelImport);
    quickImportFileInput.addEventListener('change', handleQuickImport);
    
    // 键盘事件
    codeSearch.addEventListener('keyup', function(e) {
        if (e.key === 'Enter') search();
    });
    nameSearch.addEventListener('keyup', function(e) {
        if (e.key === 'Enter') search();
    });
    specSearch.addEventListener('keyup', function(e) {
        if (e.key === 'Enter') search();
    });
}

// 绑定表格事件
function bindTableEvents() {
    // 编辑按钮
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            if (!isLoggedIn) {
                openLoginModal();
                return;
            }
            const id = parseInt(this.dataset.id);
            editMaterial(id);
        });
    });
    
    // 删除按钮
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            if (!isLoggedIn) {
                openLoginModal();
                return;
            }
            const id = parseInt(this.dataset.id);
            deleteMaterial(id);
        });
    });
    
    // 领用按钮
    document.querySelectorAll('.use-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            if (!isLoggedIn) {
                openLoginModal();
                return;
            }
            const id = parseInt(this.dataset.id);
            useMaterial(id);
        });
    });
    
    // 退料按钮
    document.querySelectorAll('.return-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            if (!isLoggedIn) {
                openLoginModal();
                return;
            }
            const id = parseInt(this.dataset.id);
            returnMaterial(id);
        });
    });
}

// 搜索
function search() {
    const code = codeSearch.value.trim().toLowerCase();
    const name = nameSearch.value.trim().toLowerCase();
    const spec = specSearch.value.trim().toLowerCase();
    
    filteredData = materialData.filter(item => {
        const itemCode = (item.code || '').toLowerCase();
        const itemName = (item.name || '').toLowerCase();
        const itemSpec = (item.spec || '').toLowerCase();
        
        return (!code || itemCode.includes(code)) &&
               (!name || itemName.includes(name)) &&
               (!spec || itemSpec.includes(spec));
    });
    
    currentPage = 1;
    updateTable();
    updateStatistics();
}

// 重置搜索
function resetSearch() {
    codeSearch.value = '';
    nameSearch.value = '';
    specSearch.value = '';
    filteredData = [...materialData];
    currentPage = 1;
    updateTable();
    updateStatistics();
}

// 上一页
function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        updateTable();
    }
}

// 下一页
function nextPage() {
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        updateTable();
    }
}

// 打开物料弹窗
function openMaterialModal(material = null) {
    const modal = document.getElementById('materialModal');
    const title = document.getElementById('modalTitle');
    const form = document.getElementById('materialForm');
    
    if (material) {
        title.textContent = '编辑辅料';
        editingMaterialId = material.id;
        document.getElementById('materialCode').value = material.code || '';
        document.getElementById('materialName').value = material.name || '';
        document.getElementById('materialSpec').value = material.spec || '';
        document.getElementById('materialUnit').value = material.unit || '';
        document.getElementById('materialQuantity').value = parseFloat(material.quantity || 0);
        document.getElementById('warningValue').value = parseFloat(material.warning_value || 0);
        document.getElementById('materialCategory').value = material.category || '';
        document.getElementById('materialLocation').value = material.location || '';
        document.getElementById('materialRemark').value = material.remark || '';
        document.getElementById('materialCode').disabled = true;
    } else {
        title.textContent = '新增辅料';
        editingMaterialId = null;
        form.reset();
        document.getElementById('materialCode').disabled = false;
    }
    
    modal.classList.remove('hidden');
}

// 关闭物料弹窗
function closeMaterialModal() {
    const modal = document.getElementById('materialModal');
    modal.classList.add('hidden');
    editingMaterialId = null;
}

// 保存物料
async function saveMaterial() {
    const form = document.getElementById('materialForm');
    const formData = new FormData(form);
    
    const data = {
        code: formData.get('materialCode'),
        name: formData.get('materialName'),
        spec: formData.get('materialSpec'),
        unit: formData.get('materialUnit'),
        quantity: parseFloat(formData.get('materialQuantity')) || 0,
        warning_value: parseFloat(formData.get('warningValue')) || 0,
        category: formData.get('materialCategory'),
        location: formData.get('materialLocation'),
        remark: formData.get('materialRemark')
    };
    
    try {
        if (editingMaterialId) {
            await API.Material.update(editingMaterialId, data);
            showToast('更新成功', 'success');
        } else {
            await API.Material.create(data);
            showToast('新增成功', 'success');
        }
        
        closeMaterialModal();
        await loadData();
        updateStatistics();
        updateTable();
    } catch (error) {
        showToast('保存失败：' + error.message, 'error');
    }
}

// 编辑物料
function editMaterial(id) {
    const material = materialData.find(item => item.id === id);
    if (material) {
        openMaterialModal(material);
    }
}

// 删除物料
async function deleteMaterial(id) {
    if (!confirm('确定要删除这条记录吗？')) {
        return;
    }
    
    try {
        await API.Material.delete(id);
        showToast('删除成功', 'success');
        await loadData();
        updateStatistics();
        updateTable();
    } catch (error) {
        showToast('删除失败：' + error.message, 'error');
    }
}

// 领用物料
function useMaterial(id) {
    const material = materialData.find(item => item.id === id);
    if (!material) return;
    
    const quantity = prompt(`请输入领用数量（当前库存：${parseFloat(material.quantity || 0)} ${material.unit}）：`);
    if (quantity === null) return;
    
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
        showToast('请输入有效的数量', 'error');
        return;
    }
    
    if (qty > parseFloat(material.quantity || 0)) {
        showToast('领用数量不能大于当前库存', 'error');
        return;
    }
    
    // 创建领用记录
    const recordData = {
        recordType: 'usage',
        materialId: material.id,
        materialCode: material.code,
        materialName: material.name,
        materialSpec: material.spec,
        materialUnit: material.unit,
        quantity: qty,
        userName: currentUser ? currentUser.name || currentUser.username : '未知',
        date: new Date().toISOString().split('T')[0],
        remark: ''
    };
    
    saveUsageRecord(recordData);
}

// 退料
function returnMaterial(id) {
    const material = materialData.find(item => item.id === id);
    if (!material) return;
    
    const quantity = prompt('请输入退料数量：');
    if (quantity === null) return;
    
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
        showToast('请输入有效的数量', 'error');
        return;
    }
    
    // 创建退料记录
    const recordData = {
        recordType: 'return',
        materialId: material.id,
        materialCode: material.code,
        materialName: material.name,
        materialSpec: material.spec,
        materialUnit: material.unit,
        quantity: qty,
        userName: currentUser ? currentUser.name || currentUser.username : '未知',
        date: new Date().toISOString().split('T')[0],
        remark: ''
    };
    
    saveUsageRecord(recordData);
}

// 保存领用/退料记录
async function saveUsageRecord(recordData) {
    try {
        await API.Usage.create(recordData);
        showToast(recordData.recordType === 'usage' ? '领用成功' : '退料成功', 'success');
        await loadData();
        updateStatistics();
        updateTable();
    } catch (error) {
        showToast('操作失败：' + error.message, 'error');
    }
}

// 处理Excel导入
function handleExcelImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        const base64Data = e.target.result.split(',')[1];
        
        try {
            await API.Material.import(base64Data);
            showToast('导入成功', 'success');
            await loadData();
            updateStatistics();
            updateTable();
        } catch (error) {
            showToast('导入失败：' + error.message, 'error');
        }
    };
    
    reader.readAsDataURL(file);
}

// 处理快速更新库存
function handleQuickImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
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
}

// 显示导出选项弹窗
function showExportOptionsModal() {
    // 先移除已存在的导出弹窗
    const existingModal = document.querySelector('.export-options-modal');
    if (existingModal) {
        document.body.removeChild(existingModal);
    }
    
    const modal = document.createElement('div');
    modal.className = 'export-options-modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
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
        if (modal && modal.parentNode) {
            document.body.removeChild(modal);
        }
    };
    
    // 使用 modal.querySelector 来获取弹窗内的元素
    const closeBtn = modal.querySelector('#closeExportModal');
    const cancelBtn = modal.querySelector('#cancelExportBtn');
    const exportAllBtn = modal.querySelector('#exportAll');
    const exportNormalBtn = modal.querySelector('#exportNormal');
    const exportWarningBtn = modal.querySelector('#exportWarning');
    const exportShortageBtn = modal.querySelector('#exportShortage');
    
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    
    if (exportAllBtn) exportAllBtn.addEventListener('click', async function() {
        try {
            const response = await API.Material.export();
            downloadFile(response, '辅料信息.xlsx');
        } catch (error) {
            showToast('导出失败：' + error.message, 'error');
        }
        closeModal();
    });
    
    if (exportNormalBtn) exportNormalBtn.addEventListener('click', async function() {
        try {
            const response = await API.Material.export('normal');
            downloadFile(response, '正常库存.xlsx');
        } catch (error) {
            showToast('导出失败：' + error.message, 'error');
        }
        closeModal();
    });
    
    if (exportWarningBtn) exportWarningBtn.addEventListener('click', async function() {
        try {
            const response = await API.Material.export('warning');
            downloadFile(response, '库存预警.xlsx');
        } catch (error) {
            showToast('导出失败：' + error.message, 'error');
        }
        closeModal();
    });
    
    if (exportShortageBtn) exportShortageBtn.addEventListener('click', async function() {
        try {
            const response = await API.Material.export('shortage');
            downloadFile(response, '库存不足.xlsx');
        } catch (error) {
            showToast('导出失败：' + error.message, 'error');
        }
        closeModal();
    });
}

// 下载文件
function downloadFile(data, filename) {
    // 如果是 Blob 对象，直接下载
    if (data instanceof Blob) {
        const url = window.URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        return;
    }
    
    // 如果是数据数组，转换为 Excel
    if (!data || data.length === 0) {
        showToast('没有数据可导出', 'warning');
        return;
    }
    
    const headers = ['物料编码', '物料名称', '物料规格', '现有数量', '单位', '预警值', '分类', '货架库位', '库存状态', '备注'];
    const rows = data.map(item => [
        item.code || '',
        item.name || '',
        item.spec || '',
        parseFloat(item.quantity || 0).toFixed(2),
        item.unit || '',
        parseFloat(item.warning_value || 0).toFixed(2),
        item.category || '',
        item.location || '',
        getStatusText(item.status),
        item.remark || ''
    ]);
    
    // 创建工作簿
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '辅料信息');
    
    // 导出
    XLSX.writeFile(workbook, filename);
}

// 显示Toast提示
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    toastMessage.textContent = message;
    
    // 设置背景颜色
    toast.className = 'fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white font-medium z-50 transform transition-all duration-300';
    
    switch(type) {
        case 'success':
            toast.style.backgroundColor = '#10b981';
            break;
        case 'error':
            toast.style.backgroundColor = '#ef4444';
            break;
        case 'warning':
            toast.style.backgroundColor = '#f59e0b';
            break;
        default:
            toast.style.backgroundColor = '#3b82f6';
    }
    
    // 显示Toast
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    
    // 3秒后隐藏
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
    }, 3000);
}

// 更新最后更新时间
function updateLastUpdateTime() {
    const now = new Date();
    lastUpdateTime.textContent = now.toLocaleString('zh-CN');
}

// 绑定登录相关事件
function bindLoginEvents() {
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
    
    if (loginTab) {
        loginTab.addEventListener('click', function() {
            showLoginForm();
        });
    }
    
    if (registerTab) {
        registerTab.addEventListener('click', function() {
            showRegisterForm();
        });
    }
    
    if (changePasswordTab) {
        changePasswordTab.addEventListener('click', function() {
            showChangePasswordForm();
        });
    }
    
    if (cancelLoginBtn) {
        cancelLoginBtn.addEventListener('click', closeLoginModal);
    }
    
    const closeLoginModalBtn = document.getElementById('closeLoginModal');
    if (closeLoginModalBtn) {
        closeLoginModalBtn.addEventListener('click', closeLoginModal);
    }
    
    if (loginButton) {
        loginButton.addEventListener('click', handleLogin);
    }
    
    if (registerButton) {
        registerButton.addEventListener('click', handleRegister);
    }
    
    if (changePasswordButton) {
        changePasswordButton.addEventListener('click', handleChangePassword);
    }
}

// 显示登录表单
function showLoginForm() {
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('registerForm').classList.add('hidden');
    document.getElementById('changePasswordForm').classList.add('hidden');
    document.getElementById('loginBtn').classList.remove('hidden');
    document.getElementById('registerBtn').classList.add('hidden');
    document.getElementById('changePasswordBtn').classList.add('hidden');
    document.getElementById('loginModalTitle').textContent = '请登录以修改数据';
}

// 显示注册表单
function showRegisterForm() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.remove('hidden');
    document.getElementById('changePasswordForm').classList.add('hidden');
    document.getElementById('loginBtn').classList.add('hidden');
    document.getElementById('registerBtn').classList.remove('hidden');
    document.getElementById('changePasswordBtn').classList.add('hidden');
    document.getElementById('loginModalTitle').textContent = '注册新账号';
}

// 显示修改密码表单
function showChangePasswordForm() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.add('hidden');
    document.getElementById('changePasswordForm').classList.remove('hidden');
    document.getElementById('loginBtn').classList.add('hidden');
    document.getElementById('registerBtn').classList.add('hidden');
    document.getElementById('changePasswordBtn').classList.remove('hidden');
    document.getElementById('loginModalTitle').textContent = '修改密码';
}

// 打开登录模态框
function openLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.classList.remove('hidden');
        showLoginForm();
    }
}

// 关闭登录模态框
function closeLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// 处理登录
async function handleLogin() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    
    if (!username || !password) {
        showToast('请输入用户名和密码', 'error');
        return;
    }
    
    try {
        const result = await API.login(username, password);
        if (result.success) {
            isLoggedIn = true;
            currentUser = result.user;
            showToast('登录成功', 'success');
            closeLoginModal();
            updateLoginStatusUI();
            enableEditButtons();
            await loadData();
            updateStatistics();
            updateTable();
            
            // 如果是管理员或超级管理员，显示用户管理按钮
            if (currentUser.role === 'admin' || currentUser.role === 'super_admin') {
                document.getElementById('userManagementBtn').style.display = 'flex';
            }
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// 显示退出确认
function showLogoutConfirm() {
    if (confirm('确定要退出登录吗？')) {
        handleLogout();
    }
}

// 处理退出
async function handleLogout() {
    try {
        await API.logout();
        isLoggedIn = false;
        currentUser = null;
        showToast('已退出登录', 'success');
        updateLoginStatusUI();
        disableEditButtons();
        document.getElementById('userManagementBtn').style.display = 'none';
    } catch (error) {
        showToast('退出失败：' + error.message, 'error');
    }
}

// 处理注册
async function handleRegister() {
    const username = document.getElementById('registerUsername').value.trim();
    const password = document.getElementById('registerPassword').value.trim();
    const confirmPassword = document.getElementById('confirmPassword').value.trim();
    
    if (!username || !password) {
        showToast('请输入用户名和密码', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showToast('两次输入的密码不一致', 'error');
        return;
    }
    
    try {
        const result = await API.User.create({
            username: username,
            password: password,
            name: username,
            role: 'employee',
            department: ''
        });
        
        if (result.data) {
            showToast('注册成功，请登录', 'success');
            showLoginForm();
        }
    } catch (error) {
        showToast('注册失败：' + error.message, 'error');
    }
}

// 处理修改密码
async function handleChangePassword() {
    const username = document.getElementById('changeUsername').value.trim();
    const oldPassword = document.getElementById('oldPassword').value.trim();
    const newPassword = document.getElementById('newPassword').value.trim();
    
    if (!username || !oldPassword || !newPassword) {
        showToast('请输入用户名、旧密码和新密码', 'error');
        return;
    }
    
    try {
        // 先使用旧密码登录验证身份
        const loginResult = await API.login(username, oldPassword);
        if (loginResult.success) {
            // 更新密码
            await API.User.changePassword(loginResult.user.id, { newPassword: newPassword });
            showToast('密码修改成功', 'success');
            closeLoginModal();
        }
    } catch (error) {
        showToast('修改失败：' + error.message, 'error');
    }
}

// 更新登录状态UI
function updateLoginStatusUI() {
    const loginStatusBtn = document.getElementById('loginStatusBtn');
    const loginStatusText = document.getElementById('loginStatusText');
    
    if (isLoggedIn && currentUser) {
        loginStatusText.textContent = currentUser.name || currentUser.username;
        loginStatusBtn.classList.add('bg-blue-100', 'text-blue-700');
        loginStatusBtn.classList.remove('bg-gray-100', 'text-gray-700');
    } else {
        loginStatusText.textContent = '未登录';
        loginStatusBtn.classList.remove('bg-blue-100', 'text-blue-700');
        loginStatusBtn.classList.add('bg-gray-100', 'text-gray-700');
    }
}

// 启用编辑按钮
function enableEditButtons() {
    // 启用所有操作按钮
    document.querySelectorAll('.edit-btn, .delete-btn, .use-btn, .return-btn').forEach(btn => {
        btn.disabled = false;
    });
    
    // 启用新增辅料按钮
    addMaterialBtn.disabled = false;
    
    // 启用导入Excel按钮
    importExcelBtn.disabled = false;
    
    // 启用快速更新库存按钮
    const quickImportBtn = document.getElementById('quickImportBtn');
    if (quickImportBtn) {
        quickImportBtn.disabled = false;
    }
    
    // 启用导出Excel按钮
    exportExcelBtn.disabled = false;
    
    // 根据权限显示用户管理按钮
    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_admin')) {
        document.getElementById('userManagementBtn').style.display = 'flex';
    }
}

// 禁用编辑按钮
function disableEditButtons() {
    // 禁用所有操作按钮
    document.querySelectorAll('.edit-btn, .delete-btn, .use-btn, .return-btn').forEach(btn => {
        btn.disabled = true;
    });
    
    // 禁用新增辅料按钮
    addMaterialBtn.disabled = true;
    
    // 禁用导入Excel按钮
    importExcelBtn.disabled = true;
    
    // 禁用快速更新库存按钮
    const quickImportBtn = document.getElementById('quickImportBtn');
    if (quickImportBtn) {
        quickImportBtn.disabled = true;
    }
    
    // 禁用导出Excel按钮
    exportExcelBtn.disabled = true;
    
    // 隐藏用户管理按钮
    document.getElementById('userManagementBtn').style.display = 'none';
}

// 打开用户管理模态框
async function openUserManagementModal() {
    const modal = document.getElementById('userManagementModal');
    modal.classList.remove('hidden');
    await loadUsers();
}

// 关闭用户管理模态框
function closeUserManagementModalFunc() {
    const modal = document.getElementById('userManagementModal');
    modal.classList.add('hidden');
}

// 加载用户列表
async function loadUsers() {
    try {
        const result = await API.User.getAll();
        users = result.data || [];
        console.log('加载用户列表成功，用户数量:', users.length);
        console.log('用户数据:', users);
        updateUserTable();
    } catch (error) {
        console.error('加载用户列表错误:', error);
        showToast('加载用户列表失败：' + error.message, 'error');
    }
}

// 更新用户表格
function updateUserTable() {
    const tbody = document.getElementById('userTableBody');
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8">暂无用户</td></tr>';
        return;
    }
    
    tbody.innerHTML = users.map(user => `
        <tr>
            <td class="px-6 py-4">${user.username}</td>
            <td class="px-6 py-4">${user.name || '-'}</td>
            <td class="px-6 py-4">
                <span class="${getRoleClass(user.role)} px-2 py-1 rounded text-sm">${getRoleText(user.role)}</span>
            </td>
            <td class="px-6 py-4">${user.department || '-'}</td>
            <td class="px-6 py-4">
                <div class="flex space-x-2">
                    <button class="edit-user-btn px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600" data-user-id="${user.id}">
                        <i class="fa fa-edit"></i>
                    </button>
                    <button class="delete-user-btn px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600" data-user-id="${user.id}">
                        <i class="fa fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
    
    // 绑定用户管理事件
    bindUserManagementEvents();
}

// 获取角色样式
function getRoleClass(role) {
    switch(role) {
        case 'super_admin':
            return 'bg-purple-100 text-purple-800';
        case 'admin':
            return 'bg-blue-100 text-blue-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
}

// 获取角色文本
function getRoleText(role) {
    switch(role) {
        case 'super_admin':
            return '超级管理员';
        case 'admin':
            return '管理员';
        default:
            return '普通员工';
    }
}

// 绑定用户管理事件
function bindUserManagementEvents() {
    // 编辑用户按钮
    document.querySelectorAll('.edit-user-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const userId = parseInt(this.dataset.userId);
            editUser(userId);
        });
    });
    
    // 删除用户按钮
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
                await loadUsers();
            } catch (error) {
                showToast('删除用户失败：' + error.message, 'error');
            }
        });
    });
    
    // 新增用户按钮
    const addUserBtn = document.getElementById('addUserBtn');
    if (addUserBtn) {
        addUserBtn.addEventListener('click', openUserModal);
    }
}

// 打开用户弹窗
function openUserModal(user = null) {
    const modal = document.getElementById('userModal');
    const title = document.getElementById('userModalTitle');
    const form = document.getElementById('userForm');
    
    if (user) {
        title.textContent = '编辑用户';
        document.getElementById('userUsername').value = user.username;
        document.getElementById('userPassword').value = '';
        document.getElementById('userName').value = user.name || '';
        document.getElementById('userRole').value = user.role || 'employee';
        document.getElementById('userDepartment').value = user.department || '';
        document.getElementById('userUsername').disabled = true;
        document.getElementById('userPassword').required = false;
    } else {
        title.textContent = '新增用户';
        form.reset();
        document.getElementById('userUsername').value = '';
        document.getElementById('userUsername').disabled = false;
        document.getElementById('userPassword').required = true;
    }
    
    modal.classList.remove('hidden');
}

// 关闭用户弹窗
function closeUserModal() {
    const modal = document.getElementById('userModal');
    modal.classList.add('hidden');
}

// 保存用户
async function saveUser() {
    const form = document.getElementById('userForm');
    const formData = new FormData(form);
    
    const data = {
        username: formData.get('userUsername'),
        password: formData.get('userPassword'),
        name: formData.get('userName'),
        role: formData.get('userRole'),
        department: formData.get('userDepartment')
    };
    
    const isEdit = document.getElementById('userUsername').disabled;
    
    try {
        if (isEdit) {
            // 编辑用户，查找用户ID
            const user = users.find(u => u.username === data.username);
            if (user) {
                await API.User.update(user.id, {
                    name: data.name,
                    role: data.role,
                    department: data.department
                });
                if (data.password) {
                    await API.User.changePassword(user.id, { newPassword: data.password });
                }
                showToast('用户更新成功', 'success');
            }
        } else {
            // 新增用户时，如果姓名为空，使用用户名作为姓名
            if (!data.name || data.name.trim() === '') {
                data.name = data.username;
            }
            console.log('新增用户数据:', data);
            const result = await API.User.create(data);
            console.log('新增用户结果:', result);
            showToast('用户新增成功', 'success');
        }
        
        closeUserModal();
        await loadUsers();
    } catch (error) {
        showToast('保存失败：' + error.message, 'error');
    }
}

// 编辑用户
function editUser(id) {
    const user = users.find(item => item.id === id);
    if (user) {
        openUserModal(user);
    }
}

// 绑定用户弹窗事件
document.addEventListener('DOMContentLoaded', function() {
    const closeUserModalBtn = document.getElementById('closeUserModal');
    const cancelUserBtn = document.getElementById('cancelUserBtn');
    const confirmUserBtn = document.getElementById('confirmUserBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const confirmBtn = document.getElementById('confirmBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    
    if (closeUserModalBtn) closeUserModalBtn.addEventListener('click', closeUserModal);
    if (cancelUserBtn) cancelUserBtn.addEventListener('click', closeUserModal);
    if (confirmUserBtn) confirmUserBtn.addEventListener('click', saveUser);
    if (cancelBtn) cancelBtn.addEventListener('click', closeMaterialModal);
    if (confirmBtn) confirmBtn.addEventListener('click', saveMaterial);
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeMaterialModal);
});

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);