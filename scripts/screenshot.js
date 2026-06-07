/**
 * Playwright 截图演示
 * 用法: node scripts/screenshot.js
 *
 * 同时截取桌面端和移动端视图，输出到 outputs/ 目录
 */
const { chromium } = require('playwright');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'outputs');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });

  const tasks = [
    {
      name: 'baidu-desktop',
      url: 'https://www.baidu.com',
      viewport: { width: 1920, height: 1080 },
    },
    {
      name: 'baidu-mobile',
      url: 'https://www.baidu.com',
      viewport: { width: 390, height: 844 },
      isMobile: true,
    },
    {
      name: '163-desktop',
      url: 'https://www.163.com',
      viewport: { width: 1280, height: 800 },
    },
  ];

  for (const { name, url, viewport, isMobile } of tasks) {
    const context = await browser.newContext({
      viewport,
      ...(isMobile ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15' } : {}),
    });
    const page = await context.newPage();

    console.log(`📸 截图中: ${name} (${viewport.width}x${viewport.height})`);
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      await page.screenshot({ path: path.join(OUTPUT_DIR, `${name}.png`), fullPage: false });
      console.log(`   ✅ 已保存: outputs/${name}.png`);
    } catch (err) {
      console.log(`   ❌ 失败: ${err.message.split('\n')[0]}`);
    }

    await context.close();
  }

  await browser.close();
  console.log('\n🎉 全部截图完成！查看 outputs/ 目录');
})();
