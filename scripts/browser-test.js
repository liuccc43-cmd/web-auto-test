/**
 * Playwright 浏览器自动化演示
 * 用法: node scripts/browser-test.js
 *
 * 演示：表单填写 → 页面交互 → 数据提取 → 截图
 * 使用本地 HTML 页面，零网络依赖
 */
const { chromium } = require('playwright');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'outputs');
const TEST_PAGE = `file:///${path.join(__dirname, '..', 'test-pages', 'form.html').replace(/\\/g, '/')}`;

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  console.log(`🌐 打开本地测试页: test-pages/form.html`);

  // 1. 打开本地测试页
  await page.goto(TEST_PAGE, { waitUntil: 'load' });

  // 2. 读取页面标题
  const pageTitle = await page.title();
  console.log(`   📄 页面标题: "${pageTitle}"`);

  // 3. 填写表单
  console.log('📝 填写表单...');
  await page.fill('#username', 'Playwright演示用户');
  await page.fill('#email', 'demo@playwright.dev');
  await page.selectOption('#role', 'qa');
  await page.check('#agree');
  console.log('   ✅ 表单已填写');

  // 4. 填写后截图
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'form-filled.png'), fullPage: true });
  console.log('   📸 截图: outputs/form-filled.png');

  // 5. 提交表单
  console.log('🚀 提交表单...');
  await page.click('button[type="submit"]');
  await page.waitForSelector('#result:visible', { timeout: 5000 });

  // 6. 验证结果
  const resultText = await page.textContent('#result');
  const isSuccess = resultText.includes('注册成功');
  console.log(`   ${isSuccess ? '✅' : '❌'} ${resultText.replace(/\n/g, ' ').trim()}`);

  // 7. 结果截图
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'form-result.png'), fullPage: true });
  console.log('   📸 截图: outputs/form-result.png');

  // 8. 第二次测试：不勾选同意直接提交（验证错误处理）
  console.log('\n🧪 边界测试：不勾选同意直接提交...');
  await page.goto(TEST_PAGE, { waitUntil: 'load' });
  await page.fill('#username', '测试用户2');
  await page.fill('#email', 'test2@test.com');
  await page.selectOption('#role', 'dev');
  // 故意不勾选 agree
  await page.click('button[type="submit"]');
  await page.waitForSelector('#result:visible', { timeout: 5000 });
  const errorText = await page.textContent('#result');
  console.log(`   ${errorText.includes('错误') ? '✅ 正确拦截' : '❌ 未拦截'} — ${errorText.trim()}`);

  await context.close();
  await browser.close();
  console.log('\n🎉 自动化测试全部完成！');
})();
