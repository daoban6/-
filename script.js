// 辅料管理看板 JavaScript - 对接云端API版本

import API from './api-config.js';

// 全局变量
let materialData = []; // 原始物料数据
let filteredData = []; // 筛选后的物料数据
let currentPage = 1; // 当前页码
let itemsPerPage = 10; // 每页显示的记录数
let editingMaterialId = null; // 当前编辑的物料ID
let isLoggedIn = false; // 登录状态
let currentUser = null; // 当前登录用户
let users = []; // 用户列表

// 排序相关变量
let currentSortField = null; // 当前排序字段
let currentSortOrder = 'asc'; // 当前排序方向：asc(升序) / desc(降序)

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
const currentPageSpan = document.getElementById('currentPage');
const totalPagesSpan = document.getElementById('totalPages');
const itemsPerPageSelect = document.getElementById('itemsPerPageSelect');
const pageJumpInput = document.getElementById('pageJumpInput');
const pageJumpBtn = document.getElementById('pageJumpBtn');
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

    // 更新最后更新时间（动态更新）
    startTimeUpdate();

    // 从URL恢复搜索状态
    restoreSearchState();

    // 绑定事件
    bindEvents();

    // 更新登录状态UI
    updateLoginStatusUI();

    if (isLoggedIn) {
        enableEditButtons();
    } else {
        disableEditButtons();
    }

    // 定时更新数据（每30秒）
    setInterval(async () => {
        if (isLoggedIn) {
            await loadData();
            updateStatistics();
            // 重新应用搜索条件，保持搜索状态
            search();
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


// 保存搜索状态到URL参数
function saveSearchState() {
    const params = new URLSearchParams();
    if (codeSearch.value.trim()) params.set('code', codeSearch.value.trim());
    if (nameSearch.value.trim()) params.set('name', nameSearch.value.trim());
    if (specSearch.value.trim()) params.set('spec', specSearch.value.trim());
    if (currentFilterStatus) params.set('status', currentFilterStatus);
    
    window.history.replaceState({}, document.title, '?' + params.toString());
}

// 从URL参数恢复搜索状态
function restoreSearchState() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const name = params.get('name');
    const spec = params.get('spec');
    const status = params.get('status');
    
    if (code) codeSearch.value = code;
    if (name) nameSearch.value = name;
    if (spec) specSearch.value = spec;
    if (status) currentFilterStatus = status;
    
    if (code || name || spec || status) {
        search();
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
let currentFilterStatus = null; // 当前筛选的库存状态

function updateStatistics() {
    const total = filteredData.length;
    const normal = filteredData.filter(item => item.status === 'normal').length;
    const warning = filteredData.filter(item => item.status === 'warning').length;
    const shortage = filteredData.filter(item => item.status === 'shortage').length;
    
    totalCount.textContent = total;
    normalStockCount.textContent = normal;
    warningStockCount.textContent = warning;
    shortageStockCount.textContent = shortage;
    
    // 更新统计卡片的点击事件 - 使用更精确的选择器
    const statsContainer = document.querySelector('.grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-4');
    if (statsContainer) {
        const cards = statsContainer.querySelectorAll('div.bg-white.rounded-lg.shadow-sm.p-4');
        
        // 为每个卡片添加鼠标悬停效果
        cards.forEach(card => {
            card.style.cursor = 'pointer';
            card.style.transition = 'all 0.3s ease';
            card.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-4px)';
                this.style.boxShadow = '0 10px 20px rgba(0, 0, 0, 0.1)';
            });
            card.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0)';
                this.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
            });
        });
        
        if (cards.length >= 4) {
            // 辅料总数卡片
            cards[0].onclick = () => filterByStatus(null);
            
            // 正常库存卡片
            cards[1].onclick = () => filterByStatus('normal');
            
            // 库存预警卡片
            cards[2].onclick = () => filterByStatus('warning');
            
            // 库存不足卡片
            cards[3].onclick = () => filterByStatus('shortage');
        }
    }
}

// 按库存状态筛选
function filterByStatus(status) {
    currentFilterStatus = status;
    currentPage = 1; // 重置页码
    
    // 更新卡片高亮
    updateFilterHighlight();
    
    // 更新表格
    updateTable();
}

// 更新筛选高亮状态
function updateFilterHighlight() {
    const totalCountCard = totalCount.closest('.bg-white');
    const normalStockCard = normalStockCount.closest('.bg-white');
    const warningStockCard = warningStockCount.closest('.bg-white');
    const shortageStockCard = shortageStockCount.closest('.bg-white');
    
    // 移除所有高亮
    [totalCountCard, normalStockCard, warningStockCard, shortageStockCard].forEach(card => {
        if (card) {
            card.classList.remove('ring-2', 'ring-blue-500');
        }
    });
    
    // 添加高亮
    if (!currentFilterStatus) {
        totalCountCard?.classList.add('ring-2', 'ring-blue-500');
    } else if (currentFilterStatus === 'normal') {
        normalStockCard?.classList.add('ring-2', 'ring-blue-500');
    } else if (currentFilterStatus === 'warning') {
        warningStockCard?.classList.add('ring-2', 'ring-blue-500');
    } else if (currentFilterStatus === 'shortage') {
        shortageStockCard?.classList.add('ring-2', 'ring-blue-500');
    }
}

// 绑定排序事件
function bindSortEvents() {
    const sortHeaders = document.querySelectorAll('.sort-header');
    sortHeaders.forEach(header => {
        header.addEventListener('click', function() {
            const field = this.dataset.sort;
            
            // 如果点击的是当前排序字段，切换排序方向
            if (currentSortField === field) {
                currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
            } else {
                // 否则设置新的排序字段，默认升序
                currentSortField = field;
                currentSortOrder = 'asc';
            }
            
            // 重置页码到第一页
            currentPage = 1;
            
            // 更新排序图标显示
            updateSortIcons();
            
            // 更新表格
            updateTable();
        });
    });
}

// 更新排序图标显示
function updateSortIcons() {
    const sortHeaders = document.querySelectorAll('.sort-header');
    sortHeaders.forEach(header => {
        const icon = header.querySelector('.sort-icon');
        const field = header.dataset.sort;
        
        if (currentSortField === field) {
            icon.textContent = currentSortOrder === 'asc' ? '↑' : '↓';
            icon.classList.remove('text-gray-400');
            icon.classList.add('text-blue-500');
            header.classList.add('bg-gray-100');
        } else {
            icon.textContent = '↕';
            icon.classList.remove('text-blue-500');
            icon.classList.add('text-gray-400');
            header.classList.remove('bg-gray-100');
        }
    });
}

// 解析货架库位格式（如A-1-1）
function parseLocation(location) {
    if (!location || typeof location !== 'string') {
        return { zone: '', row: 0, column: 0, original: location || '' };
    }
    const parts = location.trim().split('-');
    return {
        zone: parts[0] || '',
        row: parseInt(parts[1]) || 0,
        column: parseInt(parts[2]) || 0,
        original: location
    };
}

// 更新表格
function updateTable() {
    // 根据状态筛选数据
    let dataToRender = filteredData;
    if (currentFilterStatus) {
        dataToRender = filteredData.filter(item => item.status === currentFilterStatus);
    }
    
    // 排序处理
    if (currentSortField) {
        dataToRender = [...dataToRender].sort((a, b) => {
            let valueA = a[currentSortField];
            let valueB = b[currentSortField];
            
            // 处理货架库位的智能排序（格式如A-1-1、A-1-2等）
            if (currentSortField === 'location') {
                const locA = parseLocation(valueA);
                const locB = parseLocation(valueB);
                
                // 先按区域字母排序（A, B, C...）
                if (locA.zone !== locB.zone) {
                    return currentSortOrder === 'asc' 
                        ? locA.zone.localeCompare(locB.zone)
                        : locB.zone.localeCompare(locA.zone);
                }
                
                // 再按行号排序
                if (locA.row !== locB.row) {
                    return currentSortOrder === 'asc' 
                        ? locA.row - locB.row
                        : locB.row - locA.row;
                }
                
                // 最后按列号排序
                return currentSortOrder === 'asc' 
                    ? locA.column - locB.column
                    : locB.column - locA.column;
            }
            
            // 处理数值类型字段
            if (currentSortField === 'warning_value' || currentSortField === 'max_quantity') {
                valueA = parseFloat(valueA) || 0;
                valueB = parseFloat(valueB) || 0;
            }
            
            // 处理字符串类型字段
            if (typeof valueA === 'string' && typeof valueB === 'string') {
                valueA = valueA.toLowerCase();
                valueB = valueB.toLowerCase();
            }
            
            if (valueA < valueB) return currentSortOrder === 'asc' ? -1 : 1;
            if (valueA > valueB) return currentSortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    }
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = dataToRender.slice(startIndex, endIndex);
    
    if (pageData.length === 0) {
        materialTableBody.innerHTML = '<tr><td colspan="9" class="text-center py-8">暂无数据</td></tr>';
        emptyData.style.display = 'block';
    } else {
        emptyData.style.display = 'none';
        materialTableBody.innerHTML = pageData.map(item => `
            <tr>
                <td class="px-2 py-2 whitespace-nowrap">${item.code || '-'}</td>
                <td class="px-2 py-2">${item.name || '-'}</td>
                <td class="px-2 py-2">${item.spec || '-'}</td>
                <td class="px-2 py-2">
                    <span class="px-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(item.status)}">${parseFloat(item.quantity || 0).toFixed(2)}</span>
                    <span class="text-gray-400">/${parseFloat(item.max_quantity || 0).toFixed(2)}</span>
                </td>
                <td class="px-2 py-2">${item.unit || '-'}</td>
                <td class="px-2 py-2">${parseFloat(item.warning_value || 0).toFixed(2)}</td>
                <td class="px-2 py-2">${item.location || '-'}</td>
                <td class="px-2 py-2">
                    <span class="px-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(item.status)}">
                        ${getStatusText(item.status)}
                    </span>
                </td>
                <td class="px-2 py-2 whitespace-nowrap">
                    ${isLoggedIn ? `
                    <div class="flex space-x-1">
                        <button class="edit-btn px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 ${!checkPermission('edit_material') ? 'opacity-40 cursor-not-allowed' : ''}" data-id="${item.id}" ${!checkPermission('edit_material') ? 'disabled' : ''}>
                            <i class="fa fa-edit"></i>
                        </button>
                        <button class="delete-btn px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 ${!checkPermission('delete_material') ? 'opacity-40 cursor-not-allowed' : ''}" data-id="${item.id}" ${!checkPermission('delete_material') ? 'disabled' : ''}>
                            <i class="fa fa-trash"></i>
                        </button>
                    </div>
                    ` : '-'}
                </td>
            </tr>
        `).join('');
        
        // 绑定表格操作按钮事件
        bindTableEvents();
    }
    
    updatePagination(dataToRender.length);
    
    // 触发表格更新事件
    document.dispatchEvent(new Event('tableUpdated'));
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

// 获取现有数量背景色类
function getQuantityBgClass(status) {
    switch(status) {
        case 'normal':
            return 'bg-green-50';
        case 'warning':
            return 'bg-yellow-50';
        case 'shortage':
            return 'bg-red-50';
        default:
            return '';
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
function updatePagination(dataLength) {
    const totalPages = Math.ceil(dataLength / itemsPerPage);
    const start = dataLength === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, dataLength);
    
    startRange.textContent = start;
    endRange.textContent = end;
    totalDataCount.textContent = dataLength;
    
    // 更新页码显示
    currentPageSpan.textContent = currentPage;
    totalPagesSpan.textContent = totalPages;
    
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
    
    // 操作日志按钮点击事件
    const operationLogBtn = document.getElementById('operationLogBtn');
    if (operationLogBtn) {
        operationLogBtn.addEventListener('click', showOperationLogModal);
    }
    
    // 初始化登录状态UI
    updateLoginStatusUI();
    
    // 绑定登录相关事件
    bindLoginEvents();
    
    // 分页按钮事件
    prevPageBtn.addEventListener('click', prevPage);
    nextPageBtn.addEventListener('click', nextPage);
    
    // 每页显示数量选择事件
    itemsPerPageSelect.addEventListener('change', function() {
        itemsPerPage = parseInt(this.value);
        currentPage = 1;
        updateTable();
    });
    
    // 页码跳转事件
    pageJumpBtn.addEventListener('click', function() {
        const targetPage = parseInt(pageJumpInput.value);
        if (targetPage && targetPage >= 1) {
            const totalPages = Math.ceil(filteredData.length / itemsPerPage);
            currentPage = Math.min(targetPage, totalPages);
            pageJumpInput.value = '';
            updateTable();
        }
    });
    
    // 页码输入回车事件
    pageJumpInput.addEventListener('keyup', function(e) {
        if (e.key === 'Enter') {
            pageJumpBtn.click();
        }
    });
    
    // 排序按钮事件
    bindSortEvents();
    
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
    
    // 列宽度调整功能
    bindColumnResize();
    
    // 表格更新后重新绑定列宽度调整事件
    document.addEventListener('tableUpdated', function() {
        bindColumnResize();
    });
}

// 绑定表格事件
function bindTableEvents() {
    // 编辑按钮
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = parseInt(this.dataset.id);
            editMaterial(id);
        });
    });
    
    // 删除按钮
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = parseInt(this.dataset.id);
            deleteMaterial(id);
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
    saveSearchState();
}

// 列宽度调整功能
function bindColumnResize() {
    const table = document.getElementById('materialTable');
    const handles = document.querySelectorAll('.col-resize-handle');
    let isResizing = false;
    let currentColumnIndex = -1;
    let startX = 0;
    let startWidth = 0;
    
    handles.forEach(handle => {
        handle.addEventListener('mousedown', function(e) {
            isResizing = true;
            currentColumnIndex = parseInt(this.dataset.column);
            startX = e.clientX;
            
            const headerCells = table.querySelectorAll('thead th');
            if (headerCells[currentColumnIndex]) {
                startWidth = headerCells[currentColumnIndex].offsetWidth;
            }
            
            this.classList.add('active');
            document.addEventListener('mousemove', onColumnResize);
            document.addEventListener('mouseup', onColumnResizeEnd);
            e.preventDefault();
        });
    });
    
    function onColumnResize(e) {
        if (!isResizing || currentColumnIndex < 0) return;
        
        const deltaX = e.clientX - startX;
        const minWidth = 1;
        const maxWidth = 1000;
        let newWidth = startWidth + deltaX;
        
        newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
        
        const headerCells = table.querySelectorAll('thead th');
        const bodyRows = table.querySelectorAll('tbody tr');
        
        if (headerCells[currentColumnIndex]) {
            headerCells[currentColumnIndex].style.width = newWidth + 'px';
        }
        
        bodyRows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells[currentColumnIndex]) {
                cells[currentColumnIndex].style.width = newWidth + 'px';
            }
        });
    }
    
    function onColumnResizeEnd() {
        isResizing = false;
        currentColumnIndex = -1;
        
        document.querySelectorAll('.col-resize-handle').forEach(h => {
            h.classList.remove('active');
        });
        
        document.removeEventListener('mousemove', onColumnResize);
        document.removeEventListener('mouseup', onColumnResizeEnd);
    }
}

// 重置搜索 - 返回主界面显示所有库存
function resetSearch() {
    codeSearch.value = '';
    nameSearch.value = '';
    specSearch.value = '';
    filteredData = [...materialData];
    currentPage = 1;
    currentFilterStatus = null; // 清除状态筛选
    updateTable();
    updateStatistics();
    updateFilterHighlight(); // 更新筛选高亮状态
    saveSearchState();
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
    const codeInput = document.getElementById('materialCode');
    
    if (material && material.id) {
        title.textContent = '编辑辅料';
        editingMaterialId = material.id;
        codeInput.value = material.code || '';
        document.getElementById('materialName').value = material.name || '';
        document.getElementById('materialSpec').value = material.spec || '';
        document.getElementById('materialUnit').value = material.unit || '';
        document.getElementById('materialQuantity').value = parseFloat(material.quantity || 0);
        document.getElementById('warningValue').value = parseFloat(material.warning_value || 0);
        document.getElementById('materialMaxQuantity').value = parseFloat(material.max_quantity || 0);
        document.getElementById('materialLocation').value = material.location || '';
        document.getElementById('materialRemark').value = material.remark || '';
        codeInput.disabled = true;
    } else {
        title.textContent = '新增辅料';
        editingMaterialId = null;
        form.reset();
        codeInput.disabled = false;
        codeInput.focus();
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
    const codeInput = document.getElementById('materialCode');
    
    // 临时启用禁用的物料编码字段以便获取值
    const wasDisabled = codeInput.disabled;
    if (wasDisabled) {
        codeInput.disabled = false;
    }
    
    const formData = new FormData(form);
    
    const data = {
        code: formData.get('materialCode'),
        name: formData.get('materialName'),
        spec: formData.get('materialSpec'),
        unit: formData.get('materialUnit'),
        quantity: parseFloat(formData.get('materialQuantity')) || 0,
        warning_value: parseFloat(formData.get('warningValue')) || 0,
        max_quantity: parseFloat(formData.get('materialMaxQuantity')) || 0,
        location: formData.get('materialLocation'),
        remark: formData.get('materialRemark')
    };
    
    // 恢复禁用状态
    if (wasDisabled) {
        codeInput.disabled = true;
    }
    
    // 验证必填字段
    if (!data.code || !data.name || !data.spec || !data.unit) {
        showToast('请填写所有必填字段', 'error');
        return;
    }
    
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
        // 如果是未授权错误，提示用户登录
        if (error.message.includes('未授权') || error.message.includes('token')) {
            showToast('请先登录', 'info');
        } else {
            showToast('保存失败：' + error.message, 'error');
        }
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
        // 如果是未授权错误，提示用户登录
        if (error.message.includes('未授权') || error.message.includes('token')) {
            showToast('请先登录', 'info');
        } else {
            showToast('删除失败：' + error.message, 'error');
        }
    }
}



// 通用文件上传处理函数
async function handleFileUpload(event, apiMethod, operationType, successMessage, errorMessagePrefix) {
    const file = event.target.files[0];
    if (!file) return;
    
    console.log(`[${operationType === 'import' ? 'Excel导入' : '快速更新库存'}] 开始处理文件:`, file.name);
    console.log(`[${operationType === 'import' ? 'Excel导入' : '快速更新库存'}] 文件大小:`, file.size, 'bytes');
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        const base64Data = e.target.result.split(',')[1];
        console.log(`[${operationType === 'import' ? 'Excel导入' : '快速更新库存'}] 文件读取完成，准备调用API...`);
        
        try {
            const beforeMaterials = JSON.parse(JSON.stringify(materialData));
            console.log(`[${operationType === 'import' ? 'Excel导入' : '快速更新库存'}] 更新前物料数量:`, beforeMaterials.length);
            
            const result = await apiMethod(base64Data);
            console.log(`[${operationType === 'import' ? 'Excel导入' : '快速更新库存'}] API调用成功:`, result);
            
            await loadData();
            console.log(`[${operationType === 'import' ? 'Excel导入' : '快速更新库存'}] 数据重新加载完成，当前物料数量:`, materialData.length);
            
            // 使用API返回的详细消息
            const apiMessage = result.message || successMessage;
            
            const logDetails = generateImportLog(beforeMaterials, materialData, file.name, operationType);
            console.log(`[${operationType === 'import' ? 'Excel导入' : '快速更新库存'}] 生成操作日志，变更记录数:`, logDetails.length);
            
            addOperationLog({
                type: operationType,
                fileName: file.name,
                timestamp: new Date().toISOString(),
                operator: currentUser?.name || currentUser?.username || '未知用户',
                details: logDetails,
                success: true,
                message: apiMessage
            });
            
            showToast(apiMessage, 'success');
            updateStatistics();
            updateTable();
            
            console.log(`[${operationType === 'import' ? 'Excel导入' : '快速更新库存'}] 操作完成！`);
        } catch (error) {
            console.error(`[${operationType === 'import' ? 'Excel导入' : '快速更新库存'}] 操作失败:`, error);
            
            addOperationLog({
                type: operationType,
                fileName: file.name,
                timestamp: new Date().toISOString(),
                operator: currentUser?.name || currentUser?.username || '未知用户',
                details: [],
                success: false,
                message: errorMessagePrefix + '：' + error.message
            });
            showToast(errorMessagePrefix + '：' + error.message, 'error');
        }
    };
    
    reader.readAsDataURL(file);
}

// 处理Excel导入
function handleExcelImport(event) {
    handleFileUpload(
        event,
        API.Material.import,
        'import',
        '导入成功',
        '导入失败'
    );
}

function generateImportLog(beforeMaterials, afterMaterials, fileName, type) {
    const logDetails = [];
    const beforeMap = new Map();
    const afterMap = new Map();
    
    beforeMaterials.forEach(m => beforeMap.set(m.code, m));
    afterMaterials.forEach(m => afterMap.set(m.code, m));
    
    const allCodes = new Set([...beforeMap.keys(), ...afterMap.keys()]);
    
    allCodes.forEach(code => {
        const before = beforeMap.get(code);
        const after = afterMap.get(code);
        
        if (!before && after) {
            logDetails.push({
                code: after.code,
                name: after.name,
                spec: after.spec,
                before_quantity: 0,
                after_quantity: parseFloat(after.quantity) || 0,
                change: parseFloat(after.quantity) || 0,
                action: '新增'
            });
        } else if (before && !after) {
            logDetails.push({
                code: before.code,
                name: before.name,
                spec: before.spec,
                before_quantity: parseFloat(before.quantity) || 0,
                after_quantity: 0,
                change: -(parseFloat(before.quantity) || 0),
                action: '删除'
            });
        } else if (before && after) {
            const beforeQty = parseFloat(before.quantity) || 0;
            const afterQty = parseFloat(after.quantity) || 0;
            const change = afterQty - beforeQty;
            
            if (change !== 0 || before.name !== after.name || before.spec !== after.spec) {
                logDetails.push({
                    code: after.code,
                    name: after.name,
                    spec: after.spec,
                    before_quantity: beforeQty,
                    after_quantity: afterQty,
                    change: change,
                    action: type === 'quick_update' ? '库存更新' : '修改'
                });
            }
        }
    });
    
    return logDetails;
}

async function addOperationLog(log) {
    try {
        await API.OperationLog.create({
            type: log.type,
            fileName: log.fileName,
            details: log.details,
            success: log.success,
            message: log.message
        });
    } catch (error) {
        console.error('保存操作日志失败:', error);
    }
}

async function getOperationLogs(page = 1, limit = 20) {
    try {
        const result = await API.OperationLog.getAll({ page, limit });
        return result.data || [];
    } catch (error) {
        console.error('获取操作日志失败:', error);
        return [];
    }
}

async function showOperationLogModal() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h3 class="text-lg font-semibold text-gray-800">操作日志</h3>
                <button id="closeLogModal" class="text-gray-400 hover:text-gray-600 focus:outline-none">
                    <i class="fa fa-times text-xl"></i>
                </button>
            </div>
            <div class="flex-1 overflow-auto p-4">
                <div id="logsContent" class="space-y-4">
                    <div class="text-center text-gray-500 py-8">
                        <i class="fa fa-spinner fa-spin text-xl mb-2"></i>
                        <p>加载中...</p>
                    </div>
                </div>
            </div>
            <div class="px-6 py-4 border-t border-gray-200 flex justify-end">
                <button id="clearLogsBtn" class="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg focus:outline-none mr-2">
                    <i class="fa fa-trash mr-1"></i>清空日志
                </button>
                <button id="closeLogModalBtn" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 focus:outline-none">
                    关闭
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const closeModal = () => {
        if (modal && modal.parentNode) {
            document.body.removeChild(modal);
        }
    };
    
    modal.querySelector('#closeLogModal').addEventListener('click', closeModal);
    modal.querySelector('#closeLogModalBtn').addEventListener('click', closeModal);
    
    const clearLogsBtn = modal.querySelector('#clearLogsBtn');
    if (clearLogsBtn) {
        clearLogsBtn.addEventListener('click', async () => {
            if (confirm('确定要清空所有操作日志吗？')) {
                try {
                    await API.OperationLog.clear();
                    closeModal();
                    showToast('日志已清空', 'success');
                } catch (error) {
                    showToast('清空失败：' + error.message, 'error');
                }
            }
        });
    }
    
    const logsContent = modal.querySelector('#logsContent');
    try {
        const logs = await getOperationLogs();
        
        if (logs.length === 0) {
            logsContent.innerHTML = '<div class="text-center text-gray-500 py-8">暂无操作记录</div>';
            return;
        }
        
        logsContent.innerHTML = logs.map(log => `
            <div class="border rounded-lg p-4">
                <div class="flex items-start justify-between mb-2">
                    <div class="flex items-center">
                        <span class="px-2 py-1 rounded text-xs font-medium ${
                            log.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }">
                            ${log.type === 'import' ? 'Excel导入' : '快速更新库存'}
                        </span>
                        <span class="ml-2 text-sm text-gray-600">${formatDateTime(log.created_at)}</span>
                        <span class="ml-2 text-sm text-gray-500">操作人: ${log.operator_name}</span>
                    </div>
                    <span class="text-xs text-gray-400">${log.file_name}</span>
                </div>
                <div class="text-sm mb-2 ${log.success ? 'text-green-600' : 'text-red-600'}">
                    ${log.message}
                </div>
                ${log.details && log.details.length > 0 ? `
                    <div class="mt-3">
                        <div class="text-xs font-medium text-gray-700 mb-2">库存变化明细:</div>
                        <div class="overflow-x-auto">
                            <table class="w-full text-xs border-collapse">
                                <thead>
                                    <tr class="bg-gray-50">
                                        <th class="border px-2 py-1 text-left">物料编码</th>
                                        <th class="border px-2 py-1 text-left">物料名称</th>
                                        <th class="border px-2 py-1 text-left">规格</th>
                                        <th class="border px-2 py-1 text-right">变更前</th>
                                        <th class="border px-2 py-1 text-right">变更后</th>
                                        <th class="border px-2 py-1 text-right">变更量</th>
                                        <th class="border px-2 py-1 text-left">操作类型</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${log.details.map(detail => `
                                        <tr>
                                            <td class="border px-2 py-1">${detail.code}</td>
                                            <td class="border px-2 py-1">${detail.name}</td>
                                            <td class="border px-2 py-1">${detail.spec}</td>
                                            <td class="border px-2 py-1 text-right">${detail.before_quantity}</td>
                                            <td class="border px-2 py-1 text-right">${detail.after_quantity}</td>
                                            <td class="border px-2 py-1 text-right ${detail.change > 0 ? 'text-green-600' : detail.change < 0 ? 'text-red-600' : ''}">
                                                ${detail.change > 0 ? '+' : ''}${detail.change}
                                            </td>
                                            <td class="border px-2 py-1">${detail.action}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ` : ''}
            </div>
        `).join('');
    } catch (error) {
        logsContent.innerHTML = `<div class="text-center text-red-500 py-8">加载失败：${error.message}</div>`;
    }
}

function formatDateTime(isoString) {
    let date;
    if (isoString && isoString.includes('T') && !isoString.includes('Z')) {
        date = new Date(isoString + 'Z');
    } else {
        date = new Date(isoString);
    }
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// 处理快速更新库存
function handleQuickImport(event) {
    handleFileUpload(
        event,
        API.Material.updateQuantityBatch,
        'quick_update',
        '快速更新库存完成',
        '快速更新库存失败'
    );
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
            downloadFile(response.data, response.filename);
        } catch (error) {
            showToast('导出失败：' + error.message, 'error');
        }
        closeModal();
    });
    
    if (exportNormalBtn) exportNormalBtn.addEventListener('click', async function() {
        try {
            const response = await API.Material.export('normal');
            downloadFile(response.data, response.filename);
        } catch (error) {
            showToast('导出失败：' + error.message, 'error');
        }
        closeModal();
    });
    
    if (exportWarningBtn) exportWarningBtn.addEventListener('click', async function() {
        try {
            const response = await API.Material.export('warning');
            downloadFile(response.data, response.filename);
        } catch (error) {
            showToast('导出失败：' + error.message, 'error');
        }
        closeModal();
    });
    
    if (exportShortageBtn) exportShortageBtn.addEventListener('click', async function() {
        try {
            const response = await API.Material.export('shortage');
            downloadFile(response.data, response.filename);
        } catch (error) {
            showToast('导出失败：' + error.message, 'error');
        }
        closeModal();
    });
}

// 下载文件
function downloadFile(data, filename) {
    // 先检查是否是JSON错误响应
    if (typeof data === 'string' && data.length > 0) {
        try {
            const jsonData = JSON.parse(data);
            if (jsonData.error) {
                showToast('导出失败: ' + jsonData.error, 'error');
                return;
            }
        } catch (e) {
            // 不是JSON，继续处理
        }
    }

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
    
    // 如果是 base64 字符串，转换为 Blob
    if (typeof data === 'string' && data.length > 0) {
        try {
            // 使用更安全的 base64 解码方式
            const sanitizedData = data.replace(/-/g, '+').replace(/_/g, '/');
            const padding = (4 - (sanitizedData.length % 4)) % 4;
            const paddedData = sanitizedData + '='.repeat(padding);
            
            const byteCharacters = atob(paddedData);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            return;
        } catch (error) {
            console.error('Failed to decode base64 data:', error);
            showToast('导出失败: 数据解析错误', 'error');
            return;
        }
    }
    
    // 如果是数据数组，转换为 Excel
    if (!data || data.length === 0) {
        showToast('没有数据可导出', 'warning');
        return;
    }
    
    const headers = ['物料编码', '物料名称', '物料规格', '现有数量', '库存峰值', '单位', '预警值', '货架库位', '库存状态', '备注'];
    const rows = data.map(item => [
        item.code || '',
        item.name || '',
        item.spec || '',
        parseFloat(item.quantity || 0).toFixed(2),
        parseFloat(item.max_quantity || 0).toFixed(2),
        item.unit || '',
        parseFloat(item.warning_value || 0).toFixed(2),
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

// 启动时间动态更新
function startTimeUpdate() {
    updateLastUpdateTime();
    setInterval(updateLastUpdateTime, 1000); // 每秒更新一次
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
    const loginButton = document.getElementById('loginBtn');
    
    if (loginTab) {
        loginTab.addEventListener('click', function() {
            showLoginForm();
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
}

// 显示登录表单
function showLoginForm() {
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('loginBtn').classList.remove('hidden');
    document.getElementById('loginModalTitle').textContent = '请登录以修改数据';
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
            
            // 只有超级管理员可以管理用户
            if (currentUser.role === 'super_admin') {
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

// 启用编辑按钮（根据权限）
function enableEditButtons() {
    // 编辑按钮 - 管理员以上
    document.querySelectorAll('.edit-btn').forEach(btn => {
        if (checkPermission('edit_material')) {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        } else {
            btn.disabled = true;
            btn.style.opacity = '0.4';
            btn.style.cursor = 'not-allowed';
        }
    });
    
    // 删除按钮 - 管理员以上
    document.querySelectorAll('.delete-btn').forEach(btn => {
        if (checkPermission('delete_material')) {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        } else {
            btn.disabled = true;
            btn.style.opacity = '0.4';
            btn.style.cursor = 'not-allowed';
        }
    });
    
    
    
    // 新增辅料按钮 - 管理员以上
    if (checkPermission('add_material')) {
        addMaterialBtn.disabled = false;
        addMaterialBtn.style.opacity = '1';
        addMaterialBtn.style.cursor = 'pointer';
    } else {
        addMaterialBtn.disabled = true;
        addMaterialBtn.style.opacity = '0.4';
        addMaterialBtn.style.cursor = 'not-allowed';
    }
    
    // 导入Excel按钮 - 管理员以上
    if (checkPermission('import_material')) {
        importExcelBtn.disabled = false;
        importExcelBtn.style.opacity = '1';
        importExcelBtn.style.cursor = 'pointer';
    } else {
        importExcelBtn.disabled = true;
        importExcelBtn.style.opacity = '0.4';
        importExcelBtn.style.cursor = 'not-allowed';
    }
    
    // 快速更新库存按钮 - 管理员以上
    const quickImportBtn = document.getElementById('quickImportBtn');
    if (quickImportBtn) {
        if (checkPermission('update_quantity')) {
            quickImportBtn.disabled = false;
            quickImportBtn.style.opacity = '1';
            quickImportBtn.style.cursor = 'pointer';
        } else {
            quickImportBtn.disabled = true;
            quickImportBtn.style.opacity = '0.4';
            quickImportBtn.style.cursor = 'not-allowed';
        }
    }
    
    // 导出Excel按钮 - 所有登录用户
    if (checkPermission('export_material')) {
        exportExcelBtn.disabled = false;
        exportExcelBtn.style.opacity = '1';
        exportExcelBtn.style.cursor = 'pointer';
    } else {
        exportExcelBtn.disabled = true;
        exportExcelBtn.style.opacity = '0.4';
        exportExcelBtn.style.cursor = 'not-allowed';
    }
    
    // 使用量管理按钮 - 登录用户
    const usageTrackingBtn = document.getElementById('usageTrackingBtn');
    if (usageTrackingBtn) {
        if (isLoggedIn) {
            usageTrackingBtn.disabled = false;
            usageTrackingBtn.style.opacity = '1';
            usageTrackingBtn.style.cursor = 'pointer';
        } else {
            usageTrackingBtn.disabled = true;
            usageTrackingBtn.style.opacity = '0.4';
            usageTrackingBtn.style.cursor = 'not-allowed';
        }
    }
    
    // 用户管理按钮 - 超级管理员
    const userManagementBtn = document.getElementById('userManagementBtn');
    if (userManagementBtn) {
        if (checkPermission('manage_users')) {
            userManagementBtn.style.display = 'flex';
            userManagementBtn.style.opacity = '1';
            userManagementBtn.style.cursor = 'pointer';
        } else {
            userManagementBtn.style.display = 'none';
        }
    }
}

// 检查权限
function checkPermission(permission) {
    if (!isLoggedIn || !currentUser) return false;
    
    const permissions = {
        // 超级管理员权限
        'super_admin': ['add_material', 'edit_material', 'delete_material', 'import_material', 'export_material', 'update_quantity', 'add_usage', 'add_return', 'export_usage', 'manage_users', 'add_user', 'edit_user', 'delete_user'],
        // 管理员权限
        'admin': ['add_material', 'edit_material', 'delete_material', 'import_material', 'export_material', 'update_quantity', 'add_usage', 'add_return', 'export_usage', 'add_user', 'edit_user'],
        // 普通用户权限
        'user': ['add_usage', 'export_material', 'export_usage']
    };
    
    const userPermissions = permissions[currentUser.role] || [];
    return userPermissions.includes(permission);
}

// 禁用编辑按钮
function disableEditButtons() {
    // 禁用所有操作按钮并设置透明度
    document.querySelectorAll('.edit-btn, .delete-btn').forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.4';
        btn.style.cursor = 'not-allowed';
    });
    
    // 禁用新增辅料按钮
    addMaterialBtn.disabled = true;
    addMaterialBtn.style.opacity = '0.4';
    addMaterialBtn.style.cursor = 'not-allowed';
    
    // 禁用导入Excel按钮
    importExcelBtn.disabled = true;
    importExcelBtn.style.opacity = '0.4';
    importExcelBtn.style.cursor = 'not-allowed';
    
    // 禁用快速更新库存按钮
    const quickImportBtn = document.getElementById('quickImportBtn');
    if (quickImportBtn) {
        quickImportBtn.disabled = true;
        quickImportBtn.style.opacity = '0.4';
        quickImportBtn.style.cursor = 'not-allowed';
    }
    
    // 禁用导出Excel按钮
    exportExcelBtn.disabled = true;
    exportExcelBtn.style.opacity = '0.4';
    exportExcelBtn.style.cursor = 'not-allowed';
    
    // 隐藏用户管理按钮
    const userManagementBtn = document.getElementById('userManagementBtn');
    if (userManagementBtn) {
        userManagementBtn.style.display = 'none';
    }
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
                // 如果是未授权错误，提示用户登录
                if (error.message.includes('未授权') || error.message.includes('token')) {
                    showToast('请先登录', 'info');
                } else {
                    showToast('删除用户失败：' + error.message, 'error');
                }
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
    const usernameInput = document.getElementById('userUsername');
    const passwordInput = document.getElementById('userPassword');
    const nameInput = document.getElementById('userName');
    
    if (user && user.id) {
        title.textContent = '编辑用户';
        usernameInput.value = user.username || user.name || '';
        passwordInput.value = '';
        document.getElementById('userRole').value = user.role || 'user';
        document.getElementById('userDepartment').value = user.department || '';
        usernameInput.disabled = true;
        passwordInput.required = false;
        passwordInput.placeholder = '留空则不修改密码';
    } else {
        title.textContent = '新增用户';
        form.reset();
        usernameInput.value = '';
        passwordInput.required = true;
        passwordInput.placeholder = '请输入密码';
        usernameInput.disabled = false;
        document.getElementById('userPassword').required = true;
    }
    
    modal.classList.remove('hidden');
}

// 用户名输入时自动同步到姓名
function syncUsernameToName() {
    const usernameInput = document.getElementById('userUsername');
    const nameInput = document.getElementById('userName');
    const modalTitle = document.getElementById('userModalTitle');
    
    // 只有在新增用户时才自动同步
    if (modalTitle.textContent === '新增用户' && usernameInput.value && !nameInput.value) {
        nameInput.value = usernameInput.value;
    }
}

// 关闭用户弹窗
function closeUserModal() {
    const modal = document.getElementById('userModal');
    modal.classList.add('hidden');
}

// 保存用户
async function saveUser() {
    const form = document.getElementById('userForm');
    const usernameInput = document.getElementById('userUsername');
    const passwordInput = document.getElementById('userPassword');
    
    // 临时启用禁用的用户名字段以便获取值
    const wasDisabled = usernameInput.disabled;
    if (wasDisabled) {
        usernameInput.disabled = false;
    }
    
    const formData = new FormData(form);
    
    const data = {
        username: formData.get('userUsername'),
        password: formData.get('userPassword'),
        name: formData.get('userName'),
        role: formData.get('userRole'),
        department: formData.get('userDepartment')
    };
    
    // 恢复禁用状态
    if (wasDisabled) {
        usernameInput.disabled = true;
    }
    
    const isEdit = wasDisabled;
    
    try {
        if (isEdit) {
            // 编辑用户，查找用户ID
            const user = users.find(u => u.username === data.username);
            if (user) {
                await API.User.update(user.id, {
                    role: data.role,
                    department: data.department
                });
                if (data.password && data.password.trim()) {
                    await API.User.changePassword(user.id, { newPassword: data.password });
                }
                showToast('用户更新成功', 'success');
            }
        } else {
            // 新增用户时，用户名和姓名保持一致
            data.name = data.username;
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

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 绑定用户弹窗事件
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
    
    // 初始化
    init();
});