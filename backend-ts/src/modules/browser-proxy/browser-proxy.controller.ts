import { Controller, Get, Query, Res } from "@nestjs/common";
import { Response } from "express";

const MAX_BODY = 8 * 1024 * 1024; // 8MB

const GOOGLEBOT_UA =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

@Controller("browser-proxy")
export class BrowserProxyController {
  private pwBrowser: any = null;
  // 渲染结果缓存：同 URL 30 分钟内秒开，避免重复无头渲染
  private renderCache = new Map<string, { html: string; ts: number }>();
  private static CACHE_TTL = 30 * 60 * 1000;
  private static CACHE_MAX = 50;

  private getCached(url: string): string | null {
    const hit = this.renderCache.get(url);
    if (hit) {
      if (Date.now() - hit.ts < BrowserProxyController.CACHE_TTL) return hit.html;
      this.renderCache.delete(url);
    }
    return null;
  }

  private setCached(url: string, html: string) {
    if (this.renderCache.size >= BrowserProxyController.CACHE_MAX) {
      // 淘汰最旧的一条
      let oldestKey: string | null = null;
      let oldestTs = Infinity;
      for (const [k, v] of this.renderCache) {
        if (v.ts < oldestTs) {
          oldestTs = v.ts;
          oldestKey = k;
        }
      }
      if (oldestKey) this.renderCache.delete(oldestKey);
    }
    this.renderCache.set(url, { html, ts: Date.now() });
  }

  // 用无头浏览器渲染页面（Googlebot UA 可免人机验证），返回静态化 HTML：
  // SPA 壳/挑战页在 iframe 里无法正常渲染（跨域 API 被 CORS 拦截），
  // 无头浏览器内 JS 同源调 API 无此问题，渲染完成后移除 <script> 静态化
  private async renderWithPlaywright(url: string): Promise<string | null> {
    let ctx: any = null;
    try {
      const { chromium } = await import("playwright-core");
      if (!this.pwBrowser) {
        this.pwBrowser = await chromium.launch({
          headless: true,
          args: [
            "--no-sandbox",
            "--disable-blink-features=AutomationControlled",
            // 注意: 不能禁用图片(imagesEnabled=false) —— 懒加载站点(天猫/淘宝)的图片
            // 由 JS 按需创建 <img>，禁用图片会导致商品图完全不渲染，预览里全是灰块
          ],
        });
      }
      ctx = await this.pwBrowser.newContext({
        userAgent: GOOGLEBOT_UA,
        locale: "en-US",
        viewport: { width: 1280, height: 800 },
      });
      const page = await ctx.newPage();
      // 注意: 不要用 page.route 拦截外部资源 —— 实测会导致 domcontentloaded 永不触发而超时；
      // 也不等 domcontentloaded（慢资源会卡住），用 commit 立即返回后轮询等渲染
      await page.goto(url, { waitUntil: "commit", timeout: 20000 }).catch(() => {
        // 首次导航超时(网络抖动)时重试一次
        return page.goto(url, { waitUntil: "commit", timeout: 20000 });
      });
      // 等待内容渲染（0.3s 间隔轮询，最多 40 次=12s；React 挂载(root 有子元素)且出现正文即停止）
      for (let i = 0; i < 40; i++) {
        await page.waitForTimeout(300);
        let len = 0;
        try {
          len = await page.evaluate(() => {
            const root = document.getElementById("root");
            if (!root || root.children.length === 0) return 0;
            return document.body ? document.body.innerText.length : 0;
          });
        } catch {
          /* 页面尚未就绪，继续等 */
        }
        if (len > 200) break;
      }
      let html = await page.content();
      // 静态化：移除 <script>，防止 iframe 内重跑 JS 因跨域失败清空已渲染内容
      html = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<script[\s\S]*?\/>/gi, "");
      return html;
    } catch (e: any) {
      console.error("[browser-proxy] playwright render failed:", e?.message || e);
      return null;
    } finally {
      // 无论成功失败都关闭 context，防止浏览器上下文泄漏导致渲染越来越慢
      if (ctx) {
        try {
          await ctx.close();
        } catch {
          /* ignore */
        }
      }
    }
  }
  @Get()
  async proxy(@Query("url") url: string, @Res() res: Response) {
    let target: URL;
    try {
      target = new URL(String(url || "").trim());
      if (!/^https?:$/.test(target.protocol)) throw new Error("bad protocol");
    } catch {
      return this.sendError(res, "无效的网址");
    }

    let upstream: globalThis.Response;
    let fetchErr: string | null = null;
    try {
      upstream = await fetch(target.toString(), {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(8000),
      });
    } catch (e: any) {
      upstream = null as any;
      fetchErr = e?.message || String(e);
    }

    if (!upstream || upstream.status >= 400) {
      // 网络层不可达（DNS 失败/连接拒绝/被墙）→ 渲染兜底无意义（同一网络），直接给提示页 + 打开按钮
      if (!upstream) {
        return this.sendError(
          res,
          `无法访问该网站: ${fetchErr || "网络不可达（可能被墙或域名不存在）"}`,
          target.toString(),
        );
      }
      // 4xx/5xx 页面本身可能有内容（404 页等）→ 先尝试直接返回
      if (upstream.status >= 400) {
        try {
          const errBuf = Buffer.from(await upstream.arrayBuffer());
          if (errBuf.byteLength <= MAX_BODY) {
            const errHtml = errBuf.toString("utf-8");
            if (this.bodyTextLength(errHtml) > 50) {
              let h = errHtml
                .replace(/<script[\s\S]*?<\/script>/gi, "")
                .replace(/<script[\s\S]*?\/>/gi, "");
              h = this.rewriteHtml(h, target.toString());
              res.setHeader("Content-Type", "text/html; charset=utf-8");
              return res.send(h);
            }
          }
        } catch {
          /* 解析失败则走渲染兜底 */
        }
      }
      // 网络失败 / 空错误页：用无头浏览器渲染兜底（Googlebot UA 可达性更好，很多站点对爬虫放行）
      const rendered = await this.renderWithPlaywright(target.toString());
      if (rendered && this.bodyTextLength(rendered) > 50) {
        let h = rendered
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<script[\s\S]*?\/>/gi, "");
        h = this.rewriteHtml(h, target.toString());
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.send(h);
      }
      const reason = !upstream
        ? `无法访问该网站: ${fetchErr || "网络不可达"}`
        : `网站返回 ${upstream.status} ${upstream.statusText || ""}`;
      return this.sendError(res, reason, target.toString());
    }

    const contentType = upstream.headers.get("content-type") || "";
    let buf = Buffer.from(await upstream.arrayBuffer());
    if (buf.byteLength > MAX_BODY) {
      return this.sendError(res, "页面过大，无法预览（>8MB）", target.toString());
    }

    // 非 HTML 内容（PDF/图片等）→ 直接透传二进制，iframe 内浏览器原生渲染（PDF 阅读器/图片查看器）
    if (!/text\/html|application\/xhtml/i.test(contentType)) {
      res.setHeader("Content-Type", contentType || "application/octet-stream");
      return res.send(buf);
    }

    let html = buf.toString("utf-8");
    const charsetMatch = contentType.match(/charset=([\w-]+)/i);
    if (charsetMatch && !/utf-?8/i.test(charsetMatch[1])) {
      try {
        html = new TextDecoder(charsetMatch[1]).decode(buf);
      } catch {
        /* 解码失败时沿用 utf-8 */
      }
    }

    // 人机验证挑战页（reCAPTCHA/Cloudflare 等）：把 google.com 的 reCAPTCHA
    // 引用重写为官方镜像 recaptcha.net（国内可达），让验证能在面板内完成
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const pageTitle = titleMatch ? titleMatch[1] : "";
    let isChallenge = this.isBotChallenge(html, pageTitle);
    let retryResp: globalThis.Response | null = null;
    let usedBotRetry = false;
    if (isChallenge) {
      // 优先用搜索引擎爬虫 UA 重试：Kaggle/Cloudflare 等站点对 Googlebot/Bingbot 放行(SEO 必需)，
      // 可免人机验证直接拿到真实内容
      try {
        const retry = await fetch(target.toString(), {
          headers: {
            "User-Agent": GOOGLEBOT_UA,
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
          },
          redirect: "follow",
          signal: AbortSignal.timeout(8000),
        });
        if (retry.status < 400) {
          const retryBuf = Buffer.from(await retry.arrayBuffer());
          if (retryBuf.byteLength <= MAX_BODY) {
            const retryHtml = retryBuf.toString("utf-8");
            const retryTitle =
              (retryHtml.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || "";
            if (!this.isBotChallenge(retryHtml, retryTitle)) {
              retryResp = retry;
              buf = retryBuf;
              html = retryHtml;
              isChallenge = false;
            }
            usedBotRetry = true;
          }
        }
      } catch {
        /* 重试失败则沿用原挑战页 */
      }
    }

    // 挑战页或 SPA 壳（body 文本极少，内容全靠 JS 渲染）→ 无头浏览器渲染出完整内容后静态化返回。
    // 壳在 iframe 里 JS 跨域调 API 会被 CORS 拦成空白，必须渲染（结果缓存 10 分钟，重复预览秒开）
    const shellCheck = usedBotRetry || isChallenge || this.bodyTextLength(html) < 100;
    if (shellCheck) {
      const bodyLen = this.bodyTextLength(html);
      if (isChallenge || bodyLen < 100) {
        const cacheKey = target.toString();
        const cached = this.getCached(cacheKey);
        if (cached) {
          html = cached;
          isChallenge = false;
        } else {
          let rendered = await this.renderWithPlaywright(cacheKey);
          if (rendered && this.bodyTextLength(rendered) <= 150) {
            // 渲染结果几乎为空（目标站限流/响应慢，常见只渲染出 cookie 弹窗）→ 换 UA 再渲染一次
            const retry2 = await this.renderWithPlaywright(cacheKey);
            if (retry2) rendered = retry2;
          }
          if (rendered) {
            const rLen = this.bodyTextLength(rendered);
            if (this.isLoginWall(rendered)) {
              // 目标站登录墙（淘宝/天猫等未登录访问重定向到登录页）→ 友好提示
              html = this.loginWallPage(cacheKey);
              isChallenge = false;
            } else if (rLen > 200) {
              this.setCached(cacheKey, rendered);
              html = rendered;
              isChallenge = false;
            } else if (rLen > 0) {
              // 有少量内容也返回（避免空白）
              html = rendered;
              isChallenge = false;
            } else {
              html = this.previewFailPage(cacheKey);
              isChallenge = false;
            }
          } else if (!isChallenge) {
            // 渲染失败且不是挑战页（空壳）→ 返回提示页，避免空白
            html = this.previewFailPage(cacheKey);
          }
        }
      }
    }

    // 静态化：移除所有 <script>，防止页面 JS 在 iframe 中崩溃
    // （Next.js/React 应用检测宿主域不匹配会抛异常并清空 SSR 内容，如 tongyi.aliyun.com）；
    // 原站 CSS/图片经 <base> 直连加载，布局样式保留。挑战页保留脚本以便完成验证
    if (!isChallenge) {
      html = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<script[\s\S]*?\/>/gi, "")
        // 图片懒加载：首屏外图片滚动到可见才加载，避免大量图片并发拖慢预览
        .replace(/<img(?![^>]*\bloading=)[^>]*>/gi, (m) =>
          m.replace(/^<img/i, '<img loading="lazy"'),
        );
    }

    if (isChallenge) {
        // 人机验证挑战页（reCAPTCHA/Cloudflare 等）：把 google.com 的 reCAPTCHA
        // 引用重写为官方镜像 recaptcha.net（国内可达），让验证能在面板内完成
        html = html
          .replace(/https:\/\/www\.google\.com\/recaptcha/g, "https://www.recaptcha.net/recaptcha")
          .replace(/https:\/\/www\.google\.com\/recaptcha\//g, "https://www.recaptcha.net/recaptcha/")
          .replace(/https:\/\/google\.com\/recaptcha/g, "https://www.recaptcha.net/recaptcha");
      // 注入顶部提示条 + 验证完成检测脚本：
      // 验证通过后自动尝试打开内容（新标签页），若被浏览器拦截则提示一键打开
      const targetJson = JSON.stringify(target.toString());
      html = html.replace(
        /<\/body>/i,
        `<div id="stmg-recaptcha-tip" style="position:fixed;top:0;left:0;right:0;z-index:99999;background:#fb7299;color:#fff;text-align:center;padding:8px 12px;font:13px/1.5 system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.2)">该网站需先完成人机验证，完成后即可查看内容（验证通过后浏览器已记住该网站）</div>
<script>
(function(){
  window.__STMG_TARGET=${targetJson};
  var banner=document.getElementById('stmg-recaptcha-tip');
  if(!banner)return;
  var verified=false, opened=false;
  var BTN='style="margin-left:8px;padding:4px 14px;border:0;border-radius:4px;background:#fff;color:#fb7299;font-weight:600;cursor:pointer"';
  function openUrl(u){
    if(opened)return; opened=true;
    try{
      var w=window.open(u,'_blank');
      if(w) banner.innerHTML='✅ 已在新标签页打开内容，可直接阅读';
      else showVerifiedBtn(u);
    }catch(e){ showVerifiedBtn(u); }
  }
  function showVerifiedBtn(u){
    window.__STMG_OPEN=u;
    banner.innerHTML='✅ 验证通过！<button id="stmg-open-btn" '+BTN+'>点击查看内容</button>';
    var b=document.getElementById('stmg-open-btn');
    if(b) b.addEventListener('click',function(){ openUrl(window.__STMG_OPEN||window.__STMG_TARGET); });
  }
  function showVerified(u){
    if(verified)return; verified=true;
    window.__STMG_OPEN=u;
    showVerifiedBtn(u);
    openUrl(u);
  }
  function onNav(v){
    // 验证完成后页面要跳转/刷新: 拦截跳转(iframe 内跳目标站会被 X-Frame-Options 拒成空白), 改为引导打开
    if(verified)return;
    showVerified(v||window.__STMG_TARGET);
  }
  function showSkipBtn(){
    if(verified)return;
    banner.innerHTML='⚠️ 若不想验证，可<button id="stmg-open-btn" '+BTN+'>直接在新标签页打开</button>，验证通过后下次将不再拦截';
    var b=document.getElementById('stmg-open-btn');
    if(b) b.addEventListener('click',function(){ openUrl(window.__STMG_TARGET); });
  }
  // 信号0: 覆盖 onSuccess 回调 —— reCAPTCHA 验证完成的精确信号,
  // 抢在挑战页自动跳转前触发, 让原流程(设置放行 cookie)继续但不至于丢失提示
  var osT=setInterval(function(){
    if(typeof window.onSuccess==='function' && !window.__STMG_OS_WRAPPED){
      window.__STMG_OS_WRAPPED=true;
      clearInterval(osT);
      var orig=window.onSuccess;
      window.onSuccess=function(token){
        showVerified(window.__STMG_TARGET);
        try{ return orig(token); }catch(e){}
      };
    }
  },100);
  // 信号1: reCAPTCHA 验证完成（隐藏文本域出现 token）—— 120ms 快轮询, 抢在挑战页自动跳转前
  var t=setInterval(function(){
    var r=document.querySelector('.g-recaptcha-response, textarea[name="g-recaptcha-response"]');
    if(r&&r.value&&!verified){ clearInterval(t); showVerified(window.__STMG_TARGET); }
  },120);
  // 信号2: cookie 变化（验证通过后目标站写入放行 cookie）
  var lastCookie=document.cookie;
  var c=setInterval(function(){
    if(document.cookie!==lastCookie){ lastCookie=document.cookie; if(!verified){ clearInterval(c); showVerified(window.__STMG_TARGET); } }
  },400);
  // 信号3: 劫持跳转 API, 拦截验证成功后的自动跳转/刷新
  try{
    var hp=Object.getOwnPropertyDescriptor(Location.prototype,'href');
    if(hp&&hp.set){ Object.defineProperty(window.location,'href',{ get:function(){return hp.get.call(window.location);}, set:function(v){ onNav(String(v)); } }); }
  }catch(e){}
  try{
    var _as=window.location.assign.bind(window.location);
    window.location.assign=function(v){ onNav(String(v)); };
  }catch(e){}
  try{
    var _lr=window.location.replace.bind(window.location);
    window.location.replace=function(v){ onNav(String(v)); };
  }catch(e){}
  try{
    var _rl=window.location.reload.bind(window.location);
    window.location.reload=function(){ onNav(window.location.href); };
  }catch(e){}
  // 信号4: 页面即将卸载（document.write 竞争失败的兜底: 阻止跳转, 停留显示按钮）
  window.addEventListener('beforeunload',function(e){
    if(verified){
      if(!opened){
        try{ if(e.preventDefault)e.preventDefault(); if(e.returnValue!==undefined)e.returnValue=''; showVerifiedBtn(window.__STMG_OPEN||window.__STMG_TARGET); }catch(err){}
      } else {
        openUrl(window.__STMG_OPEN||window.__STMG_TARGET);
      }
    }
  });
  // 3秒后提供"直接打开"兜底按钮
  setTimeout(showSkipBtn,3000);
})();
</script></body>`,
      );
    }

    // 重写：注入 <base> 让资源直连目标站，<a> 链接改走代理继续在面板内预览
    html = this.rewriteHtml(html, target.toString());

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    // 转发上游 Set-Cookie（去掉 secure 以适配 http 代理域）：
    // Kaggle 等 SPA 的 anti-forgery token（XSRF-TOKEN/CSRF-TOKEN）通过 cookie 下发，
    // iframe 内页面需读取这些 cookie 才能成功调用目标站 API
    const cookieSource = retryResp || upstream;
    const getSetCookie = (cookieSource.headers as any).getSetCookie;
    const setCookies: string[] = typeof getSetCookie === "function"
      ? getSetCookie.call(cookieSource.headers)
      : [cookieSource.headers.get("set-cookie")].filter((v): v is string => !!v);
    for (const sc of setCookies) {
      res.append("Set-Cookie", sc.replace(/;\s*secure\s*(?=;|$)/i, ";"));
    }
    // 关键：不设置 X-Frame-Options / Content-Security-Policy，允许 iframe 嵌入
    res.send(html);
  }

  // 检测目标站登录墙（淘宝/天猫等：未登录访问被重定向到登录页，预览拿不到内容）。
  // 用 title 特征（登录页标题）+ 文本量双重判断，避免误伤正文含"请登录"字样的正常页面
  private isLoginWall(html: string): boolean {
    const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || "";
    const t = title.trim().toLowerCase();
    if (
      /^(登录|请登录|用户登录|账号登录|sign in|login|log in)$/i.test(t) ||
      /(登录|sign in|login|log in)/i.test(t)
    ) {
      return this.bodyTextLength(html) < 800;
    }
    return false;
  }

  private loginWallPage(pageUrl: string): string {
    return (
      `<!DOCTYPE html><html><head><meta charset="utf-8"><style>` +
      `body{font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f7f8fa;color:#606266}` +
      `.wrap{text-align:center;padding:32px;max-width:460px}` +
      `.icon{font-size:52px;margin-bottom:12px}` +
      `h3{margin:0 0 10px;color:#303133;font-size:16px}` +
      `p{font-size:13px;line-height:1.7;margin:0 0 18px;color:#606266;word-break:break-all}` +
      `.btn{display:inline-block;padding:9px 22px;border-radius:6px;background:#fb7299;color:#fff;text-decoration:none;font-size:13px}` +
      `.btn:hover{opacity:.9}` +
      `</style></head><body>` +
      `<div class="wrap"><div class="icon">🔐</div>` +
      `<h3>该网站需要登录后才能查看</h3>` +
      `<p>${this.escAttr(pageUrl)}<br>淘宝/天猫等网站的商品内容需要登录账号后才能显示，预览面板无法获取登录态。</p>` +
      `<a class="btn" href="${this.escAttr(pageUrl)}" target="_blank" rel="noopener noreferrer">在浏览器中打开（登录后查看）</a>` +
      `</div></body></html>`
    );
  }

  private previewFailPage(pageUrl: string): string {
    return (
      `<!DOCTYPE html><html><head><meta charset="utf-8"><style>` +
      `body{font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f7f8fa;color:#606266}` +
      `.wrap{text-align:center;padding:32px;max-width:460px}` +
      `.icon{font-size:52px;margin-bottom:12px}` +
      `h3{margin:0 0 10px;color:#303133;font-size:16px}` +
      `p{font-size:13px;line-height:1.7;margin:0 0 18px;color:#606266;word-break:break-all}` +
      `.btn{display:inline-block;padding:9px 22px;border-radius:6px;background:#fb7299;color:#fff;text-decoration:none;font-size:13px}` +
      `.btn:hover{opacity:.9}` +
      `</style></head><body>` +
      `<div class="wrap"><div class="icon">⚠️</div>` +
      `<h3>网页预览加载失败</h3>` +
      `<p>${this.escAttr(pageUrl)}<br>页面渲染超时或目标网站限制，请在新标签页中打开查看。</p>` +
      `<a class="btn" href="${this.escAttr(pageUrl)}" target="_blank" rel="noopener noreferrer">在新标签页打开</a>` +
      `</div></body></html>`
    );
  }

  private bodyTextLength(html: string): number {
    const m = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const body = m ? m[1] : html;
    return body
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim().length;
  }

  private isBotChallenge(html: string, title: string): boolean {
    const lower = html.toLowerCase();
    const t = title.toLowerCase();
    return (
      t.includes("checking your browser") ||
      t.includes("just a moment") ||
      t.includes("attention required") ||
      t.includes("verify you are human") ||
      t.includes("cf-chl") ||
      lower.includes("cf-chl-") ||
      lower.includes("challenge-platform") ||
      lower.includes("recaptcha") ||
      (lower.includes("正在检查") && lower.includes("浏览器"))
    );
  }

  private sendChallengeNotice(res: Response, pageUrl: string) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200);
    const retryUrl = `/api/v1/browser-proxy?url=${encodeURIComponent(pageUrl)}`;
    res.send(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><style>` +
        `body{font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f7f8fa;color:#606266}` +
        `.wrap{text-align:center;padding:32px;max-width:460px}` +
        `.icon{font-size:52px;margin-bottom:12px}` +
        `h3{margin:0 0 10px;color:#303133;font-size:16px}` +
        `p{font-size:13px;line-height:1.7;margin:0 0 18px;color:#606266}` +
        `.btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}` +
        `.btn{display:inline-block;padding:9px 22px;border-radius:6px;text-decoration:none;font-size:13px}` +
        `.btn-primary{background:#fb7299;color:#fff}` +
        `.btn-primary:hover{opacity:.9}` +
        `.btn-ghost{border:1px solid #dcdfe6;color:#606266;background:#fff}` +
        `.btn-ghost:hover{border-color:#fb7299;color:#fb7299}` +
        `.tip{font-size:12px;color:#909399;margin-top:16px}` +
        `</style></head><body>` +
        `<div class="wrap"><div class="icon">🛡️</div>` +
        `<h3>该网站有反爬保护，无法在面板内预览</h3>` +
        `<p>${this.escAttr(pageUrl)}<br>目标网站要求先通过 reCAPTCHA 人机验证（Kaggle、Cloudflare 等站点常见），` +
        `服务端无法自动通过，请在新标签页中打开。</p>` +
        `<div class="btns">` +
        `<a class="btn btn-primary" href="${this.escAttr(pageUrl)}" target="_blank" rel="noopener noreferrer">在新标签页打开</a>` +
        `<a class="btn btn-ghost" href="${retryUrl}">重试加载</a>` +
        `</div>` +
        `<p class="tip">也可以点击面板右上角图标在新标签页打开</p>` +
        `</div></body></html>`,
    );
  }

  private rewriteHtml(html: string, pageUrl: string): string {
    let base = pageUrl;
    const baseMatch = html.match(/<base[^>]*href=["']([^"']+)["']/i);
    if (baseMatch && baseMatch[1]) {
      try {
        base = new URL(baseMatch[1], pageUrl).toString();
      } catch {
        /* 保留原 base */
      }
    } else {
      // 注入 <base>，使页面内相对路径的资源（图片/CSS/JS）直连目标站加载
      html = html.replace(
        /<head([^>]*)>/i,
        (m, attrs) => `${m}\n<base href="${this.escAttr(pageUrl)}">`,
      );
    }

    // <a href> 重写为代理链接，点击后在预览面板内继续浏览（去掉 target=_blank 防止跳出）
    html = html.replace(/<a\s([^>]*?)href=["']([^"']+)["']/gi, (m, attrs, href) => {
      const h = (href || "").trim();
      if (!h || h.startsWith("#") || /^(javascript|mailto|tel|data|about):/i.test(h)) return m;
      let abs: string;
      try {
        abs = new URL(h, base).toString();
      } catch {
        return m;
      }
      attrs = attrs.replace(/\s+target=["']_blank["']/gi, "");
      return `<a ${attrs}href="${this.escAttr(`/api/v1/browser-proxy?url=${encodeURIComponent(abs)}`)}"`;
    });

    return html;
  }

  private escAttr(s: string): string {
    return s
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  private sendError(res: Response, msg: string, pageUrl?: string) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200);
    const btn = pageUrl
      ? `<p style="margin-top:18px"><a href="${this.escAttr(pageUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:9px 22px;border-radius:6px;background:#fb7299;color:#fff;text-decoration:none;font-size:13px">在新标签页打开</a></p>`
      : `<p style="color:#909399;font-size:12px">可点击右上角图标在新标签页打开</p>`;
    res.send(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><style>` +
        `body{font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f7f8fa;color:#606266}` +
        `div{text-align:center;padding:24px;max-width:420px}h3{margin-bottom:8px}svg{color:#909399}</style></head><body>` +
        `<div><h3>⚠️ 无法预览此页面</h3><p>${this.escAttr(msg)}</p>${btn}</div></body></html>`,
    );
  }
}
