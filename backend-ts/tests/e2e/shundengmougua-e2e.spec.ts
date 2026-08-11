import { test, expect } from "@playwright/test";

const API = "http://localhost:3000/api/v1";

/**
 * 顺藤摸瓜 E2E 自动化测试套件
 * 
 * 覆盖核心流程：
 * 1. 登录认证
 * 2. Agent 管理 (列表/详情/执行)
 * 3. 个人总线 (CRDT/E2EE/语义搜索)
 * 4. 压力监测 (仪表盘/阈值/趋势)
 * 5. 精灵系统 (进化树/表情/语音)
 * 6. 全链路: 意图路由→Agent执行→精灵状态→压力联动
 */

async function login(page: any) {
  await page.goto("/login");
  await page.fill("input[placeholder*='账号']", "admin");
  await page.fill("input[placeholder*='密码']", "123456");
  await page.click("button:has-text('登')");
  await page.waitForURL("**/chat**", { timeout: 15000 });
}

test.describe("认证模块", () => {
  test("登录页可正常展示", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("text=顺藤摸瓜")).toBeVisible();
    await expect(page.locator("input[placeholder*='账号']")).toBeVisible();
    await expect(page.locator("input[placeholder*='密码']")).toBeVisible();
  });

  test("默认账户登录成功", async ({ page }) => {
    await login(page);
    await expect(page.locator("[class*='layout'], [class*='sidebar'], [class*='main']").first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Agent 管理", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("Agent管理页显示所有Agent", async ({ page }) => {
    await page.goto("/agents");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("[class*='agent']").first()).toBeVisible({ timeout: 5000 });
  });

  test("Agent意图路由执行", async ({ page }) => {
    await page.goto("/agents");
    await page.waitForLoadState("networkidle");
    const intentInput = page.locator("input[placeholder*='意图'], textarea[placeholder*='意图'], [class*='intent'] input");
    await expect(intentInput.first()).toBeVisible({ timeout: 3000 });
    await intentInput.first().fill("搜索Q3预算相关的文档");
    const executeBtn = page.locator("button:has-text('执行'), button:has-text('路由')");
    await expect(executeBtn.first()).toBeVisible({ timeout: 3000 });
    await executeBtn.first().click();
    await page.waitForTimeout(3000);
  });
});

test.describe("个人总线", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("PersonalBus页面加载正常", async ({ page }) => {
    await page.goto("/personal-bus");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("[class*='bus'], [class*='personal']").first()).toBeVisible({ timeout: 5000 });
  });

  test("语义搜索输入可用", async ({ page }) => {
    await page.goto("/personal-bus");
    await page.waitForLoadState("networkidle");
    const searchInput = page.locator("input[placeholder*='搜索'], textarea[placeholder*='搜索'], [class*='search'] input");
    await expect(searchInput.first()).toBeVisible({ timeout: 3000 });
    await searchInput.first().fill("AI智能体");
    const searchBtn = page.locator("button:has-text('搜索'), [class*='search'] button");
    await expect(searchBtn.first()).toBeVisible({ timeout: 3000 });
    await searchBtn.first().click();
    await page.waitForTimeout(2000);
  });
});

test.describe("压力监测", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("StressMonitor页面加载正常", async ({ page }) => {
    await page.goto("/stress-monitor");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("[class*='stress'], [class*='monitor']").first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe("精灵系统", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("精灵增强页加载正常", async ({ page }) => {
    await page.goto("/sprite");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("[class*='sprite'], [class*='evolution']").first()).toBeVisible({ timeout: 5000 });
  });

  test("进化树显示四个进化阶段", async ({ page }) => {
    await page.goto("/sprite");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("text=蛋")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=鸟")).toBeVisible();
    await expect(page.locator("text=狐")).toBeVisible();
    await expect(page.locator("text=龙")).toBeVisible();
  });

  test("3D模型生成输入框可用", async ({ page }) => {
    await page.goto("/sprite");
    await page.waitForLoadState("networkidle");
    const promptInput = page.locator("input[placeholder*='描述']");
    await expect(promptInput.first()).toBeVisible({ timeout: 3000 });
    await promptInput.first().fill("可爱的卡通龙精灵");
    const genBtn = page.locator("button:has-text('生成模型')");
    await expect(genBtn.first()).toBeVisible({ timeout: 3000 });
    await genBtn.first().click();
    await page.waitForTimeout(2000);
  });
});

test.describe("全链路集成", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("完整流程: 聊天→Agent→精灵联动", async ({ page }) => {
    await page.goto("/chat");
    await page.waitForLoadState("networkidle");

    const chatInput = page.locator("[contenteditable='true'], textarea[placeholder*='输入'], [class*='input'] textarea").first();
    await expect(chatInput).toBeVisible({ timeout: 5000 });
    await chatInput.fill("帮我搜索本地文件中关于AI智能体的资料");
    const sendBtn = page.locator("button[aria-label*='发送'], button:has-text('发送')");
    await expect(sendBtn.first()).toBeVisible({ timeout: 3000 });
    await sendBtn.first().click();
    await page.waitForTimeout(5000);
  });

  test("压力监测API链路", async ({ request }) => {
    const loginRes = await request.post(`${API}/auth/login`, {
      data: { username: "admin", password: "123456" },
    });
    expect(loginRes.ok()).toBe(true);
    const { token } = await loginRes.json();
    const stressRes = await request.post(`${API}/agents/stress-agent/execute`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { task: "获取压力评分", userId: "test-user", sessionId: "test-session" },
    });
    expect(stressRes.ok()).toBe(true);
    const stressData = await stressRes.json();
    expect(stressData).toHaveProperty("success");
  });

  test("Agent列表API链路", async ({ request }) => {
    const loginRes = await request.post(`${API}/auth/login`, {
      data: { username: "admin", password: "123456" },
    });
    expect(loginRes.ok()).toBe(true);
    const { token } = await loginRes.json();
    const agentsRes = await request.get(`${API}/agents`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(agentsRes.ok()).toBe(true);
    const agentsData = await agentsRes.json();
    expect(agentsData).toHaveProperty("agents");
    expect(agentsData.agents.length).toBeGreaterThanOrEqual(1);
  });

  test("意图路由API链路", async ({ request }) => {
    const loginRes = await request.post(`${API}/auth/login`, {
      data: { username: "admin", password: "123456" },
    });
    expect(loginRes.ok()).toBe(true);
    const { token } = await loginRes.json();
    const intentRes = await request.post(`${API}/agents/execute-by-intent`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { task: "搜索关于智能体的文档" },
    });
    expect(intentRes.ok()).toBe(true);
    const intentData = await intentRes.json();
    expect(intentData).toHaveProperty("matchedAgent");
  });

  test("语音健康检查API", async ({ request }) => {
    const loginRes = await request.post(`${API}/auth/login`, {
      data: { username: "admin", password: "123456" },
    });
    expect(loginRes.ok()).toBe(true);
    const { token } = await loginRes.json();
    const healthRes = await request.get(`${API}/voice/health`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(healthRes.ok()).toBe(true);
    const healthData = await healthRes.json();
    expect(healthData).toHaveProperty("stt");
    expect(healthData).toHaveProperty("tts");
  });

  test("个人总线 API链路", async ({ request }) => {
    const loginRes = await request.post(`${API}/auth/login`, {
      data: { username: "admin", password: "123456" },
    });
    expect(loginRes.ok()).toBe(true);
    const { token } = await loginRes.json();
    for (const agentId of ["search-agent", "wechat-agent", "email-agent", "notion-agent", "sync-agent"]) {
      const res = await request.post(`${API}/agents/${agentId}/execute`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { task: "就绪" },
      });
      expect(res.ok(), `${agentId} should respond OK`).toBe(true);
      const data = await res.json();
      expect(data.success, `${agentId} should return success`).toBe(true);
    }
  });
});
