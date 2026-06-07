const { chromium } = require('playwright');
const path = require('path');

const HTML_FILE = `file:///${path.resolve(__dirname, 'index.html').replace(/\\/g, '/')}`;
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

(async () => {
  // 使用本机已有的 Chrome，无需额外下载浏览器
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width: 480, height: 800 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // 创建截图目录
  const fs = require('fs');
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  console.log('打开页面...');
  await page.goto(HTML_FILE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // ===== 步骤 1：名字 =====
  console.log('截图: 步骤 1 - 名字');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step-01-name.png'), fullPage: false });
  await page.fill('#inputField', '志明');
  await page.waitForTimeout(300);
  await page.press('#inputField', 'Enter');
  await page.waitForTimeout(500);

  // ===== 步骤 2：姓氏 =====
  console.log('截图: 步骤 2 - 姓氏');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step-02-lastname.png'), fullPage: false });
  await page.fill('#inputField', '张');
  await page.waitForTimeout(300);
  await page.press('#inputField', 'Enter');
  await page.waitForTimeout(500);

  // ===== 步骤 3：电话号码 =====
  console.log('截图: 步骤 3 - 电话号码');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step-03-phone.png'), fullPage: false });
  await page.fill('#inputField', '138-0000-0000');
  await page.waitForTimeout(300);
  await page.press('#inputField', 'Enter');
  await page.waitForTimeout(500);

  // ===== 步骤 4：公司名称 =====
  console.log('截图: 步骤 4 - 公司名称');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step-04-company.png'), fullPage: false });
  await page.fill('#inputField', '未来科技有限公司');
  await page.waitForTimeout(300);
  await page.press('#inputField', 'Enter');
  await page.waitForTimeout(500);

  // ===== 步骤 5：职位 =====
  console.log('截图: 步骤 5 - 职位');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step-05-jobtitle.png'), fullPage: false });
  await page.fill('#inputField', '产品经理');
  await page.waitForTimeout(300);
  await page.press('#inputField', 'Enter');
  await page.waitForTimeout(500);

  // ===== 步骤 6：电子邮箱 =====
  console.log('截图: 步骤 6 - 电子邮箱');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step-06-email.png'), fullPage: false });
  await page.fill('#inputField', 'zhiming@futuretech.com');
  await page.waitForTimeout(300);
  await page.press('#inputField', 'Enter');
  await page.waitForTimeout(600);

  // ===== 汇总页 =====
  console.log('截图: 汇总确认页');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step-07-summary.png'), fullPage: false });

  // ===== 点击提交 → 成功弹窗 =====
  await page.click('#btnSubmit');
  await page.waitForTimeout(1200);

  console.log('截图: 提交成功');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step-08-success.png'), fullPage: false });

  console.log('\n全部截图完成！保存在 screenshots/ 目录');
  console.log('共 8 张截图：');
  console.log('  step-01-name.png       — 名字输入页');
  console.log('  step-02-lastname.png   — 姓氏输入页');
  console.log('  step-03-phone.png      — 电话号码输入页');
  console.log('  step-04-company.png    — 公司名称输入页');
  console.log('  step-05-jobtitle.png   — 职位输入页');
  console.log('  step-06-email.png      — 电子邮箱输入页');
  console.log('  step-07-summary.png    — 汇总确认页');
  console.log('  step-08-success.png    — 提交成功弹窗');

  await browser.close();
})();
