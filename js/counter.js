// Crust & Chilly POS - Advanced Executive Daily Counter & Bills History Module 2.0
// Features: Executive 5-Card Scorecard with Visual Payment Split Ribbon,
// One-Tap Quick Filter Chips (Cash, UPI, Card, Dine-in, Takeaway, Void),
// Multi-Select Floating Bulk Action Bar (Export, Mark Completed),
// Expandable Bill Item Breakdown, 1-Click Payment Mode Switcher, WhatsApp Receipt Sharing,
// End-of-Day Shift Settlement Wizard (Z-Report Close Register),
// Cash Drawer Physical Denominations Workstation with Quick Steppers (+1, +5, +10),
// Real-Time Variance Calculation (Balanced / Surplus / Shortage),
// Till Cash Payouts Petty Log, Shift Velocity Rush Timeline, Shift Settlement Audit Log.

window.views = window.views || {};
window.views.counter = {
  activeTab: "bills", // 'bills' | 'drawer' | 'velocity' | 'shifts'
  activeDateStr: null,
  selectedPeriod: "today", // 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'
  quickFilterChip: "all", // 'all' | 'cash' | 'upi' | 'card' | 'dinein' | 'takeaway' | 'void'
  searchQuery: "",
  paymentFilter: "all", // 'all' | 'Cash' | 'UPI' | 'Card'
  statusFilter: "all", // 'all' | 'Completed' | 'Preparing' | 'Ready' | 'Cancelled'
  typeFilter: "all", // 'all' | 'Dine-in' | 'Takeaway'
  sortBy: "newest", // 'newest' | 'oldest' | 'highest' | 'lowest'
  expandedOrderId: null, // Track currently expanded bill row
  selectedOrderIds: new Set(), // Multi-select bill IDs for bulk actions

  // Physical Denominations state
  denominations: {
    500: 0,
    200: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    coins: 0
  },

  getLocalDateStr(d = new Date()) {
    if (!d || isNaN(d.getTime())) d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  getIstDateString(dateObj) {
    return this.getLocalDateStr(dateObj);
  },

  getOrderDateStr(orderOrDate) {
    if (!orderOrDate) return "";
    if (typeof orderOrDate === "string") {
      if (orderOrDate.length >= 10 && orderOrDate.includes("-")) {
        const sub = orderOrDate.substring(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(sub)) return sub;
      }
      const d = new Date(orderOrDate);
      if (!isNaN(d.getTime())) return this.getLocalDateStr(d);
      return orderOrDate.substring(0, 10);
    }
    if (orderOrDate instanceof Date) {
      return this.getLocalDateStr(orderOrDate);
    }
    if (orderOrDate && orderOrDate.createdAt) {
      return this.getOrderDateStr(orderOrDate.createdAt);
    }
    return "";
  },

  loadSavedDenominations() {
    try {
      const savedDenoms = localStorage.getItem(`crust_denom_${this.activeDateStr}`);
      if (savedDenoms) {
        this.denominations = JSON.parse(savedDenoms);
      } else {
        this.denominations = { 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, coins: 0 };
      }
    } catch (e) {
      this.denominations = { 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, coins: 0 };
    }
  },

  init(container) {
    const today = new Date();
    this.activeDateStr = this.getIstDateString(today);
    this.loadSavedDenominations();
    this.selectedOrderIds.clear();

    container.innerHTML = `
      <div class="view-animate" style="display: flex; flex-direction: column; gap: 14px; max-width: 100%; width: 100%; overflow-x: hidden;">
        
        <!-- Top Command Bar: Period Navigation & Action Hub -->
        <div class="glass-card counter-control-bar" style="padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; border-radius: 14px; background: #ffffff; border: 1px solid #f0f3f9;">
          
          <!-- Period Selector & Date Navigation -->
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 13.5px; font-weight: 800; color: var(--text-dark); white-space: nowrap; display: flex; align-items: center; gap: 7px;">
                <i class="fa-solid fa-cash-register" style="color: #2563eb; font-size: 15px;"></i> Daily Counter:
              </span>
            </div>

            <!-- Quick Time Presets -->
            <div class="rep-preset-pills" id="counter-time-pills-group" style="display: flex; gap: 5px; flex-wrap: wrap; align-items: center;">
              <button type="button" class="btn-rep-preset counter-time-pill ${this.selectedPeriod === 'today' ? 'active' : ''}" data-period="today">Today</button>
              <button type="button" class="btn-rep-preset counter-time-pill ${this.selectedPeriod === 'yesterday' ? 'active' : ''}" data-period="yesterday">Yesterday</button>
              <button type="button" class="btn-rep-preset counter-time-pill ${this.selectedPeriod === 'week' ? 'active' : ''}" data-period="week">Last 7 Days</button>
              <button type="button" class="btn-rep-preset counter-time-pill ${this.selectedPeriod === 'month' ? 'active' : ''}" data-period="month">This Month</button>
              <button type="button" class="btn-rep-preset counter-time-pill ${this.selectedPeriod === 'all' ? 'active' : ''}" data-period="all">All Time</button>
            </div>

            <!-- Date Picker -->
            <div style="display: flex; align-items: center; gap: 6px;">
              <input type="date" id="counter-date-picker" class="form-input" value="${this.activeDateStr}" style="height: 35px; font-size: 11.5px; font-weight: 700; padding: 4px 8px; border-radius: 10px; width: 135px;">
            </div>
          </div>

          <!-- Utility Operations Toolbar -->
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            
            <!-- End Shift / Close Register Wizard -->
            <button class="btn btn-primary" id="btn-counter-close-shift" style="height: 36px; padding: 0 16px; font-size: 12px; font-weight: 800; border-radius: 10px; display: inline-flex; align-items: center; gap: 7px; background: linear-gradient(135deg, #ff9b73 0%, #ff784b 100%); color: #ffffff; border: none; box-shadow: 0 3px 12px rgba(255, 138, 92, 0.35); cursor: pointer;" title="End Shift & Settle Register (Z-Report)">
              <i class="fa-solid fa-file-invoice-dollar"></i> Close Register
            </button>

            <!-- Quick Cash Out Expense Button -->
            <button class="btn btn-secondary" id="btn-counter-expense" style="height: 36px; padding: 0 13px; font-size: 12px; font-weight: 800; border-radius: 10px; display: inline-flex; align-items: center; gap: 6px; background: #fff1f2; color: #e11d48; border: 1px solid #fecdd3; cursor: pointer;" title="Record Till Cash Expense / Payout">
              <i class="fa-solid fa-hand-holding-dollar" style="color: #e11d48;"></i> + Cash Out
            </button>

            <!-- Export CSV -->
            <button class="btn btn-secondary" id="btn-export-csv" style="height: 36px; padding: 0 13px; font-size: 12px; font-weight: 800; border-radius: 10px; display: inline-flex; align-items: center; gap: 6px;" title="Download Bills CSV Excel">
              <i class="fa-solid fa-file-csv" style="color: #059669;"></i> Export CSV
            </button>

            <!-- Z-Report Day Summary Slip -->
            <button class="btn btn-secondary" id="btn-print-daysummary" style="height: 36px; padding: 0 13px; font-size: 12px; font-weight: 800; border-radius: 10px; display: inline-flex; align-items: center; gap: 6px;" title="Print 80mm Z-Report Day Summary">
              <i class="fa-solid fa-print" style="color: #2563eb;"></i> Day Summary
            </button>

            <!-- Refresh Button -->
            <button class="btn btn-secondary" id="btn-counter-refresh" style="height: 36px; padding: 0 12px; font-size: 12px; font-weight: 800; border-radius: 10px; display: inline-flex; align-items: center; gap: 6px;" title="Refresh Counter Records">
              <i class="fa-solid fa-arrows-rotate"></i>
            </button>
          </div>
        </div>

        <!-- 5-Card Executive Counter Scorecard Grid -->
        <div class="rep-kpi-grid counter-kpi-grid">
          
          <!-- Card 1: Net Sales Volume -->
          <div class="rep-kpi-card counter-kpi-card" id="counter-card-total">
            <div class="dash-kpi-icon-wrap rep-ring-coral">
              <i class="fa-solid fa-cash-register"></i>
            </div>
            <div class="rep-kpi-info">
              <div class="rep-kpi-val" id="counter-total-sales" style="color: #ff8a5c;">₹0</div>
              <div class="rep-kpi-label">Net Counter Collection</div>
              <div class="rep-kpi-badges">
                <span class="dash-sub-pill pill-neutral" id="counter-orders-active-pill"><i class="fa-solid fa-receipt"></i> 0 Valid Bills</span>
                <span class="dash-sub-pill pill-neutral" id="counter-orders-void-pill" style="display: none; color: #dc2626;"><i class="fa-solid fa-ban"></i> 0 Void</span>
              </div>
            </div>
          </div>

          <!-- Card 2: Cash in Till -->
          <div class="rep-kpi-card counter-kpi-card" id="counter-card-cash">
            <div class="dash-kpi-icon-wrap rep-ring-green">
              <i class="fa-solid fa-money-bill-wave"></i>
            </div>
            <div class="rep-kpi-info">
              <div class="rep-kpi-val" id="counter-cash-sales" style="color: #059669;">₹0</div>
              <div class="rep-kpi-label">Cash in Drawer (Till)</div>
              <div class="rep-kpi-badges">
                <span class="dash-sub-pill pill-cash" id="counter-cash-pct-pill">0% of total collections</span>
              </div>
            </div>
          </div>

          <!-- Card 3: UPI / QR Online Collection -->
          <div class="rep-kpi-card counter-kpi-card" id="counter-card-upi">
            <div class="dash-kpi-icon-wrap rep-ring-purple">
              <i class="fa-solid fa-qrcode"></i>
            </div>
            <div class="rep-kpi-info">
              <div class="rep-kpi-val" id="counter-upi-sales" style="color: #7c3aed;">₹0</div>
              <div class="rep-kpi-label">UPI / QR Collection</div>
              <div class="rep-kpi-badges">
                <span class="dash-sub-pill pill-upi" id="counter-upi-pct-pill">0% of total collections</span>
              </div>
            </div>
          </div>

          <!-- Card 4: Card Swipes -->
          <div class="rep-kpi-card counter-kpi-card" id="counter-card-card">
            <div class="dash-kpi-icon-wrap rep-ring-cyan">
              <i class="fa-solid fa-credit-card"></i>
            </div>
            <div class="rep-kpi-info">
              <div class="rep-kpi-val" id="counter-card-sales" style="color: #0284c7;">₹0</div>
              <div class="rep-kpi-label">Card Swipes (POS)</div>
              <div class="rep-kpi-badges">
                <span class="dash-sub-pill pill-neutral" id="counter-card-pct-pill">0% of total</span>
              </div>
            </div>
          </div>

          <!-- Card 5: Cash Drawer Balance & Tally Status -->
          <div class="rep-kpi-card counter-kpi-card" id="counter-drawer-card" style="cursor: pointer;" title="Click to view Cash Drawer Reconciliation">
            <div class="dash-kpi-icon-wrap rep-ring-amber" id="counter-drawer-icon">
              <i class="fa-solid fa-vault"></i>
            </div>
            <div class="rep-kpi-info">
              <div class="rep-kpi-val" id="counter-drawer-expected" style="color: #b45309;">₹0</div>
              <div class="rep-kpi-label">Drawer Expected vs Tally</div>
              <div class="rep-kpi-badges">
                <span class="growth-tag growth-up" id="counter-drawer-status-badge">Balanced</span>
              </div>
            </div>
          </div>

        </div>

        <!-- Live Visual Payment Split Mini-Ribbon -->
        <div class="glass-card" style="padding: 12px 18px; border-radius: 16px; background: #ffffff; border: 1px solid #f0f3f9; display: flex; flex-direction: column; gap: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 13.5px; font-weight: 800; color: var(--text-dark); display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-chart-pie" style="color: #2563eb;"></i> Live Payment Split Distribution
              </span>
              <span style="font-size: 11px; color: var(--text-muted); font-weight: 600;">(Real-time cashflow share)</span>
            </div>
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
              <span style="font-size: 11.5px; font-weight: 750; color: #059669; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 4px 10px; border-radius: 20px; display: inline-flex; align-items: center; gap: 5px;">
                <span style="width: 7px; height: 7px; border-radius: 50%; background: #10b981;"></span>
                Cash: <strong id="ribbon-cash-pct" style="color: #059669;">0% (₹0)</strong>
              </span>
              <span style="font-size: 11.5px; font-weight: 750; color: #7c3aed; background: #f5f3ff; border: 1px solid #ddd6fe; padding: 4px 10px; border-radius: 20px; display: inline-flex; align-items: center; gap: 5px;">
                <span style="width: 7px; height: 7px; border-radius: 50%; background: #8b5cf6;"></span>
                UPI QR: <strong id="ribbon-upi-pct" style="color: #7c3aed;">0% (₹0)</strong>
              </span>
              <span style="font-size: 11.5px; font-weight: 750; color: #0284c7; background: #f0f9ff; border: 1px solid #bae6fd; padding: 4px 10px; border-radius: 20px; display: inline-flex; align-items: center; gap: 5px;">
                <span style="width: 7px; height: 7px; border-radius: 50%; background: #0284c7;"></span>
                Card: <strong id="ribbon-card-pct" style="color: #0284c7;">0% (₹0)</strong>
              </span>
            </div>
          </div>

          <div style="width: 100%; height: 10px; background: #f1f5f9; border-radius: 8px; overflow: hidden; display: flex; padding: 1.5px; border: 1px solid #e2e8f0;">
            <div id="ribbon-bar-cash" style="width: 0%; height: 100%; background: linear-gradient(90deg, #10b981, #059669); border-radius: 6px; transition: width 0.4s ease;" title="Cash Share"></div>
            <div id="ribbon-bar-upi" style="width: 0%; height: 100%; background: linear-gradient(90deg, #8b5cf6, #7c3aed); border-radius: 6px; transition: width 0.4s ease;" title="UPI Share"></div>
            <div id="ribbon-bar-card" style="width: 0%; height: 100%; background: linear-gradient(90deg, #38bdf8, #0284c7); border-radius: 6px; transition: width 0.4s ease;" title="Card Share"></div>
          </div>
        </div>

        <!-- Sub-Tabs Navigation Strip -->
        <div class="glass-card" style="padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; border-radius: 16px; background: #ffffff; border: 1px solid #f0f3f9;">
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <button class="subtab-rep-btn ${this.activeTab === 'bills' ? 'active' : ''}" id="subtab-counter-bills">
              <i class="fa-solid fa-receipt"></i> Bills & Orders Stream
            </button>
            <button class="subtab-rep-btn ${this.activeTab === 'drawer' ? 'active' : ''}" id="subtab-counter-drawer">
              <i class="fa-solid fa-vault"></i> Cash Drawer & Denominations
            </button>
            <button class="subtab-rep-btn ${this.activeTab === 'velocity' ? 'active' : ''}" id="subtab-counter-velocity">
              <i class="fa-solid fa-chart-column"></i> Shift Rush & Velocity
            </button>
            <button class="subtab-rep-btn ${this.activeTab === 'shifts' ? 'active' : ''}" id="subtab-counter-shifts">
              <i class="fa-solid fa-clock-rotate-left"></i> Shift Settlement Audit
            </button>
          </div>
          <div style="font-size: 11.5px; font-weight: 700; color: #64748b; padding-right: 8px;" id="counter-subtab-indicator">
            <!-- Dynamic context indicator -->
          </div>
        </div>

        <!-- Sub-Tab Content Mount -->
        <div id="counter-subtab-mount"></div>

        <!-- Floating Multi-Select Bulk Action Bar -->
        <div id="counter-bulk-action-bar" style="display: none; position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 1000; background: #ffffff; border: 1.5px solid #2563eb; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.18); border-radius: 14px; padding: 10px 20px; align-items: center; gap: 16px; animation: slideUp 0.3s ease;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 28px; height: 28px; border-radius: 8px; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 13px;">
              <i class="fa-solid fa-check-double"></i>
            </div>
            <div>
              <div id="counter-bulk-count" style="font-size: 13px; font-weight: 800; color: var(--text-dark);">0 bills selected</div>
              <div id="counter-bulk-total" style="font-size: 11px; font-weight: 700; color: #2563eb;">Total: ₹0</div>
            </div>
          </div>

          <div style="height: 24px; width: 1px; background: var(--border-color);"></div>

          <div style="display: flex; gap: 8px; align-items: center;">
            <button type="button" class="btn btn-secondary" id="btn-bulk-export" style="height: 34px; padding: 0 12px; font-size: 11.5px; font-weight: 800; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-file-csv" style="color: #059669;"></i> Export Selected
            </button>
            <button type="button" class="btn btn-primary" id="btn-bulk-complete" style="height: 34px; padding: 0 14px; font-size: 11.5px; font-weight: 800; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-check"></i> Mark Completed
            </button>
            <button type="button" class="btn btn-secondary" id="btn-bulk-clear" style="height: 34px; padding: 0 10px; font-size: 11.5px; font-weight: 800; border-radius: 8px;" title="Clear Selection">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>

      </div>
    `;

    this.bindGlobalEvents();
    this.render();
  },

  bindGlobalEvents() {
    const datePicker = document.getElementById("counter-date-picker");
    const btnRefresh = document.getElementById("btn-counter-refresh");
    const drawerCard = document.getElementById("counter-drawer-card");
    const btnExpense = document.getElementById("btn-counter-expense");
    const btnExportCsv = document.getElementById("btn-export-csv");
    const btnPrintSummary = document.getElementById("btn-print-daysummary");
    const btnCloseShift = document.getElementById("btn-counter-close-shift");

    const tabBills = document.getElementById("subtab-counter-bills");
    const tabDrawer = document.getElementById("subtab-counter-drawer");
    const tabVelocity = document.getElementById("subtab-counter-velocity");
    const tabShifts = document.getElementById("subtab-counter-shifts");

    const switchSubTab = (tab) => {
      this.activeTab = tab;
      if (tabBills) tabBills.className = `subtab-rep-btn ${this.activeTab === "bills" ? "active" : ""}`;
      if (tabDrawer) tabDrawer.className = `subtab-rep-btn ${this.activeTab === "drawer" ? "active" : ""}`;
      if (tabVelocity) tabVelocity.className = `subtab-rep-btn ${this.activeTab === "velocity" ? "active" : ""}`;
      if (tabShifts) tabShifts.className = `subtab-rep-btn ${this.activeTab === "shifts" ? "active" : ""}`;
      this.renderSubTab();
    };

    if (tabBills) tabBills.onclick = () => switchSubTab("bills");
    if (tabDrawer) tabDrawer.onclick = () => switchSubTab("drawer");
    if (tabVelocity) tabVelocity.onclick = () => switchSubTab("velocity");
    if (tabShifts) tabShifts.onclick = () => switchSubTab("shifts");
    if (drawerCard) drawerCard.onclick = () => switchSubTab("drawer");

    // Quick Time Presets
    document.querySelectorAll(".counter-time-pill").forEach(pill => {
      pill.onclick = () => {
        document.querySelectorAll(".counter-time-pill").forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        this.selectedPeriod = pill.getAttribute("data-period");

        const today = new Date();
        if (this.selectedPeriod === "today") {
          this.activeDateStr = this.getIstDateString(today);
          if (datePicker) datePicker.value = this.activeDateStr;
        } else if (this.selectedPeriod === "yesterday") {
          const yest = new Date();
          yest.setDate(yest.getDate() - 1);
          this.activeDateStr = this.getIstDateString(yest);
          if (datePicker) datePicker.value = this.activeDateStr;
        }

        this.selectedOrderIds.clear();
        this.loadSavedDenominations();
        this.render();
      };
    });

    if (datePicker) {
      datePicker.onchange = (e) => {
        this.activeDateStr = e.target.value;
        this.selectedPeriod = "custom";
        document.querySelectorAll(".counter-time-pill").forEach(p => p.classList.remove("active"));
        this.selectedOrderIds.clear();
        this.loadSavedDenominations();
        this.render();
      };
    }

    if (btnRefresh) {
      btnRefresh.onclick = () => {
        this.render();
        window.showToast("Daily Counter refreshed.", "info");
      };
    }

    if (btnExpense) {
      btnExpense.onclick = () => this.openQuickCashOutModal();
    }

    if (btnExportCsv) {
      btnExportCsv.onclick = () => this.exportOrdersToCsv();
    }

    if (btnPrintSummary) {
      btnPrintSummary.onclick = () => this.showDaySummaryPrintModal();
    }

    if (btnCloseShift) {
      btnCloseShift.onclick = () => this.openShiftCloseWizardModal();
    }

    // Bulk actions bar event listeners
    const btnBulkExport = document.getElementById("btn-bulk-export");
    const btnBulkComplete = document.getElementById("btn-bulk-complete");
    const btnBulkClear = document.getElementById("btn-bulk-clear");

    if (btnBulkExport) {
      btnBulkExport.onclick = () => this.exportSelectedBillsToCsv();
    }

    if (btnBulkComplete) {
      btnBulkComplete.onclick = () => this.bulkMarkCompleted();
    }

    if (btnBulkClear) {
      btnBulkClear.onclick = () => {
        this.selectedOrderIds.clear();
        this.updateBulkActionBar();
        this.renderTableOnly();
      };
    }
  },

  getOpeningFloat() {
    const key = `crust_opening_float_${this.activeDateStr}`;
    const saved = localStorage.getItem(key);
    if (saved !== null && !isNaN(Number(saved))) {
      return Number(saved);
    }
    const settings = (window.db && window.db.get("settings")) || {};
    return Number(settings.defaultOpeningFloat) || 1000;
  },

  promptEditOpeningFloat() {
    const current = this.getOpeningFloat();
    const res = prompt(`Enter Morning Opening Cash Float for ${this.activeDateStr} (₹):`, current);
    if (res !== null) {
      const num = Math.max(0, Number(res) || 0);
      localStorage.setItem(`crust_opening_float_${this.activeDateStr}`, num);
      window.showToast(`Opening cash float set to ₹${num.toLocaleString("en-IN")}`, "success");
      this.recalculateDrawerMath();
    }
  },

  saveAndRecalcDenominations() {
    try {
      localStorage.setItem(`crust_denom_${this.activeDateStr}`, JSON.stringify(this.denominations));
    } catch (e) {}
    this.recalculateDrawerMath();
  },

  getFilteredOrdersByPeriod(allOrders) {
    const now = new Date();
    const todayStr = this.getLocalDateStr(now);

    if (this.selectedPeriod === "all") {
      return allOrders;
    }

    if (this.selectedPeriod === "today") {
      return allOrders.filter(o => this.getOrderDateStr(o) === todayStr);
    }

    if (this.selectedPeriod === "yesterday") {
      const yest = new Date();
      yest.setDate(yest.getDate() - 1);
      const yestStr = this.getLocalDateStr(yest);
      return allOrders.filter(o => this.getOrderDateStr(o) === yestStr);
    }

    if (this.selectedPeriod === "week") {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      const startStr = this.getLocalDateStr(sevenDaysAgo);
      return allOrders.filter(o => {
        const dStr = this.getOrderDateStr(o);
        return dStr >= startStr && dStr <= todayStr;
      });
    }

    if (this.selectedPeriod === "month") {
      const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
      const currentYear = String(now.getFullYear());
      const prefix = `${currentYear}-${currentMonth}`;
      return allOrders.filter(o => this.getOrderDateStr(o).startsWith(prefix));
    }

    // Default to activeDateStr (Custom calendar selection)
    const targetDate = this.activeDateStr || todayStr;
    return allOrders.filter(o => this.getOrderDateStr(o) === targetDate);
  },

  render() {
    try {
      this.renderKpis();
    } catch (err) {
      console.error("Counter: renderKpis failed:", err);
    }
    try {
      this.renderSubTab();
    } catch (err) {
      console.error("Counter: renderSubTab failed:", err);
    }
  },

  renderKpis() {
    const allOrders = (window.db && window.db.get("orders")) || [];
    const settings = (window.db && window.db.get("settings")) || {};
    const currency = settings.currencySymbol || "₹";

    const periodOrders = this.getFilteredOrdersByPeriod(allOrders);
    const validOrders = periodOrders.filter(o => o.status !== "Cancelled");
    const cancelledOrders = periodOrders.filter(o => o.status === "Cancelled");

    // Dynamic Multi-Payment Attribution (Cash, UPI, Card, Split)
    let cashSales = 0;
    let upiSales = 0;
    let cardSales = 0;
    let cashBillsCount = 0;
    let upiBillsCount = 0;
    let cardBillsCount = 0;

    validOrders.forEach(o => {
      const pm = (o.paymentMethod || "Cash").toLowerCase();
      const tot = Number(o.total) || 0;
      if (pm === "cash") {
        cashSales += tot;
        cashBillsCount++;
      } else if (pm === "upi") {
        upiSales += tot;
        upiBillsCount++;
      } else if (pm === "card") {
        cardSales += tot;
        cardBillsCount++;
      } else if (pm === "split" && o.splitDetails) {
        const c = Number(o.splitDetails.cash) || 0;
        const u = Number(o.splitDetails.upi) || 0;
        const cr = Number(o.splitDetails.card) || 0;
        cashSales += c;
        upiSales += u;
        cardSales += cr;
        if (c > 0) cashBillsCount++;
        if (u > 0) upiBillsCount++;
        if (cr > 0) cardBillsCount++;
      } else {
        cashSales += tot;
        cashBillsCount++;
      }
    });

    const netSales = validOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    // Percentage shares
    const cashPct = netSales > 0 ? Math.round((cashSales / netSales) * 100) : 0;
    const upiPct = netSales > 0 ? Math.round((upiSales / netSales) * 100) : 0;
    const cardPct = netSales > 0 ? Math.round((cardSales / netSales) * 100) : 0;

    // Update Top Scorecard Elements
    const totalEl = document.getElementById("counter-total-sales");
    const ordersEl = document.getElementById("counter-orders-count");
    const activePill = document.getElementById("counter-orders-active-pill");
    const voidPill = document.getElementById("counter-orders-void-pill");

    const cashEl = document.getElementById("counter-cash-sales");
    const cashCountEl = document.getElementById("counter-cash-count");
    const cashPctPill = document.getElementById("counter-cash-pct-pill");

    const upiEl = document.getElementById("counter-upi-sales");
    const upiCountEl = document.getElementById("counter-upi-count");
    const upiPctPill = document.getElementById("counter-upi-pct-pill");

    const cardEl = document.getElementById("counter-card-sales");
    const cardCountEl = document.getElementById("counter-card-count");
    const cardPctPill = document.getElementById("counter-card-pct-pill");

    if (totalEl) totalEl.textContent = `${currency}${Math.round(netSales).toLocaleString("en-IN")}`;
    if (ordersEl) ordersEl.textContent = `${validOrders.length} valid bills placed`;
    if (activePill) activePill.innerHTML = `<i class="fa-solid fa-receipt"></i> ${validOrders.length} Completed`;
    if (voidPill) {
      if (cancelledOrders.length > 0) {
        voidPill.style.display = "inline-flex";
        voidPill.innerHTML = `<i class="fa-solid fa-ban"></i> ${cancelledOrders.length} Void`;
      } else {
        voidPill.style.display = "none";
      }
    }

    if (cashEl) cashEl.textContent = `${currency}${Math.round(cashSales).toLocaleString("en-IN")}`;
    if (cashCountEl) cashCountEl.textContent = `${cashBillsCount} Cash Bills`;
    if (cashPctPill) cashPctPill.textContent = `${cashPct}% of total collections`;

    if (upiEl) upiEl.textContent = `${currency}${Math.round(upiSales).toLocaleString("en-IN")}`;
    if (upiCountEl) upiCountEl.textContent = `${upiBillsCount} UPI QR Bills`;
    if (upiPctPill) upiPctPill.textContent = `${upiPct}% of total collections`;

    if (cardEl) cardEl.textContent = `${currency}${Math.round(cardSales).toLocaleString("en-IN")}`;
    if (cardCountEl) cardCountEl.textContent = `${cardBillsCount} Card Swipes`;
    if (cardPctPill) cardPctPill.textContent = `${cardPct}% of total collections`;

    // Update Visual Payment Split Ribbon
    const ribbonCash = document.getElementById("ribbon-bar-cash");
    const ribbonUpi = document.getElementById("ribbon-bar-upi");
    const ribbonCard = document.getElementById("ribbon-bar-card");
    const ribbonCashPct = document.getElementById("ribbon-cash-pct");
    const ribbonUpiPct = document.getElementById("ribbon-upi-pct");
    const ribbonCardPct = document.getElementById("ribbon-card-pct");

    if (ribbonCash) ribbonCash.style.width = `${cashPct}%`;
    if (ribbonUpi) ribbonUpi.style.width = `${upiPct}%`;
    if (ribbonCard) ribbonCard.style.width = `${cardPct}%`;
    if (ribbonCashPct) ribbonCashPct.textContent = `${cashPct}% (₹${Math.round(cashSales).toLocaleString("en-IN")})`;
    if (ribbonUpiPct) ribbonUpiPct.textContent = `${upiPct}% (₹${Math.round(upiSales).toLocaleString("en-IN")})`;
    if (ribbonCardPct) ribbonCardPct.textContent = `${cardPct}% (₹${Math.round(cardSales).toLocaleString("en-IN")})`;

    this.recalculateDrawerMath();
  },

  renderSubTab() {
    const mount = document.getElementById("counter-subtab-mount");
    if (!mount) return;

    const ind = document.getElementById("counter-subtab-indicator");
    if (ind) {
      if (this.activeTab === "bills") {
        ind.innerHTML = `<i class="fa-solid fa-circle-check" style="color: #059669;"></i> Real-time orders audit`;
      } else if (this.activeTab === "drawer") {
        ind.innerHTML = `<i class="fa-solid fa-shield-halved" style="color: #2563eb;"></i> Physical cash reconciliation`;
      } else if (this.activeTab === "velocity") {
        ind.innerHTML = `<i class="fa-solid fa-fire" style="color: #d97706;"></i> Rush & peak throughput`;
      } else if (this.activeTab === "shifts") {
        ind.innerHTML = `<i class="fa-solid fa-clock-rotate-left" style="color: #6366f1;"></i> Shift closing audit log`;
      }
    }

    if (this.activeTab === "bills") {
      this.renderBillsTab(mount);
    } else if (this.activeTab === "drawer") {
      this.renderDrawerTab(mount);
    } else if (this.activeTab === "velocity") {
      this.renderVelocityTab(mount);
    } else if (this.activeTab === "shifts") {
      this.renderShiftsTab(mount);
    }
  },

  // =========================================================================
  // SUB-TAB 1: BILLS & ORDERS AUDIT STREAM (WITH QUICK FILTER CHIPS & BULK)
  // =========================================================================
  renderBillsTab(mount) {
    const allOrders = (window.db && window.db.get("orders")) || [];
    const periodOrders = this.getFilteredOrdersByPeriod(allOrders);
    const validOrders = periodOrders.filter(o => o.status !== "Cancelled");
    const cashCount = validOrders.filter(o => (o.paymentMethod || "Cash").toLowerCase() === "cash").length;
    const upiCount = validOrders.filter(o => (o.paymentMethod || "").toLowerCase() === "upi").length;
    const cardCount = validOrders.filter(o => (o.paymentMethod || "").toLowerCase() === "card").length;
    const dineInCount = validOrders.filter(o => (o.type || "Dine-in") === "Dine-in").length;
    const takeawayCount = validOrders.filter(o => (o.type || "Dine-in") === "Takeaway").length;
    const voidCount = periodOrders.filter(o => o.status === "Cancelled").length;

    mount.innerHTML = `
      <div class="glass-card view-animate" style="padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; border-radius: 16px; background: #ffffff; border: 1px solid #f0f3f9;">
        
        <!-- Header & Top Filter Row -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div>
            <h3 style="font-size: 15px; font-weight: 900; color: var(--text-dark); margin: 0 0 2px 0; display: flex; align-items: center; gap: 8px;">
              <i class="fa-solid fa-receipt" style="color: #2563eb;"></i> Bills Audit & Orders Stream
            </h3>
            <p style="font-size: 11.5px; color: var(--text-muted); margin: 0; font-weight: 600;">
              Tap any bill to expand items • Select multiple for bulk operations • Switch payment • WhatsApp receipt.
            </p>
          </div>

          <!-- Live Search Box with Instant Clear -->
          <div class="counter-search-box" style="position: relative; width: 260px;">
            <input type="text" id="counter-search-input" class="form-input" placeholder="Search Bill# / Token / Phone / Item..." value="${this.searchQuery}" style="padding: 6px 30px 6px 32px; font-size: 12px; height: 36px; border-radius: 10px; width: 100%;">
            <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 10px; top: 11px; color: var(--text-muted); font-size: 12px; pointer-events: none;"></i>
            ${this.searchQuery ? `
              <button type="button" id="btn-clear-search" style="position: absolute; right: 8px; top: 8px; border: none; background: #e2e8f0; color: var(--text-dark); width: 20px; height: 20px; border-radius: 50%; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                <i class="fa-solid fa-xmark"></i>
              </button>
            ` : ''}
          </div>
        </div>

        <!-- 1-Tap Quick Filter Chips Strip -->
        <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap; background: #f8fafc; padding: 6px 8px; border-radius: 10px; border: 1px solid var(--border-color);">
          <span style="font-size: 11px; font-weight: 800; color: var(--text-muted); margin-right: 4px; text-transform: uppercase;">Quick Filter:</span>
          
          <button type="button" class="counter-quick-chip ${this.quickFilterChip === 'all' ? 'active' : ''}" data-chip="all">
            All Bills <span class="chip-badge">${periodOrders.length}</span>
          </button>
          
          <button type="button" class="counter-quick-chip ${this.quickFilterChip === 'cash' ? 'active' : ''}" data-chip="cash">
            <i class="fa-solid fa-money-bill-wave" style="color: #059669;"></i> Cash <span class="chip-badge">${cashCount}</span>
          </button>

          <button type="button" class="counter-quick-chip ${this.quickFilterChip === 'upi' ? 'active' : ''}" data-chip="upi">
            <i class="fa-solid fa-qrcode" style="color: #7c3aed;"></i> UPI QR <span class="chip-badge">${upiCount}</span>
          </button>

          <button type="button" class="counter-quick-chip ${this.quickFilterChip === 'card' ? 'active' : ''}" data-chip="card">
            <i class="fa-solid fa-credit-card" style="color: #2563eb;"></i> Card <span class="chip-badge">${cardCount}</span>
          </button>

          <button type="button" class="counter-quick-chip ${this.quickFilterChip === 'dinein' ? 'active' : ''}" data-chip="dinein">
            <i class="fa-solid fa-utensils" style="color: #0284c7;"></i> Dine-in <span class="chip-badge">${dineInCount}</span>
          </button>

          <button type="button" class="counter-quick-chip ${this.quickFilterChip === 'takeaway' ? 'active' : ''}" data-chip="takeaway">
            <i class="fa-solid fa-bag-shopping" style="color: #d97706;"></i> Takeaway <span class="chip-badge">${takeawayCount}</span>
          </button>

          ${voidCount > 0 ? `
            <button type="button" class="counter-quick-chip ${this.quickFilterChip === 'void' ? 'active' : ''}" data-chip="void" style="border-color: #fca5a5;">
              <i class="fa-solid fa-ban" style="color: #dc2626;"></i> Void Bills <span class="chip-badge" style="background: #fef2f2; color: #dc2626;">${voidCount}</span>
            </button>
          ` : ''}

          <div style="margin-left: auto; display: flex; gap: 8px; align-items: center;">
            <select id="counter-sort-by" class="form-input" style="height: 30px; font-size: 11px; font-weight: 700; border-radius: 8px; width: 120px; padding: 2px 6px;">
              <option value="newest" ${this.sortBy === 'newest' ? 'selected' : ''}>Newest First</option>
              <option value="oldest" ${this.sortBy === 'oldest' ? 'selected' : ''}>Oldest First</option>
              <option value="highest" ${this.sortBy === 'highest' ? 'selected' : ''}>Highest ₹</option>
              <option value="lowest" ${this.sortBy === 'lowest' ? 'selected' : ''}>Lowest ₹</option>
            </select>
          </div>
        </div>

        <!-- Matching records summary banner -->
        <div style="display: flex; justify-content: space-between; align-items: center; background: #ffffff; padding: 6px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 11.5px; color: var(--text-muted);">
          <span id="counter-records-count" style="font-weight: 700; color: var(--text-dark);">Showing 0 bills</span>
          <span id="counter-records-amount" style="font-weight: 800; color: #2563eb;">Total: ₹0</span>
        </div>

        <!-- Orders Table Container -->
        <div class="table-container" style="max-height: 520px; overflow-y: auto; overflow-x: auto; width: 100%; -webkit-overflow-scrolling: touch; border-radius: 10px; border: 1px solid var(--border-color);">
          <table class="premium-table">
            <thead>
              <tr>
                <th style="width: 36px; text-align: center;">
                  <input type="checkbox" id="counter-select-all-checkbox" style="cursor: pointer; width: 15px; height: 15px;">
                </th>
                <th style="min-width: 120px;">Bill # / Token</th>
                <th>Time & Date</th>
                <th>Customer & Type</th>
                <th style="min-width: 180px;">Items Summary</th>
                <th>Payment</th>
                <th>Discount</th>
                <th style="text-align: right;">Total Amount</th>
                <th>Status</th>
                <th style="text-align: center; min-width: 160px;">Actions</th>
              </tr>
            </thead>
            <tbody id="counter-orders-table-body">
              <!-- Rendered dynamically -->
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.bindBillsViewEvents(mount);
    this.renderTableOnly();
  },

  bindBillsViewEvents(mount) {
    const searchInput = mount.querySelector("#counter-search-input");
    const btnClearSearch = mount.querySelector("#btn-clear-search");
    const sortBy = mount.querySelector("#counter-sort-by");
    const selectAllCheckbox = mount.querySelector("#counter-select-all-checkbox");

    if (searchInput) {
      searchInput.oninput = (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        this.renderTableOnly();
      };
    }

    if (btnClearSearch) {
      btnClearSearch.onclick = () => {
        this.searchQuery = "";
        if (searchInput) searchInput.value = "";
        this.renderBillsTab(document.getElementById("counter-subtab-mount"));
      };
    }

    if (sortBy) {
      sortBy.onchange = (e) => {
        this.sortBy = e.target.value;
        this.renderTableOnly();
      };
    }

    // Quick filter chips click
    mount.querySelectorAll(".counter-quick-chip").forEach(chip => {
      chip.onclick = () => {
        mount.querySelectorAll(".counter-quick-chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        this.quickFilterChip = chip.getAttribute("data-chip");
        this.renderTableOnly();
      };
    });

    // Select all visible checkbox
    if (selectAllCheckbox) {
      selectAllCheckbox.onchange = (e) => {
        const isChecked = e.target.checked;
        const visibleOrderIds = this.getCurrentlyFilteredOrderIds();
        if (isChecked) {
          visibleOrderIds.forEach(id => this.selectedOrderIds.add(id));
        } else {
          visibleOrderIds.forEach(id => this.selectedOrderIds.delete(id));
        }
        this.updateBulkActionBar();
        this.renderTableOnly();
      };
    }
  },

  getCurrentlyFilteredOrderIds() {
    const allOrders = (window.db && window.db.get("orders")) || [];
    let orders = this.getFilteredOrdersByPeriod(allOrders);

    // Apply quick chip filter
    if (this.quickFilterChip === "cash") {
      orders = orders.filter(o => o.status !== "Cancelled" && (o.paymentMethod || "Cash").toLowerCase() === "cash");
    } else if (this.quickFilterChip === "upi") {
      orders = orders.filter(o => o.status !== "Cancelled" && (o.paymentMethod || "").toLowerCase() === "upi");
    } else if (this.quickFilterChip === "card") {
      orders = orders.filter(o => o.status !== "Cancelled" && (o.paymentMethod || "").toLowerCase() === "card");
    } else if (this.quickFilterChip === "dinein") {
      orders = orders.filter(o => o.status !== "Cancelled" && (o.type || "Dine-in") === "Dine-in");
    } else if (this.quickFilterChip === "takeaway") {
      orders = orders.filter(o => o.status !== "Cancelled" && (o.type || "Dine-in") === "Takeaway");
    } else if (this.quickFilterChip === "void") {
      orders = orders.filter(o => o.status === "Cancelled");
    }

    if (this.searchQuery) {
      const q = this.searchQuery;
      orders = orders.filter(o => {
        const id = (o.id || "").toLowerCase();
        const num = String(o.orderNumber || "").toLowerCase();
        const tok = String(o.tokenNumber || "");
        const name = (o.customerName || "").toLowerCase();
        const phone = String(o.customerPhone || "");
        const items = (o.items || []).map(i => i.name.toLowerCase()).join(" ");
        return id.includes(q) || num.includes(q) || tok.includes(q) || name.includes(q) || phone.includes(q) || items.includes(q);
      });
    }

    return orders.map(o => o.id);
  },

  updateBulkActionBar() {
    const bar = document.getElementById("counter-bulk-action-bar");
    const countEl = document.getElementById("counter-bulk-count");
    const totalEl = document.getElementById("counter-bulk-total");
    if (!bar) return;

    if (this.selectedOrderIds.size === 0) {
      bar.style.display = "none";
      return;
    }

    bar.style.display = "flex";
    const allOrders = (window.db && window.db.get("orders")) || [];
    const settings = (window.db && window.db.get("settings")) || {};
    const currency = settings.currencySymbol || "₹";

    const selectedOrders = allOrders.filter(o => this.selectedOrderIds.has(o.id));
    const totalSum = selectedOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    if (countEl) countEl.textContent = `${this.selectedOrderIds.size} bills selected`;
    if (totalEl) totalEl.textContent = `Total: ${currency}${Math.round(totalSum).toLocaleString("en-IN")}`;
  },

  renderTableOnly() {
    const allOrders = (window.db && window.db.get("orders")) || [];
    const settings = (window.db && window.db.get("settings")) || {};
    const currency = settings.currencySymbol || "₹";

    // 1. Period filter
    let orders = this.getFilteredOrdersByPeriod(allOrders);

    // 2. Quick filter chip
    if (this.quickFilterChip === "cash") {
      orders = orders.filter(o => o.status !== "Cancelled" && (o.paymentMethod || "Cash").toLowerCase() === "cash");
    } else if (this.quickFilterChip === "upi") {
      orders = orders.filter(o => o.status !== "Cancelled" && (o.paymentMethod || "").toLowerCase() === "upi");
    } else if (this.quickFilterChip === "card") {
      orders = orders.filter(o => o.status !== "Cancelled" && (o.paymentMethod || "").toLowerCase() === "card");
    } else if (this.quickFilterChip === "dinein") {
      orders = orders.filter(o => o.status !== "Cancelled" && (o.type || "Dine-in") === "Dine-in");
    } else if (this.quickFilterChip === "takeaway") {
      orders = orders.filter(o => o.status !== "Cancelled" && (o.type || "Dine-in") === "Takeaway");
    } else if (this.quickFilterChip === "void") {
      orders = orders.filter(o => o.status === "Cancelled");
    }

    // 3. Search Query
    if (this.searchQuery) {
      const q = this.searchQuery;
      orders = orders.filter(o => {
        const id = (o.id || "").toLowerCase();
        const num = String(o.orderNumber || "").toLowerCase();
        const tok = String(o.tokenNumber || "");
        const name = (o.customerName || "").toLowerCase();
        const phone = String(o.customerPhone || "");
        const items = (o.items || []).map(i => i.name.toLowerCase()).join(" ");
        return id.includes(q) || num.includes(q) || tok.includes(q) || name.includes(q) || phone.includes(q) || items.includes(q);
      });
    }

    // 4. Sorting
    orders = [...orders].sort((a, b) => {
      if (this.sortBy === "newest") {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      } else if (this.sortBy === "oldest") {
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      } else if (this.sortBy === "highest") {
        return (Number(b.total) || 0) - (Number(a.total) || 0);
      } else if (this.sortBy === "lowest") {
        return (Number(a.total) || 0) - (Number(b.total) || 0);
      }
      return 0;
    });

    // Update banner summary
    const countEl = document.getElementById("counter-records-count");
    const amountEl = document.getElementById("counter-records-amount");
    const totalMatching = orders.filter(o => o.status !== "Cancelled").reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    if (countEl) countEl.textContent = `Showing ${orders.length} orders (${orders.filter(o => o.status !== "Cancelled").length} active bills)`;
    if (amountEl) amountEl.textContent = `Total Realized: ${currency}${Math.round(totalMatching).toLocaleString("en-IN")}`;

    const tbody = document.getElementById("counter-orders-table-body");
    if (!tbody) return;

    if (orders.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align: center; color: var(--text-muted); padding: 45px; font-weight: 600;">
            <i class="fa-solid fa-receipt" style="font-size: 32px; opacity: 0.3; display: block; margin-bottom: 8px;"></i>
            No orders found matching your selected criteria.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = orders.map(o => {
      const orderDate = new Date(o.createdAt);
      const timeStr = orderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateStr = this.selectedPeriod !== "today" && this.selectedPeriod !== "yesterday"
        ? `${orderDate.toLocaleDateString("en-IN", { day: '2-digit', month: 'short' })} `
        : "";

      const itemCount = (o.items || []).reduce((sum, i) => sum + (i.quantity || 1), 0);
      const itemsBrief = (o.items || []).map(i => `${i.name} (x${i.quantity})`).join(", ");

      let statusBadge = "badge-pending";
      if (o.status === "Preparing") statusBadge = "badge-preparing";
      if (o.status === "Ready") statusBadge = "badge-ready";
      if (o.status === "Completed") statusBadge = "badge-completed";
      if (o.status === "Cancelled") statusBadge = "badge-cancelled";

      const pm = (o.paymentMethod || "Cash").toLowerCase();
      let payBadge = `<span style="background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 2px 7px; border-radius: 8px; font-size: 11px; font-weight: 800;"><i class="fa-solid fa-money-bill"></i> Cash</span>`;
      if (pm === "upi") {
        payBadge = `<span style="background: #f5f3ff; color: #7c3aed; border: 1px solid #ddd6fe; padding: 2px 7px; border-radius: 8px; font-size: 11px; font-weight: 800;"><i class="fa-solid fa-qrcode"></i> UPI</span>`;
      } else if (pm === "card") {
        payBadge = `<span style="background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; padding: 2px 7px; border-radius: 8px; font-size: 11px; font-weight: 800;"><i class="fa-solid fa-credit-card"></i> Card</span>`;
      }

      const discTotal = (Number(o.bogoDiscount) || 0) + (Number(o.discount) || 0);
      const discTag = discTotal > 0
        ? `<span style="color: #16a34a; font-weight: 800; font-size: 11px;">-${currency}${discTotal.toFixed(0)}</span>`
        : `<span style="color: var(--text-muted); font-size: 11px;">-</span>`;

      const typeBadge = (o.type || "Dine-in") === "Takeaway"
        ? `<span style="background: #fffbeb; color: #b45309; border: 1px solid #fde68a; padding: 1px 6px; border-radius: 6px; font-size: 10px; font-weight: 800;">Takeaway</span>`
        : `<span style="background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; padding: 1px 6px; border-radius: 6px; font-size: 10px; font-weight: 800;">Dine-in</span>`;

      const isCancelled = o.status === "Cancelled";
      const isExpanded = this.expandedOrderId === o.id;
      const isSelected = this.selectedOrderIds.has(o.id);

      // Expanded items row preview
      const expandedDetailsHtml = isExpanded ? `
        <tr class="bill-expanded-row" style="background: #f8fafc;">
          <td colspan="10" style="padding: 12px 18px; border-top: none; border-bottom: 2px solid #cbd5e1;">
            <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 10px; padding: 12px 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed var(--border-color); padding-bottom: 6px; margin-bottom: 8px;">
                <span style="font-size: 12px; font-weight: 800; color: #2563eb;">Itemized Bill Breakdown:</span>
                <span style="font-size: 11px; color: var(--text-muted);">Timestamp: ${new Date(o.createdAt).toLocaleString("en-IN")}</span>
              </div>
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px;">
                ${(o.items || []).map(it => `
                  <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 6px 10px; font-size: 12px;">
                    <div>
                      <strong style="color: var(--text-dark);">${it.name}</strong>
                      <span style="color: var(--text-muted); font-size: 11px; margin-left: 4px;">x${it.quantity}</span>
                    </div>
                    <span style="font-weight: 800; color: #2563eb;">${currency}${Number(it.lineTotal || (it.price * it.quantity)).toFixed(2)}</span>
                  </div>
                `).join("")}
              </div>
            </div>
          </td>
        </tr>
      ` : '';

      return `
        <tr class="bill-row-clickable ${isCancelled ? 'table-row-dimmed' : ''} ${isSelected ? 'row-selected' : ''}" data-id="${o.id}" style="${isCancelled ? 'opacity: 0.6; background: #fff5f5;' : isSelected ? 'background: #eff6ff;' : ''} cursor: pointer;">
          <td style="text-align: center;" onclick="event.stopPropagation();">
            <input type="checkbox" class="counter-bill-checkbox" data-id="${o.id}" ${isSelected ? 'checked' : ''} style="cursor: pointer; width: 15px; height: 15px;">
          </td>
          <td>
            <div style="font-weight: 800; color: var(--text-dark); font-size: 13.5px; display: flex; align-items: center; gap: 5px;">
              <i class="fa-solid fa-chevron-${isExpanded ? 'down' : 'right'}" style="font-size: 10px; color: #94a3b8;"></i>
              #${o.orderNumber || o.id}
            </div>
            <div style="font-size: 11px; font-weight: 800; color: #2563eb; margin-left: 15px;">Token #${o.tokenNumber || 1}</div>
          </td>
          <td>
            <div style="font-size: 12px; font-weight: 700; color: var(--text-dark);">${timeStr}</div>
            <div style="font-size: 10.5px; color: var(--text-muted);">${dateStr}</div>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-weight: 700; color: var(--text-dark);">${o.customerName || "Walk-in Guest"}</span>
              ${typeBadge}
            </div>
            <div style="font-size: 11px; color: var(--text-muted);">${o.customerPhone || "No phone"}</div>
          </td>
          <td style="max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px; color: var(--text-dark);" title="${itemsBrief}">
            <strong style="color: #2563eb;">${itemCount}x</strong> ${itemsBrief}
          </td>
          <td>${payBadge}</td>
          <td>${discTag}</td>
          <td style="text-align: right; font-weight: 900; color: ${isCancelled ? '#94a3b8' : '#2563eb'}; font-size: 14px; ${isCancelled ? 'text-decoration: line-through;' : ''}">
            ${currency}${Number(o.total || 0).toFixed(2)}
          </td>
          <td><span class="badge ${statusBadge}">${o.status}</span></td>
          <td style="text-align: center;" onclick="event.stopPropagation();">
            <div style="display: flex; align-items: center; justify-content: center; gap: 5px;">
              
              <!-- View / Reprint Bill -->
              <button class="btn btn-secondary btn-reprint-counter" data-id="${o.id}" title="View & Print 80mm Bill" style="padding: 5px 8px; font-size: 11px; border-radius: 8px; font-weight: 700;">
                <i class="fa-solid fa-receipt" style="color: #2563eb;"></i> View
              </button>
              
              <!-- WhatsApp Share -->
              <button class="btn-wa-share" data-id="${o.id}" title="Share Receipt on WhatsApp">
                <i class="fa-brands fa-whatsapp"></i> WA
              </button>

              ${!isCancelled ? `
                <!-- Switch Payment Mode -->
                <button class="btn-edit-paymode" data-id="${o.id}" title="Change Payment Mode (Cash/UPI/Card)">
                  <i class="fa-solid fa-repeat"></i>
                </button>
                
                <!-- Void Order -->
                <button class="btn-void-order" data-id="${o.id}" title="Cancel & Void this Bill">
                  <i class="fa-solid fa-ban"></i> Void
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
        ${expandedDetailsHtml}
      `;
    }).join("");

    // Bind row click for expandable items
    tbody.querySelectorAll(".bill-row-clickable").forEach(row => {
      row.onclick = () => {
        const orderId = row.getAttribute("data-id");
        this.expandedOrderId = this.expandedOrderId === orderId ? null : orderId;
        this.renderTableOnly();
      };
    });

    // Bind individual checkboxes
    tbody.querySelectorAll(".counter-bill-checkbox").forEach(chk => {
      chk.onchange = (e) => {
        const id = e.target.getAttribute("data-id");
        if (e.target.checked) {
          this.selectedOrderIds.add(id);
        } else {
          this.selectedOrderIds.delete(id);
        }
        this.updateBulkActionBar();
        this.renderTableOnly();
      };
    });

    // Bind action listeners
    tbody.querySelectorAll(".btn-reprint-counter").forEach(btn => {
      btn.onclick = () => {
        const orderId = btn.getAttribute("data-id");
        this.showReceiptModal(orderId);
      };
    });

    tbody.querySelectorAll(".btn-wa-share").forEach(btn => {
      btn.onclick = () => {
        const orderId = btn.getAttribute("data-id");
        this.shareOrderWhatsApp(orderId);
      };
    });

    tbody.querySelectorAll(".btn-edit-paymode").forEach(btn => {
      btn.onclick = () => {
        const orderId = btn.getAttribute("data-id");
        this.promptChangePaymentMode(orderId);
      };
    });

    tbody.querySelectorAll(".btn-void-order").forEach(btn => {
      btn.onclick = () => {
        const orderId = btn.getAttribute("data-id");
        this.promptVoidOrder(orderId);
      };
    });
  },

  exportSelectedBillsToCsv() {
    if (this.selectedOrderIds.size === 0) return;
    const allOrders = (window.db && window.db.get("orders")) || [];
    const selectedOrders = allOrders.filter(o => this.selectedOrderIds.has(o.id));
    this.generateAndDownloadCsv(selectedOrders, `Selected_Bills_${this.activeDateStr}`);
  },

  bulkMarkCompleted() {
    if (this.selectedOrderIds.size === 0) return;
    const count = this.selectedOrderIds.size;
    if (confirm(`Mark ${count} selected bill(s) as Completed?`)) {
      this.selectedOrderIds.forEach(id => {
        window.db.updateOrderStatus(id, "Completed");
      });
      window.showToast(`${count} orders marked Completed!`, "success");
      this.selectedOrderIds.clear();
      this.updateBulkActionBar();
      this.render();
    }
  },

  // =========================================================================
  // SUB-TAB 2: CASH DRAWER RECONCILIATION & DENOMINATIONS WORKSTATION
  // =========================================================================
  renderDrawerTab(mount) {
    const allExpenses = (window.db && window.db.get("expenses")) || [];
    const settings = (window.db && window.db.get("settings")) || {};
    const currency = settings.currencySymbol || "₹";

    // Cash expenses for active date
    const targetDate = this.activeDateStr;
    const periodExpenses = allExpenses.filter(e => {
      const eDate = e.date || (e.createdAt ? this.getIstDateString(new Date(e.createdAt)) : "");
      const isCash = (e.paymentMode || e.paymentMethod || "Cash").toLowerCase() === "cash";
      return isCash && (this.selectedPeriod === "all" || eDate === targetDate);
    });

    const expenseRowsHtml = periodExpenses.length === 0
      ? `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 25px; font-weight: 600;">No cash payouts recorded for ${this.activeDateStr}.</td></tr>`
      : periodExpenses.map(e => `
        <tr>
          <td style="font-weight: 700; color: var(--text-dark);">${e.title || e.description}</td>
          <td><span style="font-size: 11px; font-weight: 700; background: #eff6ff; color: #2563eb; padding: 2px 8px; border-radius: 6px;">${e.category || 'General'}</span></td>
          <td style="font-size: 11.5px; color: var(--text-muted);">${e.createdAt ? new Date(e.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}</td>
          <td style="font-weight: 900; color: #dc2626; text-align: right;">-${currency}${Number(e.amount).toFixed(2)}</td>
          <td style="text-align: center;">
            <button class="btn btn-secondary btn-delete-expense" data-id="${e.id}" title="Remove this expense entry" style="padding: 3px 8px; font-size: 11px; border-radius: 6px; color: #dc2626;">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </td>
        </tr>
      `).join("");

    mount.innerHTML = `
      <div class="view-animate" style="display: flex; flex-direction: column; gap: 14px;">
        
        <!-- Drawer Settlement Container -->
        <div class="counter-tally-box">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 10px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="width: 36px; height: 36px; border-radius: 10px; background: #ecfdf5; color: #059669; display: flex; align-items: center; justify-content: center; font-size: 18px;">
                <i class="fa-solid fa-vault"></i>
              </div>
              <div>
                <h4 style="margin: 0; font-size: 15px; font-weight: 800; color: var(--text-dark);">Cash Drawer Settlement & Notes Reconciliation</h4>
                <p style="margin: 2px 0 0 0; font-size: 11.5px; color: var(--text-muted);">Reconcile physical counted drawer notes with registered POS cash sales and petty payouts.</p>
              </div>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <button type="button" class="btn btn-secondary" id="btn-reset-denoms" style="height: 34px; font-size: 11.5px; padding: 0 12px; border-radius: 8px; font-weight: 700;">
                <i class="fa-solid fa-arrow-rotate-left"></i> Reset Notes
              </button>
              <button type="button" class="btn btn-primary" id="btn-print-tally-slip" style="height: 34px; font-size: 11.5px; padding: 0 14px; border-radius: 8px; font-weight: 800; box-shadow: 0 2px 8px rgba(37, 99, 235, 0.25);">
                <i class="fa-solid fa-print"></i> Print Tally Slip
              </button>
            </div>
          </div>

          <!-- Drawer Calculation Math Summary Row -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 16px;">
            
            <!-- Opening Float -->
            <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 12px; padding: 12px 14px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Opening Cash Float</span>
                <button type="button" id="btn-edit-float" title="Change Opening Cash Float" style="background: none; border: none; color: #2563eb; cursor: pointer; font-size: 11px; font-weight: 700;">
                  <i class="fa-solid fa-pen"></i> Edit
                </button>
              </div>
              <div id="tally-opening-float" style="font-size: 20px; font-weight: 900; color: var(--text-dark); margin-top: 4px;">₹1,000</div>
              <span style="font-size: 10.5px; color: var(--text-muted);">Morning shift base cash</span>
            </div>

            <!-- (+) Cash Sales -->
            <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 12px 14px;">
              <span style="font-size: 11px; font-weight: 700; color: #047857; text-transform: uppercase;">(+) Cash Sales</span>
              <div id="tally-cash-sales" style="font-size: 20px; font-weight: 900; color: #059669; margin-top: 4px;">₹0</div>
              <span id="tally-cash-bills-count" style="font-size: 10.5px; color: #065f46;">0 bills collected</span>
            </div>

            <!-- (-) Cash Paid Out / Expenses -->
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 12px 14px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11px; font-weight: 700; color: #b91c1c; text-transform: uppercase;">(-) Cash Expenses</span>
                <span id="tally-expense-count" style="font-size: 10.5px; color: #991b1b; font-weight: 700;">${periodExpenses.length} entries</span>
              </div>
              <div id="tally-cash-out" style="font-size: 20px; font-weight: 900; color: #dc2626; margin-top: 4px;">₹0</div>
              <span style="font-size: 10.5px; color: #991b1b;">Petty cash paid from till</span>
            </div>

            <!-- (=) Expected Drawer Cash -->
            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 12px 14px;">
              <span style="font-size: 11px; font-weight: 700; color: #1d4ed8; text-transform: uppercase;">(=) Expected in Drawer</span>
              <div id="tally-expected-cash" style="font-size: 20px; font-weight: 900; color: #2563eb; margin-top: 4px;">₹1,000</div>
              <span style="font-size: 10.5px; color: #1e40af;">Float + Cash In - Cash Out</span>
            </div>

            <!-- Physical Counted & Difference -->
            <div id="tally-diff-card" style="background: #f8fafc; border: 1.5px solid var(--border-color); border-radius: 12px; padding: 12px 14px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11px; font-weight: 700; color: var(--text-dark); text-transform: uppercase;">Physical Counted</span>
                <span id="tally-variance-badge" style="font-size: 10.5px; font-weight: 800; padding: 1px 6px; border-radius: 6px; background: #e2e8f0; color: var(--text-dark);">₹0 Diff</span>
              </div>
              <div id="tally-actual-cash" style="font-size: 20px; font-weight: 900; color: var(--text-dark); margin-top: 4px;">₹0</div>
              <span id="tally-variance-desc" style="font-size: 10.5px; color: var(--text-muted);">Enter denominations below</span>
            </div>
          </div>

          <!-- Currency Denomination Note Counters Grid with Quick Stepper Chips (+1, +5, +10) -->
          <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 12px; padding: 14px 16px;">
            <div style="font-size: 12.5px; font-weight: 800; color: var(--text-dark); margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
              <span style="display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-money-bill-1-wave" style="color: #059669;"></i> Physical Cash Note Breakdown:
              </span>
              <span style="font-size: 11px; color: var(--text-muted); font-weight: 600;">Type counts or tap +1 / +5 to tally fast</span>
            </div>
            
            <div class="counter-denom-grid">
              ${[500, 200, 100, 50, 20, 10].map(val => `
                <div class="counter-denom-item">
                  <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <span class="counter-denom-label">₹${val}</span>
                    <span id="denom-sub-${val}" style="font-size: 11.5px; font-weight: 800; color: #2563eb;">₹0</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 6px; width: 100%; margin-top: 4px;">
                    <input type="number" min="0" class="counter-denom-input" data-denom="${val}" value="${this.denominations[val] || ''}" placeholder="0" style="flex: 1;">
                    <div style="display: flex; gap: 2px;">
                      <button type="button" class="btn-denom-step" data-denom="${val}" data-step="1" title="Add 1 note">+1</button>
                      <button type="button" class="btn-denom-step" data-denom="${val}" data-step="5" title="Add 5 notes">+5</button>
                    </div>
                  </div>
                </div>
              `).join("")}

              <!-- Coins -->
              <div class="counter-denom-item">
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                  <span class="counter-denom-label">Coins (₹)</span>
                  <span id="denom-sub-coins" style="font-size: 11.5px; font-weight: 800; color: #2563eb;">₹0</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px; width: 100%; margin-top: 4px;">
                  <input type="number" min="0" class="counter-denom-input" data-denom="coins" value="${this.denominations.coins || ''}" placeholder="0" style="flex: 1;">
                  <div style="display: flex; gap: 2px;">
                    <button type="button" class="btn-denom-step" data-denom="coins" data-step="10" title="Add ₹10 coins">+10</button>
                    <button type="button" class="btn-denom-step" data-denom="coins" data-step="50" title="Add ₹50 coins">+50</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Petty Cash Payouts Log for this Period -->
        <div class="glass-card" style="padding: 16px 20px; border-radius: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
            <div>
              <h4 style="margin: 0; font-size: 14px; font-weight: 800; color: var(--text-dark);">
                <i class="fa-solid fa-hand-holding-dollar" style="color: #dc2626; margin-right: 6px;"></i> Till Cash Payouts & Expenses Log
              </h4>
              <p style="margin: 2px 0 0 0; font-size: 11.5px; color: var(--text-muted);">Expenses deducted directly from the cash drawer during this period.</p>
            </div>
            <button class="btn btn-secondary" id="btn-add-payout-secondary" style="height: 32px; font-size: 11.5px; font-weight: 800; border-radius: 8px;">
              <i class="fa-solid fa-plus"></i> Add Cash Out
            </button>
          </div>

          <div class="table-container" style="max-height: 250px; overflow-y: auto;">
            <table class="premium-table" style="font-size: 12.5px;">
              <thead>
                <tr>
                  <th>Description / Purpose</th>
                  <th>Category</th>
                  <th>Time</th>
                  <th style="text-align: right;">Amount</th>
                  <th style="text-align: center;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${expenseRowsHtml}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;

    this.bindDrawerEvents(mount);
    this.recalculateDrawerMath();
  },

  bindDrawerEvents(mount) {
    const btnEditFloat = mount.querySelector("#btn-edit-float");
    const btnResetDenoms = mount.querySelector("#btn-reset-denoms");
    const btnPrintTallySlip = mount.querySelector("#btn-print-tally-slip");
    const btnAddPayoutSec = mount.querySelector("#btn-add-payout-secondary");

    if (btnEditFloat) {
      btnEditFloat.onclick = () => this.promptEditOpeningFloat();
    }

    if (btnResetDenoms) {
      btnResetDenoms.onclick = () => {
        this.denominations = { 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, coins: 0 };
        mount.querySelectorAll(".counter-denom-input").forEach(input => input.value = "");
        this.saveAndRecalcDenominations();
      };
    }

    if (btnPrintTallySlip) {
      btnPrintTallySlip.onclick = () => this.printTallySlip();
    }

    if (btnAddPayoutSec) {
      btnAddPayoutSec.onclick = () => this.openQuickCashOutModal();
    }

    // Denomination inputs
    mount.querySelectorAll(".counter-denom-input").forEach(input => {
      input.oninput = (e) => {
        const denom = e.target.getAttribute("data-denom");
        const val = Math.max(0, parseInt(e.target.value, 10) || 0);
        this.denominations[denom] = val;
        this.saveAndRecalcDenominations();
      };
    });

    // Quick increment stepper buttons
    mount.querySelectorAll(".btn-denom-step").forEach(btn => {
      btn.onclick = () => {
        const denom = btn.getAttribute("data-denom");
        const step = parseInt(btn.getAttribute("data-step"), 10) || 1;
        const current = parseInt(this.denominations[denom], 10) || 0;
        this.denominations[denom] = current + step;

        const input = mount.querySelector(`.counter-denom-input[data-denom="${denom}"]`);
        if (input) input.value = this.denominations[denom];

        this.saveAndRecalcDenominations();
      };
    });

    // Delete expense buttons
    mount.querySelectorAll(".btn-delete-expense").forEach(btn => {
      btn.onclick = () => {
        const expId = btn.getAttribute("data-id");
        if (confirm("Are you sure you want to remove this cash expense entry? Till balance will be restored.")) {
          const expenses = (window.db && window.db.get("expenses")) || [];
          const filtered = expenses.filter(e => e.id !== expId);
          window.db.set("expenses", filtered);
          window.showToast("Cash expense removed. Till balance re-calculated.", "info");
          this.render();
        }
      };
    });
  },

  recalculateDrawerMath() {
    const allOrders = (window.db && window.db.get("orders")) || [];
    const allExpenses = (window.db && window.db.get("expenses")) || [];
    const settings = (window.db && window.db.get("settings")) || {};
    const currency = settings.currencySymbol || "₹";

    const periodOrders = this.getFilteredOrdersByPeriod(allOrders);
    const validOrders = periodOrders.filter(o => o.status !== "Cancelled");

    // Cash Sales (with Split payments support)
    let cashSales = 0;
    let cashBillsCount = 0;
    validOrders.forEach(o => {
      const pm = (o.paymentMethod || "Cash").toLowerCase();
      const tot = Number(o.total) || 0;
      if (pm === "cash") {
        cashSales += tot;
        cashBillsCount++;
      } else if (pm === "split" && o.splitDetails) {
        const c = Number(o.splitDetails.cash) || 0;
        cashSales += c;
        if (c > 0) cashBillsCount++;
      }
    });

    // Filter cash expenses for active date
    const targetDate = this.activeDateStr;
    const periodExpenses = allExpenses.filter(e => {
      const eDate = e.date || (e.createdAt ? this.getIstDateString(new Date(e.createdAt)) : "");
      const isCash = (e.paymentMode || e.paymentMethod || "Cash").toLowerCase() === "cash";
      return isCash && (this.selectedPeriod === "all" || eDate === targetDate);
    });

    const cashOut = periodExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const openingFloat = this.getOpeningFloat();
    const expectedCash = openingFloat + cashSales - cashOut;

    // Physical counted calculation
    const d = this.denominations;
    const sub500 = (d[500] || 0) * 500;
    const sub200 = (d[200] || 0) * 200;
    const sub100 = (d[100] || 0) * 100;
    const sub50 = (d[50] || 0) * 50;
    const sub20 = (d[20] || 0) * 20;
    const sub10 = (d[10] || 0) * 10;
    const subCoins = d.coins || 0;

    const actualCash = sub500 + sub200 + sub100 + sub50 + sub20 + sub10 + subCoins;
    const variance = actualCash - expectedCash;

    // Update DOM in Tally panel
    const floatEl = document.getElementById("tally-opening-float");
    const cashSalesEl = document.getElementById("tally-cash-sales");
    const cashBillsCountEl = document.getElementById("tally-cash-bills-count");
    const cashOutEl = document.getElementById("tally-cash-out");
    const expenseCountEl = document.getElementById("tally-expense-count");
    const expectedEl = document.getElementById("tally-expected-cash");
    const actualEl = document.getElementById("tally-actual-cash");
    const diffBadgeEl = document.getElementById("tally-variance-badge");
    const diffDescEl = document.getElementById("tally-variance-desc");
    const diffCardEl = document.getElementById("tally-diff-card");

    // KPI Card 5 elements
    const kpiExpectedEl = document.getElementById("counter-drawer-expected");
    const kpiStatusBadge = document.getElementById("counter-drawer-status-badge");

    if (floatEl) floatEl.textContent = `${currency}${openingFloat.toLocaleString("en-IN")}`;
    if (cashSalesEl) cashSalesEl.textContent = `${currency}${Math.round(cashSales).toLocaleString("en-IN")}`;
    if (cashBillsCountEl) cashBillsCountEl.textContent = `${cashOrders.length} cash orders`;
    if (cashOutEl) cashOutEl.textContent = `${currency}${Math.round(cashOut).toLocaleString("en-IN")}`;
    if (expenseCountEl) expenseCountEl.textContent = `${periodExpenses.length} cash payouts`;
    if (expectedEl) expectedEl.textContent = `${currency}${Math.round(expectedCash).toLocaleString("en-IN")}`;
    if (actualEl) actualEl.textContent = `${currency}${Math.round(actualCash).toLocaleString("en-IN")}`;
    if (kpiExpectedEl) kpiExpectedEl.textContent = `${currency}${Math.round(expectedCash).toLocaleString("en-IN")}`;

    // Update denomination sub-labels
    const s500 = document.getElementById("denom-sub-500");
    const s200 = document.getElementById("denom-sub-200");
    const s100 = document.getElementById("denom-sub-100");
    const s50 = document.getElementById("denom-sub-50");
    const s20 = document.getElementById("denom-sub-20");
    const s10 = document.getElementById("denom-sub-10");
    const sCoins = document.getElementById("denom-sub-coins");

    if (s500) s500.textContent = `₹${sub500.toLocaleString("en-IN")}`;
    if (s200) s200.textContent = `₹${sub200.toLocaleString("en-IN")}`;
    if (s100) s100.textContent = `₹${sub100.toLocaleString("en-IN")}`;
    if (s50) s50.textContent = `₹${sub50.toLocaleString("en-IN")}`;
    if (s20) s20.textContent = `₹${sub20.toLocaleString("en-IN")}`;
    if (s10) s10.textContent = `₹${sub10.toLocaleString("en-IN")}`;
    if (sCoins) sCoins.textContent = `₹${subCoins.toLocaleString("en-IN")}`;

    // Variance badge styling
    if (diffBadgeEl && diffDescEl && diffCardEl) {
      if (actualCash === 0) {
        diffBadgeEl.textContent = "Uncounted";
        diffBadgeEl.style.background = "#f1f5f9";
        diffBadgeEl.style.color = "#64748b";
        diffDescEl.textContent = "Enter counted notes below";
        diffCardEl.style.borderColor = "var(--border-color)";

        if (kpiStatusBadge) {
          kpiStatusBadge.className = "growth-tag";
          kpiStatusBadge.style.background = "#f1f5f9";
          kpiStatusBadge.style.color = "#64748b";
          kpiStatusBadge.style.borderColor = "#e2e8f0";
          kpiStatusBadge.innerHTML = `<i class="fa-solid fa-clock"></i> Uncounted`;
        }
      } else if (variance === 0) {
        diffBadgeEl.textContent = "PERFECT MATCH";
        diffBadgeEl.style.background = "#ecfdf5";
        diffBadgeEl.style.color = "#059669";
        diffDescEl.textContent = "Cash drawer perfectly balanced!";
        diffCardEl.style.borderColor = "#10b981";

        if (kpiStatusBadge) {
          kpiStatusBadge.className = "growth-tag growth-up";
          kpiStatusBadge.innerHTML = `<i class="fa-solid fa-check"></i> Balanced`;
        }
      } else if (variance > 0) {
        diffBadgeEl.textContent = `+${currency}${Math.abs(variance)} SURPLUS`;
        diffBadgeEl.style.background = "#eff6ff";
        diffBadgeEl.style.color = "#2563eb";
        diffDescEl.textContent = "Physical cash is higher than register";
        diffCardEl.style.borderColor = "#3b82f6";

        if (kpiStatusBadge) {
          kpiStatusBadge.className = "growth-tag";
          kpiStatusBadge.style.background = "#eff6ff";
          kpiStatusBadge.style.color = "#2563eb";
          kpiStatusBadge.style.borderColor = "#bfdbfe";
          kpiStatusBadge.innerHTML = `<i class="fa-solid fa-arrow-up"></i> +₹${Math.abs(variance)} Surplus`;
        }
      } else {
        diffBadgeEl.textContent = `-${currency}${Math.abs(variance)} SHORTAGE`;
        diffBadgeEl.style.background = "#fef2f2";
        diffBadgeEl.style.color = "#dc2626";
        diffDescEl.textContent = "Drawer cash has a shortfall!";
        diffCardEl.style.borderColor = "#ef4444";

        if (kpiStatusBadge) {
          kpiStatusBadge.className = "growth-tag growth-down";
          kpiStatusBadge.style.background = "#fef2f2";
          kpiStatusBadge.style.color = "#dc2626";
          kpiStatusBadge.style.borderColor = "#fecaca";
          kpiStatusBadge.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> -₹${Math.abs(variance)} Short`;
        }
      }
    }
  },

  // =========================================================================
  // SUB-TAB 3: SHIFT RUSH & VELOCITY ANALYTICS
  // =========================================================================
  renderVelocityTab(mount) {
    const allOrders = (window.db && window.db.get("orders")) || [];
    const settings = (window.db && window.db.get("settings")) || {};
    const currency = settings.currencySymbol || "₹";

    const periodOrders = this.getFilteredOrdersByPeriod(allOrders);
    const validOrders = periodOrders.filter(o => o.status !== "Cancelled");
    const netSales = validOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    const avgTicket = validOrders.length > 0 ? Math.round(netSales / validOrders.length) : 0;
    const totalDiscounts = validOrders.reduce((sum, o) => sum + (Number(o.discount) || 0) + (Number(o.bogoDiscount) || 0), 0);

    let minToken = 999999;
    let maxToken = 0;
    let maxBillVal = 0;
    validOrders.forEach(o => {
      const tok = Number(o.tokenNumber) || 0;
      const tot = Number(o.total) || 0;
      if (tok > 0) {
        if (tok < minToken) minToken = tok;
        if (tok > maxToken) maxToken = tok;
      }
      if (tot > maxBillVal) maxBillVal = tot;
    });

    const tokenRangeText = maxToken > 0 ? `Token #${minToken} - #${maxToken}` : "None";

    // Payment shares
    const cashOrders = validOrders.filter(o => (o.paymentMethod || "Cash").toLowerCase() === "cash");
    const cashSales = cashOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const upiOrders = validOrders.filter(o => (o.paymentMethod || "").toLowerCase() === "upi");
    const upiSales = upiOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const cardOrders = validOrders.filter(o => (o.paymentMethod || "").toLowerCase() === "card");
    const cardSales = cardOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    const cashPct = netSales > 0 ? Math.round((cashSales / netSales) * 100) : 0;
    const upiPct = netSales > 0 ? Math.round((upiSales / netSales) * 100) : 0;
    const cardPct = netSales > 0 ? Math.round((cardSales / netSales) * 100) : 0;

    // Order type shares
    const dineInOrders = validOrders.filter(o => (o.type || "Dine-in") === "Dine-in");
    const takeawayOrders = validOrders.filter(o => (o.type || "Dine-in") === "Takeaway");
    const dineInPct = validOrders.length > 0 ? Math.round((dineInOrders.length / validOrders.length) * 100) : 0;
    const takeawayPct = validOrders.length > 0 ? (100 - dineInPct) : 0;

    mount.innerHTML = `
      <div class="view-animate" style="display: flex; flex-direction: column; gap: 14px;">
        
        <!-- Hourly Store Traffic Rush Meter -->
        <div class="glass-card" style="padding: 16px 20px; display: flex; flex-direction: column; gap: 12px; border-radius: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div>
              <h4 style="margin: 0; font-size: 15px; font-weight: 800; color: var(--text-dark); display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-chart-column" style="color: #2563eb;"></i> Hourly Store Traffic & Rush Timeline
              </h4>
              <p style="margin: 2px 0 0 0; font-size: 11.5px; color: var(--text-muted);">Visual customer order volume across business operational hours.</p>
            </div>
            <span id="counter-peak-hour-badge" style="font-size: 11.5px; font-weight: 800; background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; padding: 4px 10px; border-radius: 8px;">
              Peak: --
            </span>
          </div>

          <div class="counter-rush-strip" id="counter-rush-timeline" style="height: 90px;">
            <!-- Dynamically populated bars -->
          </div>
        </div>

        <!-- Velocity & Payment Share Insights Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px;">
          
          <!-- Payment Mode Share Breakdown -->
          <div class="glass-card" style="padding: 16px 18px; border-radius: 14px; display: flex; flex-direction: column; gap: 10px;">
            <h4 style="margin: 0; font-size: 13.5px; font-weight: 800; color: var(--text-dark);">
              <i class="fa-solid fa-wallet" style="color: #059669; margin-right: 6px;"></i> Payment Modes Distribution
            </h4>
            
            <!-- Horizontal Split Bar -->
            <div style="width: 100%; height: 10px; background: #e2e8f0; border-radius: 6px; overflow: hidden; display: flex; margin-top: 4px;">
              <div style="width: ${cashPct}%; height: 100%; background: #10b981;" title="Cash: ${cashPct}%"></div>
              <div style="width: ${upiPct}%; height: 100%; background: #8b5cf6;" title="UPI: ${upiPct}%"></div>
              <div style="width: ${cardPct}%; height: 100%; background: #3b82f6;" title="Card: ${cardPct}%"></div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 6px; font-size: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="display: flex; align-items: center; gap: 6px;"><span style="width: 10px; height: 10px; border-radius: 50%; background: #10b981;"></span> Cash Orders</span>
                <strong>${currency}${Math.round(cashSales).toLocaleString("en-IN")} (${cashPct}%)</strong>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="display: flex; align-items: center; gap: 6px;"><span style="width: 10px; height: 10px; border-radius: 50%; background: #8b5cf6;"></span> UPI QR Orders</span>
                <strong>${currency}${Math.round(upiSales).toLocaleString("en-IN")} (${upiPct}%)</strong>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="display: flex; align-items: center; gap: 6px;"><span style="width: 10px; height: 10px; border-radius: 50%; background: #3b82f6;"></span> Card Swipes</span>
                <strong>${currency}${Math.round(cardSales).toLocaleString("en-IN")} (${cardPct}%)</strong>
              </div>
            </div>
          </div>

          <!-- Order Type & Ticket Velocity -->
          <div class="glass-card" style="padding: 16px 18px; border-radius: 14px; display: flex; flex-direction: column; gap: 10px;">
            <h4 style="margin: 0; font-size: 13.5px; font-weight: 800; color: var(--text-dark);">
              <i class="fa-solid fa-gauge-high" style="color: #2563eb; margin-right: 6px;"></i> Speed of Service & AOV
            </h4>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 4px;">
              <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 10px; padding: 10px;">
                <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Average Ticket (AOV)</span>
                <div style="font-size: 18px; font-weight: 900; color: #2563eb; margin-top: 2px;">${currency}${avgTicket}</div>
                <span style="font-size: 10.5px; color: var(--text-muted);">${validOrders.length} valid checks</span>
              </div>

              <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 10px; padding: 10px;">
                <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Largest Bill</span>
                <div style="font-size: 18px; font-weight: 900; color: #059669; margin-top: 2px;">${currency}${maxBillVal}</div>
                <span style="font-size: 10.5px; color: var(--text-muted);">Max order ticket</span>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; border-top: 1px dashed var(--border-color); padding-top: 8px; margin-top: 4px;">
              <span>Dine-in vs Takeaway:</span>
              <strong>🍽️ ${dineInPct}% Dine-in • 🥡 ${takeawayPct}% Takeaway</strong>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px;">
              <span>Token Number Range:</span>
              <strong style="color: #2563eb;">${tokenRangeText}</strong>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px;">
              <span>Total Discounts Dispensed:</span>
              <strong style="color: #16a34a;">-${currency}${Math.round(totalDiscounts).toLocaleString("en-IN")}</strong>
            </div>
          </div>

        </div>

      </div>
    `;

    this.renderRushMeter(validOrders);
  },

  renderRushMeter(validOrders) {
    const timelineEl = document.getElementById("counter-rush-timeline");
    const peakBadgeEl = document.getElementById("counter-peak-hour-badge");
    if (!timelineEl) return;

    // Operational hours from 12 PM to 11 PM (12 to 23)
    const hours = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
    const hourCounts = {};
    const hourSales = {};
    hours.forEach(h => {
      hourCounts[h] = 0;
      hourSales[h] = 0;
    });

    validOrders.forEach(o => {
      if (!o.createdAt) return;
      const h = new Date(o.createdAt).getHours();
      if (hourCounts[h] !== undefined) {
        hourCounts[h]++;
        hourSales[h] += (Number(o.total) || 0);
      }
    });

    const maxCount = Math.max(...Object.values(hourCounts), 1);
    let peakHour = null;
    let peakCount = 0;
    hours.forEach(h => {
      if (hourCounts[h] > peakCount) {
        peakCount = hourCounts[h];
        peakHour = h;
      }
    });

    if (peakBadgeEl) {
      if (peakCount > 0 && peakHour !== null) {
        const label = peakHour >= 12 ? (peakHour === 12 ? "12 PM" : `${peakHour - 12} PM`) : `${peakHour} AM`;
        peakBadgeEl.textContent = `Peak Rush: ${label} (${peakCount} bills • ₹${Math.round(hourSales[peakHour]).toLocaleString("en-IN")})`;
      } else {
        peakBadgeEl.textContent = "Peak: No Rush Yet";
      }
    }

    timelineEl.innerHTML = hours.map(h => {
      const count = hourCounts[h] || 0;
      const sales = hourSales[h] || 0;
      const heightPercent = Math.max(10, Math.round((count / maxCount) * 100));
      const isPeak = h === peakHour && count > 0;
      const label = h >= 12 ? (h === 12 ? "12p" : `${h - 12}p`) : `${h}a`;

      return `
        <div class="counter-rush-col" title="${label}: ${count} bills (₹${Math.round(sales).toLocaleString('en-IN')})">
          <div class="counter-rush-bar ${isPeak ? 'peak' : ''}" style="height: ${heightPercent}%;"></div>
          <span class="counter-rush-hour" style="${isPeak ? 'color: #2563eb; font-weight: 900;' : ''}">${label}</span>
        </div>
      `;
    }).join("");
  },

  // =========================================================================
  // SUB-TAB 4: SHIFT SETTLEMENT AUDIT LOG (NEW ADVANCED FEATURE)
  // =========================================================================
  renderShiftsTab(mount) {
    let shiftHistory = [];
    try {
      shiftHistory = JSON.parse(localStorage.getItem("crust_shift_history") || "[]");
    } catch (e) {
      shiftHistory = [];
    }

    const settings = (window.db && window.db.get("settings")) || {};
    const currency = settings.currencySymbol || "₹";

    const rowsHtml = shiftHistory.length === 0
      ? `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 40px; font-weight: 600;">No shifts closed yet. Click "Close Register" to settle today's shift.</td></tr>`
      : shiftHistory.map(s => {
        const variance = Number(s.variance || 0);
        let varBadge = `<span style="background: #ecfdf5; color: #059669; font-weight: 800; padding: 2px 8px; border-radius: 6px; font-size: 11px;">Balanced</span>`;
        if (variance > 0) {
          varBadge = `<span style="background: #eff6ff; color: #2563eb; font-weight: 800; padding: 2px 8px; border-radius: 6px; font-size: 11px;">+${currency}${variance} Surplus</span>`;
        } else if (variance < 0) {
          varBadge = `<span style="background: #fef2f2; color: #dc2626; font-weight: 800; padding: 2px 8px; border-radius: 6px; font-size: 11px;">-${currency}${Math.abs(variance)} Short</span>`;
        }

        return `
          <tr>
            <td style="font-weight: 800; color: var(--text-dark);">${s.date || '--'}</td>
            <td style="font-size: 12px; color: var(--text-muted);">${s.closedAt ? new Date(s.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}</td>
            <td style="font-weight: 700; color: #2563eb;">${s.cashierName || 'Cashier'}</td>
            <td style="font-weight: 800; color: var(--text-dark);">${currency}${Number(s.totalSales || 0).toLocaleString("en-IN")}</td>
            <td style="font-weight: 700;">${currency}${Number(s.expectedCash || 0).toLocaleString("en-IN")}</td>
            <td style="font-weight: 800; color: #059669;">${currency}${Number(s.actualCash || 0).toLocaleString("en-IN")}</td>
            <td>${varBadge}</td>
          </tr>
        `;
      }).join("");

    mount.innerHTML = `
      <div class="glass-card view-animate" style="padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; border-radius: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div>
            <h4 style="margin: 0; font-size: 15px; font-weight: 800; color: var(--text-dark);">
              <i class="fa-solid fa-clock-rotate-left" style="color: #6366f1; margin-right: 6px;"></i> Cashier Shift Settlement Log
            </h4>
            <p style="margin: 2px 0 0 0; font-size: 11.5px; color: var(--text-muted);">Historical permanent record of shift closures, expected cash, counted cash, and variance.</p>
          </div>
          <button type="button" class="btn btn-primary" id="btn-shift-close-trigger" style="height: 34px; font-size: 11.5px; padding: 0 14px; border-radius: 8px; font-weight: 800;">
            <i class="fa-solid fa-file-invoice-dollar"></i> Close Register Now
          </button>
        </div>

        <div class="table-container" style="max-height: 400px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 10px;">
          <table class="premium-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time Closed</th>
                <th>Cashier / Manager</th>
                <th>Total Sales</th>
                <th>Expected Cash</th>
                <th>Counted Cash</th>
                <th>Till Variance</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;

    const triggerBtn = mount.querySelector("#btn-shift-close-trigger");
    if (triggerBtn) {
      triggerBtn.onclick = () => this.openShiftCloseWizardModal();
    }
  },

  // =========================================================================
  // ACTIONS: CHANGE PAYMENT MODE, VOID ORDER, CASH OUT, PRINTING, CSV
  // =========================================================================
  openShiftCloseWizardModal() {
    const allOrders = (window.db && window.db.get("orders")) || [];
    const allExpenses = (window.db && window.db.get("expenses")) || [];
    const settings = (window.db && window.db.get("settings")) || {};
    const currency = settings.currencySymbol || "₹";

    const periodOrders = this.getFilteredOrdersByPeriod(allOrders);
    const validOrders = periodOrders.filter(o => o.status !== "Cancelled");

    const netSales = validOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const cashOrders = validOrders.filter(o => (o.paymentMethod || "Cash").toLowerCase() === "cash");
    const cashSales = cashOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const upiOrders = validOrders.filter(o => (o.paymentMethod || "").toLowerCase() === "upi");
    const upiSales = upiOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const cardOrders = validOrders.filter(o => (o.paymentMethod || "").toLowerCase() === "card");
    const cardSales = cardOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    const targetDate = this.activeDateStr;
    const periodExpenses = allExpenses.filter(e => {
      const eDate = e.date || (e.createdAt ? this.getIstDateString(new Date(e.createdAt)) : "");
      const isCash = (e.paymentMode || e.paymentMethod || "Cash").toLowerCase() === "cash";
      return isCash && (this.selectedPeriod === "all" || eDate === targetDate);
    });
    const cashExpenses = periodExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const openingFloat = this.getOpeningFloat();
    const expectedDrawerCash = openingFloat + cashSales - cashExpenses;

    const d = this.denominations;
    const sub500 = (d[500] || 0) * 500;
    const sub200 = (d[200] || 0) * 200;
    const sub100 = (d[100] || 0) * 100;
    const sub50 = (d[50] || 0) * 50;
    const sub20 = (d[20] || 0) * 20;
    const sub10 = (d[10] || 0) * 10;
    const subCoins = d.coins || 0;
    const actualCash = sub500 + sub200 + sub100 + sub50 + sub20 + sub10 + subCoins;
    const variance = actualCash - expectedDrawerCash;

    const currentUser = (window.auth && window.auth.getUser && window.auth.getUser()) || {};
    const defaultCashier = currentUser.name || "Cashier";

    const modalHtml = `
      <div style="display: flex; flex-direction: column; gap: 14px; font-size: 13px;">
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 12px 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong style="color: #1e40af; font-size: 14px;">Shift Settlement Summary (${this.activeDateStr})</strong>
            <span style="font-size: 11px; color: var(--text-muted);">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 10px; text-align: center;">
            <div style="background: #fff; padding: 8px; border-radius: 8px; border: 1px solid #e2e8f0;">
              <span style="font-size: 10.5px; color: var(--text-muted); display: block;">Net Sales</span>
              <strong style="font-size: 15px; color: #2563eb;">${currency}${Math.round(netSales).toLocaleString("en-IN")}</strong>
            </div>
            <div style="background: #fff; padding: 8px; border-radius: 8px; border: 1px solid #e2e8f0;">
              <span style="font-size: 10.5px; color: var(--text-muted); display: block;">Expected Cash</span>
              <strong style="font-size: 15px; color: #059669;">${currency}${Math.round(expectedDrawerCash).toLocaleString("en-IN")}</strong>
            </div>
            <div style="background: #fff; padding: 8px; border-radius: 8px; border: 1px solid #e2e8f0;">
              <span style="font-size: 10.5px; color: var(--text-muted); display: block;">Counted Cash</span>
              <strong style="font-size: 15px; color: ${variance === 0 ? '#059669' : variance > 0 ? '#2563eb' : '#dc2626'};">${currency}${Math.round(actualCash).toLocaleString("en-IN")}</strong>
            </div>
          </div>
        </div>

        <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 10px; padding: 10px 14px; font-size: 12px; display: flex; flex-direction: column; gap: 6px;">
          <div style="display: flex; justify-content: space-between;">
            <span>Opening Cash Float:</span>
            <strong>${currency}${openingFloat}</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>(+) Cash Sales (${cashOrders.length} bills):</span>
            <strong style="color: #059669;">+${currency}${cashSales}</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>(-) Cash Expenses (${periodExpenses.length} entries):</span>
            <strong style="color: #dc2626;">-${currency}${cashExpenses}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; border-top: 1px dashed var(--border-color); padding-top: 6px; font-weight: 800;">
            <span>Till Variance:</span>
            <span style="color: ${variance === 0 ? '#059669' : variance > 0 ? '#2563eb' : '#dc2626'};">
              ${variance === 0 ? 'Balanced (₹0)' : variance > 0 ? `+${currency}${variance} Surplus` : `-${currency}${Math.abs(variance)} Shortage`}
            </span>
          </div>
        </div>

        <div>
          <label style="font-weight: 700; color: var(--text-dark); display: block; margin-bottom: 5px;">Cashier / Manager Name *</label>
          <input type="text" id="shift-cashier-name" class="form-input" value="${defaultCashier}" style="height: 38px; border-radius: 10px;">
        </div>

        <div>
          <label style="font-weight: 700; color: var(--text-dark); display: block; margin-bottom: 5px;">Closing Notes / Remarks (Optional)</label>
          <textarea id="shift-closing-notes" class="form-input" placeholder="e.g. Shift ended smoothly, ₹50 difference due to coin shortage" style="height: 60px; border-radius: 10px; padding: 8px;"></textarea>
        </div>
      </div>
    `;

    window.customModal.show({
      title: "End Shift & Settle Register (Z-Report)",
      bodyHtml: modalHtml,
      confirmText: "Settle & Record Shift",
      cancelText: "Cancel",
      onConfirm: () => {
        const nameInput = document.getElementById("shift-cashier-name");
        const notesInput = document.getElementById("shift-closing-notes");
        const cashierName = nameInput ? nameInput.value.trim() : defaultCashier;
        const notes = notesInput ? notesInput.value.trim() : "";

        if (!cashierName) {
          window.showToast("Please provide Cashier name.", "error");
          return false;
        }

        const shiftRecord = {
          id: `SHIFT-${Date.now()}`,
          date: this.activeDateStr,
          closedAt: new Date().toISOString(),
          cashierName: cashierName,
          totalSales: netSales,
          cashSales: cashSales,
          upiSales: upiSales,
          cardSales: cardSales,
          openingFloat: openingFloat,
          cashExpenses: cashExpenses,
          expectedCash: expectedDrawerCash,
          actualCash: actualCash,
          variance: variance,
          notes: notes
        };

        try {
          const history = JSON.parse(localStorage.getItem("crust_shift_history") || "[]");
          history.unshift(shiftRecord);
          localStorage.setItem("crust_shift_history", JSON.stringify(history.slice(0, 100)));
        } catch (e) {}

        window.showToast(`Shift settled successfully for ${cashierName}!`, "success");
        this.render();
        this.showDaySummaryPrintModal();
        return true;
      }
    });
  },

  promptChangePaymentMode(orderId) {
    const orders = (window.db && window.db.get("orders")) || [];
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const currentMode = order.paymentMethod || "Cash";
    const settings = (window.db && window.db.get("settings")) || {};
    const currency = settings.currencySymbol || "₹";

    const modalHtml = `
      <div style="display: flex; flex-direction: column; gap: 14px; font-size: 13px;">
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 12px 14px;">
          <div style="font-weight: 800; color: #1e40af; font-size: 14px;">Order #${order.orderNumber || order.id} (Token #${order.tokenNumber || 1})</div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
            Total: <strong>${currency}${Number(order.total).toFixed(2)}</strong> | Currently recorded as: <strong style="color: #2563eb;">${currentMode}</strong>
          </div>
        </div>

        <div>
          <label style="font-weight: 700; color: var(--text-dark); display: block; margin-bottom: 6px;">Select New Payment Mode:</label>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
            <label style="border: 1.5px solid ${currentMode === 'Cash' ? '#10b981' : 'var(--border-color)'}; padding: 10px; border-radius: 10px; text-align: center; cursor: pointer; background: ${currentMode === 'Cash' ? '#ecfdf5' : '#fff'};">
              <input type="radio" name="new-pay-mode" value="Cash" ${currentMode === 'Cash' ? 'checked' : ''} style="margin-right: 4px;">
              <strong>Cash</strong>
            </label>
            <label style="border: 1.5px solid ${currentMode === 'UPI' ? '#7c3aed' : 'var(--border-color)'}; padding: 10px; border-radius: 10px; text-align: center; cursor: pointer; background: ${currentMode === 'UPI' ? '#f5f3ff' : '#fff'};">
              <input type="radio" name="new-pay-mode" value="UPI" ${currentMode === 'UPI' ? 'checked' : ''} style="margin-right: 4px;">
              <strong>UPI QR</strong>
            </label>
            <label style="border: 1.5px solid ${currentMode === 'Card' ? '#2563eb' : 'var(--border-color)'}; padding: 10px; border-radius: 10px; text-align: center; cursor: pointer; background: ${currentMode === 'Card' ? '#eff6ff' : '#fff'};">
              <input type="radio" name="new-pay-mode" value="Card" ${currentMode === 'Card' ? 'checked' : ''} style="margin-right: 4px;">
              <strong>Card</strong>
            </label>
          </div>
        </div>

        <div style="font-size: 11px; color: var(--text-muted); background: #f8fafc; padding: 8px 12px; border-radius: 8px;">
          <i class="fa-solid fa-circle-info" style="color: #2563eb;"></i> Changing this mode will immediately re-balance your Cash Drawer Register.
        </div>
      </div>
    `;

    window.customModal.show({
      title: "Update Bill Payment Method",
      bodyHtml: modalHtml,
      confirmText: "Save Payment Mode",
      cancelText: "Cancel",
      onConfirm: () => {
        const selectedRadio = document.querySelector('input[name="new-pay-mode"]:checked');
        if (!selectedRadio) return true;

        const newMode = selectedRadio.value;
        if (newMode !== currentMode) {
          order.paymentMethod = newMode;
          window.db.set("orders", orders);
          window.showToast(`Order #${order.orderNumber || order.id} updated to ${newMode}. Tally re-balanced!`, "success");
          this.render();
        }
        return true;
      }
    });
  },

  shareOrderWhatsApp(orderId) {
    const orders = (window.db && window.db.get("orders")) || [];
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const settings = (window.db && window.db.get("settings")) || {};
    const currency = settings.currencySymbol || "₹";
    const shopName = settings.restaurantName || "Crust & Chilly";

    let phone = (order.customerPhone || "").replace(/\D/g, "");
    if (!phone) {
      phone = prompt("Enter customer WhatsApp Mobile Number (10 digits):", "");
      if (!phone) return;
      phone = phone.replace(/\D/g, "");
    }

    if (phone.length === 10) phone = `91${phone}`;

    const itemsText = (order.items || []).map(i => `• ${i.name} x${i.quantity} = ${currency}${(i.price * i.quantity)}`).join("%0A");

    const message = `*${encodeURIComponent(shopName)}*%0A`
      + `Order: *%23${order.orderNumber || order.id}* (Token *%23${order.tokenNumber || 1}*)%0A`
      + `Date: ${new Date(order.createdAt).toLocaleDateString("en-IN")}%0A`
      + `Customer: ${encodeURIComponent(order.customerName || "Valued Guest")}%0A`
      + `--------------------------%0A`
      + `${itemsText}%0A`
      + `--------------------------%0A`
      + `*Total Amount: ${currency}${Number(order.total).toFixed(2)}*%0A`
      + `Paid via: ${order.paymentMethod || "Cash"}%0A%0A`
      + `Thank you for dining at *${encodeURIComponent(shopName)}*! Enjoy your meal!`;

    const waUrl = `https://wa.me/${phone}?text=${message}`;
    window.open(waUrl, "_blank");
  },

  promptVoidOrder(orderId) {
    const orders = (window.db && window.db.get("orders")) || [];
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const confirmVoid = confirm(`Are you sure you want to VOID and CANCEL Order #${order.orderNumber || order.id} (₹${order.total})?\n\nThis will remove it from net counter collection.`);
    if (confirmVoid) {
      window.db.updateOrderStatus(orderId, "Cancelled");
      window.showToast(`Order #${order.orderNumber || order.id} has been VOIDED.`, "error");
      this.render();
    }
  },

  openQuickCashOutModal() {
    const settings = (window.db && window.db.get("settings")) || {};
    const currency = settings.currencySymbol || "₹";

    const modalHtml = `
      <div style="display: flex; flex-direction: column; gap: 14px; font-size: 13px;">
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 10px 14px; color: #991b1b; font-size: 12px; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-hand-holding-dollar" style="font-size: 16px;"></i>
          <span>This expense will be deducted directly from today's physical cash drawer register.</span>
        </div>

        <div>
          <label style="font-weight: 700; color: var(--text-dark); display: block; margin-bottom: 5px;">Description / Purpose *</label>
          <input type="text" id="cashout-desc" class="form-input" placeholder="e.g. Milk, Amul Cheese, Ice, Veggies, Gas Refill" style="height: 38px; border-radius: 10px;">
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div>
            <label style="font-weight: 700; color: var(--text-dark); display: block; margin-bottom: 5px;">Amount (${currency}) *</label>
            <input type="number" id="cashout-amount" class="form-input" placeholder="0.00" min="1" step="any" style="height: 38px; font-weight: 800; font-size: 14px; border-radius: 10px;">
          </div>
          <div>
            <label style="font-weight: 700; color: var(--text-dark); display: block; margin-bottom: 5px;">Category</label>
            <select id="cashout-cat" class="form-input" style="height: 38px; border-radius: 10px; font-weight: 600;">
              <option value="Raw Materials">Raw Materials (Dairy, Veg)</option>
              <option value="Beverages & Ice">Beverages & Ice</option>
              <option value="Packaging & Disposables">Packaging & Disposables</option>
              <option value="Gas & Fuel">Gas & Fuel</option>
              <option value="Staff Refreshment">Staff Refreshment</option>
              <option value="Store Maintenance">Store Maintenance</option>
              <option value="Other Petty Cash">Other Petty Cash</option>
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div>
            <label style="font-weight: 700; color: var(--text-dark); display: block; margin-bottom: 5px;">Payment Mode</label>
            <select id="cashout-mode" class="form-input" style="height: 38px; border-radius: 10px; font-weight: 700;">
              <option value="Cash" selected>Cash (Drawer Cash Out)</option>
              <option value="UPI">UPI / Online</option>
            </select>
          </div>
          <div>
            <label style="font-weight: 700; color: var(--text-dark); display: block; margin-bottom: 5px;">Date</label>
            <input type="date" id="cashout-date" class="form-input" value="${this.activeDateStr}" style="height: 38px; border-radius: 10px; font-weight: 600;">
          </div>
        </div>
      </div>
    `;

    window.customModal.show({
      title: "Log Cash Out / Till Expense",
      bodyHtml: modalHtml,
      confirmText: "Record Cash Out",
      cancelText: "Cancel",
      onConfirm: () => {
        const descInput = document.getElementById("cashout-desc");
        const amountInput = document.getElementById("cashout-amount");
        const catInput = document.getElementById("cashout-cat");
        const modeInput = document.getElementById("cashout-mode");
        const dateInput = document.getElementById("cashout-date");

        const desc = descInput ? descInput.value.trim() : "";
        const amount = amountInput ? parseFloat(amountInput.value) : 0;
        const category = catInput ? catInput.value : "Raw Materials";
        const paymentMode = modeInput ? modeInput.value : "Cash";
        const date = dateInput && dateInput.value ? dateInput.value : this.activeDateStr;

        if (!desc) {
          window.showToast("Please provide expense description.", "error");
          return false;
        }
        if (!amount || isNaN(amount) || amount <= 0) {
          window.showToast("Please enter a valid amount.", "error");
          return false;
        }

        const expenses = (window.db && window.db.get("expenses")) || [];
        const newExpense = {
          id: `EXP-${Date.now()}`,
          title: desc,
          description: desc,
          amount: amount,
          category: category,
          paymentMode: paymentMode,
          date: date,
          createdAt: new Date().toISOString()
        };

        expenses.unshift(newExpense);
        window.db.set("expenses", expenses);

        window.showToast(`Logged ₹${amount} expense. Till updated!`, "success");
        this.render();
        return true;
      }
    });
  },

  exportOrdersToCsv() {
    const allOrders = (window.db && window.db.get("orders")) || [];
    let orders = this.getFilteredOrdersByPeriod(allOrders);

    if (this.quickFilterChip === "cash") {
      orders = orders.filter(o => o.status !== "Cancelled" && (o.paymentMethod || "Cash").toLowerCase() === "cash");
    } else if (this.quickFilterChip === "upi") {
      orders = orders.filter(o => o.status !== "Cancelled" && (o.paymentMethod || "").toLowerCase() === "upi");
    } else if (this.quickFilterChip === "card") {
      orders = orders.filter(o => o.status !== "Cancelled" && (o.paymentMethod || "").toLowerCase() === "card");
    } else if (this.quickFilterChip === "dinein") {
      orders = orders.filter(o => o.status !== "Cancelled" && (o.type || "Dine-in") === "Dine-in");
    } else if (this.quickFilterChip === "takeaway") {
      orders = orders.filter(o => o.status !== "Cancelled" && (o.type || "Dine-in") === "Takeaway");
    } else if (this.quickFilterChip === "void") {
      orders = orders.filter(o => o.status === "Cancelled");
    }

    if (orders.length === 0) {
      window.showToast("No orders available to export.", "error");
      return;
    }

    this.generateAndDownloadCsv(orders, `Crust_Chilly_Bills_${this.activeDateStr}`);
  },

  generateAndDownloadCsv(orders, filename) {
    const headers = ["Order No", "Token No", "Date", "Time", "Customer Name", "Customer Phone", "Type", "Items", "Payment Mode", "Subtotal", "Discount", "Total", "Status"];
    const rows = orders.map(o => {
      const dt = new Date(o.createdAt || Date.now());
      const dateStr = dt.toLocaleDateString("en-IN");
      const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const itemsBrief = (o.items || []).map(i => `${i.name} (x${i.quantity})`).join("; ");
      const disc = (Number(o.bogoDiscount) || 0) + (Number(o.discount) || 0);

      return [
        `"#${o.orderNumber || o.id}"`,
        `"${o.tokenNumber || 1}"`,
        `"${dateStr}"`,
        `"${timeStr}"`,
        `"${(o.customerName || 'Walk-in').replace(/"/g, '""')}"`,
        `"${o.customerPhone || ''}"`,
        `"${o.type || 'Dine-in'}"`,
        `"${itemsBrief.replace(/"/g, '""')}"`,
        `"${o.paymentMethod || 'Cash'}"`,
        Number(o.subtotal || 0).toFixed(2),
        disc.toFixed(2),
        Number(o.total || 0).toFixed(2),
        `"${o.status || 'Completed'}"`
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.showToast(`Exported ${orders.length} bills to CSV successfully!`, "success");
  },

  showDaySummaryPrintModal() {
    const allOrders = (window.db && window.db.get("orders")) || [];
    const allExpenses = (window.db && window.db.get("expenses")) || [];
    const settings = (window.db && window.db.get("settings")) || {};
    const currency = settings.currencySymbol || "₹";

    const periodOrders = this.getFilteredOrdersByPeriod(allOrders);
    const validOrders = periodOrders.filter(o => o.status !== "Cancelled");
    const cancelledOrders = periodOrders.filter(o => o.status === "Cancelled");

    const grossSales = validOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const cashOrders = validOrders.filter(o => (o.paymentMethod || "Cash").toLowerCase() === "cash");
    const cashSales = cashOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    const upiOrders = validOrders.filter(o => (o.paymentMethod || "").toLowerCase() === "upi");
    const upiSales = upiOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    const cardOrders = validOrders.filter(o => (o.paymentMethod || "").toLowerCase() === "card");
    const cardSales = cardOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    const targetDate = this.activeDateStr;
    const periodExpenses = allExpenses.filter(e => {
      const eDate = e.date || (e.createdAt ? this.getIstDateString(new Date(e.createdAt)) : "");
      return eDate === targetDate;
    });

    const cashExpenses = periodExpenses.filter(e => (e.paymentMode || "Cash").toLowerCase() === "cash")
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const openingFloat = this.getOpeningFloat();
    const expectedDrawerCash = openingFloat + cashSales - cashExpenses;

    const summaryHtml = `
      <div id="counter-summary-printable-area" style="font-family: 'Courier New', monospace; font-size: 12.5px; color: #000; background: #fff; padding: 14px; line-height: 1.4;">
        <div style="text-align: center; margin-bottom: 10px;">
          <h2 style="font-size: 17px; font-weight: 900; margin: 0; text-transform: uppercase;">${settings.restaurantName || "Crust & Chilly"}</h2>
          <p style="font-size: 11px; margin: 2px 0;">DAILY COUNTER SETTLEMENT (Z-REPORT)</p>
          <p style="font-size: 11px; margin: 0;">Date: ${this.activeDateStr} | Time: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        </div>

        <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 6px 0; margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between;">
            <span>Total Bills Issued:</span>
            <strong>${periodOrders.length} (${validOrders.length} Valid, ${cancelledOrders.length} Void)</strong>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 900; margin-top: 4px;">
            <span>NET COUNTER SALES:</span>
            <span>${currency}${grossSales.toFixed(2)}</span>
          </div>
        </div>

        <div style="margin-bottom: 8px;">
          <strong style="text-decoration: underline;">PAYMENT COLLECTION BREAKDOWN:</strong>
          <div style="display: flex; justify-content: space-between; margin-top: 4px;">
            <span>Cash Sales (${cashOrders.length} bills):</span>
            <strong>${currency}${cashSales.toFixed(2)}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 2px;">
            <span>UPI / QR Sales (${upiOrders.length} bills):</span>
            <strong>${currency}${upiSales.toFixed(2)}</strong>
          </div>
          ${cardSales > 0 ? `
            <div style="display: flex; justify-content: space-between; margin-top: 2px;">
              <span>Card Sales (${cardOrders.length} bills):</span>
              <strong>${currency}${cardSales.toFixed(2)}</strong>
            </div>
          ` : ''}
        </div>

        <div style="border-top: 1px dashed #000; padding-top: 6px; margin-bottom: 8px;">
          <strong style="text-decoration: underline;">CASH DRAWER RECONCILIATION:</strong>
          <div style="display: flex; justify-content: space-between; margin-top: 4px;">
            <span>Opening Float:</span>
            <span>${currency}${openingFloat.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>(+) Cash Sales:</span>
            <span>+${currency}${cashSales.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>(-) Cash Expenses Paid:</span>
            <span>-${currency}${cashExpenses.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 900; border-top: 1px solid #000; margin-top: 4px; padding-top: 4px;">
            <span>EXPECTED DRAWER CASH:</span>
            <span>${currency}${expectedDrawerCash.toFixed(2)}</span>
          </div>
        </div>

        <div style="text-align: center; margin-top: 18px; font-size: 11px; border-top: 1px dashed #000; padding-top: 8px;">
          Cashier Sign: _____________________<br><br>
          Manager Sign: _____________________
        </div>
      </div>
    `;

    window.customModal.show({
      title: "Daily Counter Summary Slip (Z-Report)",
      bodyHtml: summaryHtml,
      confirmText: "Print Summary Slip",
      cancelText: "Close",
      onConfirm: () => {
        document.body.classList.add("printing-counter-summary");
        window.print();
        setTimeout(() => {
          document.body.classList.remove("printing-counter-summary");
        }, 1000);
        return true;
      }
    });
  },

  printTallySlip() {
    const settings = (window.db && window.db.get("settings")) || {};
    const currency = settings.currencySymbol || "₹";
    const d = this.denominations;

    const sub500 = (d[500] || 0) * 500;
    const sub200 = (d[200] || 0) * 200;
    const sub100 = (d[100] || 0) * 100;
    const sub50 = (d[50] || 0) * 50;
    const sub20 = (d[20] || 0) * 20;
    const sub10 = (d[10] || 0) * 10;
    const subCoins = d.coins || 0;
    const actualCash = sub500 + sub200 + sub100 + sub50 + sub20 + sub10 + subCoins;

    const tallyHtml = `
      <div id="counter-tally-printable-area" style="font-family: 'Courier New', monospace; font-size: 12.5px; color: #000; background: #fff; padding: 14px; line-height: 1.4;">
        <div style="text-align: center; margin-bottom: 10px;">
          <h2 style="font-size: 17px; font-weight: 900; margin: 0; text-transform: uppercase;">${settings.restaurantName || "Crust & Chilly"}</h2>
          <p style="font-size: 11px; margin: 2px 0;">CASH DRAWER TALLY SLIP</p>
          <p style="font-size: 11px; margin: 0;">Date: ${this.activeDateStr} | Shift Closing</p>
        </div>

        <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 6px 0; margin-bottom: 8px;">
          <strong style="text-decoration: underline;">PHYSICAL NOTE DENOMINATIONS:</strong>
          <table style="width: 100%; font-size: 12px; margin-top: 4px;">
            <tr><td>Rs 500 x ${d[500] || 0}</td><td style="text-align: right;">${currency}${sub500}</td></tr>
            <tr><td>Rs 200 x ${d[200] || 0}</td><td style="text-align: right;">${currency}${sub200}</td></tr>
            <tr><td>Rs 100 x ${d[100] || 0}</td><td style="text-align: right;">${currency}${sub100}</td></tr>
            <tr><td>Rs 50 x ${d[50] || 0}</td><td style="text-align: right;">${currency}${sub50}</td></tr>
            <tr><td>Rs 20 x ${d[20] || 0}</td><td style="text-align: right;">${currency}${sub20}</td></tr>
            <tr><td>Rs 10 x ${d[10] || 0}</td><td style="text-align: right;">${currency}${sub10}</td></tr>
            <tr><td>Coins Total</td><td style="text-align: right;">${currency}${subCoins}</td></tr>
            <tr style="border-top: 1px solid #000; font-weight: 900; font-size: 14px;">
              <td>TOTAL CASH COUNTED:</td>
              <td style="text-align: right;">${currency}${actualCash}</td>
            </tr>
          </table>
        </div>

        <div style="text-align: center; margin-top: 16px; font-size: 11px;">
          Cashier Sign: _____________________<br><br>
          Verified By: _____________________
        </div>
      </div>
    `;

    window.customModal.show({
      title: "Print Cash Tally Slip",
      bodyHtml: tallyHtml,
      confirmText: "Print Slip",
      cancelText: "Close",
      onConfirm: () => {
        document.body.classList.add("printing-counter-tally");
        window.print();
        setTimeout(() => {
          document.body.classList.remove("printing-counter-tally");
        }, 1000);
        return true;
      }
    });
  },

  showReceiptModal(orderId) {
    const orders = (window.db && window.db.get("orders")) || [];
    const order = orders.find(o => o.id === orderId);
    if (!order) {
      window.showToast("Order not found.", "error");
      return;
    }

    const settings = (window.db && window.db.get("settings")) || {};
    const currency = settings.currencySymbol || "₹";
    const dateStr = new Date(order.createdAt).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short"
    });

    const itemsHtml = (order.items || []).map(item => `
      <tr style="border-bottom: 1px dashed #cbd5e1;">
        <td style="padding: 6px 0; font-weight: 600;">${item.name}</td>
        <td style="padding: 6px 0; text-align: center;">x${item.quantity}</td>
        <td style="padding: 6px 0; text-align: right;">${currency}${item.price}</td>
        <td style="padding: 6px 0; text-align: right; font-weight: 700;">${currency}${item.lineTotal || (item.price * item.quantity)}</td>
      </tr>
    `).join("");

    const bodyHtml = `
      <div id="receipt-print-area" style="font-family: 'Courier New', monospace; font-size: 13px; color: #1e293b; background: #fff; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0; line-height: 1.4;">
        <div style="text-align: center; margin-bottom: 12px;">
          <h2 style="font-size: 18px; font-weight: 900; margin: 0; text-transform: uppercase;">${settings.restaurantName || "Crust & Chilly"}</h2>
          <p style="font-size: 11px; margin: 2px 0; color: #64748b;">${settings.address || "Shop No. 09, Shela, Ahmedabad"}</p>
          <p style="font-size: 11px; margin: 0; color: #64748b;">Mo: ${settings.phone || "+91 9664870840"}</p>
        </div>

        <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 6px 0; margin-bottom: 10px; font-size: 12px;">
          <div style="display: flex; justify-content: space-between;">
            <span><strong>Order:</strong> #${order.orderNumber || order.id}</span>
            <span><strong style="color: #2563eb; font-size: 15px;">Token #${order.tokenNumber || 1}</strong></span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 2px;">
            <span><strong>Date:</strong> ${dateStr}</span>
            <span><strong>Type:</strong> ${order.type || "Dine-in"}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 2px;">
            <span><strong>Customer:</strong> ${order.customerName || "Walk-in Guest"}</span>
            <span><strong>Pay:</strong> ${order.paymentMethod || "Cash"}</span>
          </div>
        </div>

        <table style="width: 100%; font-size: 12px; margin-bottom: 10px;">
          <thead>
            <tr style="border-bottom: 1px solid #000;">
              <th style="text-align: left; padding-bottom: 4px;">Item</th>
              <th style="text-align: center; padding-bottom: 4px;">Qty</th>
              <th style="text-align: right; padding-bottom: 4px;">Rate</th>
              <th style="text-align: right; padding-bottom: 4px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div style="border-top: 1px dashed #000; padding-top: 6px; font-size: 12px;">
          <div style="display: flex; justify-content: space-between;">
            <span>Subtotal:</span>
            <span>${currency}${Number(order.subtotal || 0).toFixed(2)}</span>
          </div>
          ${order.discount ? `
            <div style="display: flex; justify-content: space-between; color: #16a34a;">
              <span>Flat Discount:</span>
              <span>-${currency}${Number(order.discount).toFixed(2)}</span>
            </div>
          ` : ""}
          <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 900; border-top: 1px solid #000; margin-top: 6px; padding-top: 4px;">
            <span>GRAND TOTAL:</span>
            <span>${currency}${Number(order.total || 0).toFixed(2)}</span>
          </div>
        </div>

        <div style="text-align: center; margin-top: 14px; font-size: 11px; color: #64748b;">
          *** Thank You! Visit Again ***<br>
          Follow us on Instagram: @crustandchillyindia
        </div>
      </div>
    `;

    window.customModal.show({
      title: `Bill Receipt #${order.orderNumber || order.id}`,
      bodyHtml: bodyHtml,
      confirmText: "Print Receipt",
      cancelText: "Close",
      onConfirm: () => {
        window.print();
        return true;
      }
    });
  }
};
