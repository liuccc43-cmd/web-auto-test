const { chromium } = require('playwright');
const path = require('path');

const URL = 'http://localhost:8080/index.html';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

// 三组不同特征的测试数据，覆盖边界情况
const TEST_USERS = [
  {
    name: '用户A — 中文短名',
    data: {
      firstName: '伟',
      lastName: '李',
      phone: '13912345678',
      company: '华为技术有限公司',
      jobTitle: '高级软件工程师',
      email: 'wei.li@huawei.com'
    }
  },
  {
    name: '用户B — 英文名+特殊字符',
    data: {
      firstName: 'Michael-James',
      lastName: "O'Connor",
      phone: '(010) 8888-6666',
      company: 'ABC Technology (Shanghai) Co., Ltd.',
      jobTitle: 'VP of Product & Design',
      email: 'm.oconnor@abc-tech.cn'
    }
  },
  {
    name: '用户C — 长字符串+非常规格式',
    data: {
      firstName: '穆罕默德·阿卜杜勒拉赫曼',
      lastName: '艾哈迈德·本·赛义德',
      phone: '+86-186-0000-1234',
      company: '新疆维吾尔自治区长名字进出口贸易有限公司',
      jobTitle: '副总经理兼技术总监/研发部主管',
      email: 'mohammed.ahmed@very-long-domain-name-company.cn'
    }
  }
];

const FIELD_ORDER = ['firstName', 'lastName', 'phone', 'company', 'jobTitle', 'email'];

(async () => {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    slowMo: 400
  });

  const context = await browser.newContext({
    viewport: { width: 500, height: 850 },
    deviceScaleFactor: 1,
  });

  const allIssues = [];
  const page = await context.newPage();
  const fs = require('fs');

  console.log('═══════════════════════════════════════════');
  console.log('  三用户分步表单注册 — 全面功能测试');
  console.log('═══════════════════════════════════════════\n');

  for (let u = 0; u < TEST_USERS.length; u++) {
    const user = TEST_USERS[u];
    const prefix = `user${u + 1}`;
    console.log(`┌─────────────────────────────────────────┐`);
    console.log(`│  测试 ${user.name.padEnd(36)}│`);
    console.log(`└─────────────────────────────────────────┘\n`);

    // 打开/刷新页面
    if (u === 0) {
      await page.goto(URL, { waitUntil: 'networkidle' });
    } else {
      await page.goto(URL, { waitUntil: 'networkidle' });
    }
    await page.waitForTimeout(600);

    // 逐字段填写
    for (let i = 0; i < FIELD_ORDER.length; i++) {
      const field = FIELD_ORDER[i];
      const value = user.data[field];

      // 检查步骤标签
      const stepText = await page.textContent('#stepLabel');
      const expectedStep = `问题 ${i + 1} / 6`;
      if (stepText !== expectedStep) {
        allIssues.push(`[${user.name}] 步骤${i+1}: 期望"${expectedStep}", 实际"${stepText}"`);
      }

      // 检查输入框存在
      const inputExists = await page.isVisible('#inputField');
      if (!inputExists) {
        allIssues.push(`[${user.name}] 步骤${i+1}: 输入框不可见`);
        break;
      }

      // 填写
      await page.fill('#inputField', value);
      await page.waitForTimeout(200);

      // 验证填入的值
      const actualValue = await page.$eval('#inputField', el => el.value);
      if (actualValue !== value) {
        allIssues.push(`[${user.name}] 步骤${i+1} ${field}: 填入"${value}"但输入框显示"${actualValue}"`);
      }

      // 截图
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `${prefix}-step${i + 1}-${field}.png`)
      });

      // 按 Enter 前进
      await page.press('#inputField', 'Enter');
      await page.waitForTimeout(600);

      // 如果最后一步 Enter 后进入汇总页，截图
      if (i === FIELD_ORDER.length - 1) {
        await page.waitForTimeout(400);
        const summaryVisible = await page.isVisible('.summary-card');
        if (!summaryVisible) {
          allIssues.push(`[${user.name}] 最后一步 Enter 后汇总页未显示`);
          break;
        }

        // 读取汇总页数据
        const summaryItems = await page.$$eval('.summary-item', items =>
          items.map(item => ({
            key: item.querySelector('.summary-key').textContent.trim(),
            value: item.querySelector('.summary-value').textContent.trim()
          }))
        );

        const labelMap = {
          '名字': 'firstName', '姓氏': 'lastName', '电话号码': 'phone',
          '公司名称': 'company', '职位': 'jobTitle', '电子邮箱': 'email'
        };

        console.log(`  汇总数据验证:`);
        let allMatch = true;
        summaryItems.forEach(item => {
          const fieldKey = labelMap[item.key];
          const expectedVal = user.data[fieldKey];
          const match = item.value === expectedVal;
          console.log(`    ${match ? '✓' : '✗'} ${item.key}: "${item.value}"`);
          if (!match) {
            allIssues.push(`[${user.name}] 汇总[${item.key}]: "${item.value}" ≠ 期望"${expectedVal}"`);
            allMatch = false;
          }
        });
        if (allMatch) console.log(`  → 6/6 字段全部正确`);

        // 汇总页截图
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `${prefix}-summary.png`)
        });

        // 点击提交
        await page.click('#btnSubmit');
        await page.waitForTimeout(300);

        const btnDisabled = await page.$eval('#btnSubmit', el => el.disabled);
        if (!btnDisabled) {
          allIssues.push(`[${user.name}] 点击提交后按钮未禁用`);
        }

        await page.waitForTimeout(900);

        const overlayVisible = await page.isVisible('.success-overlay.show');
        if (!overlayVisible) {
          allIssues.push(`[${user.name}] 提交后成功弹窗未显示`);
        } else {
          const msg = await page.textContent('.success-message');
          console.log(`  提交结果: "${msg}"`);
        }

        // 成功截图
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `${prefix}-success.png`)
        });

        // 关闭弹窗
        await page.click('.success-overlay');
        await page.waitForTimeout(500);
      }
    }

    console.log(`  ✓ ${user.name} 测试完成\n`);
  }

  // ========================================
  // 最终结果
  // ========================================
  console.log('═══════════════════════════════════════════');
  if (allIssues.length === 0) {
    console.log('  🎉 三用户全部测试通过！未发现任何问题。');
  } else {
    console.log(`  ⚠ 发现 ${allIssues.length} 个问题：`);
    allIssues.forEach((issue, i) => {
      console.log(`  ${i + 1}. ${issue}`);
    });
  }
  console.log('═══════════════════════════════════════════');

  console.log('\n浏览器将在 5 秒后关闭...');
  await page.waitForTimeout(5000);
  await browser.close();
  console.log('测试完成，浏览器已关闭。');
})();
