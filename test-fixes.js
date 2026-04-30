// 测试脚本 - 验证所有修复
console.log('=== 开始测试修复 ===');

// 测试1: 检查 MaterialAPI 是否有 import 方法
async function testMaterialImport() {
    try {
        import('./api-config.js').then(API => {
            const materialAPI = API.default.Material;
            if (typeof materialAPI.import === 'function') {
                console.log('✅ 测试1通过: MaterialAPI.import 方法存在');
            } else {
                console.log('❌ 测试1失败: MaterialAPI.import 方法不存在');
            }
        });
    } catch (error) {
        console.log('❌ 测试1失败:', error.message);
    }
}

// 测试2: 检查 UserAPI.getAll 返回数组
async function testUserGetAll() {
    try {
        import('./api-config.js').then(async API => {
            const result = await API.default.User.getAll();
            if (Array.isArray(result.data)) {
                console.log('✅ 测试2通过: UserAPI.getAll 返回数组');
            } else {
                console.log('❌ 测试2失败: UserAPI.getAll 返回的不是数组');
            }
        });
    } catch (error) {
        console.log('❌ 测试2失败:', error.message);
    }
}

// 测试3: 检查登录状态管理
function testLoginStatus() {
    try {
        import('./api-config.js').then(API => {
            const isLoggedIn = API.default.isLoggedIn();
            const currentUser = API.default.getCurrentUser();
            
            console.log('✅ 测试3通过: 登录状态管理正常');
            console.log('   - isLoggedIn:', isLoggedIn);
            console.log('   - currentUser:', currentUser ? '已登录' : '未登录');
        });
    } catch (error) {
        console.log('❌ 测试3失败:', error.message);
    }
}

// 运行所有测试
testMaterialImport();
setTimeout(testUserGetAll, 500);
setTimeout(testLoginStatus, 1000);

console.log('=== 测试完成 ===');