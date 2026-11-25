// Crust & Chilly POS - Advanced Executive Sales & Profit Analytics Suite 2.0
// Features: Executive Financial Scorecard with Period-over-Period Growth Deltas,
// Store Health & Breakeven Analytics Gauge, Real-Time P&L Waterfall Ledger,
// Calibrated COGS Benchmark Slider, Multi-Stream Trajectory Line Charts (Revenue, Cost, Profit, Cumulative),
// 3-Mode Distribution Share Doughnut (Categories, Expenses, Payment Methods),
// Interactive Menu Engineering & Margin Matrix with 1-Tap Category Pills & Role Filters,
// Zero-Velocity Watchlist, Hourly Rush Curve (2 PM – 12 AM), Day of Week Profitability Matrix,
// Operational Insights (Fulfillment Channels, Cashless Adoption, Discounts Impact),
// Customer Loyalty Tracking, What-If Profit Simulation & Target Breakeven Calculator,
// Printable Official P&L Statement, and Full CSV Export.

window.views = window.views || {};
window.views.reports = {
  activeTab: "financial", // 'financial' | 'menu' | 'insights' | 'simulator'
  startDate: null,
  endDate: null,
  cogsPercent: 32, // Default 32% Food Cost / COGS benchmark
  activeChartMode: "both", // 'both' | 'revenue' | 'profit' | 'cumulative'
  activeDonutMode: "categories", // 'categories' | 'expenses' | 'payments'
  
  // Menu Engineering filters
  menuCategoryFilter: "all",
  menuRoleFilter: "all", // 'all' | 'star' | 'horse' | 'puzzle' | 'slow'
  itemSearchQuery: "",
  itemSortKey: "profit", // 'profit' | 'gross' | 'qty' | 'margin'
  
  // What-If Simulator state
  simSalesDelta: 0, // % change (-30 to +50)
  simCogsRate: 32, // % food cost (20 to 45)
  simExpenseDelta: 0, // % overhead change (-20 to +30)
  
  // Chart instances
  mainTrendChart: null,
  donutBreakdownChart: null,
  hourlyRushChart: null,

  getLocalDateStr(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  init(container) {
    const today = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);

    this.startDate = this.getLocalDateStr(lastWeek);
    this.endDate = this.getLocalDateStr(today);
    this.simCogsRate = this.cogsPercent;

    container.innerHTML = `
      <div class="view-animate" style="display: flex; flex-direction: column; gap: 14px; max-width: 100%; width: 100%; overflow-x: hidden;">
        
        <!-- Top Executive Command Bar: Period Selector & Export Actions -->
        <div class="glass-card report-filter-bar" style="padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; border-radius: 14px;">
          
          <div class="report-dates-group" style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
            <span style="font-size: 13.5px; font-weight: 800; color: var(--text-dark); white-space: nowrap; display: flex; align-items: center; gap: 7px;">
              <i class="fa-solid fa-chart-line" style="color: #2563eb; font-size: 15px;"></i> Analytics Period:
            </span>
            
            <!-- Quick Date Preset Pills -->
            <div class="rep-preset-pills" id="rep-preset-group">
              <button type="button" class="btn-rep-preset" data-range="today">Today</button>
              <button type="button" class="btn-rep-preset" data-range="yesterday">Yesterday</button>
              <button type="button" class="btn-rep-preset active" data-range="last7">Last 7 Days</button>
              <button type="button" class="btn-rep-preset" data-range="last30">Last 30 Days</button>
              <button type="button" class="btn-rep-preset" data-range="thisMonth">This Month</button>
              <button type="button" class="btn-rep-preset" data-range="lastMonth">Last Month</button>
            </div>

            <!-- Date Pickers -->
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-left: 2px;">
              <input type="date" id="report-start-date" class="form-input" style="height: 35px; font-size: 11.5px; padding: 4px 8px; border-radius: 10px; width: 130px;" value="${this.startDate}">
              <span style="font-size: 12px; color: var(--text-muted); font-weight: 600;">to</span>
              <input type="date" id="report-end-date" class="form-input" style="height: 35px; font-size: 11.5px; padding: 4px 8px; border-radius: 10px; width: 130px;" value="${this.endDate}">
            </div>
            <button class="btn btn-primary" id="btn-reports-apply-filter" style="padding: 0 15px; height: 35px; font-size: 12px; border-radius: 10px; font-weight: 800; display: inline-flex; align-items: center; gap: 5px;">
              <i class="fa-solid fa-filter"></i> Apply
            </button>
          </div>

          <!-- Utility Operations Toolbar -->
          <div class="report-actions-group" style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
            <button class="btn btn-secondary" id="btn-report-export-csv" style="padding: 0 13px; height: 35px; font-size: 12px; border-radius: 10px; font-weight: 800; display: inline-flex; align-items: center; gap: 6px;" title="Export Detailed P&L CSV Sheet">
              <i class="fa-solid fa-file-csv" style="color: #2563eb;"></i> Export CSV
            </button>
            <button class="btn btn-secondary" id="btn-report-print-summary" style="padding: 0 13px; height: 35px; font-size: 12px; border-radius: 10px; font-weight: 800; display: inline-flex; align-items: center; gap: 6px;" title="Print Official 80mm / A4 P&L Report">
              <i class="fa-solid fa-print" style="color: #059669;"></i> Print P&L Report
            </button>
          </div>
        </div>

        <!-- 5-Card Executive Financial Scorecard Grid with Growth Comparison -->
        <div class="rep-kpi-grid">
          
          <!-- Card 1: Gross Sales Revenue -->
          <div class="rep-kpi-card" id="rep-card-gross">
            <div class="dash-kpi-icon-wrap rep-ring-coral">
              <i class="fa-solid fa-arrow-trend-up"></i>
            </div>
            <div class="rep-kpi-info">
              <div class="rep-kpi-val" id="rep-gross-sales" style="color: #ff8a5c;">₹0</div>
              <div class="rep-kpi-label">Gross Sales Revenue</div>
              <div class="rep-kpi-badges">
                <span class="dash-sub-pill pill-neutral" id="rep-gross-orders-badge"><i class="fa-solid fa-receipt"></i> 0 Bills</span>
                <span id="rep-growth-gross-badge" class="growth-tag growth-up"><i class="fa-solid fa-arrow-trend-up"></i> +0% vs prev</span>
              </div>
            </div>
          </div>

          <!-- Card 2: Net Realized Revenue -->
          <div class="rep-kpi-card" id="rep-card-net">
            <div class="dash-kpi-icon-wrap rep-ring-cyan">
              <i class="fa-solid fa-wallet"></i>
            </div>
            <div class="rep-kpi-info">
              <div class="rep-kpi-val" id="rep-net-sales" style="color: #0284c7;">₹0</div>
              <div class="rep-kpi-label">Net Sales Realized</div>
              <div class="rep-kpi-badges">
                <span class="dash-sub-pill pill-cash" id="rep-discounts-badge"><i class="fa-solid fa-tag"></i> Discounts: -₹0</span>
                <span id="rep-growth-aov-badge" class="dash-sub-pill pill-neutral">AOV: ₹0</span>
              </div>
            </div>
          </div>

          <!-- Card 3: Food Cost / Recipe COGS Benchmarking -->
          <div class="rep-kpi-card" id="rep-card-cogs">
            <div class="dash-kpi-icon-wrap rep-ring-amber">
              <i class="fa-solid fa-boxes-stacked"></i>
            </div>
            <div class="rep-kpi-info">
              <div class="rep-kpi-val" id="rep-cogs-val" style="color: #b45309;">₹0</div>
              <div class="rep-kpi-label">Food Cost (COGS)</div>
              <div class="rep-kpi-badges">
                <span class="dash-sub-pill pill-neutral" id="rep-gross-margin-badge"><i class="fa-solid fa-percent"></i> 68% Margin</span>
              </div>
            </div>
          </div>

          <!-- Card 4: Operating Expenses -->
          <div class="rep-kpi-card" id="rep-card-expense">
            <div class="dash-kpi-icon-wrap rep-ring-rose">
              <i class="fa-solid fa-receipt"></i>
            </div>
            <div class="rep-kpi-info">
              <div class="rep-kpi-val" id="rep-expense-val" style="color: #e11d48;">₹0</div>
              <div class="rep-kpi-label">Operating Overheads</div>
              <div class="rep-kpi-badges">
                <span class="dash-sub-pill pill-neutral" id="rep-expense-entries-badge"><i class="fa-solid fa-list-check"></i> 0 Expenses</span>
              </div>
            </div>
          </div>

          <!-- Card 5: Net Operating Profit -->
          <div class="rep-kpi-card accent-green" id="rep-profit-card">
            <div class="dash-kpi-icon-wrap rep-ring-green" id="rep-profit-icon">
              <i class="fa-solid fa-sack-dollar"></i>
            </div>
            <div class="rep-kpi-info">
              <div class="rep-kpi-val" id="rep-net-profit-val" style="color: #059669; font-size: 26px;">₹0</div>
              <div class="rep-kpi-label" style="font-weight: 800; color: #059669;">NET OPERATING PROFIT</div>
              <div class="rep-kpi-badges">
                <span class="growth-tag growth-up" id="rep-profit-margin-badge"><i class="fa-solid fa-arrow-trend-up"></i> 0% Net Margin</span>
                <span class="dash-sub-pill pill-cash" id="rep-health-status-badge">Healthy Profit</span>
              </div>
            </div>
          </div>

        </div>

        <!-- Store Health & Breakeven Analytics Ribbon -->
        <div class="glass-card" style="padding: 10px 18px; border-radius: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; background: #ffffff; border: 1px solid #f0f3f9;">
          <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 12px; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-shield-heart" style="color: #059669;"></i> Store Health Score:
              </span>
              <span id="rep-store-health-pill" style="font-size: 11.5px; font-weight: 900; background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 2px 10px; border-radius: 8px;">
                92/100 · Strong
              </span>
            </div>

            <div style="height: 16px; width: 1px; background: #e2e8f0;" class="hide-mobile"></div>

            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 12px; font-weight: 700; color: #64748b;">
                <i class="fa-solid fa-scale-balanced" style="color: #0284c7;"></i> Daily Breakeven Target:
              </span>
              <strong id="rep-breakeven-pill" style="font-size: 12px; color: #0284c7;">₹0 / day (0 orders)</strong>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 11.5px; font-weight: 700; color: #64748b;" id="rep-period-comparison-label">
              Comparing vs previous equivalent period
            </span>
          </div>
        </div>

        <!-- Sub-Tabs Navigation Strip -->
        <div class="glass-card" style="padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; border-radius: 16px; background: #ffffff; border: 1px solid #f0f3f9;">
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <button class="subtab-rep-btn ${this.activeTab === 'financial' ? 'active' : ''}" id="subtab-rep-financial">
              <i class="fa-solid fa-chart-line"></i> Financial P&L & Charts
            </button>
            <button class="subtab-rep-btn ${this.activeTab === 'menu' ? 'active' : ''}" id="subtab-rep-menu">
              <i class="fa-solid fa-burger"></i> Menu Item Margins
            </button>
            <button class="subtab-rep-btn ${this.activeTab === 'insights' ? 'active' : ''}" id="subtab-rep-insights">
              <i class="fa-solid fa-fire"></i> Traffic & Customers
            </button>
            <button class="subtab-rep-btn ${this.activeTab === 'simulator' ? 'active' : ''}" id="subtab-rep-simulator">
              <i class="fa-solid fa-sliders"></i> What-If Profit Simulator
            </button>
          </div>

          <div style="font-size: 11.5px; font-weight: 700; color: #64748b; padding-right: 8px;" id="rep-subtab-indicator">
            <!-- Dynamic context indicator -->
          </div>
        </div>

        <!-- Sub-Tab Content Mount -->
        <div id="rep-subtab-mount"></div>

      </div>
    `;

    this.bindEvents();
    this.processDataAndRender();
  },

  render() {
    this.processDataAndRender();
  },

  bindEvents() {
    const btnApply = document.getElementById("btn-reports-apply-filter");
    const btnExport = document.getElementById("btn-report-export-csv");
    const btnPrint = document.getElementById("btn-report-print-summary");
    const presetButtons = document.querySelectorAll(".btn-rep-preset");

    const tabFinancial = document.getElementById("subtab-rep-financial");
    const tabMenu = document.getElementById("subtab-rep-menu");
    const tabInsights = document.getElementById("subtab-rep-insights");
    const tabSimulator = document.getElementById("subtab-rep-simulator");

    const switchSubTab = (tab) => {
      this.activeTab = tab;
      if (tabFinancial) tabFinancial.className = `subtab-rep-btn ${this.activeTab === "financial" ? "active" : ""}`;
      if (tabMenu) tabMenu.className = `subtab-rep-btn ${this.activeTab === "menu" ? "active" : ""}`;
      if (tabInsights) tabInsights.className = `subtab-rep-btn ${this.activeTab === "insights" ? "active" : ""}`;
      if (tabSimulator) tabSimulator.className = `subtab-rep-btn ${this.activeTab === "simulator" ? "active" : ""}`;
      this.renderSubTab();
    };

    if (tabFinancial) tabFinancial.onclick = () => switchSubTab("financial");
    if (tabMenu) tabMenu.onclick = () => switchSubTab("menu");
    if (tabInsights) tabInsights.onclick = () => switchSubTab("insights");
    if (tabSimulator) tabSimulator.onclick = () => switchSubTab("simulator");

    // Quick Date Preset Buttons
    const highlightPreset = (activeBtn) => {
      presetButtons.forEach(b => b.classList.remove("active"));
      if (activeBtn) activeBtn.classList.add("active");
    };

    presetButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const range = btn.getAttribute("data-range");
        const today = new Date();
        const todayStr = this.getLocalDateStr(today);

        if (range === "today") {
          this.startDate = todayStr;
          this.endDate = todayStr;
        } else if (range === "yesterday") {
          const y = new Date();
          y.setDate(today.getDate() - 1);
          const yStr = this.getLocalDateStr(y);
          this.startDate = yStr;
          this.endDate = yStr;
        } else if (range === "last7") {
          const l7 = new Date();
          l7.setDate(today.getDate() - 6);
          this.startDate = this.getLocalDateStr(l7);
          this.endDate = todayStr;
        } else if (range === "last30") {
          const l30 = new Date();
          l30.setDate(today.getDate() - 29);
          this.startDate = this.getLocalDateStr(l30);
          this.endDate = todayStr;
        } else if (range === "thisMonth") {
          const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
          this.startDate = this.getLocalDateStr(firstDay);
          this.endDate = todayStr;
        } else if (range === "lastMonth") {
          const firstDayPrev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          const lastDayPrev = new Date(today.getFullYear(), today.getMonth(), 0);
          this.startDate = this.getLocalDateStr(firstDayPrev);
          this.endDate = this.getLocalDateStr(lastDayPrev);
        }

        const startInput = document.getElementById("report-start-date");
        const endInput = document.getElementById("report-end-date");
        if (startInput) startInput.value = this.startDate;
        if (endInput) endInput.value = this.endDate;

        highlightPreset(btn);
        this.processDataAndRender();
        window.showToast(`Analytics period set: ${this.startDate} to ${this.endDate}`, "info");
      });
    });

    // Custom Date Range Apply Button
    if (btnApply) {
      btnApply.onclick = () => {
        const s = document.getElementById("report-start-date").value;
        const e = document.getElementById("report-end-date").value;

        if (!s || !e) {
          window.showToast("Please choose valid start and end dates.", "error");
          return;
        }
        if (s > e) {
          window.showToast("Start date cannot be after end date.", "error");
          return;
        }

        this.startDate = s;
        this.endDate = e;
        highlightPreset(null);
        this.processDataAndRender();
        window.showToast("Analytics updated for custom range.", "success");
      };
    }

    // Export CSV & Print P&L Report
    if (btnExport) {
      btnExport.onclick = () => this.exportReportToCSV();
    }

    if (btnPrint) {
      btnPrint.onclick = () => this.showPrintSummaryModal();
    }
  },

  calculatePreviousPeriod(startDateStr, endDateStr) {
    const [sY, sM, sD] = startDateStr.split('-').map(Number);
    const [eY, eM, eD] = endDateStr.split('-').map(Number);
    const sDate = new Date(sY, sM - 1, sD);
    const eDate = new Date(eY, eM - 1, eD);
    
    const diffTime = Math.abs(eDate - sDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const prevEnd = new Date(sDate);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - (diffDays - 1));

    return {
      prevStartStr: this.getLocalDateStr(prevStart),
      prevEndStr: this.getLocalDateStr(prevEnd),
      diffDays
    };
  },

  processDataAndRender() {
    const orders = (window.db && window.db.get("orders")) || [];
    const products = (window.db && window.db.get("products")) || [];
    const categories = (window.db && window.db.get("categories")) || [];
    const expenses = (window.db && window.db.get("expenses")) || [];
    const settings = (window.db && window.db.get("settings")) || {};
    const currency = settings.currencySymbol || "₹";

    const startStr = this.startDate;
    const endStr = this.endDate;

    // 1. Current Period Filter
    const filteredOrders = orders.filter(o => {
      if (!o.createdAt) return false;
      const orderDate = new Date(o.createdAt);
      const d = !isNaN(orderDate.getTime()) ? this.getLocalDateStr(orderDate) : o.createdAt.substring(0, 10);
      return d >= startStr && d <= endStr;
    });

    const validOrders = filteredOrders.filter(o => o.status !== "Cancelled");
    const cancelledOrders = filteredOrders.filter(o => o.status === "Cancelled");

    const periodExpenses = expenses.filter(e => {
      const dStr = e.date || (e.createdAt ? e.createdAt.substring(0, 10) : "");
      return dStr >= startStr && dStr <= endStr;
    });

    // 2. Previous Period Filter (for automated growth comparison)
    const { prevStartStr, prevEndStr, diffDays } = this.calculatePreviousPeriod(startStr, endStr);
    const prevOrders = orders.filter(o => {
      if (!o.createdAt) return false;
      const orderDate = new Date(o.createdAt);
      const d = !isNaN(orderDate.getTime()) ? this.getLocalDateStr(orderDate) : o.createdAt.substring(0, 10);
      return d >= prevStartStr && d <= prevEndStr && o.status !== "Cancelled";
    });

    const prevGrossSales = prevOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const prevAov = prevOrders.length > 0 ? (prevGrossSales / prevOrders.length) : 0;

    // 3. Current Financial Calculations
    let cashTotal = 0;
    let upiTotal = 0;
    let cardTotal = 0;
    let grossBilling = 0;
    let netSalesRealized = 0;
    let totalDiscounts = 0;
    let totalItemsCount = 0;

    validOrders.forEach(o => {
      const netAmt = Number(o.total) || 0;
      const discAmt = Number(o.discount) || 0;
      const subtotalAmt = Number(o.subtotal) || (netAmt + discAmt);

      grossBilling += subtotalAmt;
      netSalesRealized += netAmt;
      totalDiscounts += discAmt;

      const pm = (o.paymentMethod || "UPI").toLowerCase();
      if (pm === "cash") cashTotal += netAmt;
      else if (pm === "card") cardTotal += netAmt;
      else upiTotal += netAmt;

      if (Array.isArray(o.items)) {
        o.items.forEach(it => { totalItemsCount += (Number(it.quantity) || 1); });
      }
    });

    const grossSales = grossBilling;
    const netSales = netSalesRealized;
    const totalOperatingExpenses = periodExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    
    // Dynamic item-level COGS based on exact dish cost prices & recipes from Menu Management
    const financials = (window.db && typeof window.db.calculateOrdersFinancials === "function")
      ? window.db.calculateOrdersFinancials(validOrders)
      : null;

    const estimatedCOGS = financials ? financials.totalCOGS : (netSalesRealized * (this.cogsPercent / 100));
    const grossProfit = Math.max(0, netSalesRealized - estimatedCOGS);
    const grossMarginPct = netSalesRealized > 0 ? Math.round((grossProfit / netSalesRealized) * 100) : (100 - this.cogsPercent);
    const foodCostPct = netSalesRealized > 0 ? Math.round((estimatedCOGS / netSalesRealized) * 100) : this.cogsPercent;
    
    const netProfit = grossProfit - totalOperatingExpenses;
    const netMarginPct = netSalesRealized > 0 ? ((netProfit / netSalesRealized) * 100).toFixed(1) : "0.0";
    const aov = validOrders.length > 0 ? (netSalesRealized / validOrders.length) : 0;
    const itemsPerOrder = validOrders.length > 0 ? (totalItemsCount / validOrders.length).toFixed(1) : "0";

    // Growth deltas vs previous period
    const grossGrowthPct = prevGrossSales > 0 ? (((netSalesRealized - prevGrossSales) / prevGrossSales) * 100).toFixed(1) : null;
    const aovGrowthPct = prevAov > 0 ? (((aov - prevAov) / prevAov) * 100).toFixed(1) : null;

    // Daily breakeven target calculation
    const daysInPeriod = Math.max(1, diffDays);
    const dailyExpenses = totalOperatingExpenses / daysInPeriod;
    const grossMarginRate = (grossMarginPct / 100) || 0.68;
    const dailyBreakevenRevenue = grossMarginRate > 0 ? (dailyExpenses / grossMarginRate) : 0;
    const breakevenOrdersCount = aov > 0 ? Math.ceil(dailyBreakevenRevenue / aov) : 0;

    // Store Health Score (0 to 100)
    let healthScore = 75;
    if (netProfit > (netSalesRealized * 0.25)) healthScore += 15;
    else if (netProfit > 0) healthScore += 8;
    else healthScore -= 20;

    if (netSalesRealized > 0 && (upiTotal + cardTotal) / netSalesRealized >= 0.5) healthScore += 5; // cashless adoption
    if (aov >= 200) healthScore += 5;
    healthScore = Math.max(10, Math.min(99, healthScore));

    // Cache calculations on instance
    this.currentData = {
      validOrders,
      periodExpenses,
      categories,
      products,
      currency,
      grossSales: grossBilling,
      netSales: netSalesRealized,
      totalDiscounts,
      flatDiscounts: totalDiscounts,
      estimatedCOGS,
      grossProfit,
      grossMarginPct,
      foodCostPct,
      totalOperatingExpenses,
      netProfit,
      netMarginPct,
      aov,
      itemsPerOrder,
      cashTotal,
      upiTotal,
      cardTotal,
      grossGrowthPct,
      aovGrowthPct,
      dailyBreakevenRevenue,
      breakevenOrdersCount,
      healthScore,
      prevGrossSales,
      daysInPeriod
    };

    // 4. Update Top 5 Scorecard Elements
    const grossSalesEl = document.getElementById("rep-gross-sales");
    const ordersSubEl = document.getElementById("rep-orders-sub");
    const grossOrdersBadge = document.getElementById("rep-gross-orders-badge");
    const grossGrowthBadge = document.getElementById("rep-growth-gross-badge");

    const netSalesEl = document.getElementById("rep-net-sales");
    const discountsBadge = document.getElementById("rep-discounts-badge");
    const aovBadge = document.getElementById("rep-growth-aov-badge");

    const cogsValEl = document.getElementById("rep-cogs-val");
    const cogsSubEl = document.getElementById("rep-cogs-sub");
    const grossMarginBadge = document.getElementById("rep-gross-margin-badge");

    const expenseValEl = document.getElementById("rep-expense-val");
    const expenseEntriesBadge = document.getElementById("rep-expense-entries-badge");

    const netProfitValEl = document.getElementById("rep-net-profit-val");
    const profitMarginBadge = document.getElementById("rep-profit-margin-badge");
    const healthStatusBadge = document.getElementById("rep-health-status-badge");
    const profitCard = document.getElementById("rep-profit-card");

    const storeHealthPill = document.getElementById("rep-store-health-pill");
    const breakevenPill = document.getElementById("rep-breakeven-pill");
    const compLabel = document.getElementById("rep-period-comparison-label");

    if (grossSalesEl) grossSalesEl.textContent = `${currency}${Math.round(grossBilling).toLocaleString("en-IN")}`;
    if (ordersSubEl) ordersSubEl.textContent = `${validOrders.length} completed transactions`;
    if (grossOrdersBadge) grossOrdersBadge.innerHTML = `<i class="fa-solid fa-receipt"></i> ${validOrders.length} Bills`;
    
    if (grossGrowthBadge) {
      if (grossGrowthPct !== null) {
        const isUp = Number(grossGrowthPct) >= 0;
        grossGrowthBadge.className = `growth-tag ${isUp ? 'growth-up' : 'growth-down'}`;
        grossGrowthBadge.innerHTML = `<i class="fa-solid ${isUp ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}"></i> ${isUp ? '+' : ''}${grossGrowthPct}% vs prev`;
      } else {
        grossGrowthBadge.className = "growth-tag";
        grossGrowthBadge.innerHTML = `<i class="fa-solid fa-clock"></i> New period`;
      }
    }

    if (netSalesEl) netSalesEl.textContent = `${currency}${Math.round(netSalesRealized).toLocaleString("en-IN")}`;
    if (discountsBadge) discountsBadge.innerHTML = `<i class="fa-solid fa-tag"></i> Discounts: -${currency}${Math.round(totalDiscounts).toLocaleString("en-IN")}`;
    if (aovBadge) aovBadge.textContent = `AOV: ${currency}${Math.round(aov)}`;

    if (cogsValEl) cogsValEl.textContent = `${currency}${Math.round(estimatedCOGS).toLocaleString("en-IN")}`;
    if (cogsSubEl) cogsSubEl.textContent = `Exact menu dish cost (${foodCostPct}% COGS)`;
    if (grossMarginBadge) grossMarginBadge.innerHTML = `<i class="fa-solid fa-percent"></i> ${grossMarginPct}% Margin`;

    if (expenseValEl) expenseValEl.textContent = `${currency}${Math.round(totalOperatingExpenses).toLocaleString("en-IN")}`;
    if (expenseEntriesBadge) expenseEntriesBadge.innerHTML = `<i class="fa-solid fa-receipt"></i> ${periodExpenses.length} Expense Entries`;

    if (netProfitValEl) {
      const isProfitable = netProfit >= 0;
      netProfitValEl.textContent = `${isProfitable ? '' : '-'}${currency}${Math.abs(Math.round(netProfit)).toLocaleString("en-IN")}`;
      netProfitValEl.style.color = isProfitable ? "#059669" : "#dc2626";

      if (profitCard) {
        profitCard.className = `rep-kpi-card ${isProfitable ? 'accent-green' : 'accent-rose'}`;
      }

      if (profitMarginBadge) {
        profitMarginBadge.className = `growth-tag ${isProfitable ? 'growth-up' : 'growth-down'}`;
        profitMarginBadge.innerHTML = `<i class="fa-solid ${isProfitable ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}"></i> ${netMarginPct}% Net Margin`;
      }

      if (healthStatusBadge) {
        if (netProfit > (netSalesRealized * 0.25)) {
          healthStatusBadge.className = "dash-sub-pill pill-cash";
          healthStatusBadge.textContent = "High Profitability";
        } else if (netProfit > 0) {
          healthStatusBadge.className = "dash-sub-pill pill-neutral";
          healthStatusBadge.textContent = "Profitable Operation";
        } else {
          healthStatusBadge.className = "dash-sub-pill pill-neutral";
          healthStatusBadge.style.color = "#dc2626";
          healthStatusBadge.textContent = "Operating at Deficit";
        }
      }
    }

    if (storeHealthPill) {
      storeHealthPill.textContent = `${healthScore}/100 · ${healthScore >= 80 ? 'Excellent' : healthScore >= 60 ? 'Moderate' : 'Needs Attention'}`;
      storeHealthPill.style.background = healthScore >= 80 ? "#ecfdf5" : healthScore >= 60 ? "#fffbeb" : "#fef2f2";
      storeHealthPill.style.color = healthScore >= 80 ? "#059669" : healthScore >= 60 ? "#b45309" : "#dc2626";
    }

    if (breakevenPill) {
      breakevenPill.textContent = `${currency}${Math.round(dailyBreakevenRevenue).toLocaleString("en-IN")} / day (approx ${breakevenOrdersCount} orders)`;
    }

    if (compLabel) {
      compLabel.textContent = `Comparing vs previous ${daysInPeriod} days (${prevStartStr} to ${prevEndStr})`;
    }

    // 5. Render Active Sub-Tab
    try {
      this.renderSubTab();
    } catch (subTabErr) {
      console.error("Error in renderSubTab:", subTabErr);
    }
  },

  renderSubTab() {
    const mount = document.getElementById("rep-subtab-mount");
    if (!mount) return;

    try {
      const ind = document.getElementById("rep-subtab-indicator");
      if (ind) {
        if (this.activeTab === "financial") {
          ind.innerHTML = `<i class="fa-solid fa-chart-line" style="color: #2563eb;"></i> P&L & Trajectory Charts`;
        } else if (this.activeTab === "menu") {
          ind.innerHTML = `<i class="fa-solid fa-trophy" style="color: #eab308;"></i> Unit margins & sales role`;
        } else if (this.activeTab === "insights") {
          ind.innerHTML = `<i class="fa-solid fa-fire" style="color: #d97706;"></i> Rush, channels & loyalty`;
        } else if (this.activeTab === "simulator") {
          ind.innerHTML = `<i class="fa-solid fa-sliders" style="color: #7c3aed;"></i> What-if profit & target simulator`;
        }
      }

      if (this.activeTab === "financial") {
        this.renderFinancialTab(mount);
      } else if (this.activeTab === "menu") {
        this.renderMenuTab(mount);
      } else if (this.activeTab === "insights") {
        this.renderInsightsTab(mount);
      } else if (this.activeTab === "simulator") {
        this.renderSimulatorTab(mount);
      }
    } catch (e) {
      console.error("Error rendering reports subtab content:", e);
    }
  },

  // =========================================================================
  // SUB-TAB 1: FINANCIAL P&L & CHARTS
  // =========================================================================
  renderFinancialTab(mount) {
    mount.innerHTML = `
      <div class="view-animate" style="display: flex; flex-direction: column; gap: 14px;">
        
        <!-- Executive Profit & Loss (P&L) Waterfall Ledger Banner -->
        <div class="rep-pnl-waterfall-card">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 14.5px; font-weight: 900; color: var(--text-dark); display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-file-invoice-dollar" style="color: #2563eb;"></i> Executive P&L Financial Waterfall
              </span>
              <span style="font-size: 11px; color: var(--text-muted); font-weight: 600;">(Real-time cashflow realization)</span>
            </div>

            <!-- Real Dish Costing & Margin Realized Status Tag -->
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 11.5px; font-weight: 750; color: #059669; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 4px 11px; border-radius: 12px; display: inline-flex; align-items: center; gap: 5px;">
                <i class="fa-solid fa-calculator"></i> Real Dish Costing & Margin
              </span>
            </div>
          </div>

          <!-- Step-by-Step Waterfall Flow -->
          <div class="rep-pnl-steps-flow" id="rep-waterfall-steps">
            <!-- Injected via JavaScript -->
          </div>
        </div>

        <!-- Charts Grid: Multi-Stream Trend + Dual Doughnut -->
        <div class="rep-charts-row">
          
          <!-- Chart 1: Interactive Multi-Stream Trend Chart -->
          <div class="dash-chart-card" style="min-height: 350px;">
            <div class="chart-header">
              <div>
                <div class="chart-title">
                  <i class="fa-solid fa-chart-line" style="color: #2563eb;"></i> Financial Trend Trajectory
                </div>
                <div style="font-size: 11px; color: var(--text-muted); font-weight: 600; margin-top: 2px;">
                  Daily revenue, cost baseline, and net operating profit
                </div>
              </div>

              <!-- Stream Mode Switcher -->
              <div class="dash-chart-toggle-group" id="rep-trend-mode-toggle">
                <button type="button" class="dash-chart-toggle-btn ${this.activeChartMode === 'both' ? 'active' : ''}" data-mode="both">Revenue & Profit</button>
                <button type="button" class="dash-chart-toggle-btn ${this.activeChartMode === 'revenue' ? 'active' : ''}" data-mode="revenue">Revenue Only</button>
                <button type="button" class="dash-chart-toggle-btn ${this.activeChartMode === 'profit' ? 'active' : ''}" data-mode="profit">Net Profit</button>
                <button type="button" class="dash-chart-toggle-btn ${this.activeChartMode === 'cumulative' ? 'active' : ''}" data-mode="cumulative">Cumulative</button>
              </div>
            </div>
            <div class="dash-chart-wrap" style="height: 260px;">
              <canvas id="repMainTrendCanvas"></canvas>
            </div>
          </div>

          <!-- Chart 2: Distribution Share Doughnut (Categories, Expenses, Payments) -->
          <div class="dash-chart-card" style="min-height: 350px;">
            <div class="chart-header">
              <div>
                <div class="chart-title">
                  <i class="fa-solid fa-chart-pie" style="color: #10b981;"></i> Distribution Share
                </div>
                <div style="font-size: 11px; color: var(--text-muted); font-weight: 600; margin-top: 2px;">
                  Category sales, operating costs, and payment modes
                </div>
              </div>

              <!-- Doughnut Mode Switcher -->
              <div class="dash-chart-toggle-group" id="rep-donut-mode-toggle">
                <button type="button" class="dash-chart-toggle-btn ${this.activeDonutMode === 'categories' ? 'active' : ''}" data-mode="categories">Categories</button>
                <button type="button" class="dash-chart-toggle-btn ${this.activeDonutMode === 'expenses' ? 'active' : ''}" data-mode="expenses">Expenses</button>
                <button type="button" class="dash-chart-toggle-btn ${this.activeDonutMode === 'payments' ? 'active' : ''}" data-mode="payments">Payments</button>
              </div>
            </div>
            <div class="dash-chart-wrap" style="height: 260px;">
              <canvas id="repDonutCanvas"></canvas>
            </div>
          </div>

        </div>

      </div>
    `;

    // Bind Trend Toggle
    mount.querySelectorAll("#rep-trend-mode-toggle button").forEach(btn => {
      btn.onclick = () => {
        mount.querySelectorAll("#rep-trend-mode-toggle button").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.activeChartMode = btn.getAttribute("data-mode");
        this.renderTrendChartOnly();
      };
    });

    // Bind Donut Toggle
    mount.querySelectorAll("#rep-donut-mode-toggle button").forEach(btn => {
      btn.onclick = () => {
        mount.querySelectorAll("#rep-donut-mode-toggle button").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.activeDonutMode = btn.getAttribute("data-mode");
        this.renderDonutChartOnly();
      };
    });

    if (this.currentData) {
      const { grossSales, totalDiscounts, netSales, estimatedCOGS, grossProfit, totalOperatingExpenses, netProfit, currency } = this.currentData;
      this.renderWaterfallSteps(grossSales, totalDiscounts, netSales, estimatedCOGS, grossProfit, totalOperatingExpenses, netProfit, currency);
      this.renderTrendChartOnly();
      this.renderDonutChartOnly();
    }
  },

  // =========================================================================
  // SUB-TAB 2: MENU ITEM MARGINS & ENGINEERING (WITH QUICK PILLS)
  // =========================================================================
  renderMenuTab(mount) {
    const products = (window.db && window.db.get("products")) || [];
    const categories = (window.db && window.db.get("categories")) || [];
    const validOrders = (this.currentData && this.currentData.validOrders) || [];
    const currency = (this.currentData && this.currentData.currency) || "₹";

    mount.innerHTML = `
      <div class="view-animate" style="display: flex; flex-direction: column; gap: 14px;">
        
        <!-- Menu Item Profitability Executive KPI Cards -->
        <div class="rep-kpi-grid" style="margin-bottom: 0px !important;">
          <div class="rep-kpi-card">
            <div class="dash-kpi-icon-wrap rep-ring-cyan">
              <i class="fa-solid fa-utensils"></i>
            </div>
            <div class="rep-kpi-info">
              <div class="rep-kpi-val" id="rep-menu-kpi-units">0</div>
              <div class="rep-kpi-label">Units Sold</div>
              <div class="rep-kpi-badges">
                <span class="dash-sub-pill pill-neutral"><i class="fa-solid fa-receipt"></i> Items Served</span>
              </div>
            </div>
          </div>

          <div class="rep-kpi-card">
            <div class="dash-kpi-icon-wrap rep-ring-coral">
              <i class="fa-solid fa-coins"></i>
            </div>
            <div class="rep-kpi-info">
              <div class="rep-kpi-val" id="rep-menu-kpi-revenue" style="color: #ff8a5c;">₹0</div>
              <div class="rep-kpi-label">Gross Menu Sales</div>
              <div class="rep-kpi-badges">
                <span class="dash-sub-pill pill-cash">Customer Billing</span>
              </div>
            </div>
          </div>

          <div class="rep-kpi-card">
            <div class="dash-kpi-icon-wrap rep-ring-amber">
              <i class="fa-solid fa-boxes-stacked"></i>
            </div>
            <div class="rep-kpi-info">
              <div class="rep-kpi-val" id="rep-menu-kpi-cogs" style="color: #b45309;">₹0</div>
              <div class="rep-kpi-label">Ingredient Cost (COGS)</div>
              <div class="rep-kpi-badges">
                <span class="dash-sub-pill pill-neutral" id="rep-menu-kpi-cogs-pct">0% Cost Ratio</span>
              </div>
            </div>
          </div>

          <div class="rep-kpi-card">
            <div class="dash-kpi-icon-wrap rep-ring-green">
              <i class="fa-solid fa-sack-dollar"></i>
            </div>
            <div class="rep-kpi-info">
              <div class="rep-kpi-val" id="rep-menu-kpi-profit" style="color: #059669;">₹0</div>
              <div class="rep-kpi-label">Profit Made After Selling</div>
              <div class="rep-kpi-badges">
                <span class="growth-tag growth-up" id="rep-menu-kpi-margin-pct">0% Margin</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Menu Item Margin & Profitability Engineering Matrix -->
        <div class="glass-card" style="padding: 18px 20px; display: flex; flex-direction: column; gap: 12px; border-radius: 16px; background: #ffffff; border: 1px solid #f0f3f9;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div>
              <h3 style="font-size: 15px; font-weight: 900; color: #1e293b; margin: 0; display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-trophy" style="color: #f59e0b;"></i> Menu Item Costing, Margins & Profit Realization Matrix
              </h3>
              <div style="font-size: 11px; color: #64748b; font-weight: 600; margin-top: 2px;">
                Calculated from actual recipe costs & dish pricing: selling price, recipe COGS, unit margin, and total profit earned after selling
              </div>
            </div>

            <!-- Search & Sort Controls -->
            <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
              <div style="position: relative; width: 220px;">
                <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 10px; top: 11px; font-size: 11px; color: #94a3b8;"></i>
                <input type="text" id="rep-item-search-input" class="form-input" placeholder="Search dish / category..." value="${this.itemSearchQuery}" style="height: 35px; font-size: 12px; padding-left: 28px; border-radius: 10px; width: 100%;">
              </div>
              <select id="rep-item-sort-select" class="form-input" style="height: 35px; font-size: 11.5px; border-radius: 10px; padding: 2px 8px; font-weight: 700; width: 180px;">
                <option value="profit" ${this.itemSortKey === 'profit' ? 'selected' : ''}>Sort: Highest Profit First</option>
                <option value="margin" ${this.itemSortKey === 'margin' ? 'selected' : ''}>Sort: Highest Margin %</option>
                <option value="gross" ${this.itemSortKey === 'gross' ? 'selected' : ''}>Sort: Highest Revenue</option>
                <option value="qty" ${this.itemSortKey === 'qty' ? 'selected' : ''}>Sort: Most Units Sold</option>
              </select>
            </div>
          </div>

          <!-- 1-Tap Category Filter Pills Strip -->
          <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap; background: #f8fafc; padding: 6px 10px; border-radius: 10px; border: 1px solid #e2e8f0;">
            <span style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">Category:</span>
            <button type="button" class="rep-quick-chip ${this.menuCategoryFilter === 'all' ? 'active' : ''}" data-cat="all">All</button>
            ${categories.map(c => `
              <button type="button" class="rep-quick-chip ${this.menuCategoryFilter === c.id ? 'active' : ''}" data-cat="${c.id}">${c.name}</button>
            `).join("")}

            <div style="height: 18px; width: 1px; background: #e2e8f0; margin: 0 4px;"></div>

            <span style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">Role:</span>
            <button type="button" class="rep-quick-chip ${this.menuRoleFilter === 'all' ? 'active' : ''}" data-role="all">All Roles</button>
            <button type="button" class="rep-quick-chip ${this.menuRoleFilter === 'star' ? 'active' : ''}" data-role="star">🌟 Stars</button>
            <button type="button" class="rep-quick-chip ${this.menuRoleFilter === 'horse' ? 'active' : ''}" data-role="horse">🐎 Volume</button>
            <button type="button" class="rep-quick-chip ${this.menuRoleFilter === 'puzzle' ? 'active' : ''}" data-role="puzzle">💡 High Margin</button>
            <button type="button" class="rep-quick-chip ${this.menuRoleFilter === 'slow' ? 'active' : ''}" data-role="slow">⚠️ Low Velocity</button>
          </div>

          <!-- Item Profitability Table -->
          <div class="table-container" style="max-height: 520px; overflow-y: auto; overflow-x: auto; width: 100%; -webkit-overflow-scrolling: touch; border-radius: 12px; border: 1px solid #f0f3f9;">
            <table class="premium-table" style="font-size: 12px; width: 100%;">
              <thead>
                <tr>
                  <th style="width: 30px;">#</th>
                  <th>Menu Item Description</th>
                  <th>Category</th>
                  <th style="text-align: right;">Selling Price</th>
                  <th style="text-align: right;">Recipe Cost (COGS)</th>
                  <th style="text-align: right;">Unit Margin</th>
                  <th style="text-align: center;">Units Sold</th>
                  <th style="text-align: right;">Total Sales</th>
                  <th style="text-align: right;">Total Food Cost</th>
                  <th style="text-align: right;">Net Profit Made</th>
                  <th style="text-align: center;">Sales Role</th>
                </tr>
              </thead>
              <tbody id="rep-item-profit-tbody">
                <!-- Injected via JS -->
              </tbody>
            </table>
          </div>
        </div>

        <!-- Slow Moving / Zero Velocity Watchlist Card -->
        <div class="glass-card" style="padding: 18px 20px; border-radius: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div>
              <h4 style="margin: 0; font-size: 14px; font-weight: 800; color: var(--text-dark);">
                <i class="fa-solid fa-triangle-exclamation" style="color: #ff7343; margin-right: 6px;"></i> Zero Velocity Menu Watchlist
              </h4>
              <p style="margin: 2px 0 0 0; font-size: 11.5px; color: var(--text-muted);">Active dishes with 0 sales in the selected period to optimize inventory.</p>
            </div>
            <span class="badge" style="background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; font-weight: 800;" id="rep-slow-items-badge">0 Unsold Items</span>
          </div>

          <div class="table-container" style="max-height: 240px; overflow-y: auto;">
            <table class="premium-table" style="font-size: 12.5px;">
              <thead>
                <tr>
                  <th>Dish Name</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th style="text-align: right;">Status</th>
                </tr>
              </thead>
              <tbody id="rep-slow-items-tbody">
                <!-- Injected via JS -->
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;

    const searchInput = mount.querySelector("#rep-item-search-input");
    const sortSelect = mount.querySelector("#rep-item-sort-select");

    if (searchInput) {
      searchInput.oninput = (e) => {
        this.itemSearchQuery = e.target.value.toLowerCase().trim();
        this.renderItemProfitTableOnly();
      };
    }

    if (sortSelect) {
      sortSelect.onchange = (e) => {
        this.itemSortKey = e.target.value;
        this.renderItemProfitTableOnly();
      };
    }

    // Category pills click
    mount.querySelectorAll(".rep-quick-chip[data-cat]").forEach(btn => {
      btn.onclick = () => {
        mount.querySelectorAll(".rep-quick-chip[data-cat]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.menuCategoryFilter = btn.getAttribute("data-cat");
        this.renderItemProfitTableOnly();
      };
    });

    // Role pills click
    mount.querySelectorAll(".rep-quick-chip[data-role]").forEach(btn => {
      btn.onclick = () => {
        mount.querySelectorAll(".rep-quick-chip[data-role]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.menuRoleFilter = btn.getAttribute("data-role");
        this.renderItemProfitTableOnly();
      };
    });

    this.renderItemProfitTableOnly();
    this.renderLowVelocityMenu(products, categories, validOrders, currency);
  },

  // =========================================================================
  // SUB-TAB 3: TRAFFIC, CHANNELS & CUSTOMER INSIGHTS
  // =========================================================================
  renderInsightsTab(mount) {
    const validOrders = (this.currentData && this.currentData.validOrders) || [];
    const currency = (this.currentData && this.currentData.currency) || "₹";
    const grossSales = (this.currentData && this.currentData.grossSales) || 0;
    const cashTotal = (this.currentData && this.currentData.cashTotal) || 0;
    const upiTotal = (this.currentData && this.currentData.upiTotal) || 0;
    const cardTotal = (this.currentData && this.currentData.cardTotal) || 0;

    mount.innerHTML = `
      <div class="view-animate" style="display: flex; flex-direction: column; gap: 14px;">
        
        <!-- Chart 3: Peak Hourly Rush Curve (2 PM – 12 AM) -->
        <div class="dash-chart-card" style="min-height: 330px; border-radius: 14px;">
          <div class="chart-header">
            <div>
              <div class="chart-title">
                <i class="fa-solid fa-stopwatch" style="color: #f59e0b;"></i> Hourly Rush Curve (2 PM – 12 AM)
              </div>
              <div style="font-size: 11px; color: var(--text-muted); font-weight: 600; margin-top: 2px;">
                Sales density and orders volume by operational business hour
              </div>
            </div>
            <span id="rep-peak-hour-chip" class="dash-shift-live-pill shift-closing" style="font-size: 11px; font-weight: 800;">
              Calculating...
            </span>
          </div>
          <div class="dash-chart-wrap" style="height: 250px;">
            <canvas id="repHourlyRushCanvas"></canvas>
          </div>
        </div>

        <!-- Day of Week Performance Matrix (Sun - Sat) -->
        <div class="glass-card" style="padding: 16px 20px; display: flex; flex-direction: column; gap: 12px; border-radius: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div>
              <h3 style="font-size: 14.5px; font-weight: 800; color: var(--text-dark); margin: 0; display: flex; align-items: center; gap: 7px;">
                <i class="fa-solid fa-calendar-week" style="color: #2563eb;"></i> Day of Week Profitability & Sales Matrix
              </h3>
              <div style="font-size: 11px; color: var(--text-muted); font-weight: 600; margin-top: 2px;">
                Sales volume, customer traffic, and average ticket size across days
              </div>
            </div>
            <span id="rep-best-day-badge" class="badge-menu-star" style="font-size: 11px; font-weight: 800;">Weekday vs Weekend</span>
          </div>
          <div id="rep-day-of-week-container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px;">
            <!-- Injected via JS -->
          </div>
        </div>

        <!-- 3 Operational Insights Cards -->
        <div class="rep-insights-grid">
          
          <!-- Insight Card 1: Fulfillment Channels -->
          <div class="rep-insight-box">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <div style="font-weight: 800; font-size: 13.5px; color: var(--text-dark); display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-utensils" style="color: #2563eb;"></i> Fulfillment Channels
              </div>
              <span class="insight-badge" id="rep-orders-channel-badge">${validOrders.length} Bills</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px;" id="rep-order-types-container">
              <!-- Injected dynamically -->
            </div>
          </div>

          <!-- Insight Card 2: Cash & Payment Reconciliation -->
          <div class="rep-insight-box">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <div style="font-weight: 800; font-size: 13.5px; color: var(--text-dark); display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-cash-register" style="color: #059669;"></i> Payment Collection Split
              </div>
              <span class="insight-badge" id="rep-payment-summary-badge" style="background: #ecfdf5; color: #065f46; border-color: #a7f3d0;">Total</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;" id="rep-cash-reconcile-container">
              <!-- Injected dynamically -->
            </div>
          </div>

          <!-- Insight Card 3: Promotional Discounts Impact -->
          <div class="rep-insight-box">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <div style="font-weight: 800; font-size: 13.5px; color: var(--text-dark); display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-tags" style="color: #8b5cf6;"></i> Discounts Impact
              </div>
              <span class="insight-badge" id="rep-discount-rate-badge" style="background: #f5f3ff; color: #5b21b6; border-color: #ddd6fe;">0% Discount</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px;" id="rep-discounts-container">
              <!-- Injected dynamically -->
            </div>
          </div>

        </div>

        <!-- Customer Loyalty Table -->
        <div class="glass-card" style="padding: 18px 20px; border-radius: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div>
              <h4 style="margin: 0; font-size: 14px; font-weight: 800; color: var(--text-dark);">
                <i class="fa-solid fa-users" style="color: #10b981; margin-right: 6px;"></i> Customer Loyalty & Regular Guests
              </h4>
              <p style="margin: 2px 0 0 0; font-size: 11.5px; color: var(--text-muted);" id="rep-loyalty-subtext">Repeat customer visits in selected period.</p>
            </div>
            <span class="badge badge-completed" id="rep-repeat-rate-badge">0% Repeat Rate</span>
          </div>

          <div class="table-container" style="max-height: 250px; overflow-y: auto;">
            <table class="premium-table" style="font-size: 12.5px;">
              <thead>
                <tr>
                  <th>Customer Name</th>
                  <th>Phone / Contact</th>
                  <th>Orders Placed</th>
                  <th style="text-align: right;">Total Spent</th>
                </tr>
              </thead>
              <tbody id="rep-loyalty-tbody">
                <!-- Injected via JS -->
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;

    this.renderHourlyRushChartOnly();
    this.renderDayOfWeekPerformance(validOrders, currency);
    this.renderOrderChannels(validOrders, grossSales, currency);
    this.renderCashReconciliation(cashTotal, upiTotal, cardTotal, grossSales, currency);
    this.renderDiscountsImpact(validOrders, grossSales, currency);
    this.renderCustomerLoyalty(validOrders, currency);
  },

  // =========================================================================
  // SUB-TAB 4: WHAT-IF PROFIT SIMULATOR & BREAKEVEN TARGETS (NEW ADVANCED)
  // =========================================================================
  renderSimulatorTab(mount) {
    if (!this.currentData) return;

    const { grossSales, estimatedCOGS, totalOperatingExpenses, netProfit, currency, daysInPeriod } = this.currentData;

    mount.innerHTML = `
      <div class="view-animate" style="display: flex; flex-direction: column; gap: 14px;">
        
        <!-- Header Info -->
        <div class="glass-card" style="padding: 18px 20px; border-radius: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div>
              <h3 style="margin: 0; font-size: 16px; font-weight: 900; color: var(--text-dark); display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-sliders" style="color: #7c3aed;"></i> Real-Time What-If Profit Simulator & Sensitivity Lab
              </h3>
              <p style="margin: 3px 0 0 0; font-size: 12px; color: var(--text-muted);">
                Test sensitivity scenarios: Adjust projected sales growth, food cost targets, and overheads to see their direct impact on net profit.
              </p>
            </div>
            <button type="button" class="btn btn-secondary" id="btn-reset-simulator" style="height: 34px; font-size: 11.5px; font-weight: 800; border-radius: 8px;">
              <i class="fa-solid fa-arrow-rotate-left"></i> Reset Defaults
            </button>
          </div>
        </div>

        <!-- Simulator Grid: Sliders on Left, Live Projected Outcome on Right -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 14px;">
          
          <!-- Controls Panel -->
          <div class="glass-card" style="padding: 20px; border-radius: 14px; display: flex; flex-direction: column; gap: 16px;">
            <h4 style="margin: 0; font-size: 14px; font-weight: 800; color: var(--text-dark); border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
              <i class="fa-solid fa-gears" style="color: #2563eb; margin-right: 6px;"></i> Simulation Parameters
            </h4>

            <!-- Slider 1: Sales Volume Variation -->
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <label style="font-size: 12.5px; font-weight: 800; color: var(--text-dark);">
                  Expected Sales Growth / Drop:
                </label>
                <span id="sim-val-sales" style="font-size: 13px; font-weight: 900; color: #2563eb;">+0%</span>
              </div>
              <input type="range" id="sim-slider-sales" class="sim-slider" min="-30" max="50" step="5" value="${this.simSalesDelta}">
              <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--text-muted); margin-top: 2px;">
                <span>-30% Drop</span>
                <span>Current Baseline</span>
                <span>+50% Growth</span>
              </div>
            </div>

            <!-- Slider 2: Target Food Cost (COGS) % -->
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <label style="font-size: 12.5px; font-weight: 800; color: var(--text-dark);">
                  Target Food Cost (COGS %):
                </label>
                <span id="sim-val-cogs" style="font-size: 13px; font-weight: 900; color: #b45309;">${this.simCogsRate}%</span>
              </div>
              <input type="range" id="sim-slider-cogs" class="sim-slider" min="20" max="45" step="1" value="${this.simCogsRate}">
              <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--text-muted); margin-top: 2px;">
                <span>20% (Ultra Lean)</span>
                <span>32% (Standard)</span>
                <span>45% (High Cost)</span>
              </div>
            </div>

            <!-- Slider 3: Overhead Expenses Variation -->
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <label style="font-size: 12.5px; font-weight: 800; color: var(--text-dark);">
                  Overhead Expense Adjustment:
                </label>
                <span id="sim-val-expenses" style="font-size: 13px; font-weight: 900; color: #dc2626;">+0%</span>
              </div>
              <input type="range" id="sim-slider-expenses" class="sim-slider" min="-25" max="35" step="5" value="${this.simExpenseDelta}">
              <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--text-muted); margin-top: 2px;">
                <span>-25% Cut</span>
                <span>Current Expenses</span>
                <span>+35% Increase</span>
              </div>
            </div>
          </div>

          <!-- Live Outcome Dashboard -->
          <div class="glass-card" style="padding: 20px; border-radius: 14px; display: flex; flex-direction: column; justify-content: space-between; gap: 14px;">
            <h4 style="margin: 0; font-size: 14px; font-weight: 800; color: var(--text-dark); border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
              <i class="fa-solid fa-chart-pie" style="color: #059669; margin-right: 6px;"></i> Projected Financial Impact
            </h4>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 10px; padding: 10px 12px;">
                <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Projected Sales</span>
                <div id="sim-out-sales" style="font-size: 18px; font-weight: 900; color: #2563eb; margin-top: 2px;">₹0</div>
                <span id="sim-out-sales-delta" style="font-size: 10.5px; color: var(--text-muted);">Baseline: ₹0</span>
              </div>

              <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 10px; padding: 10px 12px;">
                <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Projected Food Cost</span>
                <div id="sim-out-cogs" style="font-size: 18px; font-weight: 900; color: #b45309; margin-top: 2px;">₹0</div>
                <span id="sim-out-cogs-pct" style="font-size: 10.5px; color: var(--text-muted);">0% of sales</span>
              </div>

              <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 10px; padding: 10px 12px;">
                <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Projected Overheads</span>
                <div id="sim-out-expenses" style="font-size: 18px; font-weight: 900; color: #dc2626; margin-top: 2px;">₹0</div>
                <span id="sim-out-expenses-delta" style="font-size: 10.5px; color: var(--text-muted);">Fixed overheads</span>
              </div>

              <div id="sim-out-profit-card" style="background: #ecfdf5; border: 1.5px solid #a7f3d0; border-radius: 10px; padding: 10px 12px;">
                <span style="font-size: 11px; font-weight: 800; color: #047857; text-transform: uppercase;">PROJECTED NET PROFIT</span>
                <div id="sim-out-profit" style="font-size: 20px; font-weight: 900; color: #059669; margin-top: 2px;">₹0</div>
                <span id="sim-out-profit-diff" style="font-size: 11px; font-weight: 800; color: #059669;">+₹0 boost</span>
              </div>
            </div>

            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 10px 14px; font-size: 11.5px; color: #1e40af;">
              <i class="fa-solid fa-circle-info" style="margin-right: 5px;"></i>
              <strong id="sim-tip-text">Pro-Tip: Reducing food cost by 3% yields the equivalent profit of a 10% sales surge!</strong>
            </div>
          </div>

        </div>

      </div>
    `;

    this.bindSimulatorEvents(mount);
    this.recalculateSimulation();
  },

  bindSimulatorEvents(mount) {
    const sSales = mount.querySelector("#sim-slider-sales");
    const sCogs = mount.querySelector("#sim-slider-cogs");
    const sExpenses = mount.querySelector("#sim-slider-expenses");
    const btnReset = mount.querySelector("#btn-reset-simulator");

    if (sSales) {
      sSales.oninput = (e) => {
        this.simSalesDelta = Number(e.target.value);
        mount.querySelector("#sim-val-sales").textContent = `${this.simSalesDelta >= 0 ? '+' : ''}${this.simSalesDelta}%`;
        this.recalculateSimulation();
      };
    }

    if (sCogs) {
      sCogs.oninput = (e) => {
        this.simCogsRate = Number(e.target.value);
        mount.querySelector("#sim-val-cogs").textContent = `${this.simCogsRate}%`;
        this.recalculateSimulation();
      };
    }

    if (sExpenses) {
      sExpenses.oninput = (e) => {
        this.simExpenseDelta = Number(e.target.value);
        mount.querySelector("#sim-val-expenses").textContent = `${this.simExpenseDelta >= 0 ? '+' : ''}${this.simExpenseDelta}%`;
        this.recalculateSimulation();
      };
    }

    if (btnReset) {
      btnReset.onclick = () => {
        this.simSalesDelta = 0;
        this.simCogsRate = this.cogsPercent;
        this.simExpenseDelta = 0;
        this.renderSimulatorTab(mount);
      };
    }
  },

  recalculateSimulation() {
    if (!this.currentData) return;

    const { grossSales, totalOperatingExpenses, netProfit, currency } = this.currentData;

    const projSales = Math.max(0, grossSales * (1 + (this.simSalesDelta / 100)));
    const projCogs = projSales * (this.simCogsRate / 100);
    const projExpenses = Math.max(0, totalOperatingExpenses * (1 + (this.simExpenseDelta / 100)));
    const projGrossProfit = Math.max(0, projSales - projCogs);
    const projNetProfit = projGrossProfit - projExpenses;
    const profitDiff = projNetProfit - netProfit;

    const outSales = document.getElementById("sim-out-sales");
    const outSalesDelta = document.getElementById("sim-out-sales-delta");
    const outCogs = document.getElementById("sim-out-cogs");
    const outCogsPct = document.getElementById("sim-out-cogs-pct");
    const outExpenses = document.getElementById("sim-out-expenses");
    const outExpensesDelta = document.getElementById("sim-out-expenses-delta");
    const outProfit = document.getElementById("sim-out-profit");
    const outProfitDiff = document.getElementById("sim-out-profit-diff");
    const profitCard = document.getElementById("sim-out-profit-card");

    if (outSales) outSales.textContent = `${currency}${Math.round(projSales).toLocaleString("en-IN")}`;
    if (outSalesDelta) outSalesDelta.textContent = `Baseline: ${currency}${Math.round(grossSales).toLocaleString("en-IN")}`;
    if (outCogs) outCogs.textContent = `${currency}${Math.round(projCogs).toLocaleString("en-IN")}`;
    if (outCogsPct) outCogsPct.textContent = `${this.simCogsRate}% target food cost`;
    if (outExpenses) outExpenses.textContent = `${currency}${Math.round(projExpenses).toLocaleString("en-IN")}`;
    if (outExpensesDelta) outExpensesDelta.textContent = `${this.simExpenseDelta >= 0 ? '+' : ''}${this.simExpenseDelta}% vs current overheads`;

    if (outProfit) {
      const isProfitable = projNetProfit >= 0;
      outProfit.textContent = `${isProfitable ? '' : '-'}${currency}${Math.abs(Math.round(projNetProfit)).toLocaleString("en-IN")}`;
      outProfit.style.color = isProfitable ? "#059669" : "#dc2626";

      if (profitCard) {
        profitCard.style.background = isProfitable ? "#ecfdf5" : "#fef2f2";
        profitCard.style.borderColor = isProfitable ? "#a7f3d0" : "#fecaca";
      }
    }

    if (outProfitDiff) {
      const isPositive = profitDiff >= 0;
      outProfitDiff.style.color = isPositive ? "#059669" : "#dc2626";
      outProfitDiff.textContent = `${isPositive ? '+' : ''}${currency}${Math.round(profitDiff).toLocaleString("en-IN")} vs actual current`;
    }
  },

  renderWaterfallSteps(gross, discounts, net, cogs, grossProf, expenses, netProf, currency) {
    const container = document.getElementById("rep-waterfall-steps");
    if (!container) return;

    const isProfitable = netProf >= 0;
    const grossMarginPct = net > 0 ? ((grossProf / net) * 100).toFixed(1) : "0.0";
    const netMarginPct = net > 0 ? ((netProf / net) * 100).toFixed(1) : "0.0";
    const cogsPct = net > 0 ? ((cogs / net) * 100).toFixed(1) : this.cogsPercent;

    container.innerHTML = `
      <!-- Step 1: Gross Sales -->
      <div class="rep-pnl-step">
        <div class="rep-pnl-step-title">1. Gross Sales</div>
        <div class="rep-pnl-step-amt" style="color: #ff8a5c;">${currency}${Math.round(gross).toLocaleString("en-IN")}</div>
        <div class="rep-pnl-step-tag" style="color: #64748b;">100% Billing</div>
      </div>

      <div class="rep-pnl-arrow"><i class="fa-solid fa-minus"></i></div>

      <!-- Step 2: Discounts -->
      <div class="rep-pnl-step" style="background: #fff8f5; border-color: #ffe0d2;">
        <div class="rep-pnl-step-title" style="color: #c2410c;">2. Discounts</div>
        <div class="rep-pnl-step-amt" style="color: #ff7343;">-${currency}${Math.round(discounts).toLocaleString("en-IN")}</div>
        <div class="rep-pnl-step-tag" style="color: #ff7343;">Discount Deductions</div>
      </div>

      <div class="rep-pnl-arrow"><i class="fa-solid fa-equals"></i></div>

      <!-- Step 3: Net Revenue -->
      <div class="rep-pnl-step" style="background: #f0f9ff; border-color: #bae6fd;">
        <div class="rep-pnl-step-title" style="color: #0369a1;">3. Net Revenue</div>
        <div class="rep-pnl-step-amt" style="color: #0284c7;">${currency}${Math.round(net).toLocaleString("en-IN")}</div>
        <div class="rep-pnl-step-tag" style="color: #0284c7;">Realized Cashflow</div>
      </div>

      <div class="rep-pnl-arrow"><i class="fa-solid fa-minus"></i></div>

      <!-- Step 4: Food Cost COGS -->
      <div class="rep-pnl-step" style="background: #fffbeb; border-color: #fde68a;">
        <div class="rep-pnl-step-title" style="color: #b45309;">4. Food Cost (COGS)</div>
        <div class="rep-pnl-step-amt" style="color: #b45309;">-${currency}${Math.round(cogs).toLocaleString("en-IN")}</div>
        <div class="rep-pnl-step-tag" style="color: #b45309;">${cogsPct}% Dish Cost</div>
      </div>

      <div class="rep-pnl-arrow"><i class="fa-solid fa-equals"></i></div>

      <!-- Step 5: Gross Profit -->
      <div class="rep-pnl-step" style="background: #f0fdfa; border-color: #99f6e4;">
        <div class="rep-pnl-step-title" style="color: #0f766e;">5. Gross Profit</div>
        <div class="rep-pnl-step-amt" style="color: #0d9488;">${currency}${Math.round(grossProf).toLocaleString("en-IN")}</div>
        <div class="rep-pnl-step-tag" style="color: #0d9488;">${grossMarginPct}% Gross Margin</div>
      </div>

      <div class="rep-pnl-arrow"><i class="fa-solid fa-minus"></i></div>

      <!-- Step 6: Operating Overheads -->
      <div class="rep-pnl-step" style="background: #fff1f2; border-color: #fecdd3;">
        <div class="rep-pnl-step-title" style="color: #be123c;">6. Overhead Expenses</div>
        <div class="rep-pnl-step-amt" style="color: #e11d48;">-${currency}${Math.round(expenses).toLocaleString("en-IN")}</div>
        <div class="rep-pnl-step-tag" style="color: #e11d48;">Salaries & Bills</div>
      </div>

      <div class="rep-pnl-arrow"><i class="fa-solid fa-equals"></i></div>

      <!-- Step 7: Net Operating Profit -->
      <div class="rep-pnl-step step-highlight" style="background: ${isProfitable ? 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)' : '#fef2f2'}; border-color: ${isProfitable ? '#10b981' : '#fecaca'};">
        <div class="rep-pnl-step-title" style="color: ${isProfitable ? '#059669' : '#dc2626'}; font-weight: 900;">7. NET OPERATING PROFIT</div>
        <div class="rep-pnl-step-amt" style="color: ${isProfitable ? '#059669' : '#dc2626'}; font-size: 18px;">
          ${isProfitable ? '' : '-'}${currency}${Math.abs(Math.round(netProf)).toLocaleString("en-IN")}
        </div>
        <div class="rep-pnl-step-tag" style="color: ${isProfitable ? '#047857' : '#991b1b'}; font-weight: 800;">
          ${netMarginPct}% Net Margin
        </div>
      </div>
    `;
  },

  renderItemProfitTableOnly() {
    const tbody = document.getElementById("rep-item-profit-tbody");
    if (!tbody || !this.currentData) return;

    const { validOrders, categories, products, currency } = this.currentData;
    const cogsRate = this.cogsPercent / 100;

    // Aggregate items sold
    const itemMap = {};
    validOrders.forEach(o => {
      if (Array.isArray(o.items)) {
        o.items.forEach(it => {
          const name = it.name || "Unknown Item";
          if (!itemMap[name]) {
            const prod = products.find(p => p.id === it.productId || p.name === name);
            const cat = prod ? categories.find(c => c.id === prod.category) : null;
            itemMap[name] = {
              name,
              productId: it.productId,
              categoryId: prod ? prod.category : null,
              categoryName: cat ? cat.name : "General",
              price: Number(it.price || 0),
              unitsSold: 0,
              grossSales: 0,
              veg: prod ? prod.veg : true
            };
          }
          itemMap[name].unitsSold += (Number(it.quantity) || 1);
          itemMap[name].grossSales += (Number(it.lineTotal) || (it.price * (it.quantity || 1)));
        });
      }
    });

    const costMap = (window.db && typeof window.db.getProductCostMap === "function") ? window.db.getProductCostMap() : {};

    let itemList = Object.values(itemMap).map(i => {
      const prod = products.find(p => p.id === i.productId || p.name === i.name);
      const cleanKey = String(i.name).trim().toLowerCase();
      const costInfo = (i.productId && costMap[i.productId]) || costMap[cleanKey];
      
      const unitCost = (prod && prod.costPrice !== undefined && prod.costPrice !== null && !isNaN(prod.costPrice) && Number(prod.costPrice) > 0)
        ? Number(prod.costPrice)
        : (costInfo ? Number(costInfo.costPrice) : (i.price * cogsRate));
      
      const unitMargin = Math.max(0, i.price - unitCost);
      const marginPct = i.price > 0 ? Math.round((unitMargin / i.price) * 100) : (100 - this.cogsPercent);
      const estimatedCost = unitCost * i.unitsSold;
      const profitContributed = Math.max(0, i.grossSales - estimatedCost);
      const isFromRecipe = costInfo ? costInfo.isFromRecipe : false;
      const isCustom = costInfo ? costInfo.isCustom : false;

      return {
        ...i,
        unitCost,
        unitMargin,
        estimatedCost,
        profitContributed,
        marginPct,
        isFromRecipe,
        isCustom
      };
    });

    // Update Top Summary KPI Banner in Menu Margins tab
    const totalUnitsSold = itemList.reduce((sum, it) => sum + it.unitsSold, 0);
    const totalMenuRevenue = itemList.reduce((sum, it) => sum + it.grossSales, 0);
    const totalMenuCost = itemList.reduce((sum, it) => sum + it.estimatedCost, 0);
    const totalMenuProfit = itemList.reduce((sum, it) => sum + it.profitContributed, 0);
    const overallMarginPct = totalMenuRevenue > 0 ? Math.round((totalMenuProfit / totalMenuRevenue) * 100) : 0;
    const overallCostPct = totalMenuRevenue > 0 ? Math.round((totalMenuCost / totalMenuRevenue) * 100) : 0;

    const kpiUnits = document.getElementById("rep-menu-kpi-units");
    const kpiRevenue = document.getElementById("rep-menu-kpi-revenue");
    const kpiCogs = document.getElementById("rep-menu-kpi-cogs");
    const kpiCogsPct = document.getElementById("rep-menu-kpi-cogs-pct");
    const kpiProfit = document.getElementById("rep-menu-kpi-profit");
    const kpiMarginPct = document.getElementById("rep-menu-kpi-margin-pct");

    if (kpiUnits) kpiUnits.textContent = `${totalUnitsSold} Dishes`;
    if (kpiRevenue) kpiRevenue.textContent = `${currency}${Math.round(totalMenuRevenue).toLocaleString("en-IN")}`;
    if (kpiCogs) kpiCogs.textContent = `${currency}${Math.round(totalMenuCost).toLocaleString("en-IN")}`;
    if (kpiCogsPct) kpiCogsPct.textContent = `${overallCostPct}% Cost Ratio`;
    if (kpiProfit) kpiProfit.textContent = `+${currency}${Math.round(totalMenuProfit).toLocaleString("en-IN")}`;
    if (kpiMarginPct) kpiMarginPct.innerHTML = `<i class="fa-solid fa-arrow-trend-up"></i> ${overallMarginPct}% Margin`;

    // 1. Filter by Category Pill
    if (this.menuCategoryFilter !== "all") {
      itemList = itemList.filter(i => i.categoryId === this.menuCategoryFilter);
    }

    // 2. Filter by search query
    if (this.itemSearchQuery) {
      itemList = itemList.filter(i => 
        i.name.toLowerCase().includes(this.itemSearchQuery) || 
        i.categoryName.toLowerCase().includes(this.itemSearchQuery)
      );
    }

    // Determine thresholds for Menu Engineering Role
    const maxQty = Math.max(...itemList.map(i => i.unitsSold), 1);
    const maxProfit = Math.max(...itemList.map(i => i.profitContributed), 1);

    // 3. Filter by Role Chip
    if (this.menuRoleFilter !== "all") {
      itemList = itemList.filter(i => {
        const isStar = i.unitsSold >= maxQty * 0.4 && i.profitContributed >= maxProfit * 0.4;
        const isHorse = !isStar && i.unitsSold >= maxQty * 0.35;
        const isPuzzle = i.marginPct >= 65;
        const isSlow = i.unitsSold <= 2;

        if (this.menuRoleFilter === "star") return isStar;
        if (this.menuRoleFilter === "horse") return isHorse;
        if (this.menuRoleFilter === "puzzle") return isPuzzle;
        if (this.menuRoleFilter === "slow") return isSlow;
        return true;
      });
    }

    // 4. Sort
    if (this.itemSortKey === "gross") {
      itemList.sort((a, b) => b.grossSales - a.grossSales);
    } else if (this.itemSortKey === "qty") {
      itemList.sort((a, b) => b.unitsSold - a.unitsSold);
    } else if (this.itemSortKey === "margin") {
      itemList.sort((a, b) => b.marginPct - a.marginPct);
    } else {
      // Default: profit
      itemList.sort((a, b) => b.profitContributed - a.profitContributed);
    }

    if (itemList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; padding: 35px; color: #64748b; font-weight: 600;">No matching items sold during this period.</td></tr>`;
      return;
    }

    tbody.innerHTML = itemList.map((item, idx) => {
      let roleHtml = `<span class="badge-menu-horse">🐎 Volume Driver</span>`;
      if (item.unitsSold >= maxQty * 0.4 && item.profitContributed >= maxProfit * 0.4) {
        roleHtml = `<span class="badge-menu-star">🌟 Star Item</span>`;
      } else if (item.marginPct >= 65) {
        roleHtml = `<span class="badge-menu-puzzle">💡 High Margin</span>`;
      } else if (item.unitsSold <= 2) {
        roleHtml = `<span class="badge-menu-slow">⚠️ Low Velocity</span>`;
      }

      const costTypeTag = item.isFromRecipe 
        ? `<span style="font-size: 9.5px; font-weight: 800; background: #fef3c7; color: #b45309; padding: 1px 5px; border-radius: 4px; border: 1px solid #fde68a;">Recipe</span>` 
        : item.isCustom 
          ? `<span style="font-size: 9.5px; font-weight: 800; background: #e0f2fe; color: #0284c7; padding: 1px 5px; border-radius: 4px; border: 1px solid #bae6fd;">Custom</span>` 
          : `<span style="font-size: 9.5px; font-weight: 800; background: #f1f5f9; color: #64748b; padding: 1px 5px; border-radius: 4px;">Std 32%</span>`;

      return `
        <tr>
          <td style="font-size: 11px; color: #64748b; width: 20px; font-weight: 700;">#${idx + 1}</td>
          <td>
            <div style="font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 7px;">
              <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${item.veg !== false ? '#10b981' : '#ef4444'}; flex-shrink: 0;" title="${item.veg !== false ? 'Veg' : 'Non-Veg'}"></span>
              ${item.name}
            </div>
          </td>
          <td>
            <span style="font-size: 11px; font-weight: 700; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; padding: 2px 8px; border-radius: 6px;">
              ${item.categoryName}
            </span>
          </td>
          <td style="text-align: right; font-weight: 700; color: #1e293b;">${currency}${item.price.toFixed(0)}</td>
          <td style="text-align: right; font-weight: 700; color: #b45309;">
            <div style="display: inline-flex; align-items: center; gap: 5px; justify-content: flex-end;">
              ${currency}${item.unitCost.toFixed(1)}
              ${costTypeTag}
            </div>
          </td>
          <td style="text-align: right;">
            <div style="font-weight: 800; color: #059669; font-size: 12.5px;">+${currency}${item.unitMargin.toFixed(1)}</div>
            <div style="font-size: 10px; font-weight: 700; color: #64748b;">${item.marginPct}% margin</div>
          </td>
          <td style="text-align: center;">
            <span style="font-weight: 800; color: #0284c7; background: #f0f9ff; border: 1px solid #bae6fd; padding: 2px 9px; border-radius: 8px; font-size: 11.5px;">
              ${item.unitsSold} sold
            </span>
          </td>
          <td style="text-align: right; font-weight: 800; color: #1e293b;">${currency}${Math.round(item.grossSales).toLocaleString("en-IN")}</td>
          <td style="text-align: right; font-weight: 700; color: #b45309;">${currency}${Math.round(item.estimatedCost).toLocaleString("en-IN")}</td>
          <td style="text-align: right;">
            <span style="font-weight: 900; color: #059669; font-size: 13px; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 3px 8px; border-radius: 8px; display: inline-block;">
              +${currency}${Math.round(item.profitContributed).toLocaleString("en-IN")}
            </span>
          </td>
          <td style="text-align: center;">
            ${roleHtml}
          </td>
        </tr>
      `;
    }).join("");
  },

  renderTrendChartOnly() {
    const canvas = document.getElementById("repMainTrendCanvas");
    if (!canvas || !this.currentData || typeof Chart === "undefined") return;

    try {
      const ctx = canvas.getContext("2d");
      if (this.mainTrendChart) {
        this.mainTrendChart.destroy();
      }

    const { validOrders, periodExpenses } = this.currentData;
    const cogsRate = this.cogsPercent / 100;
    const textMuted = '#64748b';
    const borderColor = 'rgba(202, 213, 226, 0.6)';

    // Date points generator
    const labels = [];
    const revenuePoints = [];
    const costPoints = [];
    const profitPoints = [];
    const cumulativeProfitPoints = [];

    const [sY, sM, sD] = this.startDate.split('-').map(Number);
    const [eY, eM, eD] = this.endDate.split('-').map(Number);
    const start = new Date(sY, sM - 1, sD);
    const end = new Date(eY, eM - 1, eD);

    let cumulativeSum = 0;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = this.getLocalDateStr(d);
      labels.push(d.toLocaleDateString("en-US", { month: "short", day: "numeric" }));

      const dayOrders = validOrders.filter(o => {
        const orderDate = new Date(o.createdAt);
        const oStr = !isNaN(orderDate.getTime()) ? this.getLocalDateStr(orderDate) : o.createdAt.substring(0, 10);
        return oStr === dateStr;
      });

      const dayExpenses = periodExpenses.filter(e => {
        const eStr = e.date || (e.createdAt ? e.createdAt.substring(0, 10) : "");
        return eStr === dateStr;
      });

      const dayRevenue = dayOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
      const dayExpenseTotal = dayExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      const dayFin = (window.db && typeof window.db.calculateOrdersFinancials === "function")
        ? window.db.calculateOrdersFinancials(dayOrders)
        : null;
      const dayCOGS = dayFin ? dayFin.totalCOGS : (dayRevenue * cogsRate);
      const dayTotalCost = dayCOGS + dayExpenseTotal;
      const dayNetProfit = dayRevenue - dayTotalCost;

      cumulativeSum += dayNetProfit;

      revenuePoints.push(Math.round(dayRevenue));
      costPoints.push(Math.round(dayTotalCost));
      profitPoints.push(Math.round(dayNetProfit));
      cumulativeProfitPoints.push(Math.round(cumulativeSum));
    }

    // Gradient Fills
    const blueGradient = ctx.createLinearGradient(0, 0, 0, 240);
    blueGradient.addColorStop(0, 'rgba(37, 99, 235, 0.25)');
    blueGradient.addColorStop(1, 'rgba(37, 99, 235, 0.01)');

    const greenGradient = ctx.createLinearGradient(0, 0, 0, 240);
    greenGradient.addColorStop(0, 'rgba(16, 185, 129, 0.28)');
    greenGradient.addColorStop(1, 'rgba(16, 185, 129, 0.01)');

    let datasets = [];

    if (this.activeChartMode === "revenue") {
      datasets = [
        {
          label: "Sales Revenue (₹)",
          data: revenuePoints,
          borderColor: "#2563eb",
          backgroundColor: blueGradient,
          borderWidth: 3,
          tension: 0.25,
          fill: true,
          pointBackgroundColor: "#2563eb",
          pointRadius: 4
        }
      ];
    } else if (this.activeChartMode === "profit") {
      datasets = [
        {
          label: "Net Operating Profit (₹)",
          data: profitPoints,
          borderColor: "#10b981",
          backgroundColor: greenGradient,
          borderWidth: 3,
          tension: 0.25,
          fill: true,
          pointBackgroundColor: "#10b981",
          pointRadius: 4
        }
      ];
    } else if (this.activeChartMode === "cumulative") {
      datasets = [
        {
          label: "Cumulative Net Profit (₹)",
          data: cumulativeProfitPoints,
          borderColor: "#7c3aed",
          backgroundColor: 'rgba(124, 58, 237, 0.15)',
          borderWidth: 3,
          tension: 0.25,
          fill: true,
          pointBackgroundColor: "#7c3aed",
          pointRadius: 4
        }
      ];
    } else {
      // Default: 'both' (Multi-Stream)
      datasets = [
        {
          label: "Sales Revenue (₹)",
          data: revenuePoints,
          borderColor: "#2563eb",
          backgroundColor: blueGradient,
          borderWidth: 2.5,
          tension: 0.25,
          fill: true,
          pointBackgroundColor: "#2563eb",
          pointRadius: 3.5
        },
        {
          label: "Cost & Overheads (₹)",
          data: costPoints,
          borderColor: "#f59e0b",
          borderWidth: 2,
          borderDash: [5, 4],
          tension: 0.25,
          fill: false,
          pointBackgroundColor: "#f59e0b",
          pointRadius: 3
        },
        {
          label: "Net Profit (₹)",
          data: profitPoints,
          borderColor: "#10b981",
          backgroundColor: greenGradient,
          borderWidth: 3,
          tension: 0.25,
          fill: true,
          pointBackgroundColor: "#10b981",
          pointRadius: 4
        }
      ];
    }

    this.mainTrendChart = new Chart(ctx, {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            display: true,
            labels: { color: textMuted, font: { family: "Outfit", size: 11, weight: "bold" }, boxWidth: 12 }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleFont: { family: "Outfit", size: 12, weight: "bold" },
            bodyFont: { family: "Outfit", size: 11.5 },
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (context) => ` ${context.dataset.label}: ₹${context.raw.toLocaleString("en-IN")}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: borderColor },
            ticks: { color: textMuted, font: { family: "Outfit", size: 10.5, weight: "600" } }
          },
          y: {
            grid: { color: borderColor },
            ticks: { color: textMuted, font: { family: "Outfit", size: 10.5, weight: "600" } }
          }
        }
      }
    });
    } catch (trendErr) {
      console.error("Error creating trend chart:", trendErr);
    }
  },

  renderDonutChartOnly() {
    const canvas = document.getElementById("repDonutCanvas");
    if (!canvas || !this.currentData || typeof Chart === "undefined") return;

    try {
      const ctx = canvas.getContext("2d");
      if (this.donutBreakdownChart) {
        this.donutBreakdownChart.destroy();
      }

    const { validOrders, periodExpenses, categories, products, cashTotal, upiTotal, cardTotal } = this.currentData;
    const textMuted = '#64748b';
    const borderColor = 'rgba(202, 213, 226, 0.6)';

    let labels = [];
    let data = [];
    let backgroundColors = [];

    if (this.activeDonutMode === "expenses") {
      const expCatMap = {};
      periodExpenses.forEach(e => {
        const cat = e.category || "Other expenses";
        expCatMap[cat] = (expCatMap[cat] || 0) + (Number(e.amount) || 0);
      });

      labels = Object.keys(expCatMap);
      data = labels.map(k => Math.round(expCatMap[k]));
      backgroundColors = ["#ef4444", "#f59e0b", "#8b5cf6", "#06b6d4", "#64748b", "#10b981"];

      if (labels.length === 0) {
        labels = ["No Operating Expenses"];
        data = [1];
        backgroundColors = [borderColor];
      }
    } else if (this.activeDonutMode === "payments") {
      labels = ["Cash in Till", "UPI QR Online", "Card Swiped"];
      data = [Math.round(cashTotal), Math.round(upiTotal), Math.round(cardTotal)];
      backgroundColors = ["#10b981", "#8b5cf6", "#3b82f6"];
    } else {
      // Default: Categories
      const catSalesMap = {};
      categories.forEach(c => { catSalesMap[c.name] = 0; });

      validOrders.forEach(o => {
        if (Array.isArray(o.items)) {
          o.items.forEach(it => {
            const prod = products.find(p => p.id === it.productId || p.name === it.name);
            if (prod) {
              const cat = categories.find(c => c.id === prod.category);
              if (cat) {
                catSalesMap[cat.name] = (catSalesMap[cat.name] || 0) + (Number(it.lineTotal) || 0);
              }
            }
          });
        }
      });

      labels = Object.keys(catSalesMap).filter(k => catSalesMap[k] > 0);
      data = labels.map(k => Math.round(catSalesMap[k]));
      backgroundColors = ["#2563eb", "#10b981", "#6366f1", "#0284c7", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6", "#64748b"];

      if (labels.length === 0) {
        labels = ["No Sales"];
        data = [1];
        backgroundColors = [borderColor];
      }
    }

    this.donutBreakdownChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: backgroundColors,
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
            position: "right",
            labels: { color: textMuted, font: { family: "Outfit", size: 11, weight: "bold" }, padding: 8, boxWidth: 10 }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleFont: { family: "Outfit", size: 12, weight: "bold" },
            bodyFont: { family: "Outfit", size: 11.5 },
            padding: 9,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ₹${Number(ctx.raw).toLocaleString("en-IN")}`
            }
          }
        },
        cutout: "68%"
      }
    });
    } catch (donutErr) {
      console.error("Error creating donut chart:", donutErr);
    }
  },

  renderHourlyRushChartOnly() {
    const canvas = document.getElementById("repHourlyRushCanvas");
    if (!canvas || !this.currentData) return;

    const ctx = canvas.getContext("2d");
    if (this.hourlyRushChart) {
      this.hourlyRushChart.destroy();
    }

    const { validOrders } = this.currentData;
    const textMuted = '#64748b';
    const borderColor = 'rgba(202, 213, 226, 0.6)';

    const opHours = [14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
    const rushLabels = ["2 PM", "3 PM", "4 PM", "5 PM", "6 PM", "7 PM", "8 PM", "9 PM", "10 PM", "11 PM"];
    const rushSales = opHours.map(() => 0);
    const rushBills = opHours.map(() => 0);

    const barColors = opHours.map(h => {
      if (h >= 14 && h < 17) return "#f59e0b"; // Afternoon
      if (h >= 17 && h < 19) return "#ff7343"; // Evening
      if (h >= 19 && h < 22) return "#7c3aed"; // Dinner Rush
      return "#4f46e5"; // Late Night
    });

    validOrders.forEach(o => {
      const d = new Date(o.createdAt);
      if (isNaN(d.getTime())) return;
      const h = d.getHours();
      const amt = Number(o.total) || 0;
      const idx = opHours.indexOf(h);
      if (idx !== -1) {
        rushSales[idx] += amt;
        rushBills[idx]++;
      }
    });

    let peakIdx = 0;
    let maxRush = 0;
    rushSales.forEach((s, idx) => {
      if (s > maxRush) {
        maxRush = s;
        peakIdx = idx;
      }
    });

    const chip = document.getElementById("rep-peak-hour-chip");
    if (chip) {
      chip.textContent = maxRush > 0 ? `Peak Rush: ${rushLabels[peakIdx]}` : "No Rush Logged";
    }

    this.hourlyRushChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: rushLabels,
        datasets: [{
          label: "Sales (₹)",
          data: rushSales.map(Math.round),
          backgroundColor: barColors,
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
            titleFont: { family: "Outfit", size: 12, weight: "bold" },
            bodyFont: { family: "Outfit", size: 11.5 },
            padding: 9,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => [
                ` Revenue: ₹${Number(ctx.raw).toLocaleString("en-IN")}`,
                ` Bills: ${rushBills[ctx.dataIndex]} orders`
              ]
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: textMuted, font: { family: "Outfit", size: 10.5, weight: "600" } }
          },
          y: {
            grid: { color: borderColor },
            ticks: { color: textMuted, font: { family: "Outfit", size: 10.5, weight: "600" } }
          }
        }
      }
    });
  },

  renderDayOfWeekPerformance(orders, currencySymbol) {
    const container = document.getElementById("rep-day-of-week-container");
    if (!container) return;

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayStats = dayNames.map((name, idx) => ({ name, dayIdx: idx, sales: 0, orders: 0 }));

    orders.forEach(o => {
      if (!o.createdAt) return;
      const d = new Date(o.createdAt);
      if (isNaN(d.getTime())) return;
      const dayIdx = d.getDay();
      dayStats[dayIdx].sales += (Number(o.total) || 0);
      dayStats[dayIdx].orders++;
    });

    let bestDayIdx = 0;
    let maxDaySales = 0;
    dayStats.forEach(ds => {
      if (ds.sales > maxDaySales) {
        maxDaySales = ds.sales;
        bestDayIdx = ds.dayIdx;
      }
    });

    const badge = document.getElementById("rep-best-day-badge");
    if (badge && maxDaySales > 0) {
      badge.textContent = `👑 Best: ${dayNames[bestDayIdx]} (${currencySymbol}${Math.round(maxDaySales).toLocaleString("en-IN")})`;
    }

    container.innerHTML = dayStats.map(ds => {
      const isTop = ds.dayIdx === bestDayIdx && maxDaySales > 0;
      const avgBill = ds.orders > 0 ? Math.round(ds.sales / ds.orders) : 0;
      return `
        <div style="background: ${isTop ? '#fffbeb' : '#f8fafc'}; border: ${isTop ? '1.5px solid #fde68a' : '1px solid var(--border-color)'}; border-radius: 10px; padding: 10px 8px; text-align: center; display: flex; flex-direction: column; justify-content: space-between; gap: 4px;">
          <div style="font-size: 11.5px; font-weight: 800; color: ${isTop ? '#b45309' : 'var(--text-dark)'};">
            ${ds.name} ${isTop ? '👑' : ''}
          </div>
          <div style="font-size: 13.5px; font-weight: 900; color: ${isTop ? '#b45309' : '#2563eb'};">
            ${currencySymbol}${Math.round(ds.sales).toLocaleString("en-IN")}
          </div>
          <div style="font-size: 10px; color: var(--text-muted); font-weight: 600;">
            ${ds.orders} bills • Avg ${currencySymbol}${avgBill}
          </div>
        </div>
      `;
    }).join("");
  },

  renderOrderChannels(orders, grossSales, currencySymbol) {
    const container = document.getElementById("rep-order-types-container");
    if (!container) return;

    let dineCount = 0, dineSales = 0;
    let takeCount = 0, takeSales = 0;

    orders.forEach(o => {
      const type = (o.type || "Dine-in").toLowerCase();
      const amt = Number(o.total) || 0;
      if (type.includes("takeaway") || type.includes("parcel")) {
        takeCount++;
        takeSales += amt;
      } else {
        dineCount++;
        dineSales += amt;
      }
    });

    const badge = document.getElementById("rep-orders-channel-badge");
    if (badge) badge.textContent = `${orders.length} Bills Total`;

    const dinePct = grossSales > 0 ? Math.round((dineSales / grossSales) * 100) : 0;
    const takePct = grossSales > 0 ? Math.round((takeSales / grossSales) * 100) : 0;

    container.innerHTML = `
      <div>
        <div style="display: flex; justify-content: space-between; font-size: 11.5px; font-weight: 700; margin-bottom: 3px;">
          <span style="color: var(--text-dark);"><i class="fa-solid fa-chair" style="color: #2563eb;"></i> Dine-in (${dineCount} bills)</span>
          <span style="color: #2563eb;">${currencySymbol}${Math.round(dineSales).toLocaleString("en-IN")} (${dinePct}%)</span>
        </div>
        <div style="height: 6px; background: #eff6ff; border-radius: 4px; overflow: hidden;">
          <div style="width: ${dinePct}%; height: 100%; background: #2563eb; border-radius: 4px;"></div>
        </div>
      </div>

      <div>
        <div style="display: flex; justify-content: space-between; font-size: 11.5px; font-weight: 700; margin-bottom: 3px;">
          <span style="color: var(--text-dark);"><i class="fa-solid fa-bag-shopping" style="color: #f59e0b;"></i> Takeaway & Parcel (${takeCount} bills)</span>
          <span style="color: #d97706;">${currencySymbol}${Math.round(takeSales).toLocaleString("en-IN")} (${takePct}%)</span>
        </div>
        <div style="height: 6px; background: #fffbeb; border-radius: 4px; overflow: hidden;">
          <div style="width: ${takePct}%; height: 100%; background: #f59e0b; border-radius: 4px;"></div>
        </div>
      </div>
    `;
  },

  renderCashReconciliation(cashTotal, upiTotal, cardTotal, grossRevenue, currencySymbol) {
    const container = document.getElementById("rep-cash-reconcile-container");
    const badge = document.getElementById("rep-payment-summary-badge");
    if (badge) badge.textContent = `${currencySymbol}${Math.round(grossRevenue).toLocaleString("en-IN")} Total`;
    if (!container) return;

    const cashPct = grossRevenue > 0 ? Math.round((cashTotal / grossRevenue) * 100) : 0;
    const upiPct = grossRevenue > 0 ? Math.round((upiTotal / grossRevenue) * 100) : 0;
    const cardPct = grossRevenue > 0 ? Math.round((cardTotal / grossRevenue) * 100) : 0;

    container.innerHTML = `
      <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 10px; padding: 10px 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span style="font-size: 12px; font-weight: 700; color: #059669; display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-money-bill-wave"></i> Cash in Till:
          </span>
          <span style="font-size: 13.5px; font-weight: 900; color: #059669;">${currencySymbol}${Math.round(cashTotal).toLocaleString("en-IN")}</span>
        </div>
        <div style="height: 5px; background: #e2e8f0; border-radius: 3px; overflow: hidden;">
          <div style="width: ${cashPct}%; height: 100%; background: #10b981; border-radius: 3px;"></div>
        </div>
        <div style="font-size: 10.5px; color: var(--text-muted); text-align: right; margin-top: 2px;">${cashPct}% of collections</div>
      </div>

      <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 10px; padding: 10px 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span style="font-size: 12px; font-weight: 700; color: #2563eb; display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-qrcode"></i> UPI Online:
          </span>
          <span style="font-size: 13.5px; font-weight: 900; color: #2563eb;">${currencySymbol}${Math.round(upiTotal).toLocaleString("en-IN")}</span>
        </div>
        <div style="height: 5px; background: #e2e8f0; border-radius: 3px; overflow: hidden;">
          <div style="width: ${upiPct}%; height: 100%; background: #2563eb; border-radius: 3px;"></div>
        </div>
        <div style="font-size: 10.5px; color: var(--text-muted); text-align: right; margin-top: 2px;">${upiPct}% of collections</div>
      </div>

      ${cardTotal > 0 ? `
        <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 10px; padding: 10px 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-size: 12px; font-weight: 700; color: #7c3aed; display: flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-credit-card"></i> Card Swiped:
            </span>
            <span style="font-size: 13.5px; font-weight: 900; color: #7c3aed;">${currencySymbol}${Math.round(cardTotal).toLocaleString("en-IN")}</span>
          </div>
          <div style="height: 5px; background: #e2e8f0; border-radius: 3px; overflow: hidden;">
            <div style="width: ${cardPct}%; height: 100%; background: #7c3aed; border-radius: 3px;"></div>
          </div>
          <div style="font-size: 10.5px; color: var(--text-muted); text-align: right; margin-top: 2px;">${cardPct}% of collections</div>
        </div>
      ` : ''}
    `;
  },

  renderDiscountsImpact(orders, grossSales, currencySymbol) {
    const container = document.getElementById("rep-discounts-container");
    if (!container) return;

    const flatDiscounts = orders.reduce((sum, o) => sum + (Number(o.discount) || 0), 0);
    const totalDiscounts = flatDiscounts;
    const rate = grossSales > 0 ? ((totalDiscounts / (grossSales + totalDiscounts)) * 100).toFixed(1) : 0;

    const badge = document.getElementById("rep-discount-rate-badge");
    if (badge) badge.textContent = `${rate}% Discount Rate`;

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; padding: 6px 10px; border-radius: 8px; background: #f8fafc; font-size: 11.5px;">
        <span style="font-weight: 700; color: var(--text-dark);">Customer Bill Discounts:</span>
        <span style="font-weight: 800; color: #2563eb;">${currencySymbol}${Math.round(flatDiscounts).toLocaleString("en-IN")}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 6px 10px; border-radius: 8px; background: #fff1f2; border: 1px solid #fecdd3; font-size: 12px; font-weight: 800;">
        <span style="color: #9f1239;">Total Customer Savings:</span>
        <span style="color: #be123c;">${currencySymbol}${Math.round(totalDiscounts).toLocaleString("en-IN")}</span>
      </div>
    `;
  },

  renderCustomerLoyalty(orders, currencySymbol) {
    const tbody = document.getElementById("rep-loyalty-tbody");
    if (!tbody) return;

    const customerMap = {};
    orders.forEach(o => {
      const rawName = (o.customerName || "").trim();
      const rawPhone = (o.customerPhone || "").trim();
      const lowerName = rawName.toLowerCase();
      if (!rawName || lowerName === "walk-in" || lowerName === "walk in" || lowerName === "walk-in guest" || lowerName === "guest") {
        if (!rawPhone) return;
      }

      const key = rawPhone || rawName.toLowerCase();
      if (!customerMap[key]) {
        customerMap[key] = {
          name: rawName || "Regular Guest",
          phone: rawPhone || "--",
          ordersCount: 0,
          totalSpent: 0
        };
      }
      customerMap[key].ordersCount++;
      customerMap[key].totalSpent += (Number(o.total) || 0);
    });

    const customerList = Object.values(customerMap).sort((a, b) => b.totalSpent - a.totalSpent);
    const totalCustomers = customerList.length;
    const repeatCustomers = customerList.filter(c => c.ordersCount >= 2).length;
    const repeatRate = totalCustomers > 0 ? Math.round((repeatCustomers / totalCustomers) * 100) : 0;

    const rateBadge = document.getElementById("rep-repeat-rate-badge");
    if (rateBadge) rateBadge.textContent = `${repeatRate}% Repeat Rate`;

    const subtextEl = document.getElementById("rep-loyalty-subtext");
    if (subtextEl) subtextEl.textContent = `${totalCustomers} unique guests • ${repeatCustomers} repeat visitors in period`;

    if (customerList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:25px; color:var(--text-muted); font-size:12px; font-weight:600;"><i class="fa-solid fa-address-book" style="margin-right:6px;"></i> Guest details registered in POS terminal will appear here.</td></tr>`;
    } else {
      tbody.innerHTML = customerList.slice(0, 5).map(c => `
        <tr>
          <td style="font-weight: 700; color: var(--text-dark); display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-user-check" style="color: #10b981; font-size: 11px;"></i> ${c.name}
          </td>
          <td style="color: var(--text-muted); font-weight: 600; font-size: 12px;">${c.phone}</td>
          <td><span style="font-weight: 800; color: #10b981; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 2px 8px; border-radius: 10px; font-size: 11px;">${c.ordersCount} visits</span></td>
          <td style="text-align: right; font-weight: 800; color: #2563eb;">${currencySymbol}${Math.round(c.totalSpent).toLocaleString("en-IN")}</td>
        </tr>
      `).join("");
    }
  },

  renderLowVelocityMenu(products, categories, validOrders, currencySymbol) {
    const tbody = document.getElementById("rep-slow-items-tbody");
    if (!tbody) return;

    const itemSoldMap = {};
    validOrders.forEach(o => {
      if (Array.isArray(o.items)) {
        o.items.forEach(it => { itemSoldMap[it.name] = true; });
      }
    });

    const activeProducts = products.filter(p => p.status !== "Inactive");
    const unsoldItems = activeProducts.filter(p => !itemSoldMap[p.name]);

    const badge = document.getElementById("rep-slow-items-badge");
    if (badge) badge.textContent = `${unsoldItems.length} Unsold Items`;

    if (unsoldItems.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:25px; color:#059669; font-weight:700;"><i class="fa-solid fa-circle-check"></i> Great job! All active menu items recorded sales!</td></tr>`;
    } else {
      tbody.innerHTML = unsoldItems.slice(0, 6).map(p => {
        const cat = categories.find(c => c.id === p.category);
        return `
          <tr>
            <td style="font-weight: 700; color: var(--text-dark);">${p.name}</td>
            <td style="color: var(--text-muted); font-size: 11.5px;">${cat ? cat.name : '--'}</td>
            <td style="font-weight: 700; color: var(--text-dark);">${currencySymbol}${p.price}</td>
            <td style="text-align: right;"><span style="font-size: 10.5px; font-weight: 800; color: #dc2626; background: #fef2f2; border: 1px solid #fecaca; padding: 2px 7px; border-radius: 6px;">0 Sold</span></td>
          </tr>
        `;
      }).join("");
    }
  },

  showPrintSummaryModal() {
    if (!this.currentData) return;

    const {
      validOrders,
      currency,
      grossSales,
      netSales,
      totalDiscounts,
      estimatedCOGS,
      grossProfit,
      grossMarginPct,
      totalOperatingExpenses,
      netProfit,
      netMarginPct,
      aov,
      cashTotal,
      upiTotal,
      cardTotal
    } = this.currentData;

    const settings = (window.db && window.db.get("settings")) || {};
    const restaurantName = settings.restaurantName || "Crust & Chilly";

    const summaryHtml = `
      <div id="reports-pl-printable-area" style="font-family: 'Courier New', monospace; font-size: 12.5px; color: #000; background: #fff; padding: 18px; line-height: 1.45;">
        <div style="text-align: center; margin-bottom: 14px;">
          <h2 style="font-size: 19px; font-weight: 900; margin: 0; text-transform: uppercase;">${restaurantName}</h2>
          <p style="font-size: 12px; font-weight: 700; margin: 2px 0;">EXECUTIVE PROFIT & LOSS (P&L) STATEMENT</p>
          <p style="font-size: 11px; margin: 0;">Period: ${this.startDate} to ${this.endDate}</p>
        </div>

        <div style="border-top: 1.5px dashed #000; border-bottom: 1.5px dashed #000; padding: 8px 0; margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between;">
            <span>Completed Customer Orders:</span>
            <strong>${validOrders.length} orders</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 2px;">
            <span>Gross Sales (100%):</span>
            <strong>${currency}${(grossSales + totalDiscounts).toFixed(2)}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 2px; color: #555;">
            <span>(-) Discounts Given:</span>
            <span>-${currency}${totalDiscounts.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-weight: 900; border-top: 1px solid #000; margin-top: 4px; padding-top: 4px;">
            <span>NET SALES REVENUE:</span>
            <span>${currency}${netSales.toFixed(2)}</span>
          </div>
        </div>

        <div style="border-bottom: 1.5px dashed #000; padding-bottom: 8px; margin-bottom: 10px;">
          <div style="font-weight: 800; text-decoration: underline; margin-bottom: 4px;">COST OF GOODS & OPERATING EXPENSES:</div>
          <div style="display: flex; justify-content: space-between;">
            <span>(-) Cost of Goods Sold (Menu Ingredients COGS):</span>
            <span>-${currency}${estimatedCOGS.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-weight: 800; margin-top: 2px;">
            <span>GROSS PROFIT (${grossMarginPct}% Margin):</span>
            <span>${currency}${grossProfit.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 3px; color: #555;">
            <span>(-) Overhead Operating Expenses:</span>
            <span>-${currency}${totalOperatingExpenses.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 900; border-top: 1.5px solid #000; margin-top: 6px; padding-top: 6px;">
            <span>NET OPERATING PROFIT:</span>
            <span>${currency}${netProfit.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; margin-top: 2px;">
            <span>Net Profit Margin %:</span>
            <strong>${netMarginPct}%</strong>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; margin-top: 2px;">
            <span>Average Order Value (AOV):</span>
            <strong>${currency}${Math.round(aov)}</strong>
          </div>
        </div>

        <div style="margin-bottom: 12px; font-size: 12px;">
          <strong style="text-decoration: underline;">PAYMENT COLLECTION BREAKDOWN:</strong>
          <div style="display: flex; justify-content: space-between; margin-top: 4px;">
            <span>Cash in Till:</span>
            <span>${currency}${cashTotal.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 2px;">
            <span>UPI Online Received:</span>
            <span>${currency}${upiTotal.toFixed(2)}</span>
          </div>
          ${cardTotal > 0 ? `
            <div style="display: flex; justify-content: space-between; margin-top: 2px;">
              <span>Card Swiped:</span>
              <span>${currency}${cardTotal.toFixed(2)}</span>
            </div>
          ` : ''}
        </div>

        <div style="text-align: center; margin-top: 22px; font-size: 11px; border-top: 1px dashed #000; padding-top: 10px;">
          Authorized Manager Signature: _______________________<br><br>
          System Generated: ${new Date().toLocaleString("en-IN")}
        </div>
      </div>
    `;

    window.customModal.show({
      title: "Executive P&L Performance Report",
      bodyHtml: summaryHtml,
      confirmText: "Print P&L Summary",
      cancelText: "Close",
      onConfirm: () => {
        document.body.classList.add("printing-reports-pl");
        window.print();
        setTimeout(() => {
          document.body.classList.remove("printing-reports-pl");
        }, 1000);
        return true;
      }
    });
  },

  exportReportToCSV() {
    if (!this.currentData) return;

    const { validOrders } = this.currentData;
    const startStr = this.startDate;
    const endStr = this.endDate;
    const cogsRate = this.cogsPercent / 100;

    if (validOrders.length === 0) {
      window.showToast("No orders available to export for this period.", "error");
      return;
    }

    const costMap = (window.db && typeof window.db.getProductCostMap === "function") ? window.db.getProductCostMap() : {};

    let csv = "Order ID,Date,Customer,Phone,Order Type,Payment Method,Subtotal,Discount,Net Total,COGS,Gross Profit,Status\r\n";
    validOrders.forEach(o => {
      const net = Number(o.total) || 0;
      let cogs = 0;
      if (o.totalCOGS !== undefined && o.totalCOGS !== null) {
        cogs = Number(o.totalCOGS);
      } else if (Array.isArray(o.items)) {
        o.items.forEach(it => {
          const qty = Number(it.quantity) || 1;
          const cleanKey = String(it.name || "").trim().toLowerCase();
          const costInfo = (it.productId && costMap[it.productId]) || costMap[cleanKey];
          const uCost = (it.costPrice !== undefined && it.costPrice !== null && !isNaN(it.costPrice))
            ? Number(it.costPrice)
            : (costInfo ? costInfo.costPrice : (Number(it.price) || 0) * cogsRate);
          cogs += uCost * qty;
        });
      } else {
        cogs = net * cogsRate;
      }
      const profit = Math.max(0, net - cogs);
      csv += `ORD-${o.orderNumber || o.id},"${o.createdAt}",` +
             `"${(o.customerName || 'Walk-in').replace(/"/g, '""')}",` +
             `"${(o.customerPhone || '').replace(/"/g, '""')}",` +
             `"${o.type || 'Dine-in'}","${o.paymentMethod || 'UPI'}",` +
             `${(Number(o.subtotal) || 0).toFixed(2)},` +
             `${(Number(o.discount) || 0).toFixed(2)},${net.toFixed(2)},${cogs.toFixed(2)},${profit.toFixed(2)},"${o.status}"\r\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Crust_Chilly_Sales_Profit_${startStr}_to_${endStr}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    window.showToast("Comprehensive P&L CSV file successfully downloaded.", "success");
  }
};
