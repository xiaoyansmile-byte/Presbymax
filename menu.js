// 统一菜单配置
const menuConfig = {
  items: [
    { id: 'home', label: '首页', url: 'index.html' },
    { id: 'admin', label: '管理后台', url: 'admin.html' },
    { id: 'auth', label: '用户管理', url: 'auth.html' },
    { id: 'analytics', label: '数据分析', url: 'analytics.html' },
    { id: 'plans', label: '训练计划', url: 'plans.html' },
    { id: 'execute', label: '执行计划', url: 'execute-plan.html' },
    { id: 'reminders', label: '提醒设置', url: 'reminders.html' },
    { id: 'reports', label: '训练报告', url: 'reports.html' },
    { id: 'sync', label: '数据同步', url: 'sync.html' }
  ]
};

const CURRENT_USER_KEY = "vision-training-current-user";
const protectedPages = new Set([
  "plans.html",
  "execute-plan.html",
  "analytics.html",
  "reports.html",
  "reminders.html",
  "sync.html",
  "admin.html",
]);

function getCurrentPage() {
  const path = window.location.pathname || "";
  const name = path.split("/").pop();
  const normalized = (name || "index.html").split("?")[0].split("#")[0];
  return normalized || "index.html";
}

function loadCurrentUser() {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw);
    if (!user || typeof user !== "object") return null;
    if (!user.id && !user.email) return null;
    return user;
  } catch (e) {
    return null;
  }
}

function getDisplayName(user) {
  if (!user) return "";
  return user.name || user.username || user.email || "用户";
}

function getDisplayInitial(user) {
  const name = getDisplayName(user).trim();
  if (!name) return "U";
  return name.charAt(0).toUpperCase();
}

function ensureMenuUserStyles() {
  if (document.getElementById("menu-user-style")) return;
  const style = document.createElement("style");
  style.id = "menu-user-style";
  style.textContent = `
    .menu-topbar {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .menu-user-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-right: 10px;
    }
    .menu-user-chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 36px;
      max-width: 180px;
      padding: 0 0.55rem 0 0.4rem;
      border-radius: 999px;
      border: 1px solid #d2d2d7;
      background: #f8f8fa;
      color: #1d1d1f;
      font-size: 0.82rem;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .menu-user-avatar {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #0071e3;
      color: #fff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0.72rem;
      font-weight: 700;
      flex: 0 0 24px;
    }
    .menu-user-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .menu-logout-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 36px;
      padding: 0 0.6rem;
      border-radius: 999px;
      border: 1px solid #ffd6d1;
      background: #fff5f3;
      color: #c4372a;
      text-decoration: none;
      font-size: 0.8rem;
      font-weight: 600;
      transition: all 0.2s ease;
    }
    .menu-logout-link:hover {
      background: #ffeae6;
      border-color: #ffb4aa;
    }
    .menu-logout-icon {
      width: 14px;
      height: 14px;
      display: inline-block;
      color: currentColor;
      flex: 0 0 14px;
    }
    .menu-logout-text {
      display: inline;
    }
    .menu-btn-icon {
      width: 16px;
      height: 16px;
      display: inline-block;
      color: currentColor;
      flex: 0 0 16px;
    }
    .menu-btn-label {
      display: inline;
    }
    .menu-container .menu-button {
      height: 36px;
      padding: 0 0.95rem;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      line-height: 1;
    }
    @media (max-width: 640px) {
      .menu-user-wrap {
        margin-right: 8px;
        gap: 6px;
      }
      .menu-user-chip {
        width: 36px;
        height: 36px;
        max-width: 36px;
        padding: 0;
        justify-content: center;
      }
      .menu-user-avatar {
        width: 26px;
        height: 26px;
      }
      .menu-user-name {
        display: none;
      }
      .menu-logout-link {
        width: 36px;
        height: 36px;
        padding: 0;
        justify-content: center;
      }
      .menu-logout-text {
        display: none;
      }
      .menu-container .menu-button {
        width: 36px;
        padding: 0;
        justify-content: center;
        gap: 0;
      }
      .menu-btn-label {
        display: none;
      }
    }
  `;
  document.head.appendChild(style);
}

function ensureAccessibleTypographyStyles() {
  if (document.getElementById("mobile-readable-style")) return;
  const style = document.createElement("style");
  style.id = "mobile-readable-style";
  style.textContent = `
    @media (max-width: 768px) {
      html, body {
        font-size: 18px !important;
      }
      body {
        line-height: 1.65 !important;
        -webkit-text-size-adjust: 100%;
      }
      h1 {
        font-size: 1.55rem !important;
        line-height: 1.35 !important;
      }
      h2 {
        font-size: 1.35rem !important;
        line-height: 1.4 !important;
      }
      h3 {
        font-size: 1.15rem !important;
        line-height: 1.45 !important;
      }
      p, li, label, .status, .hint, .desc, .lead {
        font-size: 1.08rem !important;
        line-height: 1.7 !important;
        word-break: normal !important;
        overflow-wrap: normal !important;
      }
      button, input, select, textarea, .btn {
        font-size: 1.05rem !important;
        min-height: 44px !important;
        line-height: 1.35 !important;
      }
      .header h1 {
        font-size: 1.25rem !important;
        line-height: 1.3 !important;
        word-break: keep-all !important;
      }
      .menu-dropdown a {
        font-size: 1rem !important;
        white-space: nowrap !important;
      }
      .training-info h4,
      .current-plan-title,
      .plan-card h2 {
        word-break: keep-all !important;
        overflow-wrap: normal !important;
      }
    }
    @media (max-width: 480px) {
      html, body {
        font-size: 17px !important;
      }
      h1 {
        font-size: 1.45rem !important;
      }
      h2 {
        font-size: 1.28rem !important;
      }
      p, li, label, .status, .hint, .desc, .lead {
        font-size: 1.02rem !important;
      }
      button, input, select, textarea, .btn {
        font-size: 1rem !important;
        min-height: 42px !important;
      }
      .header h1 {
        font-size: 1.15rem !important;
      }
    }
  `;
  document.head.appendChild(style);
}

// 训练结束提示：展示结果并在 3 秒后自动跳转
window.showTrainingResultThenRedirect = function (options) {
  const opts = options || {};
  const title = opts.title || "训练完成";
  const summary = opts.summary || "本次训练已完成。";
  const target = opts.target || "execute-plan.html";
  let seconds = Number(opts.countdown || 3);

  const old = document.getElementById("training-result-overlay");
  if (old) old.remove();

  const overlay = document.createElement("div");
  overlay.id = "training-result-overlay";
  overlay.style.cssText = [
    "position:fixed",
    "inset:0",
    "background:rgba(0,0,0,0.45)",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "z-index:9999",
    "padding:16px"
  ].join(";");

  const modal = document.createElement("div");
  modal.style.cssText = [
    "width:min(92vw,420px)",
    "background:#ffffff",
    "border-radius:12px",
    "padding:20px",
    "box-shadow:0 10px 30px rgba(0,0,0,0.2)",
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
    "color:#1d1d1f"
  ].join(";");

  const titleEl = document.createElement("h3");
  titleEl.textContent = title;
  titleEl.style.cssText = "margin:0 0 10px;font-size:20px;line-height:1.3;";

  const summaryEl = document.createElement("p");
  summaryEl.textContent = summary;
  summaryEl.style.cssText = "margin:0 0 12px;color:#333;line-height:1.5;white-space:pre-line;";

  const countdownEl = document.createElement("p");
  countdownEl.style.cssText = "margin:0;color:#0071e3;font-weight:600;";
  countdownEl.textContent = `${seconds} 秒后返回计划执行页面`;

  modal.appendChild(titleEl);
  modal.appendChild(summaryEl);
  modal.appendChild(countdownEl);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const timer = window.setInterval(function () {
    seconds -= 1;
    if (seconds > 0) {
      countdownEl.textContent = `${seconds} 秒后返回计划执行页面`;
      return;
    }
    window.clearInterval(timer);
    window.location.href = target;
  }, 1000);
};

// 生成菜单HTML
function generateMenu(user) {
  const menuItems = menuConfig.items.map(item => 
    `<a href="${(!user && protectedPages.has(item.url)) ? 'auth.html' : item.url}" class="menu-item" data-url="${item.url}" data-protected="${protectedPages.has(item.url) ? '1' : '0'}">${item.label}</a>`
  ).join('');

  const userInfoHtml = user
    ? `
      <div class="menu-user-wrap">
        <span class="menu-user-chip" title="${getDisplayName(user)}">
          <span class="menu-user-avatar">${getDisplayInitial(user)}</span>
          <span class="menu-user-name">${getDisplayName(user)}</span>
        </span>
        <a href="#" id="quick-logout-link" class="menu-logout-link" title="退出登录">
          <svg class="menu-logout-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path fill="currentColor" d="M10 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-8v-2h8V5h-8V3Zm-1.707 4.293L9.707 8.707 7.414 11H16v2H7.414l2.293 2.293-1.414 1.414L3.586 12l4.707-4.707Z"/>
          </svg>
          <span class="menu-logout-text">退出登录</span>
        </a>
      </div>
    `
    : "";
  
  return `
    <div class="menu-topbar">
      ${userInfoHtml}
      <div class="menu-container">
        <button class="menu-button" aria-label="菜单">
          <svg class="menu-btn-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path fill="currentColor" d="M3 6h18v2H3V6Zm0 5h18v2H3v-2Zm0 5h18v2H3v-2Z"/>
          </svg>
          <span class="menu-btn-label">菜单</span>
        </button>
        <div class="menu-dropdown">
          ${menuItems}
        </div>
      </div>
    </div>
  `;
}

// 加载菜单到页面
function loadMenu() {
  const menuContainer = document.getElementById('menu-container');
  ensureAccessibleTypographyStyles();
  if (menuContainer) {
    ensureMenuUserStyles();
    const user = loadCurrentUser();
    menuContainer.innerHTML = generateMenu(user);
    if (user) {
      const quickLogout = document.getElementById("quick-logout-link");
      if (quickLogout) {
        quickLogout.addEventListener("click", function (e) {
          e.preventDefault();
          try {
            localStorage.removeItem(CURRENT_USER_KEY);
          } catch (err) {}
          window.location.replace("index.html");
        });
      }
    }
  }
}

// 当DOM加载完成后加载菜单
document.addEventListener('DOMContentLoaded', function () {
  const page = getCurrentPage();
  const user = loadCurrentUser();

  if (!user && protectedPages.has(page)) {
    window.location.replace('auth.html');
    return;
  }

  loadMenu();
});

// 全局点击拦截：未登录时点击菜单中的受保护页面，直接跳转登录
document.addEventListener('click', function (e) {
  const link = e.target && e.target.closest ? e.target.closest('.menu-item[data-protected="1"]') : null;
  if (!link) return;
  const user = loadCurrentUser();
  if (!user) {
    e.preventDefault();
    window.location.replace('auth.html');
  }
});
