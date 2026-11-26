// Crust & Chilly POS - Advanced Dynamic Business Intelligence 360° & Reactive Analytics Suite
// Pure ES6+ Modular Engine: Multi-Tab Executive Hub, Category Margin Matrix, Customer VIP CRM,
// Daily Goal Pacing, Real-Time Cloud Reactivity, CSV/JSON Backup & WhatsApp Owner Reports.

(function () {
  "use strict";

  const businessIntel = {
    activeModalPeriod: "today", // 'today' | 'week' | 'month' | 'all'
    activeModalTab: "overview", // 'overview' | 'customers' | 'categories' | 'backup'
    isModalOpen: false,

    getLocalDateStr(d = new Date()) {
      const date = d instanceof Date ? d : new Date(d);
      if (isNaN(date.getTime())) return "";
      const offset = date.getTimezoneOffset() * 60000;
      return new Date(date.getTime() - offset).toISOString().substring(0, 10);
    },

    escapeHtml(str) {
      return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    },

    getPeriodRange(period) {
      const today = new Date();
      const todayStr = this.getLocalDateStr(today);
      if (period === "today") return { start: todayStr, end: todayStr, label: "Today" };
      if (period === "week") {
        const start = new Date(today);
        start.setDate(today.getDate() - 6);
        return { start: this.getLocalDateStr(start), end: todayStr, label: "Last 7 Days" };
      }
      if (period === "month") {
        const start = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
        return { start, end: todayStr, label: "This Month" };
      }
      return { start: "2000-01-01", end: "2099-12-31", label: "All-Time Lifetime" };
    },

    computeSnapshot(period = "today") {
      const orders = (window.db && window.db.get("orders")) || [];
      const expenses = (window.db && window.db.get("expenses")) || [];
      const products = (window.db && window.db.get("products")) || [];
      const categories = (window.db && window.db.get("categories")) || [];
      const settings = (window.db && window.db.get("settings")) || {};
      const { start, end, label } = this.getPeriodRange(period);

      const prodMap = new Map(products.map(p => [p.id, p]));
      const prodNameMap = new Map(products.map(p => [(p.name || "").toLowerCase(), p]));
      const catMap = new Map(categories.map(c => [c.id, c.name]));

      const validOrders = orders.filter(o => {
        if (!o || o.status === "Cancelled") return false;
        const dStr = this.getLocalDateStr(o.createdAt || o.date);
        return dStr >= start && dStr <= end;
      });

      const cancelledCount = orders.filter(o => {
        if (!o || o.status !== "Cancelled") return false;
        const dStr = this.getLocalDateStr(o.createdAt || o.date);
        return dStr >= start && dStr <= end;
      }).length;

      const periodExpenses = expenses.filter(ex => {
        if (!ex) return false;
        const dStr = this.getLocalDateStr(ex.date || ex.createdAt);
        return dStr >= start && dStr <= end;
      });

      let grossSales = 0;
      let totalDiscounts = 0;
      let totalCogs = 0;
      let totalItemsSold = 0;
      const payments = { Cash: 0, UPI: 0, Card: 0, Split: 0 };
      const channels = { "Dine-in": 0, Takeaway: 0, Delivery: 0 };
      const itemStats = new Map();
      const catStats = new Map();
      const hourStats = new Array(24).fill(0);
      const customerStats = new Map();

      categories.forEach(c => {
        catStats.set(c.id, { id: c.id, name: c.name, qty: 0, revenue: 0, cogs: 0, profit: 0 });
      });

      validOrders.forEach(o => {
        const total = Number(o.total) || 0;
        const disc = Number(o.discount) || 0;
        grossSales += total;
        totalDiscounts += disc;

        const pm = o.paymentMethod || "Cash";
        if (pm === "Split" && o.splitDetails) {
          payments.Cash += Number(o.splitDetails.cash) || 0;
          payments.UPI += Number(o.splitDetails.upi) || 0;
          payments.Card += Number(o.splitDetails.card) || 0;
        } else if (payments[pm] !== undefined) {
          payments[pm] += total;
        } else {
          payments.Cash += total;
        }

        const ch = o.type || "Dine-in";
        channels[ch] = (channels[ch] || 0) + 1;

        const dt = new Date(o.createdAt || o.date);
        if (!isNaN(dt.getTime())) {
          hourStats[dt.getHours()] += total;
        }

        // Customer CRM aggregation
        const phone = (o.customerPhone || "").replace(/\D/g, "");
        const cname = (o.customerName || "Walk-in Customer").trim();
        if (phone.length >= 10) {
          const cur = customerStats.get(phone) || { name: cname, phone, visits: 0, spent: 0, lastVisit: o.createdAt, favMap: new Map() };
          cur.visits += 1;
          cur.spent += total;
          if (cname && cname !== "Walk-in Customer") cur.name = cname;
          if (new Date(o.createdAt) > new Date(cur.lastVisit)) cur.lastVisit = o.createdAt;
          (o.items || []).forEach(it => {
            cur.favMap.set(it.name, (cur.favMap.get(it.name) || 0) + (Number(it.quantity) || 1));
          });
          customerStats.set(phone, cur);
        }

        // Items, Categories & Exact COGS
        (o.items || []).forEach(it => {
          const qty = Number(it.quantity) || 1;
          totalItemsSold += qty;
          const rev = (Number(it.price) || 0) * qty;
          const prod = prodMap.get(it.productId) || prodNameMap.get((it.name || "").toLowerCase());
          const unitCost = prod && prod.costPrice ? Number(prod.costPrice) : (Number(it.price) || 0) * 0.32;
          const cost = unitCost * qty;
          totalCogs += cost;

          const curIt = itemStats.get(it.name) || { name: it.name, qty: 0, revenue: 0, profit: 0 };
          curIt.qty += qty;
          curIt.revenue += rev;
          curIt.profit += (rev - cost);
          itemStats.set(it.name, curIt);

          const catId = (prod && prod.category) || it.category || "other";
          const catEntry = catStats.get(catId) || { id: catId, name: catMap.get(catId) || "Other", qty: 0, revenue: 0, cogs: 0, profit: 0 };
          catEntry.qty += qty;
          catEntry.revenue += rev;
          catEntry.cogs += cost;
          catEntry.profit += (rev - cost);
          catStats.set(catId, catEntry);
        });
      });

      const totalExpenses = periodExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const netProfit = grossSales - totalCogs - totalExpenses;
      const netMarginPct = grossSales > 0 ? Math.round((netProfit / grossSales) * 1000) / 10 : 0;
      const avgTicket = validOrders.length > 0 ? Math.round(grossSales / validOrders.length) : 0;

      const topItems = Array.from(itemStats.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
      const topProfitItems = Array.from(itemStats.values()).sort((a, b) => b.profit - a.profit).slice(0, 3);
      const categoryBreakdown = Array.from(catStats.values())
        .map(c => ({
          ...c,
          marginPct: c.revenue > 0 ? Math.round((c.profit / c.revenue) * 100) : 0
        }))
        .sort((a, b) => b.revenue - a.revenue);

      const allCustomers = Array.from(customerStats.values())
        .map(c => {
          let fav = "—";
          let maxQ = 0;
          c.favMap.forEach((q, n) => { if (q > maxQ) { maxQ = q; fav = n; } });
          return {
            name: c.name,
            phone: c.phone,
            visits: c.visits,
            spent: Math.round(c.spent),
            avgOrder: Math.round(c.spent / Math.max(1, c.visits)),
            lastVisit: this.getLocalDateStr(c.lastVisit),
            favorite: fav
          };
        })
        .sort((a, b) => b.spent - a.spent);

      const repeatCustomersCount = allCustomers.filter(c => c.visits > 1).length;
      const repeatRatePct = allCustomers.length > 0 ? Math.round((repeatCustomersCount / allCustomers.length) * 100) : 0;

      let peakHour = -1;
      let peakHourRev = 0;
      hourStats.forEach((rev, h) => {
        if (rev > peakHourRev) { peakHourRev = rev; peakHour = h; }
      });

      const formatHour = (h) => {
        if (h < 0) return "No rush yet";
        const ampm = h >= 12 ? "PM" : "AM";
        const h12 = h % 12 || 12;
        const nextH = (h + 1) % 12 || 12;
        const nextAmpm = (h + 1) >= 12 && (h + 1) < 24 ? "PM" : "AM";
        return `${h12} ${ampm} – ${nextH} ${nextAmpm}`;
      };

      const digitalTotal = payments.UPI + payments.Card;
      const digitalPct = grossSales > 0 ? Math.round((digitalTotal / grossSales) * 100) : 0;
      const dailyGoal = Number(settings.dailyGoal) || 5000;
      const goalPct = period === "today" ? Math.min(100, Math.round((grossSales / Math.max(1, dailyGoal)) * 100)) : null;

      return {
        period,
        label,
        billsCount: validOrders.length,
        cancelledCount,
        totalItemsSold,
        grossSales: Math.round(grossSales),
        totalDiscounts: Math.round(totalDiscounts),
        totalCogs: Math.round(totalCogs),
        totalExpenses: Math.round(totalExpenses),
        netProfit: Math.round(netProfit),
        netMarginPct,
        avgTicket,
        dailyGoal,
        goalPct,
        payments,
        channels,
        digitalPct,
        topItems,
        topProfitItems,
        categoryBreakdown,
        customers: allCustomers,
        repeatRatePct,
        peakHourLabel: formatHour(peakHour),
        peakHourShare: grossSales > 0 ? Math.round((peakHourRev / grossSales) * 100) : 0,
        rawOrders: validOrders
      };
    },

    // Build Dynamic Insight Cards for Executive Dashboard
    getSmartInsightCards() {
      const snap = this.computeSnapshot("today");
      const weekSnap = this.computeSnapshot("week");
      const activeSnap = snap.billsCount > 0 ? snap : weekSnap;
      const scopeTag = snap.billsCount > 0 ? "Today" : "7-Day";

      const topProfit = activeSnap.topProfitItems[0];
      const expenseRatio = activeSnap.grossSales > 0 ? Math.round((activeSnap.totalExpenses / activeSnap.grossSales) * 100) : 0;

      return [
        {
          icon: "fa-bolt",
          color: "#ea580c",
          bg: "#fff7ed",
          tab: "overview",
          title: `Peak Rush (${scopeTag})`,
          value: activeSnap.peakHourLabel,
          sub: activeSnap.peakHourShare > 0 ? `${activeSnap.peakHourShare}% of revenue • ${activeSnap.totalItemsSold} items` : "Awaiting live orders"
        },
        {
          icon: "fa-crown",
          color: "#059669",
          bg: "#ecfdf5",
          tab: "categories",
          title: `Top Profit Dish (${scopeTag})`,
          value: topProfit ? topProfit.name : "No sales yet",
          sub: topProfit ? `₹${Math.round(topProfit.profit).toLocaleString()} net margin (${topProfit.qty} sold)` : "Tap to view Category Margins"
        },
        {
          icon: "fa-qrcode",
          color: "#2563eb",
          bg: "#eff6ff",
          tab: "overview",
          title: "Digital / UPI Share",
          value: `${activeSnap.digitalPct}% Cashless`,
          sub: `UPI ₹${Math.round(activeSnap.payments.UPI).toLocaleString()} • Cash ₹${Math.round(activeSnap.payments.Cash).toLocaleString()}`
        },
        {
          icon: "fa-users",
          color: "#7c3aed",
          bg: "#f5f3ff",
          tab: "customers",
          title: `Customers & Margin (${scopeTag})`,
          value: `${activeSnap.netMarginPct}% Net Margin`,
          sub: `${activeSnap.customers.length} VIPs (${activeSnap.repeatRatePct}% repeat) • Exp ${expenseRatio}%`
        }
      ];
    },

    // Open Multi-Tab 360° Business Overview Modal
    openBusiness360Modal(period = this.activeModalPeriod || "today", tab = this.activeModalTab || "overview") {
      this.activeModalPeriod = period;
      this.activeModalTab = tab;
      this.isModalOpen = true;

      const snap = this.computeSnapshot(period);
      const products = (window.db && window.db.get("products")) || [];
      const orders = (window.db && window.db.get("orders")) || [];
      const activeKds = orders.filter(o => o.status === "Pending" || o.status === "Preparing").length;

      const tabHtml = tab === "overview"
        ? this.renderOverviewTab(snap)
        : tab === "customers"
          ? this.renderCustomersTab(snap)
          : tab === "categories"
            ? this.renderCategoriesTab(snap)
            : this.renderBackupTab(snap);

      const bodyHtml = `
        <div class="b360-container">
          <div class="b360-period-bar">
            <div class="b360-pills">
              ${["today", "week", "month", "all"].map(p => `
                <button type="button" class="b360-pill ${period === p ? "active" : ""}" onclick="window.businessIntel.openBusiness360Modal('${p}', '${tab}')">
                  ${p === "today" ? "Today" : p === "week" ? "Last 7 Days" : p === "month" ? "This Month" : "All-Time"}
                </button>
              `).join("")}
            </div>
            <div class="b360-live-pills">
              <span class="b360-chip"><i class="fa-solid fa-fire-burner" style="color:#ea580c;"></i> ${activeKds} Active KDS</span>
              <span class="b360-chip"><i class="fa-solid fa-utensils" style="color:#2563eb;"></i> ${products.length} Items</span>
            </div>
          </div>

          <div class="b360-tabs-bar">
            <button type="button" class="b360-tab-btn ${tab === "overview" ? "active" : ""}" onclick="window.businessIntel.openBusiness360Modal('${period}', 'overview')">
              <i class="fa-solid fa-chart-pie"></i> Overview & P&L
            </button>
            <button type="button" class="b360-tab-btn ${tab === "categories" ? "active" : ""}" onclick="window.businessIntel.openBusiness360Modal('${period}', 'categories')">
              <i class="fa-solid fa-layer-group"></i> Category Margins
            </button>
            <button type="button" class="b360-tab-btn ${tab === "customers" ? "active" : ""}" onclick="window.businessIntel.openBusiness360Modal('${period}', 'customers')">
              <i class="fa-solid fa-crown"></i> VIP Customers (${snap.customers.length})
            </button>
            <button type="button" class="b360-tab-btn ${tab === "backup" ? "active" : ""}" onclick="window.businessIntel.openBusiness360Modal('${period}', 'backup')">
              <i class="fa-solid fa-database"></i> Backup & Export
            </button>
          </div>

          <div class="b360-tab-content">
            ${tabHtml}
          </div>
        </div>
      `;

      if (window.customModal) {
        window.customModal.show({
          title: "Crust & Chilly — Business 360° Executive Hub",
          bodyHtml,
          hideFooter: true,
          onCancel: () => { this.isModalOpen = false; }
        });
      }
    },

    renderOverviewTab(snap) {
      const goalBar = snap.goalPct !== null ? `
        <div class="b360-goal-wrap">
          <div class="b360-goal-head">
            <span><i class="fa-solid fa-bullseye" style="color:#ea580c;"></i> Today's Revenue Goal Progress</span>
            <strong>₹${snap.grossSales.toLocaleString()} / ₹${snap.dailyGoal.toLocaleString()} (${snap.goalPct}%)</strong>
          </div>
          <div class="b360-progress-track">
            <div class="b360-progress-fill" style="width: ${snap.goalPct}%;"></div>
          </div>
        </div>
      ` : "";

      return `
        <div class="b360-kpi-row">
          <div class="b360-kpi-card">
            <span class="b360-kpi-lbl">Gross Sales (${snap.label})</span>
            <strong class="b360-kpi-val num-tabular" style="color: #ea580c;">₹${snap.grossSales.toLocaleString()}</strong>
            <small>${snap.billsCount} Bills • Avg ₹${snap.avgTicket}</small>
          </div>
          <div class="b360-kpi-card">
            <span class="b360-kpi-lbl">Food Cost (COGS)</span>
            <strong class="b360-kpi-val num-tabular" style="color: #b45309;">₹${snap.totalCogs.toLocaleString()}</strong>
            <small>${snap.totalItemsSold} Dishes Sold</small>
          </div>
          <div class="b360-kpi-card">
            <span class="b360-kpi-lbl">Expenses & Disc.</span>
            <strong class="b360-kpi-val num-tabular" style="color: #e11d48;">₹${snap.totalExpenses.toLocaleString()}</strong>
            <small>Disc: ₹${snap.totalDiscounts.toLocaleString()} • Void: ${snap.cancelledCount}</small>
          </div>
          <div class="b360-kpi-card highlight">
            <span class="b360-kpi-lbl">True Net Profit</span>
            <strong class="b360-kpi-val num-tabular" style="color: ${snap.netProfit >= 0 ? "#059669" : "#e11d48"};">₹${snap.netProfit.toLocaleString()}</strong>
            <small>${snap.netMarginPct}% Net Margin</small>
          </div>
        </div>

        ${goalBar}

        <div class="b360-grid-2">
          <div class="b360-box">
            <h4><i class="fa-solid fa-trophy" style="color: #f59e0b;"></i> Top 5 Selling Dishes</h4>
            ${snap.topItems.length === 0 ? `<div class="b360-empty">No sales recorded in this period.</div>` : `
              <div class="b360-list">
                ${snap.topItems.map((it, idx) => `
                  <div class="b360-list-row">
                    <span><strong>#${idx + 1}</strong> ${this.escapeHtml(it.name)}</span>
                    <span class="num-tabular"><strong>${it.qty}x</strong> • ₹${Math.round(it.revenue).toLocaleString()}</span>
                  </div>
                `).join("")}
              </div>
            `}
          </div>

          <div class="b360-box">
            <h4><i class="fa-solid fa-wallet" style="color: #2563eb;"></i> Payments & Order Channels</h4>
            <div class="b360-list">
              <div class="b360-list-row"><span><i class="fa-solid fa-qrcode" style="color:#2563eb;"></i> UPI Digital (${snap.digitalPct}%)</span><strong class="num-tabular">₹${Math.round(snap.payments.UPI).toLocaleString()}</strong></div>
              <div class="b360-list-row"><span><i class="fa-solid fa-money-bill-wave" style="color:#059669;"></i> Cash Drawer</span><strong class="num-tabular">₹${Math.round(snap.payments.Cash).toLocaleString()}</strong></div>
              <div class="b360-list-row"><span><i class="fa-solid fa-credit-card" style="color:#7c3aed;"></i> Card</span><strong class="num-tabular">₹${Math.round(snap.payments.Card).toLocaleString()}</strong></div>
              <div class="b360-list-row" style="border-top: 1px dashed #e2e8f0; padding-top: 7px; margin-top: 4px;">
                <span>Dine-in: <strong>${snap.channels["Dine-in"] || 0}</strong> • Takeaway: <strong>${snap.channels.Takeaway || 0}</strong></span>
                <span>Delivery: <strong>${snap.channels.Delivery || 0}</strong></span>
              </div>
            </div>
          </div>
        </div>
      `;
    },

    renderCategoriesTab(snap) {
      const maxRev = Math.max(1, ...snap.categoryBreakdown.map(c => c.revenue));
      return `
        <div class="b360-box">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <h4 style="margin:0;"><i class="fa-solid fa-layer-group" style="color:#ea580c;"></i> Category-Wise Revenue & Profit Matrix</h4>
            <span class="b360-chip">${snap.totalItemsSold} Total Qty</span>
          </div>
          <div class="b360-table-wrap">
            <table class="b360-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Sold</th>
                  <th>Revenue</th>
                  <th>Food Cost</th>
                  <th>Net Margin</th>
                </tr>
              </thead>
              <tbody>
                ${snap.categoryBreakdown.map(c => `
                  <tr>
                    <td>
                      <div style="font-weight:700; color:#0f172a;">${this.escapeHtml(c.name)}</div>
                      <div class="b360-mini-bar"><div style="width:${Math.round((c.revenue / maxRev) * 100)}%;"></div></div>
                    </td>
                    <td class="num-tabular">${c.qty}</td>
                    <td class="num-tabular" style="font-weight:700;">₹${Math.round(c.revenue).toLocaleString()}</td>
                    <td class="num-tabular" style="color:#b45309;">₹${Math.round(c.cogs).toLocaleString()}</td>
                    <td class="num-tabular" style="color:#059669; font-weight:700;">₹${Math.round(c.profit).toLocaleString()} (${c.marginPct}%)</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;
    },

    renderCustomersTab(snap) {
      if (snap.customers.length === 0) {
        return `<div class="b360-box"><div class="b360-empty">No customer phone numbers recorded in ${snap.label}. Enter customer phone numbers at POS billing to build your VIP CRM!</div></div>`;
      }
      return `
        <div class="b360-box">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
            <h4 style="margin:0;"><i class="fa-solid fa-crown" style="color:#f59e0b;"></i> Customer VIP Leaderboard (${snap.customers.length})</h4>
            <span class="b360-chip" style="background:#f5f3ff; color:#6d28d9; border-color:#ddd6fe;">Repeat Rate: ${snap.repeatRatePct}%</span>
          </div>
          <div class="b360-table-wrap">
            <table class="b360-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Visits</th>
                  <th>Total Spent</th>
                  <th>Favorite Dish</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${snap.customers.slice(0, 15).map(c => `
                  <tr>
                    <td>
                      <div style="font-weight:700; color:#0f172a;">${this.escapeHtml(c.name)}</div>
                      <div style="font-size:11px; color:#64748b;">+91 ${this.escapeHtml(c.phone)}</div>
                    </td>
                    <td class="num-tabular"><strong>${c.visits}x</strong></td>
                    <td class="num-tabular" style="font-weight:700; color:#059669;">₹${c.spent.toLocaleString()}</td>
                    <td style="font-size:11.5px; color:#334155;">${this.escapeHtml(c.favorite)}</td>
                    <td>
                      <button type="button" class="btn-b360-wa-mini" onclick="window.businessIntel.messageCustomerWhatsApp('${this.escapeHtml(c.phone)}', '${this.escapeHtml(c.name)}')" title="Send Thank-You / Offer on WhatsApp">
                        <i class="fa-brands fa-whatsapp"></i> Greet
                      </button>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;
    },

    renderBackupTab(snap) {
      return `
        <div class="b360-box">
          <h4><i class="fa-solid fa-share-nodes" style="color:#059669;"></i> Owner Reports & Full Business Backup</h4>
          <p style="font-size:12px; color:#64748b; margin-bottom:14px;">
            Share an instant ${snap.label} summary on WhatsApp, export orders to Excel CSV, or download a complete JSON backup of your restaurant database.
          </p>
          <div class="b360-actions-footer">
            <button type="button" class="btn-b360 whatsapp" onclick="window.businessIntel.shareWhatsAppSummary('${snap.period}')">
              <i class="fa-brands fa-whatsapp"></i> Share Summary on WhatsApp
            </button>
            <button type="button" class="btn-b360 csv" onclick="window.businessIntel.exportOrdersCsv('${snap.period}')">
              <i class="fa-solid fa-file-csv"></i> Export ${snap.label} Bills CSV
            </button>
            <button type="button" class="btn-b360 backup" onclick="window.businessIntel.exportFullBackup()">
              <i class="fa-solid fa-download"></i> Full JSON Backup
            </button>
            <label class="btn-b360 restore" title="Restore data from a saved JSON backup">
              <i class="fa-solid fa-upload"></i> Restore Backup
              <input type="file" accept=".json" style="display:none;" onchange="window.businessIntel.importFullBackup(this)">
            </label>
          </div>
        </div>
      `;
    },

    messageCustomerWhatsApp(phone, name) {
      const cleanPhone = String(phone).replace(/\D/g, "");
      const target = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
      const msg = `Hello ${name}! Thank you for visiting *Crust & Chilly*! We truly appreciate your love for our food. Visit us again soon for fresh burgers, tikka pav & mojitos!`;
      window.open(`https://wa.me/${target}?text=${encodeURIComponent(msg)}`, "_blank");
    },

    shareWhatsAppSummary(period = "today") {
      const snap = this.computeSnapshot(period);
      const topList = snap.topItems.slice(0, 3).map((i, idx) => `${idx + 1}. ${i.name} (${i.qty}x - ₹${Math.round(i.revenue)})`).join("\n");
      const msg = [
        `*CRUST & CHILLY — BUSINESS REPORT (${snap.label.toUpperCase()})*`,
        `Date: ${new Date().toLocaleDateString("en-IN")}`,
        `--------------------------------`,
        `*Gross Sales:* ₹${snap.grossSales.toLocaleString()} (${snap.billsCount} Bills)`,
        `*Avg Ticket:* ₹${snap.avgTicket}`,
        `*Food Cost (COGS):* ₹${snap.totalCogs.toLocaleString()}`,
        `*Expenses:* ₹${snap.totalExpenses.toLocaleString()}`,
        `*Net Profit:* ₹${snap.netProfit.toLocaleString()} (${snap.netMarginPct}%)`,
        `--------------------------------`,
        `*Payments:* UPI ₹${Math.round(snap.payments.UPI)} | Cash ₹${Math.round(snap.payments.Cash)} | Card ₹${Math.round(snap.payments.Card)}`,
        topList ? `--------------------------------\n*Top Sellers:*\n${topList}` : ""
      ].filter(Boolean).join("\n");

      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
      if (window.showToast) window.showToast("Opening WhatsApp Business Summary...", "success");
    },

    exportOrdersCsv(period = "today") {
      const snap = this.computeSnapshot(period);
      if (snap.rawOrders.length === 0) {
        if (window.showToast) window.showToast("No orders found in this period to export.", "info");
        return;
      }
      const headers = ["Bill No", "Date", "Customer", "Phone", "Type", "Payment", "Items", "Discount", "Total"];
      const rows = snap.rawOrders.map(o => [
        `"${o.orderNumber || o.id}"`,
        `"${this.getLocalDateStr(o.createdAt)}"`,
        `"${(o.customerName || "Walk-in").replace(/"/g, '""')}"`,
        `"${o.customerPhone || ""}"`,
        `"${o.type || "Dine-in"}"`,
        `"${o.paymentMethod || "Cash"}"`,
        `"${(o.items || []).map(i => `${i.name} x${i.quantity}`).join("; ").replace(/"/g, '""')}"`,
        Number(o.discount) || 0,
        Number(o.total) || 0
      ].join(","));

      const csv = [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `crust-chilly-bills-${period}-${this.getLocalDateStr()}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      if (window.showToast) window.showToast(`Exported ${snap.rawOrders.length} bills to CSV!`, "success");
    },

    exportFullBackup() {
      if (!window.db) return;
      const keys = ["users", "categories", "ingredients", "products", "settings", "permissions", "orders", "expenses", "purchases", "orderCounter"];
      const payload = {
        app: "Crust & Chilly POS",
        exportedAt: new Date().toISOString(),
        data: {}
      };
      keys.forEach(k => { payload.data[k] = window.db.get(k); });

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `crust-chilly-backup-${this.getLocalDateStr()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      if (window.showToast) window.showToast("Full Business Backup downloaded successfully!", "success");
    },

    importFullBackup(input) {
      const file = input && input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target.result);
          if (!parsed || !parsed.data || !Array.isArray(parsed.data.products)) {
            throw new Error("Invalid backup format");
          }
          Object.keys(parsed.data).forEach(k => {
            if (parsed.data[k] !== null && parsed.data[k] !== undefined) {
              window.db.set(k, parsed.data[k]);
            }
          });
          if (window.showToast) window.showToast("Backup restored! Refreshing view...", "success");
          if (window.customModal) window.customModal.hide();
          if (window.app && window.app.route) window.app.route();
        } catch (err) {
          if (window.showToast) window.showToast("Invalid backup file. Please select a valid .json export.", "error");
        }
      };
      reader.readAsText(file);
    }
  };

  // Real-time reactive listener: auto-refresh Business 360 modal if open when live data updates
  window.addEventListener("db-update", () => {
    const modalEl = document.getElementById("modal-container");
    if (businessIntel.isModalOpen && modalEl && modalEl.classList.contains("active")) {
      businessIntel.openBusiness360Modal(businessIntel.activeModalPeriod, businessIntel.activeModalTab);
    }
  });

  window.businessIntel = businessIntel;
})();
