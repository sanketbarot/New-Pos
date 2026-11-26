// Crust & Chilly POS - Executive Command Center & Business Intelligence
// Ultra-Modern, Clean & Advanced Real-Time Restaurant Management Dashboard
// Features: Dynamic Timeframe Filtering, Revenue Pacing & Projections, Live Shift Detection,
// Tabbed Deep Dive (Analytics, Shift Rush & Kitchen Ops, Cash Drawer & Financial Audit, Menu & Stock Watch),
// Real-Time Denomination Tally, Instant Z-Report, Live Filterable Bills Stream, and CSV Export.

window.views = window.views || {};
window.views.dashboard = {
  salesChart: null,
  paymentChart: null,
  categoryChart: null,

  // Dashboard View State
  selectedTimeframe: "today", // 'today' | 'yesterday' | 'week' | 'month' | 'custom'
  customStartDate: null,
  customEndDate: null,
  activeTab: "overview", // 'overview' | 'operations' | 'financials' | 'menu_stock'
  activeChartMode: "trend", // 'trend' | 'hourlyRush' | 'hourlyOrders' | 'monthly'
  bestSellerSort: "qty", // 'qty' | 'rev'
  recentBillsSearchQuery: "",

  // Auto-Refresh Timers
  autoRefreshEnabled: true,
  autoRefreshTimer: null,
  autoRefreshCountdown: 30,
  countdownInterval: null,
  clockInterval: null,

  // Denomination state
  denominations: {
    500: 0,
    200: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0
  },

  getLocalDateStr(d = new Date()) {
    const dateObj = d instanceof Date ? d : new Date(d);
    if (isNaN(dateObj.getTime())) return "";
    const offset = dateObj.getTimezoneOffset() * 60000;
    return new Date(dateObj.getTime() - offset).toISOString().substring(0, 10);
  },

  getOrderLocalDateStr(orderOrDate) {
    if (!orderOrDate) return "";
    const raw = typeof orderOrDate === "object" ? (orderOrDate.createdAt || orderOrDate.date || "") : orderOrDate;
    if (!raw) return "";
    return this.getLocalDateStr(raw);
  },

  formatTime(isoOrDateStr) {
    if (!isoOrDateStr) return "--:--";
    const d = new Date(isoOrDateStr);
    return isNaN(d.getTime()) ? "--:--" : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  },

  animateCounter(el, targetVal, prefix = "", duration = 380) {
    if (!el) return;
    const end = Math.round(Number(targetVal) || 0);
    const startRaw = parseInt((el.textContent || "0").replace(/[^\d-]/g, ""), 10);
    const start = isNaN(startRaw) ? 0 : startRaw;
    if (start === end) {
      el.textContent = `${prefix}${end.toLocaleString("en-IN")}`;
      return;
    }
    const startTime = performance.now();
    const step = (now) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (end - start) * eased);
      el.textContent = `${prefix}${current.toLocaleString("en-IN")}`;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  },

  renderFloorTableMatrix(orders) {
    const container = document.getElementById("dash-floor-table-matrix");
    if (!container) return;
    const tables = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"];
    const activeMap = new Map();
    orders.forEach(o => {
      if (o.type === "Dine-in" && o.status !== "Completed" && o.status !== "Cancelled" && o.tableNumber) {
        const key = o.tableNumber.trim().toUpperCase().replace("-", "");
        if (!activeMap.has(key)) activeMap.set(key, o);
      }
    });

    container.innerHTML = tables.map(t => {
      const ord = activeMap.get(t);
      if (ord) {
        return `
          <div class="dash-table-tile occupied" onclick="app.switchView('orders')" title="Active Order #${ord.orderNumber || ord.id} (${ord.status}) — Click to view in KDS">
            <div class="dash-table-top">
              <span class="dash-table-num">${t}</span>
              <span class="dash-table-dot busy"></span>
            </div>
            <div class="dash-table-amt">₹${Math.round(Number(ord.total) || 0)}</div>
            <div class="dash-table-sub">${ord.status}</div>
          </div>
        `;
      }
      return `
        <div class="dash-table-tile free" onclick="app.switchView('pos')" title="Table ${t} Available — Click to start Dine-in order">
          <div class="dash-table-top">
            <span class="dash-table-num">${t}</span>
            <span class="dash-table-dot free"></span>
          </div>
          <div class="dash-table-amt" style="color:#059669;">Free</div>
          <div class="dash-table-sub">Ready</div>
        </div>
      `;
    }).join("");
  },

  getTimeframeDates() {
    const today = new Date();
    const todayStr = this.getLocalDateStr(today);

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = this.getLocalDateStr(yesterday);

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 6);
    const weekStartStr = this.getLocalDateStr(weekStart);

    const prevWeekStart = new Date(today);
    prevWeekStart.setDate(today.getDate() - 13);
    const prevWeekStartStr = this.getLocalDateStr(prevWeekStart);
    const prevWeekEndStr = this.getLocalDateStr(new Date(today.getTime() - 7 * 86400000));

    const monthStartStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;

    const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevMonthStartStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
    const lastDayPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
    const prevMonthEndStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-${String(lastDayPrevMonth).padStart(2, '0')}`;

    return {
      todayStr,
      yesterdayStr,
      weekStartStr,
      prevWeekStartStr,
      prevWeekEndStr,
      monthStartStr,
      prevMonthStartStr,
      prevMonthEndStr
    };
  },

  setTimeframe(period) {
    this.selectedTimeframe = period;
    document.querySelectorAll(".dash-period-btn, .counter-quick-chip[data-period]").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-period") === period);
    });
    this.calculateAndRenderMetrics();
  },

  setActiveTab(tabName) {
    this.activeTab = tabName;
    document.querySelectorAll(".dash-tab-btn").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-tab") === tabName);
    });
    document.querySelectorAll(".dash-tab-pane").forEach(pane => {
      pane.classList.toggle("active", pane.id === `tab-pane-${tabName}`);
    });

    // Re-render chart if switching to overview tab to ensure correct dimensions
    if (tabName === "overview") {
      const orders = window.db.get("orders") || [];
      const { todayStr } = this.getTimeframeDates();
      setTimeout(() => {
        this.renderSalesChart(orders, todayStr);
        this.renderPaymentChart(orders, todayStr);
        const validOrders = this.getFilteredOrders().filter(o => o.status !== "Cancelled");
        this.renderCategoryChart(validOrders);
      }, 50);
    }
  },

  setChartMode(mode) {
    this.activeChartMode = mode;
    document.querySelectorAll(".dash-chart-toggle-btn").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-mode") === mode);
    });
    const orders = window.db.get("orders") || [];
    const { todayStr } = this.getTimeframeDates();
    this.renderSalesChart(orders, todayStr);
  },

  setBestSellerSort(sortBy) {
    this.bestSellerSort = sortBy;
    document.querySelectorAll(".dash-leader-sort-btn").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-sort") === sortBy);
    });
    const filteredOrders = this.getFilteredOrders();
    const products = window.db.get("products") || [];
    const categories = window.db.get("categories") || [];
    const settings = window.db.get("settings") || {};
    this.renderBestSellers(filteredOrders, products, categories, settings.currencySymbol || "₹");
  },

  init(container) {
    // Clear any running intervals
    if (this.autoRefreshTimer) clearInterval(this.autoRefreshTimer);
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    if (this.clockInterval) clearInterval(this.clockInterval);

    const today = new Date();
    const formattedDate = today.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric"
    });

    container.innerHTML = `
      <div class="dash-container view-animate" style="display: flex; flex-direction: column; gap: 14px; max-width: 100%; width: 100%; padding-bottom: 60px;">
        
        <!-- 1. Executive Top Command Bar (Porcelain White matching Counter & Menu) -->
        <div class="glass-card counter-control-bar" style="padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; border-radius: 14px; background: #ffffff; border: 1px solid #f0f3f9;">
          
          <!-- Period Selector Strip -->
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 7px; margin-right: 4px;">
              <span style="font-size: 13.5px; font-weight: 800; color: var(--text-dark); white-space: nowrap; display: flex; align-items: center; gap: 7px;">
                <i class="fa-solid fa-chart-pie" style="color: #ff8a5c; font-size: 15px;"></i> Executive Control:
              </span>
            </div>
            <div class="dash-period-pills" id="dash-period-selector" style="display: flex; gap: 5px; align-items: center; flex-wrap: wrap; background: transparent; border: none; padding: 0;">
              <button class="counter-quick-chip ${this.selectedTimeframe === 'today' ? 'active' : ''}" data-period="today" onclick="views.dashboard.setTimeframe('today')">Today</button>
              <button class="counter-quick-chip ${this.selectedTimeframe === 'yesterday' ? 'active' : ''}" data-period="yesterday" onclick="views.dashboard.setTimeframe('yesterday')">Yesterday</button>
              <button class="counter-quick-chip ${this.selectedTimeframe === 'week' ? 'active' : ''}" data-period="week" onclick="views.dashboard.setTimeframe('week')">Last 7 Days</button>
              <button class="counter-quick-chip ${this.selectedTimeframe === 'month' ? 'active' : ''}" data-period="month" onclick="views.dashboard.setTimeframe('month')">This Month</button>
              <button class="counter-quick-chip ${this.selectedTimeframe === 'custom' ? 'active' : ''}" data-period="custom" onclick="views.dashboard.openCustomDateRangeModal()">Custom 📅</button>
            </div>
          </div>

          <!-- Actions & Live Auto-Refresh -->
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            
            <!-- Live Shift Indicator -->
            <div id="dash-shift-indicator" class="dash-shift-live-pill shift-open" style="font-size: 11.5px; font-weight: 750; padding: 5px 12px; border-radius: 20px;">
              <i class="fa-solid fa-circle"></i> <span>Live Shift Active</span>
            </div>

            <!-- Auto-Refresh Toggle -->
            <button id="dash-autorefresh-btn" class="counter-quick-chip ${this.autoRefreshEnabled ? 'active' : ''}" title="Toggle 30s Real-time Auto-Refresh" onclick="views.dashboard.toggleAutoRefresh()" style="cursor: pointer; display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 12px;">
              <i class="fa-solid fa-arrows-rotate ${this.autoRefreshEnabled ? 'fa-spin' : ''}" id="dash-refresh-icon" style="font-size: 11px;"></i>
              <span id="dash-countdown-text">Auto 30s</span>
            </button>

            <!-- Fast Action Buttons -->
            <button class="btn btn-secondary" onclick="views.dashboard.openQuickExpenseModal()" title="Add Shop Expense" style="height: 36px; border-radius: 10px; padding: 0 13px; font-size: 12px; font-weight: 800; display: inline-flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-plus-circle" style="color: #dc2626;"></i> Expense
            </button>
            <button class="btn btn-secondary" onclick="views.dashboard.openCashDrawerAuditModal()" title="Audit Drawer & Denominations" style="height: 36px; border-radius: 10px; padding: 0 13px; font-size: 12px; font-weight: 800; display: inline-flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-vault" style="color: #059669;"></i> Audit Drawer
            </button>
            <button class="btn btn-secondary" onclick="views.dashboard.openDayEndReportModal()" title="Daily Z-Report Summary" style="height: 36px; border-radius: 10px; padding: 0 13px; font-size: 12px; font-weight: 800; display: inline-flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-file-invoice-dollar" style="color: #2563eb;"></i> Z-Report
            </button>
            <button class="btn btn-secondary" id="dash-btn-refresh" title="Refresh Dashboard Metrics" style="height: 36px; width: 36px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 10px; font-size: 13px; font-weight: 700;">
              <i class="fa-solid fa-rotate-right"></i>
            </button>
          </div>

        </div>

        <!-- 2. Executive 5-Metric Scorecard Grid (Pastel Executive Design) -->
        <div class="dash-kpi-grid">
          
          <!-- Card 1: Gross Sales Revenue (Tangerine Coral Ring) -->
          <div class="rep-kpi-card dash-kpi-card" id="dash-card-sales">
            <div class="dash-kpi-icon-wrap rep-ring-coral">
              <i class="fa-solid fa-indian-rupee-sign"></i>
            </div>
            <div class="rep-kpi-info">
              <div class="rep-kpi-val" id="dash-sales-val" style="color: #ff8a5c;">₹0</div>
              <div class="rep-kpi-label">Gross Sales Realized</div>
              <div class="rep-kpi-badges">
                <span id="dash-growth-indicator"></span>
                <span class="dash-sub-pill pill-cash" id="dash-card-goal-pill"><i class="fa-solid fa-bullseye"></i> Goal Track</span>
              </div>
            </div>
          </div>

          <!-- Card 2: Estimated Net Profit (Emerald Mint Ring) -->
          <div class="rep-kpi-card dash-kpi-card" id="dash-card-profit">
            <div class="dash-kpi-icon-wrap rep-ring-green">
              <i class="fa-solid fa-arrow-trend-up"></i>
            </div>
            <div class="rep-kpi-info">
              <div class="rep-kpi-val" id="dash-profit-val" style="color: #10b981;">₹0</div>
              <div class="rep-kpi-label">Estimated Net Profit</div>
              <div class="rep-kpi-badges">
                <span class="dash-sub-pill pill-cash" id="dash-margin-pill"><i class="fa-solid fa-percent"></i> 0% Margin</span>
                <span class="dash-sub-pill pill-neutral" id="dash-expense-pill"><i class="fa-solid fa-receipt"></i> Exp: ₹0</span>
              </div>
            </div>
          </div>

          <!-- Card 3: Total Bills & AOV (Sunburst Amber Ring) -->
          <div class="rep-kpi-card dash-kpi-card" id="dash-card-orders">
            <div class="dash-kpi-icon-wrap rep-ring-amber">
              <i class="fa-solid fa-receipt"></i>
            </div>
            <div class="rep-kpi-info">
              <div class="rep-kpi-val" id="dash-orders-val" style="color: #f59e0b;">0</div>
              <div class="rep-kpi-label">Bills & Avg Ticket</div>
              <div class="rep-kpi-badges">
                <span class="dash-sub-pill pill-neutral" id="dash-aov-pill"><i class="fa-solid fa-calculator"></i> Avg: ₹0</span>
                <span class="dash-sub-pill pill-cash" id="dash-fulfillment-pill"><i class="fa-solid fa-check"></i> 100% Fulfilled</span>
              </div>
            </div>
          </div>

          <!-- Card 4: Kitchen Live Queue (Orchid Purple Ring) -->
          <div class="rep-kpi-card dash-kpi-card" id="dash-card-kitchen">
            <div class="dash-kpi-icon-wrap rep-ring-purple">
              <i class="fa-solid fa-fire-burner"></i>
            </div>
            <div class="rep-kpi-info">
              <div class="rep-kpi-val" id="dash-active-val" style="color: #8b5cf6;">0</div>
              <div class="rep-kpi-label">Kitchen Live Prep</div>
              <div class="rep-kpi-badges">
                <span class="dash-sub-pill pill-neutral" id="dash-queue-status"><i class="fa-solid fa-stopwatch"></i> Avg: --m</span>
                <span class="dash-sub-pill pill-cash" id="dash-delay-pill"><i class="fa-solid fa-circle-check"></i> On-Time</span>
              </div>
            </div>
          </div>

          <!-- Card 5: Cash Drawer & Digital (Sky Cyan Ring) -->
          <div class="rep-kpi-card dash-kpi-card" id="dash-card-drawer" style="cursor: pointer;" onclick="views.dashboard.openCashDrawerAuditModal()" title="Click to Audit Cash Drawer">
            <div class="dash-kpi-icon-wrap rep-ring-cyan">
              <i class="fa-solid fa-vault"></i>
            </div>
            <div class="rep-kpi-info">
              <div class="rep-kpi-val" id="dash-drawer-val" style="color: #0284c7;">₹0</div>
              <div class="rep-kpi-label">Cash in Till (Drawer)</div>
              <div class="rep-kpi-badges">
                <span class="dash-sub-pill pill-cash" id="dash-cash-sales-pill"><i class="fa-solid fa-money-bill-wave"></i> Cash: ₹0</span>
                <span class="dash-sub-pill pill-neutral" id="dash-digital-sub" style="color: #2563eb;">UPI: ₹0</span>
              </div>
            </div>
          </div>

        </div>

        <!-- 2B. Dynamic Live Business Intelligence Insights Strip -->
        <div id="dash-smart-insights-strip" class="dash-smart-insights-strip"></div>

        <!-- 3. Smart Store Pulse & Revenue Target Pacing Ribbon (Executive Pastel Suite) -->
        <div class="glass-card" style="padding: 14px 20px; border-radius: 16px; background: #ffffff; border: 1px solid #f0f3f9; box-shadow: 0 4px 16px -2px rgba(22, 27, 46, 0.04); display: flex; flex-direction: column; gap: 12px;">
          
          <!-- Top Row: Operational Status, Shift & Badges -->
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            
            <!-- Left: Shift Pulse Title & Operating Hours -->
            <div style="display: flex; align-items: center; gap: 11px;">
              <div style="width: 36px; height: 36px; border-radius: 11px; background: #fff5f2; color: #ff8a5c; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 1px solid #ffd6cc; flex-shrink: 0; box-shadow: 0 2px 6px rgba(255, 138, 92, 0.15);">
                <i class="fa-solid fa-bolt"></i>
              </div>
              <div>
                <div style="font-size: 13.5px; font-weight: 850; color: var(--text-dark); display: flex; align-items: center; gap: 8px;">
                  <span id="dash-peak-banner-text">Continuous Service Active • All Shifts Monitored</span>
                </div>
                <div style="font-size: 11px; color: var(--text-muted); font-weight: 600; display: flex; align-items: center; gap: 6px; margin-top: 1px;">
                  <span>Store Hours: 12:00 PM – 3:00 AM (15-Hr Continuous)</span>
                  <span class="dot-sep">•</span>
                  <span id="dash-items-sold-sub" style="color: #2563eb; font-weight: 750;">0 items served across bills</span>
                </div>
              </div>
            </div>

            <!-- Right: Table Occupancy & Projected Close Pills + Actions -->
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <!-- Table Occupancy Pill -->
              <span id="dash-table-occupancy-pill" style="font-size: 11.5px; font-weight: 750; color: #166534; background: #f0fdf4; border: 1px solid #86efac; padding: 4px 12px; border-radius: 20px; display: inline-flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-chair" style="color: #16a34a;"></i> <strong>0/8</strong> Tables Active (0% Occ.)
              </span>

              <!-- Projected Closing Pill -->
              <span style="font-size: 11.5px; font-weight: 750; color: #2563eb; background: #eff6ff; border: 1px solid #bfdbfe; padding: 4px 12px; border-radius: 20px; display: inline-flex; align-items: center; gap: 5px;">
                <i class="fa-solid fa-chart-line"></i> <span id="dash-target-projected">Projected 3 AM: ₹0</span>
              </span>

              <!-- Set Target Goal Button -->
              <button id="dash-btn-set-target" type="button" title="Configure Daily Revenue Target" style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 20px; padding: 4px 12px; font-size: 11.5px; font-weight: 750; color: var(--text-dark); cursor: pointer; display: inline-flex; align-items: center; gap: 5px; transition: all 0.2s ease;">
                <i class="fa-solid fa-bullseye" style="color: #ff8a5c;"></i> Set Goal
              </button>

              <!-- 1-Click Share Today's WhatsApp Summary -->
              <button type="button" onclick="window.businessIntel && window.businessIntel.shareWhatsAppSummary('today')" title="Share Today's Business Summary on WhatsApp" style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 20px; padding: 4px 12px; font-size: 11.5px; font-weight: 750; color: #059669; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; transition: all 0.2s ease;">
                <i class="fa-brands fa-whatsapp"></i> Share Report
              </button>

              <!-- Open POS Button -->
              <a href="#pos" class="btn btn-primary" style="height: 30px; padding: 0 13px; font-size: 11.5px; font-weight: 800; border-radius: 9px; text-decoration: none; display: inline-flex; align-items: center; gap: 5px; background: linear-gradient(135deg, #ff9b73 0%, #ff784b 100%); color: #ffffff; border: none; box-shadow: 0 2px 8px rgba(255, 138, 92, 0.3);">
                <i class="fa-solid fa-receipt"></i> Open POS
              </a>
            </div>

          </div>

          <!-- Bottom Row: Full-Width Daily Revenue Pacing Progress Bar -->
          <div style="display: flex; flex-direction: column; gap: 6px; background: #f8fafc; border: 1px solid #eef2f8; padding: 9px 14px; border-radius: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; font-weight: 800;">
              <span style="color: var(--text-dark); display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-flag-checkered" style="color: #ff8a5c;"></i>
                <span id="dash-target-amounts">Today's Revenue Goal: ₹15,000</span>
              </span>
              <span id="dash-target-badge" style="color: #ff8a5c; font-weight: 850; background: #fff5f2; border: 1px solid #ffd6cc; padding: 2px 8px; border-radius: 10px;">0% Met</span>
            </div>
            <div class="dash-pacing-progress-bg" style="width: 100%; height: 9px; background: #e2e8f0; border-radius: 6px; overflow: hidden; border: 1px solid #cbd5e1; padding: 1px;">
              <div id="dash-target-bar" class="dash-pacing-progress-fill" style="width: 0%; height: 100%; background: linear-gradient(90deg, #ff8a5c 0%, #10b981 100%); border-radius: 5px; transition: width 0.4s ease;"></div>
            </div>
          </div>

        </div>

        <!-- 3B. Live Floor Table Occupancy Matrix (T1 - T8) -->
        <div class="glass-card" style="padding: 13px 18px; border-radius: 16px; background: #ffffff; border: 1px solid #f0f3f9; display: flex; flex-direction: column; gap: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 13px; font-weight: 800; color: var(--text-dark); display: flex; align-items: center; gap: 7px;">
              <i class="fa-solid fa-chair" style="color: #10b981;"></i> Live Floor Table Matrix (T1 – T8)
            </span>
            <span style="font-size: 11px; color: var(--text-muted); font-weight: 600;">Click any free table to bill or occupied table to track in KDS</span>
          </div>
          <div id="dash-floor-table-matrix" class="dash-floor-table-matrix"></div>
        </div>

        <!-- 4. Performance & Collections Row (2-Column Grid: 62% / 38%) -->
        <div class="dash-charts-row" style="display: grid; grid-template-columns: 1.6fr 1fr; gap: 14px;">
          
          <!-- Main Chart: 7-Day Trend / Hourly Rush -->
          <div class="glass-card dash-chart-card" style="padding: 18px 20px; border-radius: 18px; background: #ffffff; border: 1px solid #f0f3f9;">
            <div class="dash-chart-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 14px;">
              <div class="dash-chart-title" style="font-size: 14px; font-weight: 850; color: var(--text-dark); display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-chart-line" style="color: #2563eb;"></i> 
                <span id="dash-chart-title-text">Revenue Trajectory</span>
              </div>
              <div class="dash-chart-toggle-group" style="display: flex; gap: 5px; align-items: center; flex-wrap: wrap;">
                <button class="dash-chart-toggle-btn ${this.activeChartMode === 'trend' ? 'active' : ''}" data-mode="trend" onclick="views.dashboard.setChartMode('trend')">7-Day Trend</button>
                <button class="dash-chart-toggle-btn ${this.activeChartMode === 'hourlyRush' ? 'active' : ''}" data-mode="hourlyRush" onclick="views.dashboard.setChartMode('hourlyRush')">Hourly Sales</button>
                <button class="dash-chart-toggle-btn ${this.activeChartMode === 'hourlyOrders' ? 'active' : ''}" data-mode="hourlyOrders" onclick="views.dashboard.setChartMode('hourlyOrders')">Hourly Bills</button>
                <button class="dash-chart-toggle-btn ${this.activeChartMode === 'monthly' ? 'active' : ''}" data-mode="monthly" onclick="views.dashboard.setChartMode('monthly')">30-Day</button>
              </div>
            </div>
            <div class="dash-chart-canvas-wrap" style="height: 270px; width: 100%;">
              <canvas id="salesTrendsChartCanvas"></canvas>
            </div>
          </div>

          <!-- Payment Split & Fulfillment Channels Card -->
          <div class="glass-card dash-chart-card" style="padding: 18px 20px; border-radius: 18px; background: #ffffff; border: 1px solid #f0f3f9;">
            <div class="dash-chart-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <div class="dash-chart-title" style="font-size: 14px; font-weight: 850; color: var(--text-dark); display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-wallet" style="color: #10b981;"></i> Collections & Channels
              </div>
              <span class="dash-tag tag-cash" style="font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px;">Mix</span>
            </div>
            <div class="dash-chart-canvas-wrap" style="height: 170px; width: 100%;">
              <canvas id="paymentPieChartCanvas"></canvas>
            </div>

            <!-- Fulfillment Channels Progress -->
            <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 14px; padding-top: 12px; border-top: 1px solid #f0f3f9;">
              <div>
                <div style="display: flex; justify-content: space-between; font-size: 11.5px; font-weight: 750; color: var(--text-dark);">
                  <span><i class="fa-solid fa-chair" style="color: #2563eb; margin-right: 4px;"></i> Dine-in (<span id="channel-dine-count">0 orders</span>)</span>
                  <span id="channel-dine-sales" style="color: #2563eb; font-weight: 850;">₹0</span>
                </div>
                <div class="dash-pacing-progress-bg" style="margin-top: 4px; height: 6px; background: #f1f5f9; border-radius: 6px; overflow: hidden;">
                  <div id="channel-dine-bar" class="dash-pacing-progress-fill" style="width: 0%; height: 100%; background: #2563eb; border-radius: 6px; transition: width 0.3s ease;"></div>
                </div>
              </div>
              <div>
                <div style="display: flex; justify-content: space-between; font-size: 11.5px; font-weight: 750; color: var(--text-dark);">
                  <span><i class="fa-solid fa-bag-shopping" style="color: #10b981; margin-right: 4px;"></i> Takeaway (<span id="channel-take-count">0 orders</span>)</span>
                  <span id="channel-take-sales" style="color: #059669; font-weight: 850;">₹0</span>
                </div>
                <div class="dash-pacing-progress-bg" style="margin-top: 4px; height: 6px; background: #f1f5f9; border-radius: 6px; overflow: hidden;">
                  <div id="channel-take-bar" class="dash-pacing-progress-fill" style="width: 0%; height: 100%; background: #10b981; border-radius: 6px; transition: width 0.3s ease;"></div>
                </div>
              </div>
              <div>
                <div style="display: flex; justify-content: space-between; font-size: 11.5px; font-weight: 750; color: var(--text-dark);">
                  <span><i class="fa-solid fa-motorcycle" style="color: #f59e0b; margin-right: 4px;"></i> Delivery (<span id="channel-del-count">0 orders</span>)</span>
                  <span id="channel-del-sales" style="color: #d97706; font-weight: 850;">₹0</span>
                </div>
                <div class="dash-pacing-progress-bg" style="margin-top: 4px; height: 6px; background: #f1f5f9; border-radius: 6px; overflow: hidden;">
                  <div id="channel-del-bar" class="dash-pacing-progress-fill" style="width: 0%; height: 100%; background: #f59e0b; border-radius: 6px; transition: width 0.3s ease;"></div>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- 5. Operational Intelligence Row (2-Column Grid: 50% / 50%) -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;" class="dash-menu-stock-grid">
          
          <!-- Best Selling Menu Items Leaderboard -->
          <div class="glass-card dash-card-box" style="padding: 18px 20px; border-radius: 18px; background: #ffffff; border: 1px solid #f0f3f9;">
            <div class="dash-card-box-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
              <h3 style="font-size: 14px; font-weight: 850; color: var(--text-dark); margin: 0; display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-crown" style="color: #f59e0b;"></i> Best Selling Menu Items
              </h3>
              <div style="display: flex; align-items: center; gap: 6px;">
                <button class="dash-chart-toggle-btn active dash-leader-sort-btn" data-sort="qty" onclick="views.dashboard.setBestSellerSort('qty')">By Qty</button>
                <button class="dash-chart-toggle-btn dash-leader-sort-btn" data-sort="rev" onclick="views.dashboard.setBestSellerSort('rev')">By Revenue</button>
                <button class="dash-chart-toggle-btn dash-leader-sort-btn" data-sort="profit" onclick="views.dashboard.setBestSellerSort('profit')">By Profit</button>
              </div>
            </div>
            <div id="dash-best-sellers-list" style="display: flex; flex-direction: column; gap: 8px;">
              <!-- Injected dynamically -->
            </div>
          </div>

          <!-- Raw Material Inventory Health Watch & Expenses -->
          <div style="display: flex; flex-direction: column; gap: 14px;">
            
            <div class="glass-card dash-card-box" style="padding: 18px 20px; border-radius: 18px; background: #ffffff; border: 1px solid #f0f3f9;">
              <div class="dash-card-box-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                <h3 style="font-size: 14px; font-weight: 850; color: var(--text-dark); margin: 0; display: flex; align-items: center; gap: 8px;">
                  <i class="fa-solid fa-boxes-stacked" style="color: #dc2626;"></i> Raw Material Stock Health
                </h3>
                <span id="dash-inventory-badge" class="dash-tag tag-neutral">Checking...</span>
              </div>
              <div id="dash-inventory-watch-list" style="display: flex; flex-direction: column; gap: 8px; max-height: 200px; overflow-y: auto;">
                <!-- Injected dynamically -->
              </div>
            </div>

            <!-- Overhead Expenses Quick Watch -->
            <div class="glass-card dash-card-box" style="padding: 18px 20px; border-radius: 18px; background: #ffffff; border: 1px solid #f0f3f9;">
              <div class="dash-card-box-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                <h3 style="font-size: 14px; font-weight: 850; color: var(--text-dark); margin: 0; display: flex; align-items: center; gap: 8px;">
                  <i class="fa-solid fa-receipt" style="color: #2563eb;"></i> Period Expenses Log
                </h3>
                <button type="button" class="btn btn-secondary" onclick="views.dashboard.openQuickExpenseModal()" style="height: 30px; padding: 0 10px; font-size: 11px; font-weight: 800; border-radius: 8px; display: inline-flex; align-items: center; gap: 5px;">
                  <i class="fa-solid fa-plus"></i> Expense
                </button>
              </div>
              <div id="dash-expenses-summary-list" style="display: flex; flex-direction: column; gap: 7px; max-height: 140px; overflow-y: auto;">
                <!-- Injected dynamically -->
              </div>
            </div>

          </div>

        </div>

        <!-- 6. Recent Register Bills Stream (Searchable & Filterable) -->
        <div class="glass-card dash-stream-card" style="padding: 18px 20px; border-radius: 18px; background: #ffffff; border: 1px solid #f0f3f9;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 14px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <h3 style="font-size: 14px; font-weight: 850; color: var(--text-dark); margin: 0; display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-clock-rotate-left" style="color: #2563eb;"></i> Live Register Bills Stream
              </h3>
              <span class="dash-tag tag-neutral" id="dash-recent-count-tag">Showing 8 Bills</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <div style="position: relative; display: inline-flex; align-items: center;">
                <input type="text" id="dash-recent-search-input" class="dash-search-input" placeholder="🔍 Search bill #, phone, mode..." oninput="views.dashboard.onSearchBills(this.value)">
                <button type="button" id="dash-search-clear-btn" onclick="document.getElementById('dash-recent-search-input').value=''; views.dashboard.onSearchBills('');" title="Clear Search" style="display: none; position: absolute; right: 10px; background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 12px; padding: 0;">
                  <i class="fa-solid fa-circle-xmark"></i>
                </button>
              </div>
              <a href="#counter" class="btn btn-secondary" style="height: 32px; padding: 0 12px; font-size: 11.5px; font-weight: 800; border-radius: 10px; text-decoration: none; display: inline-flex; align-items: center; gap: 5px;">
                All History <i class="fa-solid fa-chevron-right" style="font-size: 10px;"></i>
              </a>
            </div>
          </div>

          <div id="dash-recent-orders-list" style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
            <!-- Injected dynamically -->
          </div>
        </div>

      </div>
    `;

    // Bind Refresh button
    const btnRefresh = document.getElementById("dash-btn-refresh");
    if (btnRefresh) {
      btnRefresh.addEventListener("click", () => {
        this.calculateAndRenderMetrics();
        window.showToast("Executive metrics refreshed successfully!", "info");
      });
    }

    // Bind Set Target button
    const btnSetTarget = document.getElementById("dash-btn-set-target");
    if (btnSetTarget) {
      btnSetTarget.addEventListener("click", () => {
        const curSettings = window.db.get("settings") || {};
        const curTarget = Number(curSettings.dailySalesTarget) || 15000;
        const newTarget = prompt("Enter Daily Revenue Target (₹):", curTarget);
        if (newTarget !== null && !isNaN(Number(newTarget)) && Number(newTarget) > 0) {
          curSettings.dailySalesTarget = Number(newTarget);
          window.db.set("settings", curSettings);
          this.calculateAndRenderMetrics();
          window.showToast(`Daily revenue goal set to ${curSettings.currencySymbol || "₹"}${Number(newTarget).toLocaleString("en-IN")}`, "success");
        }
      });
    }

    // Start live clock & shifts
    this.startLiveClock();

    // Start auto-refresh
    this.startAutoRefresh();

    // Render initial denomination calculator inputs
    this.renderDenominationInputs();

    // Calculate metrics
    this.calculateAndRenderMetrics();
  },

  startLiveClock() {
    const update = () => {
      const now = new Date();
      const clockEl = document.getElementById("dash-live-clock");
      if (clockEl) {
        clockEl.innerHTML = `<i class="fa-regular fa-clock" style="color: #2563eb;"></i> ${now.toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
      }

      // Check shift status (12 PM to 3 AM operational)
      const currentHour = now.getHours();
      const shiftEl = document.getElementById("dash-shift-indicator");
      if (shiftEl) {
        if ((currentHour >= 12 && currentHour <= 23) || (currentHour >= 0 && currentHour < 3)) {
          let shiftName = "Live Shift Active";
          if (currentHour >= 19 && currentHour < 22) shiftName = "🔥 Dinner Rush Active";
          else if (currentHour >= 22 || currentHour < 3) shiftName = "🌙 Late Night / Midnight Rush";
          else if (currentHour >= 12 && currentHour < 17) shiftName = "☀️ Lunch Shift Active";
          
          shiftEl.className = "dash-shift-live-pill shift-open";
          shiftEl.innerHTML = `<i class="fa-solid fa-circle"></i> <span>${shiftName} (12 PM – 3 AM)</span>`;
        } else {
          shiftEl.className = "dash-shift-live-pill shift-closed";
          shiftEl.innerHTML = `<i class="fa-solid fa-moon" style="font-size: 10px;"></i> <span>Off-Hours (Opens 12 PM)</span>`;
        }
      }
    };
    update();
    this.clockInterval = setInterval(update, 1000);
  },

  toggleAutoRefresh() {
    this.autoRefreshEnabled = !this.autoRefreshEnabled;
    const btn = document.getElementById("dash-autorefresh-btn");
    const icon = document.getElementById("dash-refresh-icon");
    const text = document.getElementById("dash-countdown-text");

    if (this.autoRefreshEnabled) {
      if (btn) btn.classList.add("active");
      if (icon) icon.className = "fa-solid fa-arrows-rotate fa-spin";
      if (text) text.textContent = "Auto 30s";
      this.startAutoRefresh();
      window.showToast("Real-time 30s auto-refresh enabled.", "info");
    } else {
      if (btn) btn.classList.remove("active");
      if (icon) icon.className = "fa-solid fa-pause";
      if (text) text.textContent = "Paused";
      if (this.autoRefreshTimer) clearInterval(this.autoRefreshTimer);
      if (this.countdownInterval) clearInterval(this.countdownInterval);
      window.showToast("Auto-refresh paused.", "info");
    }
  },

  startAutoRefresh() {
    if (this.autoRefreshTimer) clearInterval(this.autoRefreshTimer);
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    if (!this.autoRefreshEnabled) return;

    this.autoRefreshCountdown = 30;
    this.countdownInterval = setInterval(() => {
      this.autoRefreshCountdown--;
      const text = document.getElementById("dash-countdown-text");
      if (text && this.autoRefreshEnabled) {
        text.textContent = `Auto ${this.autoRefreshCountdown}s`;
      }
      if (this.autoRefreshCountdown <= 0) {
        this.autoRefreshCountdown = 30;
        this.calculateAndRenderMetrics();
      }
    }, 1000);
  },

  getFilteredOrders() {
    const orders = window.db.get("orders") || [];
    const { todayStr, yesterdayStr, weekStartStr, monthStartStr } = this.getTimeframeDates();

    if (this.selectedTimeframe === "yesterday") {
      return orders.filter(o => this.getOrderLocalDateStr(o) === yesterdayStr);
    } else if (this.selectedTimeframe === "week") {
      return orders.filter(o => {
        const dStr = this.getOrderLocalDateStr(o);
        return dStr && dStr >= weekStartStr && dStr <= todayStr;
      });
    } else if (this.selectedTimeframe === "month") {
      return orders.filter(o => {
        const dStr = this.getOrderLocalDateStr(o);
        return dStr && dStr >= monthStartStr && dStr <= todayStr;
      });
    } else if (this.selectedTimeframe === "custom" && this.customStartDate && this.customEndDate) {
      return orders.filter(o => {
        const dStr = this.getOrderLocalDateStr(o);
        return dStr && dStr >= this.customStartDate && dStr <= this.customEndDate;
      });
    } else {
      return orders.filter(o => this.getOrderLocalDateStr(o) === todayStr);
    }
  },

  calculateAndRenderMetrics() {
    const orders = window.db.get("orders") || [];
    const products = window.db.get("products") || [];
    const categories = window.db.get("categories") || [];
    const expenses = window.db.get("expenses") || [];
    const settings = window.db.get("settings") || {};

    const currencySymbol = settings.currencySymbol || "₹";
    const { todayStr, yesterdayStr, weekStartStr, prevWeekStartStr, prevWeekEndStr, monthStartStr, prevMonthStartStr, prevMonthEndStr } = this.getTimeframeDates();

    const filteredOrders = this.getFilteredOrders();
    const validOrders = filteredOrders.filter(o => o.status !== "Cancelled");
    const cancelledOrders = filteredOrders.filter(o => o.status === "Cancelled");

    // Populate Dynamic Smart Insights Strip
    const insightsStrip = document.getElementById("dash-smart-insights-strip");
    if (insightsStrip && window.businessIntel && typeof window.businessIntel.getSmartInsightCards === "function") {
      const cards = window.businessIntel.getSmartInsightCards();
      insightsStrip.innerHTML = cards.map(c => `
        <div class="dash-intel-card" onclick="window.businessIntel.openBusiness360Modal('today', '${c.tab || 'overview'}')" title="Click to open ${c.title} in Business 360°">
          <div class="dash-intel-icon" style="color: ${c.color}; background: ${c.bg};">
            <i class="fa-solid ${c.icon}"></i>
          </div>
          <div class="dash-intel-body">
            <div class="dash-intel-title">${c.title}</div>
            <div class="dash-intel-val">${c.value}</div>
            <div class="dash-intel-sub">${c.sub}</div>
          </div>
        </div>
      `).join("");
    }

    // Dynamic label for Gross Sales
    let periodLabel = "Today's";
    if (this.selectedTimeframe === "yesterday") periodLabel = "Yesterday's";
    else if (this.selectedTimeframe === "week") periodLabel = "7-Day";
    else if (this.selectedTimeframe === "month") periodLabel = "This Month's";
    else if (this.selectedTimeframe === "custom") periodLabel = "Custom Period";

    const salesLabelEl = document.getElementById("dash-sales-label");
    if (salesLabelEl) salesLabelEl.textContent = `${periodLabel} Gross Sales`;

    // Gross Sales & Payment Mode Totals
    let cashTotal = 0, cashOrdersCount = 0;
    let upiTotal = 0, upiOrdersCount = 0;
    let cardTotal = 0, cardOrdersCount = 0;
    let grossSales = 0;
    let flatDiscountTotal = 0;
    let totalItemsServed = 0;

    validOrders.forEach(o => {
      const amt = Number(o.total) || 0;
      grossSales += amt;
      flatDiscountTotal += (Number(o.discount) || 0);

      if (Array.isArray(o.items)) {
        o.items.forEach(i => { totalItemsServed += (i.quantity || 1); });
      }

      if (o.paymentMethod === "Cash") {
        cashTotal += amt;
        cashOrdersCount++;
      } else if (o.paymentMethod === "Card") {
        cardTotal += amt;
        cardOrdersCount++;
      } else {
        upiTotal += amt;
        upiOrdersCount++;
      }
    });

    const salesValEl = document.getElementById("dash-sales-val");
    if (salesValEl) this.animateCounter(salesValEl, grossSales, currencySymbol);

    const itemsSoldSub = document.getElementById("dash-items-sold-sub");
    if (itemsSoldSub) itemsSoldSub.textContent = `${totalItemsServed} items served across bills`;

    // Growth indicator comparison
    const growthEl = document.getElementById("dash-growth-indicator");
    if (growthEl) {
      let prevPeriodSales = 0;
      let compLabel = "vs prev";

      if (this.selectedTimeframe === "today") {
        prevPeriodSales = orders
          .filter(o => this.getOrderLocalDateStr(o) === yesterdayStr && o.status !== "Cancelled")
          .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
        compLabel = "vs yday";
      } else if (this.selectedTimeframe === "yesterday") {
        const dayBefore = new Date();
        dayBefore.setDate(dayBefore.getDate() - 2);
        const dStr = this.getLocalDateStr(dayBefore);
        prevPeriodSales = orders
          .filter(o => this.getOrderLocalDateStr(o) === dStr && o.status !== "Cancelled")
          .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
        compLabel = "vs day prior";
      } else if (this.selectedTimeframe === "week") {
        prevPeriodSales = orders
          .filter(o => {
            const dStr = this.getOrderLocalDateStr(o);
            return dStr && dStr >= prevWeekStartStr && dStr <= prevWeekEndStr && o.status !== "Cancelled";
          })
          .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
        compLabel = "vs prev 7D";
      } else if (this.selectedTimeframe === "month") {
        prevPeriodSales = orders
          .filter(o => {
            const dStr = this.getOrderLocalDateStr(o);
            return dStr && dStr >= prevMonthStartStr && dStr <= prevMonthEndStr && o.status !== "Cancelled";
          })
          .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
        compLabel = "vs prev month";
      }

      if (prevPeriodSales > 0) {
        const diffPct = Math.round(((grossSales - prevPeriodSales) / prevPeriodSales) * 100);
        const isUp = diffPct >= 0;
        growthEl.innerHTML = `
          <span class="dash-growth-tag ${isUp ? 'growth-up' : 'growth-down'}">
            <i class="fa-solid ${isUp ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}"></i> ${isUp ? '+' : ''}${diffPct}% ${compLabel}
          </span>
        `;
      } else {
        growthEl.innerHTML = "";
      }
    }

    // Revenue Target Pacing Tracker
    let multiplier = 1;
    if (this.selectedTimeframe === "week") multiplier = 7;
    else if (this.selectedTimeframe === "month") multiplier = 30;
    else if (this.selectedTimeframe === "custom" && this.customStartDate && this.customEndDate) {
      const d1 = new Date(this.customStartDate);
      const d2 = new Date(this.customEndDate);
      const diffDays = Math.max(1, Math.round((d2 - d1) / 86400000) + 1);
      multiplier = diffDays;
    }

    const baseTarget = Number(settings.dailySalesTarget) || 15000;
    const targetGoal = baseTarget * multiplier;
    const targetPct = targetGoal > 0 ? Math.min(100, Math.round((grossSales / targetGoal) * 100)) : 0;

    const targetBadgeEl = document.getElementById("dash-target-badge");
    const cardGoalPill = document.getElementById("dash-card-goal-pill");
    const targetAmountsEl = document.getElementById("dash-target-amounts");
    const targetBarEl = document.getElementById("dash-target-bar");
    const projectedCloseEl = document.getElementById("dash-target-projected");

    if (targetBadgeEl) targetBadgeEl.textContent = `${targetPct}% Met`;
    if (cardGoalPill) cardGoalPill.innerHTML = `<i class="fa-solid fa-bullseye"></i> ${targetPct}% Goal`;
    if (targetAmountsEl) targetAmountsEl.textContent = `Today's Revenue Goal: ${currencySymbol}${Math.round(targetGoal).toLocaleString("en-IN")}`;
    if (targetBarEl) {
      targetBarEl.style.width = `${targetPct}%`;
      targetBarEl.style.background = targetPct >= 100 ? "linear-gradient(90deg, #10b981, #059669)" : "linear-gradient(90deg, #ff8a5c, #10b981)";
    }

    // Run-rate & Projected Closing
    if (this.selectedTimeframe === "today") {
      const now = new Date();
      const curHour = now.getHours() + (now.getMinutes() / 60);
      const normalizedCurHour = curHour < 12 ? curHour + 24 : curHour;
      const operatingHoursElapsed = Math.max(0.5, Math.min(15, Math.max(0, normalizedCurHour - 12)));
      const hourlyVelocity = Math.round(grossSales / operatingHoursElapsed);
      const remainingHours = Math.max(0, 27 - Math.max(12, normalizedCurHour));
      const projectedClosingRevenue = Math.round(grossSales + (hourlyVelocity * remainingHours));

      if (projectedCloseEl) {
        projectedCloseEl.textContent = `Projected 3 AM: ${currencySymbol}${projectedClosingRevenue.toLocaleString("en-IN")}`;
      }
    } else {
      if (projectedCloseEl) {
        projectedCloseEl.textContent = `${targetPct}% of ${currencySymbol}${Math.round(targetGoal).toLocaleString("en-IN")}`;
      }
    }

    // Overhead Expenses for Period
    const periodExpenses = expenses.filter(e => {
      const dStr = this.getOrderLocalDateStr(e);
      if (this.selectedTimeframe === "yesterday") return dStr === yesterdayStr;
      if (this.selectedTimeframe === "week") return dStr && dStr >= weekStartStr && dStr <= todayStr;
      if (this.selectedTimeframe === "month") return dStr && dStr >= monthStartStr && dStr <= todayStr;
      if (this.selectedTimeframe === "custom" && this.customStartDate && this.customEndDate) {
        return dStr && dStr >= this.customStartDate && dStr <= this.customEndDate;
      }
      return dStr === todayStr;
    });

    const totalPeriodExpense = periodExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const cashExpenses = periodExpenses.filter(e => e.paymentMethod === "Cash").reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    
    // Dynamic item-level COGS based on exact dish cost prices from Menu Management
    const fin = (window.db && window.db.calculateOrdersFinancials)
      ? window.db.calculateOrdersFinancials(validOrders)
      : null;
    const actualCOGS = fin ? fin.totalCOGS : (grossSales * 0.32);
    const netProfit = Math.max(0, grossSales - actualCOGS - totalPeriodExpense);
    const profitMargin = grossSales > 0 ? Math.round((netProfit / grossSales) * 100) : 0;

    const profitValEl = document.getElementById("dash-profit-val");
    if (profitValEl) this.animateCounter(profitValEl, netProfit, currencySymbol);

    const marginPillEl = document.getElementById("dash-margin-pill");
    if (marginPillEl) marginPillEl.innerHTML = `<i class="fa-solid fa-percent"></i> ${profitMargin}% Margin`;

    const expensePillEl = document.getElementById("dash-expense-pill");
    if (expensePillEl) expensePillEl.innerHTML = `<i class="fa-solid fa-receipt"></i> Exp: ${currencySymbol}${Math.round(totalPeriodExpense).toLocaleString("en-IN")}`;

    // Orders Count & AOV
    const totalOrdersCount = filteredOrders.length;
    const fulfillmentRate = totalOrdersCount > 0 ? Math.round((validOrders.length / totalOrdersCount) * 100) : 100;
    const aov = validOrders.length > 0 ? Math.round(grossSales / validOrders.length) : 0;

    const ordersValEl = document.getElementById("dash-orders-val");
    if (ordersValEl) this.animateCounter(ordersValEl, totalOrdersCount, "");

    this.renderFloorTableMatrix(orders);

    const aovPillEl = document.getElementById("dash-aov-pill");
    if (aovPillEl) aovPillEl.innerHTML = `<i class="fa-solid fa-calculator"></i> Avg: ${currencySymbol}${aov}/bill`;

    const fulfillmentPillEl = document.getElementById("dash-fulfillment-pill");
    if (fulfillmentPillEl) {
      fulfillmentPillEl.innerHTML = `<i class="fa-solid fa-check"></i> ${fulfillmentRate}% Fulfilled`;
    }

    // Active Kitchen Queue
    const activeQueueOrders = orders.filter(o => o.status === "Pending" || o.status === "Preparing");
    const activeQueueCount = activeQueueOrders.length;

    // Table Occupancy calculation (NEW ADVANCED FEATURE)
    const activeTables = new Set();
    activeQueueOrders.forEach(o => {
      if (o.type === "Dine-in" && o.table) activeTables.add(o.table);
    });
    const occEl = document.getElementById("dash-table-occupancy-pill");
    if (occEl) {
      const occCount = activeTables.size;
      const occPct = Math.round((occCount / 8) * 100);
      occEl.innerHTML = `<i class="fa-solid fa-chair" style="color: ${occCount > 0 ? '#16a34a' : '#64748b'};"></i> <strong>${occCount}/8</strong> Tables Active (${occPct}% Occ.)`;
    }

    const activeValEl = document.getElementById("dash-active-val");
    if (activeValEl) activeValEl.textContent = activeQueueCount;

    const badgeActiveOrders = document.getElementById("tab-badge-active-orders");
    if (badgeActiveOrders) badgeActiveOrders.textContent = activeQueueCount;

    const prepOrders = filteredOrders.filter(o => (o.status === "Ready" || o.status === "Completed") && (o.prepDurationSeconds || (o.readyAt && o.createdAt)));
    let totalPrepSecs = 0;
    prepOrders.forEach(o => {
      const dur = o.prepDurationSeconds || Math.round((new Date(o.readyAt || o.completedAt) - new Date(o.preparingStartedAt || o.createdAt)) / 1000);
      totalPrepSecs += Math.max(0, dur);
    });
    const avgPrepSecs = prepOrders.length > 0 ? Math.round(totalPrepSecs / prepOrders.length) : 0;
    const avgPrepMins = Math.floor(avgPrepSecs / 60);

    const targetPrepMinutes = Number(settings.targetPrepMinutes) || 15;
    const targetPrepSecs = targetPrepMinutes * 60;
    const nowTs = new Date();
    const overdueCount = orders.filter(o => {
      if (o.status !== "Preparing") return false;
      const start = new Date(o.preparingStartedAt || o.createdAt);
      return Math.floor((nowTs - start) / 1000) > targetPrepSecs;
    }).length;

    const queueStatusEl = document.getElementById("dash-queue-status");
    if (queueStatusEl) {
      queueStatusEl.innerHTML = `<i class="fa-solid fa-stopwatch"></i> Avg: ${avgPrepMins > 0 ? `${avgPrepMins}m` : (prepOrders.length > 0 ? `${avgPrepSecs}s` : '--m')}`;
    }

    const delayPillEl = document.getElementById("dash-delay-pill");
    if (delayPillEl) {
      if (overdueCount > 0) {
        delayPillEl.className = "dash-sub-pill pill-neutral";
        delayPillEl.style.color = "#dc2626";
        delayPillEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${overdueCount} Delayed!`;
      } else {
        delayPillEl.className = "dash-sub-pill pill-cash";
        delayPillEl.style.color = "";
        delayPillEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> On-Time`;
      }
    }

    // Expected Drawer Cash
    const expectedDrawerCash = Math.max(0, cashTotal - cashExpenses);
    const drawerValEl = document.getElementById("dash-drawer-val");
    if (drawerValEl) drawerValEl.textContent = `${currencySymbol}${Math.round(expectedDrawerCash).toLocaleString("en-IN")}`;

    const digitalSubEl = document.getElementById("dash-digital-sub");
    if (digitalSubEl) digitalSubEl.textContent = `UPI / Online: ${currencySymbol}${Math.round(upiTotal).toLocaleString("en-IN")}`;

    const cashSalesPill = document.getElementById("dash-cash-sales-pill");
    if (cashSalesPill) cashSalesPill.innerHTML = `<i class="fa-solid fa-money-bill-wave"></i> Cash: ${currencySymbol}${Math.round(cashTotal).toLocaleString("en-IN")}`;

    // Customer Retention & Counts
    const custMap = {};
    validOrders.forEach(o => {
      const phone = (o.customerPhone || "").trim();
      const name = (o.customerName || "").trim() || "Walk-in";
      const key = phone ? phone : name;
      if (!custMap[key]) custMap[key] = { name, phone, count: 0, spent: 0 };
      custMap[key].count++;
      custMap[key].spent += (Number(o.total) || 0);
    });

    const totalUniqueCust = Object.keys(custMap).length;
    const repeatCustCount = Object.values(custMap).filter(c => c.count > 1).length;
    const repeatCustRate = totalUniqueCust > 0 ? Math.round((repeatCustCount / totalUniqueCust) * 100) : 0;

    // Render Subsections
    this.renderChannels(validOrders, grossSales, currencySymbol);
    this.renderShiftsAndPeak(validOrders, currencySymbol);
    this.renderLiveKitchenQueue(activeQueueOrders);
    this.renderFinancialsTab(cashTotal, cashExpenses, expectedDrawerCash, periodExpenses, currencySymbol);
    this.renderBestSellers(filteredOrders, products, categories, currencySymbol);
    this.renderInventoryWatch();
    this.renderCustomerInsights(custMap, totalUniqueCust, repeatCustRate, currencySymbol);
    this.renderRecentBills(filteredOrders, currencySymbol);

    // Visual Charts
    this.renderSalesChart(orders, todayStr);
    this.renderPaymentChart(orders, todayStr);
    this.renderCategoryChart(validOrders);
  },

  // Channels (Dine-in vs Parcel vs Delivery)
  renderChannels(validOrders, grossSales, currencySymbol) {
    let dineCount = 0, dineSales = 0;
    let takeCount = 0, takeSales = 0;
    let delCount = 0, delSales = 0;

    validOrders.forEach(o => {
      const type = (o.type || "Dine-in").toLowerCase();
      const amt = Number(o.total) || 0;
      if (type.includes("takeaway") || type.includes("parcel")) {
        takeCount++;
        takeSales += amt;
      } else if (type.includes("delivery")) {
        delCount++;
        delSales += amt;
      } else {
        dineCount++;
        dineSales += amt;
      }
    });

    const dinePct = grossSales > 0 ? Math.round((dineSales / grossSales) * 100) : 0;
    const takePct = grossSales > 0 ? Math.round((takeSales / grossSales) * 100) : 0;
    const delPct = grossSales > 0 ? Math.round((delSales / grossSales) * 100) : 0;

    const setEl = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    setEl("channel-dine-sales", `${currencySymbol}${Math.round(dineSales).toLocaleString("en-IN")}`);
    setEl("channel-dine-count", `${dineCount} orders (${dinePct}%)`);
    setEl("channel-dine-avg", `Avg: ${currencySymbol}${dineCount > 0 ? Math.round(dineSales / dineCount) : 0}/table`);

    setEl("channel-take-sales", `${currencySymbol}${Math.round(takeSales).toLocaleString("en-IN")}`);
    setEl("channel-take-count", `${takeCount} orders (${takePct}%)`);
    setEl("channel-take-avg", `Avg: ${currencySymbol}${takeCount > 0 ? Math.round(takeSales / takeCount) : 0}/parcel`);

    setEl("channel-del-sales", `${currencySymbol}${Math.round(delSales).toLocaleString("en-IN")}`);
    setEl("channel-del-count", `${delCount} orders (${delPct}%)`);
    setEl("channel-del-avg", `Avg: ${currencySymbol}${delCount > 0 ? Math.round(delSales / delCount) : 0}/delivery`);

    const barDine = document.getElementById("channel-dine-bar");
    if (barDine) barDine.style.width = `${dinePct}%`;

    const barTake = document.getElementById("channel-take-bar");
    if (barTake) barTake.style.width = `${takePct}%`;

    const barDel = document.getElementById("channel-del-bar");
    if (barDel) barDel.style.width = `${delPct}%`;
  },

  // Shifts and Peak Hour
  renderShiftsAndPeak(validOrders, currencySymbol) {
    const container = document.getElementById("dash-shifts-container");
    if (!container) return;

    const shifts = [
      { name: "12 PM – 5 PM", label: "Lunch Shift", icon: "fa-sun", color: "#f59e0b", orders: 0, sales: 0, match: h => h >= 12 && h < 17 },
      { name: "5 PM – 7 PM", label: "Evening Snacks", icon: "fa-mug-hot", color: "#ff7343", orders: 0, sales: 0, match: h => h >= 17 && h < 19 },
      { name: "7 PM – 10 PM", label: "Dinner Rush", icon: "fa-utensils", color: "#7c3aed", orders: 0, sales: 0, match: h => h >= 19 && h < 22 },
      { name: "10 PM – 12 AM", label: "Late Night", icon: "fa-moon", color: "#4f46e5", orders: 0, sales: 0, match: h => h >= 22 && h < 24 },
      { name: "12 AM – 3 AM", label: "Midnight Rush", icon: "fa-cloud-moon", color: "#2563eb", orders: 0, sales: 0, match: h => h >= 0 && h < 3 }
    ];

    const hourFrequency = {};
    validOrders.forEach(o => {
      const d = new Date(o.createdAt);
      if (isNaN(d.getTime())) return;
      const h = d.getHours();
      const amt = Number(o.total) || 0;
      hourFrequency[h] = (hourFrequency[h] || 0) + 1;

      for (const s of shifts) {
        if (s.match(h)) {
          s.orders++;
          s.sales += amt;
          break;
        }
      }
    });

    let peakHour = null;
    let maxHourOrders = 0;
    Object.keys(hourFrequency).forEach(h => {
      if (hourFrequency[h] > maxHourOrders) {
        maxHourOrders = hourFrequency[h];
        peakHour = Number(h);
      }
    });

    const peakBannerEl = document.getElementById("dash-peak-banner-text");
    if (peakBannerEl) {
      if (peakHour !== null && maxHourOrders > 0) {
        const ampm1 = peakHour >= 12 ? 'PM' : 'AM';
        const h1 = peakHour % 12 || 12;
        const nextH = (peakHour + 1) % 24;
        const ampm2 = nextH >= 12 ? 'PM' : 'AM';
        const h2 = nextH % 12 || 12;
        peakBannerEl.textContent = `Busiest Operational Rush: ${h1} ${ampm1} – ${h2} ${ampm2} (${maxHourOrders} bills generated)`;
      } else {
        peakBannerEl.textContent = `Continuous Service Active • All Shifts Monitored`;
      }
    }

    const currentHour = new Date().getHours();
    container.innerHTML = shifts.map(s => {
      const isCurrent = s.match(currentHour);
      return `
        <div class="dash-shift-card ${isCurrent ? 'active-shift' : ''}">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 12px; font-weight: 800; color: var(--text-dark); display: flex; align-items: center; gap: 6px;">
              <i class="fa-solid ${s.icon}" style="color: ${s.color};"></i> ${s.name}
            </span>
            ${isCurrent ? `<span style="background: #2563eb; color: #fff; font-size: 9px; font-weight: 800; padding: 2px 7px; border-radius: 6px;">ACTIVE</span>` : ''}
          </div>
          <div style="font-size: 11px; font-weight: 700; color: var(--text-muted);">${s.label}</div>
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 4px;">
            <span style="font-size: 16px; font-weight: 900; color: ${s.color};">${currencySymbol}${Math.round(s.sales).toLocaleString("en-IN")}</span>
            <span style="font-size: 11px; font-weight: 700; color: var(--text-muted);">${s.orders} bills</span>
          </div>
        </div>
      `;
    }).join("");
  },

  // Live Kitchen Tickets in Operations Tab
  renderLiveKitchenQueue(activeOrders) {
    const countEl = document.getElementById("dash-live-ticket-count");
    if (countEl) countEl.textContent = activeOrders.length;

    const listEl = document.getElementById("dash-live-tickets-list");
    if (!listEl) return;

    if (activeOrders.length === 0) {
      listEl.innerHTML = `
        <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 12px; padding: 16px; text-align: center;">
          <i class="fa-solid fa-circle-check" style="font-size: 22px; color: #16a34a; margin-bottom: 4px; display: block;"></i>
          <div style="font-weight: 800; font-size: 13px; color: #166534;">Kitchen Queue is 100% Clear!</div>
          <div style="font-size: 11px; color: #15803d; margin-top: 2px;">No orders currently pending or preparing. Ready for new tickets.</div>
        </div>
      `;
      return;
    }

    const now = new Date();
    listEl.innerHTML = activeOrders.slice(0, 5).map(o => {
      const elapsedMins = Math.max(0, Math.floor((now - new Date(o.createdAt)) / 60000));
      const isUrgent = elapsedMins >= 15;
      const isWarning = elapsedMins >= 10 && !isUrgent;
      const badgeBg = isUrgent ? "#fee2e2" : (isWarning ? "#fffbeb" : "#ecfdf5");
      const badgeColor = isUrgent ? "#dc2626" : (isWarning ? "#b45309" : "#059669");

      const itemsStr = Array.isArray(o.items) ? o.items.map(i => `${i.quantity}x ${i.name}`).join(", ") : "Items";

      return `
        <div style="padding: 10px 14px; background: #f8fafc; border: 1px solid var(--border-color); border-radius: 12px; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
          <div style="min-width: 0; flex: 1;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 850; font-size: 13px; color: var(--text-dark);">#${o.orderNumber || "Bill"}</span>
              <span class="dash-tag tag-neutral">${o.type || "Dine-in"}</span>
              <span style="font-size: 11px; font-weight: 700; color: ${badgeColor}; background: ${badgeBg}; padding: 2px 8px; border-radius: 6px;">
                <i class="fa-solid fa-clock"></i> ${elapsedMins}m in kitchen
              </span>
            </div>
            <div style="font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px;">
              ${itemsStr}
            </div>
          </div>
          <a href="#orders" style="font-size: 11px; font-weight: 800; color: #2563eb; text-decoration: none; background: #eff6ff; padding: 4px 10px; border-radius: 8px; flex-shrink: 0;">
            View in KDS
          </a>
        </div>
      `;
    }).join("");
  },

  // Financials Tab (Drawer Balance, Expenses, Tally)
  renderFinancialsTab(cashTotal, cashExpenses, expectedDrawerCash, periodExpenses, currencySymbol) {
    const finCashIn = document.getElementById("dash-fin-cash-in");
    if (finCashIn) finCashIn.textContent = `${currencySymbol}${Math.round(cashTotal).toLocaleString("en-IN")}`;

    const finCashOut = document.getElementById("dash-fin-cash-out");
    if (finCashOut) finCashOut.textContent = `-${currencySymbol}${Math.round(cashExpenses).toLocaleString("en-IN")}`;

    const finExpectedTotal = document.getElementById("dash-fin-expected-total");
    if (finExpectedTotal) finExpectedTotal.textContent = `${currencySymbol}${Math.round(expectedDrawerCash).toLocaleString("en-IN")}`;

    const expensesList = document.getElementById("dash-expenses-summary-list");
    if (expensesList) {
      if (periodExpenses.length === 0) {
        expensesList.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 12px; font-size: 11.5px;">No overhead expenses recorded for this period.</div>`;
      } else {
        expensesList.innerHTML = periodExpenses.slice(0, 6).map(e => `
          <div style="padding: 9px 12px; background: #ffffff; border: 1px solid #f0f3f9; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; box-shadow: 0 2px 6px rgba(22, 27, 46, 0.02);">
            <div>
              <span style="font-weight: 800; color: var(--text-dark);">${e.description}</span>
              <span style="color: var(--text-muted); margin-left: 6px; font-size: 11px;">(${e.category || 'General'}) • ${e.paymentMethod || 'Cash'}</span>
            </div>
            <span style="font-weight: 850; color: #dc2626;">-${currencySymbol}${Math.round(e.amount)}</span>
          </div>
        `).join("");
      }
    }
  },

  // Denomination Calculator
  renderDenominationInputs() {
    const container = document.getElementById("dash-denom-rows-container");
    if (!container) return;

    const notes = [500, 200, 100, 50, 20, 10];
    container.innerHTML = notes.map(note => `
      <div class="dash-denom-row">
        <span style="font-weight: 800; font-size: 12.5px; color: var(--text-dark);">₹${note} x</span>
        <input type="number" min="0" value="${this.denominations[note] || ''}" placeholder="0" class="dash-denom-input" id="dash-denom-${note}" oninput="views.dashboard.onDenomInput(${note}, this.value)">
        <span style="text-align: right; font-weight: 850; font-size: 12.5px; color: #2563eb;" id="dash-denom-sub-${note}">₹0</span>
      </div>
    `).join("");
  },

  onDenomInput(note, val) {
    const count = parseInt(val, 10) || 0;
    this.denominations[note] = Math.max(0, count);

    const subEl = document.getElementById(`dash-denom-sub-${note}`);
    if (subEl) subEl.textContent = `₹${(note * count).toLocaleString("en-IN")}`;

    this.calculateDenominationTotal();
  },

  resetDenominations() {
    [500, 200, 100, 50, 20, 10].forEach(note => {
      this.denominations[note] = 0;
      const input = document.getElementById(`dash-denom-${note}`);
      if (input) input.value = "";
      const subEl = document.getElementById(`dash-denom-sub-${note}`);
      if (subEl) subEl.textContent = "₹0";
    });
    this.calculateDenominationTotal();
  },

  calculateDenominationTotal() {
    let totalCounted = 0;
    [500, 200, 100, 50, 20, 10].forEach(note => {
      totalCounted += note * (this.denominations[note] || 0);
    });

    const totalValEl = document.getElementById("dash-denom-total-val");
    if (totalValEl) totalValEl.textContent = `₹${totalCounted.toLocaleString("en-IN")}`;

    // Compare with expected cash
    const orders = window.db.get("orders") || [];
    const expenses = window.db.get("expenses") || [];
    const { todayStr } = this.getTimeframeDates();

    const cashSales = orders
      .filter(o => this.getOrderLocalDateStr(o) === todayStr && o.status !== "Cancelled" && o.paymentMethod === "Cash")
      .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    const cashExpenses = expenses
      .filter(e => this.getOrderLocalDateStr(e) === todayStr && e.paymentMethod === "Cash")
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const expectedCash = Math.max(0, cashSales - cashExpenses);
    const variance = totalCounted - expectedCash;

    const alertEl = document.getElementById("dash-denom-variance-alert");
    if (alertEl) {
      if (totalCounted === 0) {
        alertEl.style.display = "none";
      } else {
        alertEl.style.display = "block";
        if (variance === 0) {
          alertEl.style.color = "#059669";
          alertEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> Drawer is Perfectly Balanced (₹0 discrepancy)`;
        } else if (variance > 0) {
          alertEl.style.color = "#2563eb";
          alertEl.innerHTML = `<i class="fa-solid fa-arrow-up"></i> Cash Excess / Over by +₹${Math.round(variance).toLocaleString("en-IN")}`;
        } else {
          alertEl.style.color = "#dc2626";
          alertEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Cash Shortage of -₹${Math.round(Math.abs(variance)).toLocaleString("en-IN")}`;
        }
      }
    }
  },

  saveDrawerAuditRecord() {
    let totalCounted = 0;
    [500, 200, 100, 50, 20, 10].forEach(note => {
      totalCounted += note * (this.denominations[note] || 0);
    });

    if (totalCounted <= 0) {
      window.showToast("Please enter counted note denominations first.", "error");
      return;
    }

    const orders = window.db.get("orders") || [];
    const expenses = window.db.get("expenses") || [];
    const { todayStr } = this.getTimeframeDates();

    const cashSales = orders
      .filter(o => this.getOrderLocalDateStr(o) === todayStr && o.status !== "Cancelled" && o.paymentMethod === "Cash")
      .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    const cashExpenses = expenses
      .filter(e => this.getOrderLocalDateStr(e) === todayStr && e.paymentMethod === "Cash")
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const expectedCash = Math.max(0, cashSales - cashExpenses);
    const variance = totalCounted - expectedCash;

    const auditRecord = {
      date: todayStr,
      timestamp: new Date().toISOString(),
      expected: expectedCash,
      counted: totalCounted,
      variance: variance,
      denominations: { ...this.denominations },
      note: "Denomination physical tally recorded via Executive Dashboard"
    };

    const audits = window.db.get("drawer_audits") || [];
    audits.unshift(auditRecord);
    window.db.set("drawer_audits", audits);

    window.showToast(`Audit saved! Total counted: ₹${totalCounted.toLocaleString("en-IN")} (${variance >= 0 ? '+' : ''}${Math.round(variance)} variance)`, "success");
  },

  // Best Sellers Leaderboard
  renderBestSellers(orders, products, categories, currencySymbol) {
    const costMap = (window.db && typeof window.db.getProductCostMap === "function")
      ? window.db.getProductCostMap()
      : {};

    const productSoldCounter = {};
    const productRevenueCounter = {};
    const productProfitCounter = {};

    orders.forEach(o => {
      if (o.status === "Cancelled" || !Array.isArray(o.items)) return;
      o.items.forEach(item => {
        const name = item.name || "Unknown Item";
        const qty = Number(item.quantity) || 1;
        const lineRev = (Number(item.price) || 0) * qty;

        const cleanKey = String(name).trim().toLowerCase();
        const costInfo = (item.productId && costMap[item.productId]) || costMap[cleanKey] || null;
        const unitCost = (item.costPrice !== undefined && item.costPrice !== null && !isNaN(item.costPrice) && Number(item.costPrice) >= 0)
          ? Number(item.costPrice)
          : (costInfo ? Number(costInfo.costPrice) : ((Number(item.price) || 0) * 0.32));
        const lineCost = unitCost * qty;
        const lineProfit = Math.max(0, lineRev - lineCost);

        productSoldCounter[name] = (productSoldCounter[name] || 0) + qty;
        productRevenueCounter[name] = (productRevenueCounter[name] || 0) + lineRev;
        productProfitCounter[name] = (productProfitCounter[name] || 0) + lineProfit;
      });
    });

    const bestSellersList = Object.keys(productSoldCounter)
      .map(name => {
        const prod = products.find(p => p.name === name || (p.name && name.startsWith(p.name)));
        const cat = prod ? categories.find(c => c.id === prod.category) : null;
        const cleanKey = String(name).trim().toLowerCase();
        const costInfo = costMap[cleanKey];
        const qty = productSoldCounter[name];
        const revenue = productRevenueCounter[name] || 0;
        const profit = productProfitCounter[name] || 0;
        const marginPct = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

        return {
          name: name,
          category: cat ? cat.name : (costInfo ? costInfo.category : "Menu Item"),
          quantity: qty,
          revenue: revenue,
          profit: profit,
          marginPct: marginPct
        };
      })
      .sort((a, b) => {
        if (this.bestSellerSort === "rev") return b.revenue - a.revenue;
        if (this.bestSellerSort === "profit") return b.profit - a.profit;
        return b.quantity - a.quantity;
      })
      .slice(0, 5);

    const container = document.getElementById("dash-best-sellers-list");
    if (!container) return;

    if (bestSellersList.length === 0) {
      container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px; font-size: 12px;">No sales recorded for this period.</div>`;
      return;
    }

    const maxVal = this.bestSellerSort === "rev"
      ? (bestSellersList[0].revenue || 1)
      : (this.bestSellerSort === "profit" ? (bestSellersList[0].profit || 1) : (bestSellersList[0].quantity || 1));
    const rankBadges = ["rank-1", "rank-2", "rank-3", "rank-other", "rank-other"];
    const rankIcons = ["🥇", "🥈", "🥉", "4", "5"];

    container.innerHTML = bestSellersList.map((item, idx) => {
      const curVal = this.bestSellerSort === "rev" ? item.revenue : (this.bestSellerSort === "profit" ? item.profit : item.quantity);
      const pct = Math.max(5, Math.min(100, Math.round((curVal / (maxVal || 1)) * 100)));

      return `
        <div style="padding: 10px 14px; background: #ffffff; border: 1px solid #f0f3f9; border-radius: 12px; display: flex; flex-direction: column; gap: 6px; box-shadow: 0 2px 6px rgba(22, 27, 46, 0.02);">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
              <span class="rank-badge ${rankBadges[idx]}" style="font-size: 13px; font-weight: 850;">${rankIcons[idx]}</span>
              <div style="min-width: 0;">
                <div style="font-weight: 800; font-size: 13px; color: var(--text-dark); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${item.name}
                </div>
                <div style="font-size: 10.5px; color: var(--text-muted); font-weight: 600; display: flex; align-items: center; gap: 5px; margin-top: 1px;">
                  <span style="color: #2563eb; font-weight: 750;">${item.category}</span>
                  <span style="color: #cbd5e1;">•</span>
                  <span style="color: #059669; font-weight: 750; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 1px 6px; border-radius: 6px;">${item.marginPct}% Margin</span>
                </div>
              </div>
            </div>
            <div style="text-align: right; flex-shrink: 0;">
              <div style="font-weight: 850; color: #ff8a5c; font-size: 13px;">${item.quantity} sold</div>
              <div style="font-size: 11px; color: var(--text-muted); font-weight: 600; margin-top: 1px;">
                ${currencySymbol}${Math.round(item.revenue).toLocaleString("en-IN")} · <strong style="color: #059669;">+${currencySymbol}${Math.round(item.profit).toLocaleString("en-IN")}</strong>
              </div>
            </div>
          </div>
          <div class="dash-pacing-progress-bg" style="height: 5px; background: #f1f5f9; border-radius: 6px; overflow: hidden;">
            <div class="dash-pacing-progress-fill" style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, #ff8a5c, #ff784b); border-radius: 6px; transition: width 0.3s ease;"></div>
          </div>
        </div>
      `;
    }).join("");
  },

  // Raw Material Inventory Health Watch
  renderInventoryWatch() {
    const container = document.getElementById("dash-inventory-watch-list");
    if (!container) return;

    const ingredients = window.db.get("ingredients") || [];
    const lowItems = ingredients.filter(i => {
      const min = Number(i.minStock) || 5;
      return Number(i.stock) <= min;
    }).sort((a, b) => Number(a.stock) - Number(b.stock));

    const badgeEl = document.getElementById("dash-inventory-badge");
    const tabBadgeLow = document.getElementById("tab-badge-low-stock");

    if (badgeEl) {
      if (lowItems.length > 0) {
        badgeEl.className = "dash-tag tag-danger";
        badgeEl.textContent = `${lowItems.length} Low Stock Alert`;
      } else {
        badgeEl.className = "dash-tag tag-cash";
        badgeEl.textContent = "All Healthy 🟢";
      }
    }

    if (tabBadgeLow) {
      if (lowItems.length > 0) {
        tabBadgeLow.style.display = "inline-block";
        tabBadgeLow.textContent = `${lowItems.length} Low`;
      } else {
        tabBadgeLow.style.display = "none";
      }
    }

    if (lowItems.length === 0) {
      container.innerHTML = `
        <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 12px; padding: 14px; text-align: center;">
          <i class="fa-solid fa-circle-check" style="font-size: 20px; color: #16a34a; margin-bottom: 4px; display: block;"></i>
          <div style="font-weight: 800; font-size: 12.5px; color: #166534;">All ${ingredients.length} Raw Materials In Stock</div>
          <div style="font-size: 11px; color: #15803d; margin-top: 2px;">Kitchen has sufficient inventory for all prep orders.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = lowItems.slice(0, 4).map(item => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 9px 12px; background: #ffffff; border: 1px solid #f0f3f9; border-radius: 12px; font-size: 11.5px; box-shadow: 0 2px 6px rgba(22, 27, 46, 0.02);">
        <div style="min-width: 0; flex: 1;">
          <div style="font-weight: 800; color: var(--text-dark); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.name}</div>
          <div style="font-size: 10.5px; color: var(--text-muted); margin-top: 1px;">Reorder Min: ${item.minStock || 5} ${item.unit || 'units'}</div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
          <span style="background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; font-size: 10.5px; font-weight: 800; padding: 2px 7px; border-radius: 6px;">
            ${item.stock} ${item.unit || ''}
          </span>
          <button type="button" onclick="views.dashboard.openQuickRestockModal('${item.id}', '${item.name}')" style="background: #eff6ff; border: 1px solid #bfdbfe; color: #2563eb; border-radius: 8px; padding: 4px 9px; font-size: 11px; font-weight: 800; cursor: pointer;">
            + Restock
          </button>
        </div>
      </div>
    `).join("");
  },

  // Customer Loyalty & Regular Guests
  renderCustomerInsights(custMap, totalCustCount, repeatRate, currencySymbol) {
    const container = document.getElementById("dash-customer-insights-list");
    if (!container) return;

    const allCusts = Object.values(custMap);
    const topCusts = allCusts
      .filter(c => c.name !== "Walk-in" || c.phone)
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 3);

    const badgeEl = document.getElementById("dash-cust-badge");
    if (badgeEl) badgeEl.textContent = `${totalCustCount} Guests`;

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
        <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 12px; padding: 10px; text-align: center;">
          <span style="font-size: 11px; color: var(--text-muted); font-weight: 700;">Repeat Guest Rate</span>
          <div style="font-size: 18px; font-weight: 900; color: #10b981; margin-top: 2px;">${repeatRate}%</div>
        </div>
        <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 12px; padding: 10px; text-align: center;">
          <span style="font-size: 11px; color: var(--text-muted); font-weight: 700;">Total Guests Served</span>
          <div style="font-size: 18px; font-weight: 900; color: #2563eb; margin-top: 2px;">${totalCustCount}</div>
        </div>
      </div>

      <div style="font-size: 11px; font-weight: 800; color: var(--text-muted); margin-bottom: 6px; text-transform: uppercase;">
        <i class="fa-solid fa-star" style="color: #f59e0b;"></i> Top Spenders & Regulars
      </div>
      <div style="display: flex; flex-direction: column; gap: 6px;">
        ${topCusts.length > 0 ? topCusts.map(c => `
          <div style="display: flex; justify-content: space-between; align-items: center; background: #ffffff; border: 1px solid var(--border-color); border-radius: 10px; padding: 7px 10px; font-size: 11.5px;">
            <div>
              <div style="font-weight: 800; color: var(--text-dark);">${c.name}</div>
              <div style="font-size: 10px; color: var(--text-muted);">${c.phone ? `+91 ${c.phone}` : 'Walk-in regular'} • ${c.count} orders</div>
            </div>
            <div style="font-weight: 900; color: #059669;">${currencySymbol}${Math.round(c.spent).toLocaleString("en-IN")}</div>
          </div>
        `).join("") : `<div style="text-align: center; color: var(--text-muted); font-size: 11.5px; padding: 8px;">Add guest numbers in POS to track loyalty!</div>`}
      </div>
    `;
  },

  // Live Register Bills Stream (Searchable)
  onSearchBills(query) {
    this.recentBillsSearchQuery = (query || "").trim().toLowerCase();
    const clearBtn = document.getElementById("dash-search-clear-btn");
    if (clearBtn) clearBtn.style.display = this.recentBillsSearchQuery ? "inline-block" : "none";
    const filteredOrders = this.getFilteredOrders();
    const settings = window.db.get("settings") || {};
    this.renderRecentBills(filteredOrders, settings.currencySymbol || "₹");
  },

  renderRecentBills(orders, currencySymbol) {
    const container = document.getElementById("dash-recent-orders-list");
    if (!container) return;

    if (!orders || orders.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 24px 10px; font-weight: 600; font-size: 12.5px;">
          <i class="fa-solid fa-receipt" style="font-size: 24px; color: #cbd5e1; margin-bottom: 6px; display: block;"></i>
          No bills recorded in this timeframe yet.
        </div>
      `;
      return;
    }

    let sorted = [...orders].sort((a, b) => (b.orderNumber || 0) - (a.orderNumber || 0));

    // Apply live search filter
    if (this.recentBillsSearchQuery) {
      sorted = sorted.filter(o => {
        const orderNo = String(o.orderNumber || "").toLowerCase();
        const custName = String(o.customerName || "").toLowerCase();
        const custPhone = String(o.customerPhone || "").toLowerCase();
        const payMode = String(o.paymentMethod || "").toLowerCase();
        const type = String(o.type || "").toLowerCase();
        return orderNo.includes(this.recentBillsSearchQuery) ||
               custName.includes(this.recentBillsSearchQuery) ||
               custPhone.includes(this.recentBillsSearchQuery) ||
               payMode.includes(this.recentBillsSearchQuery) ||
               type.includes(this.recentBillsSearchQuery);
      });
    }

    const countTag = document.getElementById("dash-recent-count-tag");
    if (countTag) countTag.textContent = `Showing ${Math.min(8, sorted.length)} of ${sorted.length} Bills`;

    const displayOrders = sorted.slice(0, 8);

    if (displayOrders.length === 0) {
      container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 18px; font-size: 12px;">No bills matching "${this.recentBillsSearchQuery}".</div>`;
      return;
    }

    container.innerHTML = displayOrders.map(o => {
      const timeStr = this.formatTime(o.createdAt);
      const isCash = o.paymentMethod === "Cash";
      const payPillClass = isCash ? "tag-cash" : "tag-upi";
      const payIcon = isCash ? "fa-money-bill-wave" : "fa-qrcode";

      let statusColor = "#d97706";
      let statusBg = "#fffbeb";
      let statusBorder = "#fde68a";
      if (o.status === "Completed") { statusColor = "#059669"; statusBg = "#ecfdf5"; statusBorder = "#a7f3d0"; }
      else if (o.status === "Ready") { statusColor = "#10b981"; statusBg = "#ecfdf5"; statusBorder = "#a7f3d0"; }
      else if (o.status === "Preparing") { statusColor = "#4361ee"; statusBg = "#eff6ff"; statusBorder = "#bfdbfe"; }
      else if (o.status === "Cancelled") { statusColor = "#64748b"; statusBg = "#f1f5f9"; statusBorder = "#e2e8f0"; }

      const itemsSummary = Array.isArray(o.items)
        ? o.items.map(i => `${i.quantity}x ${i.name}`).join(", ")
        : "Order items";

      return `
        <div class="dash-bill-row">
          <div style="min-width: 0; flex: 1 1 0%; overflow: hidden;">
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span style="font-weight: 850; font-size: 13px; color: var(--text-dark);">#${o.orderNumber || "Bill"}</span>
              <span style="font-size: 11px; color: var(--text-muted); font-weight: 600;">${timeStr}</span>
              <span class="dash-tag ${payPillClass}" style="padding: 2px 7px; font-size: 10px; border-radius: 6px;">
                <i class="fa-solid ${payIcon}"></i> ${o.paymentMethod || "UPI"}
              </span>
              <span style="font-size: 10px; font-weight: 700; color: #475569; background: #f1f5f9; border: 1px solid #e2e8f0; padding: 2px 7px; border-radius: 6px;">
                ${o.type || "Dine-in"}
              </span>
            </div>
            <div style="font-size: 11.5px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 3px;" title="${itemsSummary.replace(/"/g, '&quot;')}">
              ${itemsSummary}
            </div>
          </div>
          <div style="text-align: right; flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; min-width: 90px;">
            <div style="font-weight: 900; font-size: 13.5px; color: var(--text-dark);">${currencySymbol}${Math.round(o.total || 0)}</div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="display: inline-block; padding: 2px 8px; border-radius: 7px; font-size: 10px; font-weight: 750; color: ${statusColor}; background: ${statusBg}; border: 1px solid ${statusBorder}; white-space: nowrap;">
                ${o.status || "Pending"}
              </span>
              <button type="button" onclick="views.dashboard.openViewBillModal('${o.id}')" title="View Full Bill Slip" style="background: #ffffff; border: 1px solid #dbe4ff; border-radius: 8px; padding: 3px 8px; font-size: 11px; cursor: pointer; color: #ff8a5c; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s ease;">
                <i class="fa-solid fa-receipt"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");
  },

  // Interactive Visual Sales Chart (7-Day Trend / Hourly Sales / Hourly Bills / 30-Day)
  renderSalesChart(orders, todayStr) {
    const textMuted = '#64748b';
    const borderColor = 'rgba(226, 232, 240, 0.7)';

    const trendsCanvas = document.getElementById("salesTrendsChartCanvas");
    if (!trendsCanvas) return;

    const trendsCtx = trendsCanvas.getContext("2d");
    if (this.salesChart) {
      this.salesChart.destroy();
    }

    const titleEl = document.getElementById("dash-chart-title-text");

    if (this.activeChartMode === "hourlyRush" || this.activeChartMode === "hourlyOrders") {
      // HOURLY RUSH PATTERN (12 PM - 3 AM)
      const isRevenue = this.activeChartMode === "hourlyRush";
      if (titleEl) {
        titleEl.textContent = isRevenue ? "Today's Hourly Revenue Rush (₹)" : "Today's Hourly Bill Count";
      }

      const hours = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2];
      const hourLabels = ["12 PM", "1 PM", "2 PM", "3 PM", "4 PM", "5 PM", "6 PM", "7 PM", "8 PM", "9 PM", "10 PM", "11 PM", "12 AM", "1 AM", "2 AM"];
      const hourlySales = new Array(hours.length).fill(0);
      const hourlyOrders = new Array(hours.length).fill(0);

      const todayValid = orders.filter(o => this.getOrderLocalDateStr(o) === todayStr && o.status !== "Cancelled");
      todayValid.forEach(o => {
        const d = new Date(o.createdAt);
        if (isNaN(d.getTime())) return;
        const h = d.getHours();
        const idx = hours.indexOf(h);
        if (idx !== -1) {
          hourlySales[idx] += (Number(o.total) || 0);
          hourlyOrders[idx] += 1;
        }
      });

      const datasetData = isRevenue ? hourlySales.map(v => Math.round(v)) : hourlyOrders;

      this.salesChart = new Chart(trendsCtx, {
        type: "bar",
        data: {
          labels: hourLabels,
          datasets: [{
            label: isRevenue ? "Hourly Sales (₹)" : "Bills Count",
            data: datasetData,
            backgroundColor: isRevenue ? "rgba(37, 99, 235, 0.85)" : "rgba(16, 185, 129, 0.85)",
            hoverBackgroundColor: isRevenue ? "#1d4ed8" : "#059669",
            borderRadius: 6,
            borderSkipped: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              titleFont: { family: "Plus Jakarta Sans, sans-serif", size: 12, weight: "bold" },
              bodyFont: { family: "Plus Jakarta Sans, sans-serif", size: 11 },
              padding: 10,
              cornerRadius: 8,
              callbacks: {
                label: (ctx) => isRevenue ? ` Revenue: ₹${ctx.raw.toLocaleString("en-IN")}` : ` Orders: ${ctx.raw} bills`
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: textMuted, font: { family: "Plus Jakarta Sans, sans-serif", size: 10.5, weight: "600" } }
            },
            y: {
              grid: { color: borderColor },
              ticks: {
                color: textMuted,
                font: { family: "Plus Jakarta Sans, sans-serif", size: 10.5, weight: "600" },
                callback: (val) => isRevenue ? `₹${val}` : `${val}`
              }
            }
          }
        }
      });

    } else if (this.activeChartMode === "monthly") {
      // 30-DAY REVENUE TRAJECTORY
      if (titleEl) titleEl.textContent = "30-Day Revenue Trajectory (₹)";

      const daysLabel = [];
      const salesData = [];
      const today = new Date();

      for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = this.getLocalDateStr(d);
        daysLabel.push(d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }));

        const daySales = orders
          .filter(o => o.createdAt && o.status !== "Cancelled" && this.getOrderLocalDateStr(o) === dateStr)
          .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

        salesData.push(Math.round(daySales));
      }

      const fillGradient = trendsCtx.createLinearGradient(0, 0, 0, 240);
      fillGradient.addColorStop(0, 'rgba(255, 138, 92, 0.22)');
      fillGradient.addColorStop(1, 'rgba(255, 138, 92, 0.01)');

      this.salesChart = new Chart(trendsCtx, {
        type: "line",
        data: {
          labels: daysLabel,
          datasets: [{
            label: "Daily Revenue (₹)",
            data: salesData,
            borderColor: "#ff8a5c",
            backgroundColor: fillGradient,
            borderWidth: 2.5,
            tension: 0.35,
            fill: true,
            pointRadius: 2,
            pointHoverRadius: 5
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              titleFont: { family: "Plus Jakarta Sans, sans-serif", size: 12, weight: "bold" },
              bodyFont: { family: "Plus Jakarta Sans, sans-serif", size: 11 },
              padding: 10,
              cornerRadius: 8,
              callbacks: {
                label: (ctx) => ` Revenue: ₹${ctx.raw.toLocaleString("en-IN")}`
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: textMuted, font: { family: "Plus Jakarta Sans, sans-serif", size: 10, weight: "600" }, maxTicksLimit: 10 }
            },
            y: {
              grid: { color: borderColor },
              ticks: {
                color: textMuted,
                font: { family: "Plus Jakarta Sans, sans-serif", size: 10.5, weight: "600" },
                callback: (val) => `₹${val}`
              }
            }
          }
        }
      });

    } else {
      // 7-DAY REVENUE TRAJECTORY
      if (titleEl) titleEl.textContent = "7-Day Revenue Trajectory (₹)";

      const daysLabel = [];
      const salesData = [];
      const today = new Date();

      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = this.getLocalDateStr(d);
        daysLabel.push(d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" }));

        const daySales = orders
          .filter(o => o.createdAt && o.status !== "Cancelled" && this.getOrderLocalDateStr(o) === dateStr)
          .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

        salesData.push(Math.round(daySales));
      }

      const fillGradient = trendsCtx.createLinearGradient(0, 0, 0, 240);
      fillGradient.addColorStop(0, 'rgba(37, 99, 235, 0.25)');
      fillGradient.addColorStop(1, 'rgba(37, 99, 235, 0.01)');

      this.salesChart = new Chart(trendsCtx, {
        type: "line",
        data: {
          labels: daysLabel,
          datasets: [{
            label: "Daily Revenue (₹)",
            data: salesData,
            borderColor: "#2563eb",
            backgroundColor: fillGradient,
            borderWidth: 3,
            tension: 0.35,
            fill: true,
            pointBackgroundColor: "#2563eb",
            pointBorderColor: "#ffffff",
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              titleFont: { family: "Plus Jakarta Sans, sans-serif", size: 12, weight: "bold" },
              bodyFont: { family: "Plus Jakarta Sans, sans-serif", size: 11 },
              padding: 10,
              cornerRadius: 8,
              callbacks: {
                label: (ctx) => ` Revenue: ₹${ctx.raw.toLocaleString("en-IN")}`
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: textMuted, font: { family: "Plus Jakarta Sans, sans-serif", size: 11, weight: "600" } }
            },
            y: {
              grid: { color: borderColor },
              ticks: {
                color: textMuted,
                font: { family: "Plus Jakarta Sans, sans-serif", size: 11, weight: "600" },
                callback: (val) => `₹${val}`
              }
            }
          }
        }
      });
    }
  },

  // Payment Mode Doughnut
  renderPaymentChart(orders, todayStr) {
    const paymentCanvas = document.getElementById("paymentPieChartCanvas");
    if (!paymentCanvas) return;

    const filtered = this.getFilteredOrders().filter(o => o.status !== "Cancelled");
    let upiSum = 0, cashSum = 0, cardSum = 0;

    filtered.forEach(o => {
      const amt = Number(o.total) || 0;
      if (o.paymentMethod === "Cash") cashSum += amt;
      else if (o.paymentMethod === "Card") cardSum += amt;
      else upiSum += amt;
    });

    const totalPayment = upiSum + cashSum + cardSum;
    const paymentCtx = paymentCanvas.getContext("2d");

    if (this.paymentChart) {
      this.paymentChart.destroy();
    }

    const textMuted = '#64748b';

    this.paymentChart = new Chart(paymentCtx, {
      type: "doughnut",
      data: {
        labels: ["UPI", "Cash", "Card"],
        datasets: [{
          data: totalPayment === 0 ? [1] : [upiSum, cashSum, cardSum],
          backgroundColor: totalPayment === 0 ? ["#e2e8f0"] : ["#2563eb", "#10b981", "#8b5cf6"],
          borderWidth: 2,
          borderColor: "#ffffff",
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: textMuted,
              font: { family: "Plus Jakarta Sans, sans-serif", size: 11, weight: "bold" },
              padding: 10,
              boxWidth: 10
            }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleFont: { family: "Plus Jakarta Sans, sans-serif", size: 12, weight: "bold" },
            bodyFont: { family: "Plus Jakarta Sans, sans-serif", size: 11 },
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (context) => {
                if (totalPayment === 0) return " No transactions yet";
                const val = context.raw;
                const pct = totalPayment > 0 ? Math.round((val / totalPayment) * 100) : 0;
                return ` ${context.label}: ₹${val.toLocaleString("en-IN")} (${pct}%)`;
              }
            }
          }
        },
        cutout: "68%"
      }
    });
  },

  // Category Revenue Share Doughnut
  renderCategoryChart(validOrders) {
    const canvas = document.getElementById("categoryChartCanvas");
    if (!canvas) return;

    const products = window.db.get("products") || [];
    const categories = window.db.get("categories") || [];

    const catTotals = {};
    categories.forEach(c => { catTotals[c.name] = 0; });
    catTotals["Other"] = 0;

    validOrders.forEach(o => {
      if (Array.isArray(o.items)) {
        o.items.forEach(item => {
          const prod = products.find(p => p.name === item.name);
          const cat = prod ? categories.find(c => c.id === prod.category) : null;
          const catName = cat ? cat.name : "Other";
          const lineTotal = (item.price || 0) * (item.quantity || 1);
          catTotals[catName] = (catTotals[catName] || 0) + lineTotal;
        });
      }
    });

    const activeLabels = [];
    const activeValues = [];
    const palette = ["#2563eb", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#64748b"];

    Object.keys(catTotals).forEach(name => {
      if (catTotals[name] > 0) {
        activeLabels.push(name);
        activeValues.push(Math.round(catTotals[name]));
      }
    });

    const totalCatRev = activeValues.reduce((a, b) => a + b, 0);
    const badgeEl = document.getElementById("dash-cat-chart-badge");
    if (badgeEl) badgeEl.textContent = `${activeLabels.length} Categories`;

    const ctx = canvas.getContext("2d");
    if (this.categoryChart) {
      this.categoryChart.destroy();
    }

    const textMuted = '#64748b';

    this.categoryChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: activeLabels.length === 0 ? ["No Sales"] : activeLabels,
        datasets: [{
          data: activeLabels.length === 0 ? [1] : activeValues,
          backgroundColor: activeLabels.length === 0 ? ["#e2e8f0"] : palette.slice(0, activeLabels.length),
          borderWidth: 2,
          borderColor: "#ffffff",
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: textMuted,
              font: { family: "Plus Jakarta Sans, sans-serif", size: 11, weight: "bold" },
              padding: 10,
              boxWidth: 10
            }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleFont: { family: "Plus Jakarta Sans, sans-serif", size: 12, weight: "bold" },
            bodyFont: { family: "Plus Jakarta Sans, sans-serif", size: 11 },
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (context) => {
                if (totalCatRev === 0) return " No category sales";
                const val = context.raw;
                const pct = totalCatRev > 0 ? Math.round((val / totalCatRev) * 100) : 0;
                return ` ${context.label}: ₹${val.toLocaleString("en-IN")} (${pct}%)`;
              }
            }
          }
        },
        cutout: "68%"
      }
    });
  },

  // Modal 1: Quick Shop Overhead Expense Logger
  openQuickExpenseModal() {
    const todayStr = this.getLocalDateStr();
    const bodyHtml = `
      <form id="dash-quick-expense-form" style="display: flex; flex-direction: column; gap: 12px; font-size: 13px;">
        <div>
          <label style="font-weight: 700; color: var(--text-dark); display: block; margin-bottom: 4px;">Expense Description / Item *</label>
          <input type="text" id="quick-exp-desc" placeholder="e.g. Burger Buns, Dairy / Milk, Gas Cylinder, Staff Tea" required style="width: 100%; border: 1.5px solid var(--border-color); border-radius: 10px; padding: 8px 12px; font-size: 13px; outline: none; box-sizing: border-box;">
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div>
            <label style="font-weight: 700; color: var(--text-dark); display: block; margin-bottom: 4px;">Amount (₹) *</label>
            <input type="number" id="quick-exp-amt" min="1" step="any" placeholder="₹0" required style="width: 100%; border: 1.5px solid var(--border-color); border-radius: 10px; padding: 8px 12px; font-size: 13px; outline: none; box-sizing: border-box; font-weight: 800; color: #2563eb;">
          </div>
          <div>
            <label style="font-weight: 700; color: var(--text-dark); display: block; margin-bottom: 4px;">Category</label>
            <select id="quick-exp-cat" style="width: 100%; border: 1.5px solid var(--border-color); border-radius: 10px; padding: 8px 10px; font-size: 12.5px; outline: none; box-sizing: border-box; background: #fff;">
              <option value="Raw material">Raw material</option>
              <option value="Milk / Dairy">Milk / Dairy</option>
              <option value="Vegetables">Vegetables</option>
              <option value="Gas / Fuel">Gas / Fuel</option>
              <option value="Tea / Refreshment">Tea / Refreshment</option>
              <option value="Electricity">Electricity</option>
              <option value="Salary">Salary</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Other expenses">Other expenses</option>
            </select>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div>
            <label style="font-weight: 700; color: var(--text-dark); display: block; margin-bottom: 4px;">Paid From</label>
            <select id="quick-exp-mode" style="width: 100%; border: 1.5px solid var(--border-color); border-radius: 10px; padding: 8px 10px; font-size: 12.5px; outline: none; box-sizing: border-box; background: #fff;">
              <option value="Cash">Cash (Deducts from Drawer)</option>
              <option value="UPI">UPI / Bank Account</option>
            </select>
          </div>
          <div>
            <label style="font-weight: 700; color: var(--text-dark); display: block; margin-bottom: 4px;">Date</label>
            <input type="date" id="quick-exp-date" value="${todayStr}" style="width: 100%; border: 1.5px solid var(--border-color); border-radius: 10px; padding: 8px 10px; font-size: 12.5px; outline: none; box-sizing: border-box;">
          </div>
        </div>
      </form>
    `;

    window.customModal.show({
      title: "Log Shop Overhead Expense",
      bodyHtml: bodyHtml,
      confirmText: "Save Expense",
      cancelText: "Cancel",
      onConfirm: () => {
        const desc = (document.getElementById("quick-exp-desc") ? document.getElementById("quick-exp-desc").value.trim() : "");
        const amt = Number(document.getElementById("quick-exp-amt") ? document.getElementById("quick-exp-amt").value : 0);
        const cat = document.getElementById("quick-exp-cat") ? document.getElementById("quick-exp-cat").value : "Other expenses";
        const mode = document.getElementById("quick-exp-mode") ? document.getElementById("quick-exp-mode").value : "Cash";
        const date = (document.getElementById("quick-exp-date") ? document.getElementById("quick-exp-date").value : "") || todayStr;

        if (!desc) {
          window.showToast("Please enter an expense description.", "error");
          return false;
        }
        if (!amt || amt <= 0) {
          window.showToast("Please enter a valid expense amount.", "error");
          return false;
        }

        const expenses = window.db.get("expenses") || [];
        expenses.unshift({
          id: "EXP-" + Date.now(),
          description: desc,
          amount: amt,
          category: cat,
          paymentMethod: mode,
          date: date,
          createdAt: new Date().toISOString()
        });
        window.db.set("expenses", expenses);
        window.showToast(`Logged ₹${amt} expense: ${desc}`, "success");
        this.calculateAndRenderMetrics();
      }
    });
  },

  // Modal 2: Cash Drawer Audit Modal
  openCashDrawerAuditModal() {
    const orders = window.db.get("orders") || [];
    const expenses = window.db.get("expenses") || [];
    const todayStr = this.getLocalDateStr();

    const cashSales = orders
      .filter(o => this.getOrderLocalDateStr(o) === todayStr && o.status !== "Cancelled" && o.paymentMethod === "Cash")
      .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    const cashExpenses = expenses
      .filter(e => this.getOrderLocalDateStr(e) === todayStr && e.paymentMethod === "Cash")
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const expectedCash = Math.max(0, cashSales - cashExpenses);

    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 14px; font-size: 13px;">
        <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 12px; padding: 12px 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 11px; font-weight: 800; color: #166534; text-transform: uppercase;">Expected In Drawer:</span>
            <span style="font-size: 18px; font-weight: 900; color: #15803d;">₹${Math.round(expectedCash).toLocaleString("en-IN")}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; color: #166534; margin-top: 4px;">
            <span>(+) Cash Sales: ₹${Math.round(cashSales)}</span>
            <span>(-) Cash Expenses: ₹${Math.round(cashExpenses)}</span>
          </div>
        </div>

        <div>
          <label style="font-weight: 800; color: var(--text-dark); display: block; margin-bottom: 6px;">
            Enter Physical Counted Cash (₹):
          </label>
          <input type="number" id="drawer-counted-input" placeholder="Enter counted amount in cash register" min="0" step="any" style="width: 100%; border: 2px solid #2563eb; border-radius: 12px; padding: 10px 14px; font-size: 16px; font-weight: 900; outline: none; box-sizing: border-box; color: #2563eb;">
        </div>

        <div id="drawer-audit-variance-box" style="display: none; border-radius: 12px; padding: 12px 14px;">
          <!-- Injected on input -->
        </div>

        <div>
          <label style="font-weight: 700; color: var(--text-dark); display: block; margin-bottom: 4px;">Audit Note / Manager Signature:</label>
          <input type="text" id="drawer-audit-note" placeholder="e.g. Shift closing tally checked by Sanket" style="width: 100%; border: 1px solid var(--border-color); border-radius: 10px; padding: 8px 12px; font-size: 12.5px; outline: none; box-sizing: border-box;">
        </div>
      </div>
    `;

    window.customModal.show({
      title: "Cash Drawer Physical Audit & Tally",
      bodyHtml: bodyHtml,
      confirmText: "Verify & Save Audit",
      cancelText: "Close",
      onConfirm: () => {
        const countedVal = Number(document.getElementById("drawer-counted-input") ? document.getElementById("drawer-counted-input").value : null);
        if (isNaN(countedVal) || countedVal === null || document.getElementById("drawer-counted-input").value === "") {
          window.showToast("Please enter counted cash amount.", "error");
          return false;
        }

        const variance = countedVal - expectedCash;
        const note = (document.getElementById("drawer-audit-note") ? document.getElementById("drawer-audit-note").value.trim() : "") || "Verified";

        const auditRecord = {
          date: todayStr,
          timestamp: new Date().toISOString(),
          expected: expectedCash,
          counted: countedVal,
          variance: variance,
          note: note
        };

        const audits = window.db.get("drawer_audits") || [];
        audits.unshift(auditRecord);
        window.db.set("drawer_audits", audits);

        if (variance === 0) {
          window.showToast("Cash Drawer perfectly balanced! ₹0 difference.", "success");
        } else if (variance > 0) {
          window.showToast(`Drawer audited: Over by +₹${Math.round(variance)}`, "info");
        } else {
          window.showToast(`Drawer audited: Short by -₹${Math.round(Math.abs(variance))}`, "error");
        }
        this.calculateAndRenderMetrics();
      }
    });

    // Real-time variance listener
    setTimeout(() => {
      const inputEl = document.getElementById("drawer-counted-input");
      const varBox = document.getElementById("drawer-audit-variance-box");
      if (inputEl && varBox) {
        inputEl.addEventListener("input", () => {
          const val = Number(inputEl.value);
          if (isNaN(val) || inputEl.value === "") {
            varBox.style.display = "none";
            return;
          }
          varBox.style.display = "block";
          const diff = val - expectedCash;
          if (diff === 0) {
            varBox.style.background = "#f0fdf4";
            varBox.style.border = "1.5px solid #86efac";
            varBox.innerHTML = `
              <div style="display: flex; justify-content: space-between; align-items: center; font-weight: 800; color: #166534;">
                <span><i class="fa-solid fa-circle-check"></i> Drawer Balanced:</span>
                <span>₹0 Discrepancy</span>
              </div>
            `;
          } else if (diff > 0) {
            varBox.style.background = "#eff6ff";
            varBox.style.border = "1.5px solid #93c5fd";
            varBox.innerHTML = `
              <div style="display: flex; justify-content: space-between; align-items: center; font-weight: 800; color: #1e40af;">
                <span><i class="fa-solid fa-arrow-up"></i> Cash Excess / Over:</span>
                <span>+₹${Math.round(diff).toLocaleString("en-IN")}</span>
              </div>
            `;
          } else {
            varBox.style.background = "#fef2f2";
            varBox.style.border = "1.5px solid #fca5a5";
            varBox.innerHTML = `
              <div style="display: flex; justify-content: space-between; align-items: center; font-weight: 800; color: #991b1b;">
                <span><i class="fa-solid fa-triangle-exclamation"></i> Cash Shortage:</span>
                <span>-₹${Math.round(Math.abs(diff)).toLocaleString("en-IN")}</span>
              </div>
            `;
          }
        });
      }
    }, 100);
  },

  // Modal 3: Day-End Register Closing Z-Report
  openDayEndReportModal() {
    const orders = window.db.get("orders") || [];
    const expenses = window.db.get("expenses") || [];
    const settings = window.db.get("settings") || {};
    const currencySymbol = settings.currencySymbol || "₹";

    const todayStr = this.getLocalDateStr();
    const todayOrders = orders.filter(o => this.getOrderLocalDateStr(o) === todayStr);
    const todayValid = todayOrders.filter(o => o.status !== "Cancelled");

    let gross = 0, cash = 0, upi = 0, card = 0, flatDisc = 0;
    let dineCount = 0, takeCount = 0, delCount = 0;

    todayValid.forEach(o => {
      const amt = Number(o.total) || 0;
      gross += amt;
      if (o.paymentMethod === "Cash") cash += amt;
      else if (o.paymentMethod === "Card") card += amt;
      else upi += amt;

      flatDisc += (Number(o.discount) || 0);

      const type = (o.type || "Dine-in").toLowerCase();
      if (type.includes("takeaway") || type.includes("parcel")) takeCount++;
      else if (type.includes("delivery")) delCount++;
      else dineCount++;
    });

    const cashExpenses = expenses
      .filter(e => this.getOrderLocalDateStr(e) === todayStr && e.paymentMethod === "Cash")
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const expectedClosingCash = Math.max(0, cash - cashExpenses);
    const nowStr = new Date().toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const user = window.db.getCurrentUser();
    const cashierName = user ? user.name : "Sanket Barot";

    const bodyHtml = `
      <div id="z-report-printable-area" style="font-family: 'Courier New', monospace; font-size: 13px; color: #000; background: #fff; padding: 16px; border: 1px dashed #cbd5e1; border-radius: 12px; line-height: 1.4; max-width: 360px; margin: 0 auto;">
        <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px;">
          <h2 style="margin: 0; font-size: 17px; font-weight: 900; letter-spacing: 0.5px;">CRUST & CHILLY</h2>
          <div style="font-size: 11px; font-weight: 800; margin-top: 2px;">*** DAILY CLOSING Z-REPORT ***</div>
          <div style="font-size: 11px; margin-top: 3px;">Date: ${todayStr} | Time: ${nowStr}</div>
          <div style="font-size: 11px;">Register: Main POS Terminal • Cashier: ${cashierName}</div>
        </div>

        <div style="border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between;"><span>Total Bills Generated:</span><strong>${todayOrders.length}</strong></div>
          <div style="display: flex; justify-content: space-between;"><span>Completed Orders:</span><strong>${todayValid.length}</strong></div>
          <div style="display: flex; justify-content: space-between;"><span>Cancelled Orders:</span><strong>${todayOrders.length - todayValid.length}</strong></div>
          <div style="display: flex; justify-content: space-between;"><span>Dine-in / Tables:</span><strong>${dineCount}</strong></div>
          <div style="display: flex; justify-content: space-between;"><span>Takeaway / Parcel:</span><strong>${takeCount}</strong></div>
          <div style="display: flex; justify-content: space-between;"><span>Direct Delivery:</span><strong>${delCount}</strong></div>
        </div>

        <div style="border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px;">
          <div style="font-weight: 900; margin-bottom: 4px;">COLLECTIONS & REVENUE</div>
          <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 900;">
            <span>GROSS SALES:</span>
            <span>${currencySymbol}${Math.round(gross).toLocaleString("en-IN")}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 4px;"><span>Cash Collection:</span><span>${currencySymbol}${Math.round(cash).toLocaleString("en-IN")}</span></div>
          <div style="display: flex; justify-content: space-between;"><span>UPI / Online:</span><span>${currencySymbol}${Math.round(upi).toLocaleString("en-IN")}</span></div>
          ${card > 0 ? `<div style="display: flex; justify-content: space-between;"><span>Card:</span><span>${currencySymbol}${Math.round(card).toLocaleString("en-IN")}</span></div>` : ''}
          <div style="display: flex; justify-content: space-between; color: #475569;"><span>Discounts Given:</span><span>-${currencySymbol}${Math.round(flatDisc).toLocaleString("en-IN")}</span></div>
        </div>

        <div style="border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px;">
          <div style="font-weight: 900; margin-bottom: 4px;">DRAWER CASH RECONCILIATION</div>
          <div style="display: flex; justify-content: space-between;"><span>(+) Cash Sales:</span><span>${currencySymbol}${Math.round(cash).toLocaleString("en-IN")}</span></div>
          <div style="display: flex; justify-content: space-between; color: #dc2626;"><span>(-) Cash Expenses Paid:</span><span>-${currencySymbol}${Math.round(cashExpenses).toLocaleString("en-IN")}</span></div>
          <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 900; color: #15803d; margin-top: 6px; padding-top: 4px; border-top: 1px dashed #000;">
            <span>EXPECTED DRAWER CASH:</span>
            <span>${currencySymbol}${Math.round(expectedClosingCash).toLocaleString("en-IN")}</span>
          </div>
        </div>

        <div style="text-align: center; font-size: 10px; margin-top: 8px; color: #475569;">
          <div>Day-End Reconciliation Verified & Closed</div>
          <div style="margin-top: 16px; display: flex; justify-content: space-between; font-size: 10px;">
            <span>Cashier: ________________</span>
            <span>Manager: ________________</span>
          </div>
        </div>
      </div>
    `;

    window.customModal.show({
      title: "Daily Register Closing Z-Report",
      bodyHtml: bodyHtml,
      confirmText: "Print Slip",
      cancelText: "Close",
      onConfirm: () => {
        document.body.classList.add("printing-z-report");
        window.print();
        setTimeout(() => {
          document.body.classList.remove("printing-z-report");
        }, 1000);
      }
    });
  },

  // Modal 4: Custom Date Range Picker
  openCustomDateRangeModal() {
    const todayStr = this.getLocalDateStr();
    const defaultStart = this.customStartDate || todayStr;
    const defaultEnd = this.customEndDate || todayStr;

    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 14px; font-size: 13px;">
        <p style="margin: 0; color: var(--text-muted);">Select custom start and end date to analyze business performance:</p>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div>
            <label style="font-weight: 700; color: var(--text-dark); display: block; margin-bottom: 4px;">Start Date</label>
            <input type="date" id="dash-custom-start" value="${defaultStart}" style="width: 100%; border: 1.5px solid var(--border-color); border-radius: 10px; padding: 8px 10px; font-size: 13px; outline: none; box-sizing: border-box;">
          </div>
          <div>
            <label style="font-weight: 700; color: var(--text-dark); display: block; margin-bottom: 4px;">End Date</label>
            <input type="date" id="dash-custom-end" value="${defaultEnd}" style="width: 100%; border: 1.5px solid var(--border-color); border-radius: 10px; padding: 8px 10px; font-size: 13px; outline: none; box-sizing: border-box;">
          </div>
        </div>
      </div>
    `;

    window.customModal.show({
      title: "Select Custom Analytics Period",
      bodyHtml: bodyHtml,
      confirmText: "Apply Range",
      cancelText: "Cancel",
      onConfirm: () => {
        const startVal = document.getElementById("dash-custom-start") ? document.getElementById("dash-custom-start").value : null;
        const endVal = document.getElementById("dash-custom-end") ? document.getElementById("dash-custom-end").value : null;

        if (!startVal || !endVal) {
          window.showToast("Please choose both start and end date.", "error");
          return false;
        }

        if (startVal > endVal) {
          window.showToast("Start date cannot be after end date.", "error");
          return false;
        }

        this.customStartDate = startVal;
        this.customEndDate = endVal;
        this.setTimeframe("custom");
        window.showToast(`Showing data from ${startVal} to ${endVal}`, "success");
      }
    });
  },

  // Modal 5: Quick Restock Ingredient Prompt
  openQuickRestockModal(ingredientId, ingredientName) {
    const qty = prompt(`Enter restock units to ADD for "${ingredientName}":`, "10");
    if (qty !== null && !isNaN(Number(qty)) && Number(qty) > 0) {
      const ingredients = window.db.get("ingredients") || [];
      const item = ingredients.find(i => i.id === ingredientId || i.name === ingredientName);
      if (item) {
        item.stock = (Number(item.stock) || 0) + Number(qty);
        window.db.set("ingredients", ingredients);
        window.showToast(`Added ${qty} ${item.unit || 'units'} to ${ingredientName}. New stock: ${item.stock}`, "success");
        this.calculateAndRenderMetrics();
      }
    }
  },

  // Modal 6: View Full Bill Receipt
  openViewBillModal(orderId) {
    const orders = window.db.get("orders") || [];
    const order = orders.find(o => o.id === orderId);
    if (!order) {
      window.showToast("Order not found.", "error");
      return;
    }

    const settings = window.db.get("settings") || {};
    const currencySymbol = settings.currencySymbol || "₹";
    const dateFormatted = new Date(order.createdAt).toLocaleString("en-IN");

    const itemsHtml = Array.isArray(order.items) ? order.items.map(i => `
      <tr>
        <td style="padding: 4px 0;">${i.quantity}x ${i.name}</td>
        <td style="text-align: right; padding: 4px 0;">${currencySymbol}${((i.price || 0) * (i.quantity || 1))}</td>
      </tr>
    `).join("") : "";

    const bodyHtml = `
      <div style="font-family: 'Courier New', monospace; font-size: 13px; color: #000; background: #fff; padding: 14px; border: 1px dashed #cbd5e1; border-radius: 12px; line-height: 1.4; max-width: 320px; margin: 0 auto;">
        <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 900;">CRUST & CHILLY</h3>
          <div style="font-size: 11px;">Bill #${order.orderNumber || "N/A"}</div>
          <div style="font-size: 10px; color: #555;">${dateFormatted}</div>
          <div style="font-size: 11px; margin-top: 3px;">Type: <strong>${order.type || "Dine-in"}</strong> • Mode: <strong>${order.paymentMethod || "UPI"}</strong></div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 12px; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
          ${itemsHtml}
        </table>

        <div style="display: flex; flex-direction: column; gap: 3px; font-size: 12px; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
          <div style="display: flex; justify-content: space-between;"><span>Subtotal:</span><span>${currencySymbol}${Math.round(order.subtotal || order.total || 0)}</span></div>
          ${order.discount ? `<div style="display: flex; justify-content: space-between; color: #166534;"><span>Discount:</span><span>-${currencySymbol}${Math.round(order.discount)}</span></div>` : ''}
          <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 900; margin-top: 4px;">
            <span>TOTAL AMOUNT:</span>
            <span>${currencySymbol}${Math.round(order.total || 0)}</span>
          </div>
        </div>

        <div style="text-align: center; font-size: 10px; color: #555; margin-top: 6px;">
          Thank you for visiting Crust & Chilly!
        </div>
      </div>
    `;

    window.customModal.show({
      title: `Bill #${order.orderNumber || "Details"}`,
      bodyHtml: bodyHtml,
      confirmText: "Close",
      cancelText: "Print",
      onCancel: () => {
        window.print();
      }
    });
  },

  // Export Executive CSV
  exportExecutiveCSV() {
    const orders = this.getFilteredOrders();
    if (orders.length === 0) {
      window.showToast("No orders available to export for this timeframe.", "error");
      return;
    }

    let csv = "Order No,Date & Time,Type,Table,Customer,Phone,Payment Mode,Status,Items Count,Gross Total,Discounts,Net Total\n";

    orders.forEach(o => {
      const itemsCount = Array.isArray(o.items) ? o.items.reduce((sum, i) => sum + (i.quantity || 1), 0) : 0;
      const totalDisc = Number(o.discount) || 0;
      const row = [
        `"${o.orderNumber || ''}"`,
        `"${o.createdAt || ''}"`,
        `"${o.type || 'Dine-in'}"`,
        `"${o.tableNo || '-'}"`,
        `"${(o.customerName || 'Walk-in').replace(/"/g, '""')}"`,
        `"${o.customerPhone || ''}"`,
        `"${o.paymentMethod || 'UPI'}"`,
        `"${o.status || 'Completed'}"`,
        itemsCount,
        Math.round((o.total || 0) + totalDisc),
        Math.round(totalDisc),
        Math.round(o.total || 0)
      ];
      csv += row.join(",") + "\n";
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Crust_Chilly_Executive_Report_${this.selectedTimeframe}_${this.getLocalDateStr()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.showToast("Executive CSV export downloaded!", "success");
  },

  // Print Executive Summary Briefing
  printExecutiveSummary() {
    const orders = this.getFilteredOrders();
    const validOrders = orders.filter(o => o.status !== "Cancelled");
    const gross = validOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const cash = validOrders.filter(o => o.paymentMethod === "Cash").reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const upi = validOrders.filter(o => o.paymentMethod === "UPI").reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const card = validOrders.filter(o => o.paymentMethod === "Card").reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      window.print();
      return;
    }

    const todayStr = this.getLocalDateStr();
    printWindow.document.write(`
      <html>
        <head>
          <title>Executive Briefing - Crust & Chilly</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 30px; color: #1e293b; }
            h1 { font-size: 20px; font-weight: 800; margin-bottom: 4px; }
            .header { border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px; }
            .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 24px; }
            .kpi-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; }
            .kpi-label { font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b; }
            .kpi-val { font-size: 22px; font-weight: 900; color: #0f172a; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
            th { background: #f1f5f9; font-weight: 800; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>CRUST & CHILLY - EXECUTIVE BUSINESS BRIEFING</h1>
            <div>Date: ${todayStr} • Timeframe: ${this.selectedTimeframe.toUpperCase()}</div>
          </div>
          <div class="kpi-grid">
            <div class="kpi-box">
              <div class="kpi-label">Gross Revenue</div>
              <div class="kpi-val">₹${Math.round(gross).toLocaleString("en-IN")}</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-label">Total Bills</div>
              <div class="kpi-val">${validOrders.length}</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-label">Average Order Value</div>
              <div class="kpi-val">₹${validOrders.length > 0 ? Math.round(gross / validOrders.length) : 0}</div>
            </div>
          </div>
          <h3>Collections Summary</h3>
          <table>
            <tr><th>Payment Channel</th><th>Amount (₹)</th><th>Share (%)</th></tr>
            <tr><td>UPI / Online</td><td>₹${Math.round(upi).toLocaleString("en-IN")}</td><td>${gross > 0 ? Math.round((upi / gross) * 100) : 0}%</td></tr>
            <tr><td>Cash Drawer</td><td>₹${Math.round(cash).toLocaleString("en-IN")}</td><td>${gross > 0 ? Math.round((cash / gross) * 100) : 0}%</td></tr>
            <tr><td>Card</td><td>₹${Math.round(card).toLocaleString("en-IN")}</td><td>${gross > 0 ? Math.round((card / gross) * 100) : 0}%</td></tr>
          </table>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }
};
