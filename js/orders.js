// Crust & Chilly POS - Advanced Kitchen Display System (KDS) & Order Flow Module
// High-Visibility Kitchen Kanban, Interactive Item Cook Checklist, Live Dish Batch Aggregator,
// Category & Station Routing, SLA Urgency Visual Timers, KOT Thermal Slips, and Full Order Audit.
// (Sound-Free: 100% visual cues, zero audio interruptions)

// Safe no-op audio stub to prevent any residual external errors
window.soundAlerts = {
  soundEnabled: false,
  audioCtx: null,
  init() {},
  updateAllSoundUI() {},
  playNewOrderSound() {},
  playOneMinWarningSound() {},
  playOverdueSound() {},
  toggleSound() {}
};

window.views = window.views || {};
window.views.orders = {
  activeSubTab: "kds", // 'kds' | 'history'
  stationFilter: "all", // 'all' | categoryId
  typeFilter: "all", // 'all' | 'dine-in' | 'takeaway' | 'delivery'
  dishFilter: null, // null | specific dish name from aggregator
  prioritySort: "fifo", // 'fifo' (oldest first) | 'overdue' | 'newest'
  searchQuery: "",
  checkedItems: {}, // In-memory session checklist: { `${orderId}_${itemIndex}`: true }
  timerInterval: null,

  init(container) {
    if (this.timerInterval) clearInterval(this.timerInterval);

    container.innerHTML = `
      <div class="view-animate" style="display: flex; flex-direction: column; gap: 12px; width: 100%; min-width: 0;">
        
        <!-- Top Sub-Navigation Header & Controls -->
        <div style="background: #ffffff; padding: 10px 16px; border-radius: 16px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05); flex-wrap: wrap; gap: 10px;">
          
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <button class="btn ${this.activeSubTab === 'kds' ? 'btn-primary' : 'btn-secondary'}" id="btn-sub-kds" style="border-radius: 12px; padding: 7px 16px; font-weight: 850; font-size: 12.5px;">
              <i class="fa-solid fa-kitchen-set"></i> Kitchen KDS Queue
            </button>
            <button class="btn ${this.activeSubTab === 'history' ? 'btn-primary' : 'btn-secondary'}" id="btn-sub-history" style="border-radius: 12px; padding: 7px 16px; font-weight: 850; font-size: 12.5px;">
              <i class="fa-solid fa-clock-rotate-left"></i> Order Audit & KOT Slips
            </button>
          </div>
          
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <!-- Live Search Input -->
            <div style="width: 240px;">
              <input type="text" id="kds-quick-search-input" class="dash-search-input" style="width: 100%;" placeholder="🔍 Search Token, #, dish, table..." value="${this.searchQuery}">
            </div>

            <!-- Fullscreen Bump Mode Toggle -->
            <button type="button" id="btn-kds-fullscreen" class="kds-btn-fullscreen" title="Toggle Fullscreen Kitchen Screen">
              <i class="fa-solid fa-expand"></i> Fullscreen
            </button>
          </div>
        </div>

        <!-- Dynamic Mount view body -->
        <div id="orders-content-mount"></div>
      </div>
    `;

    this.setupSubNavListeners();
    this.renderActiveTab();
    this.startGlobalTimerLoop();
  },

  setupSubNavListeners() {
    const btnKds = document.getElementById("btn-sub-kds");
    const btnHistory = document.getElementById("btn-sub-history");
    const searchInput = document.getElementById("kds-quick-search-input");
    const btnFullscreen = document.getElementById("btn-kds-fullscreen");

    if (btnKds && btnHistory) {
      btnKds.onclick = () => {
        this.activeSubTab = "kds";
        btnKds.className = "btn btn-primary";
        btnHistory.className = "btn btn-secondary";
        this.renderActiveTab();
      };

      btnHistory.onclick = () => {
        this.activeSubTab = "history";
        btnHistory.className = "btn btn-primary";
        btnKds.className = "btn btn-secondary";
        this.renderActiveTab();
      };
    }

    if (searchInput) {
      searchInput.oninput = (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.renderActiveTab();
      };
    }

    if (btnFullscreen) {
      btnFullscreen.onclick = () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
          btnFullscreen.innerHTML = `<i class="fa-solid fa-compress"></i> Normal`;
        } else {
          document.exitFullscreen().catch(() => {});
          btnFullscreen.innerHTML = `<i class="fa-solid fa-expand"></i> Fullscreen`;
        }
      };
    }
  },

  renderActiveTab() {
    const mount = document.getElementById("orders-content-mount");
    if (!mount) return;

    if (this.activeSubTab === "kds") {
      this.renderKds(mount);
    } else {
      this.renderHistory(mount);
    }
  },

  // 1. KITCHEN DISPLAY QUEUE (KANBAN)
  renderKds(mount) {
    const allOrders = window.db.get("orders") || [];
    const products = window.db.get("products") || [];
    const categories = window.db.get("categories") || [];
    const settings = window.db.get("settings") || {};

    const targetMinutes = Number(settings.targetPrepMinutes) || 15;
    const targetSeconds = targetMinutes * 60;
    const now = new Date();

    // 1. Filter out completed/cancelled for active cooking pool
    let activeOrders = allOrders.filter(o => o.status === "Pending" || o.status === "Preparing" || o.status === "Ready");

    // 2. Filter by fulfillment type (All, Dine-in, Takeaway, Delivery)
    if (this.typeFilter !== "all") {
      activeOrders = activeOrders.filter(o => (o.type || "Dine-in").toLowerCase().includes(this.typeFilter));
    }

    // 3. Filter by Kitchen Station / Category
    if (this.stationFilter !== "all") {
      activeOrders = activeOrders.filter(o => {
        if (!Array.isArray(o.items)) return false;
        return o.items.some(item => {
          const prod = products.find(p => p.name === item.name);
          return prod && prod.category === this.stationFilter;
        });
      });
    }

    // 4. Filter by specific dish from batch aggregator
    if (this.dishFilter) {
      activeOrders = activeOrders.filter(o => {
        if (!Array.isArray(o.items)) return false;
        return o.items.some(i => i.name === this.dishFilter);
      });
    }

    // 5. Filter by Live Search Query
    if (this.searchQuery) {
      const q = this.searchQuery;
      activeOrders = activeOrders.filter(o =>
        String(o.orderNumber || "").toLowerCase().includes(q) ||
        String(o.tokenNumber || "").includes(q) ||
        (o.customerName && o.customerName.toLowerCase().includes(q)) ||
        (o.tableNumber && String(o.tableNumber).includes(q)) ||
        (Array.isArray(o.items) && o.items.some(i => i.name.toLowerCase().includes(q)))
      );
    }

    // 6. Sort Active Orders (FIFO / Urgent Overdue / Newest)
    const getOrderUrgencyAge = (o) => {
      const created = new Date(o.createdAt).getTime();
      return isNaN(created) ? 0 : created;
    };

    activeOrders.sort((a, b) => {
      if (this.prioritySort === "newest") {
        return getOrderUrgencyAge(b) - getOrderUrgencyAge(a);
      } else if (this.prioritySort === "overdue") {
        // Overdue first: compare remaining seconds
        const aStart = new Date(a.preparingStartedAt || a.createdAt).getTime();
        const bStart = new Date(b.preparingStartedAt || b.createdAt).getTime();
        return aStart - bStart;
      } else {
        // FIFO: Oldest order first (standard restaurant flow)
        return getOrderUrgencyAge(a) - getOrderUrgencyAge(b);
      }
    });

    const pendingOrders = activeOrders.filter(o => o.status === "Pending");
    const preparingOrders = activeOrders.filter(o => o.status === "Preparing");
    const readyOrders = activeOrders.filter(o => o.status === "Ready");

    // Calculate Overdue & SLA Metrics
    let overdueCount = 0;
    let nearingTargetCount = 0;

    preparingOrders.forEach(o => {
      const start = new Date(o.preparingStartedAt || o.createdAt);
      const elapsedSecs = Math.floor((now - start) / 1000);
      const remaining = targetSeconds - elapsedSecs;
      if (remaining <= 0) overdueCount++;
      else if (remaining <= 120) nearingTargetCount++;
    });

    // Average prep turnaround calculation for today
    const nowLocal = new Date();
    const todayLocalOffset = nowLocal.getTimezoneOffset() * 60000;
    const todayStr = new Date(nowLocal.getTime() - todayLocalOffset).toISOString().substring(0, 10);
    const todayCompletedOrders = allOrders.filter(o => {
      if (!o.createdAt || o.status === "Cancelled") return false;
      const d = new Date(o.createdAt);
      if (isNaN(d.getTime())) return false;
      const isToday = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().substring(0, 10) === todayStr;
      return isToday && (o.status === "Ready" || o.status === "Completed") && (o.prepDurationSeconds || (o.readyAt && o.createdAt));
    });

    let totalDurationSecs = 0;
    let onTimeCount = 0;
    todayCompletedOrders.forEach(o => {
      const dur = o.prepDurationSeconds || Math.round((new Date(o.readyAt || o.completedAt) - new Date(o.preparingStartedAt || o.createdAt)) / 1000);
      totalDurationSecs += Math.max(0, dur);
      if (dur <= targetSeconds) onTimeCount++;
    });

    const avgSecs = todayCompletedOrders.length > 0 ? Math.round(totalDurationSecs / todayCompletedOrders.length) : 0;
    const avgM = Math.floor(avgSecs / 60);
    const avgS = avgSecs % 60;
    const avgSpeedText = todayCompletedOrders.length > 0 ? `${avgM}m ${avgS}s` : "--m";
    const onTimeRate = todayCompletedOrders.length > 0 ? Math.round((onTimeCount / todayCompletedOrders.length) * 100) : 100;

    // Batch Cook Aggregator Matrix (Live dishes across Pending & Cooking)
    const cookingTickets = [...pendingOrders, ...preparingOrders];
    const dishCountMap = {};
    cookingTickets.forEach(o => {
      if (Array.isArray(o.items)) {
        o.items.forEach(it => {
          dishCountMap[it.name] = (dishCountMap[it.name] || 0) + (Number(it.quantity) || 1);
        });
      }
    });
    const dishAggregatorList = Object.entries(dishCountMap).sort((a, b) => b[1] - a[1]);

    // Station Categories count
    const stationCounts = {};
    categories.forEach(c => { stationCounts[c.id] = 0; });
    cookingTickets.forEach(o => {
      if (Array.isArray(o.items)) {
        o.items.forEach(it => {
          const prod = products.find(p => p.name === it.name);
          if (prod && prod.category && stationCounts[prod.category] !== undefined) {
            stationCounts[prod.category] += (Number(it.quantity) || 1);
          }
        });
      }
    });

    mount.innerHTML = `
      <!-- 1. Live Kitchen Command Performance Strip -->
      <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 16px; padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);">
        
        <!-- Metrics / Live SLAs -->
        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
          
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 11px; font-weight: 750; color: var(--text-muted); text-transform: uppercase;">Active Cooking:</span>
            <span style="font-size: 13px; font-weight: 900; color: #2563eb; background: #eff6ff; border: 1px solid #bfdbfe; padding: 2px 10px; border-radius: 8px;">
              ${pendingOrders.length + preparingOrders.length} Tickets
            </span>
          </div>

          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 11px; font-weight: 750; color: var(--text-muted); text-transform: uppercase;">Avg Turnaround:</span>
            <span style="font-size: 13px; font-weight: 900; color: #059669; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 2px 10px; border-radius: 8px;">
              ${avgSpeedText}
            </span>
          </div>

          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 11px; font-weight: 750; color: var(--text-muted); text-transform: uppercase;">On-Time SLA:</span>
            <span style="font-size: 13px; font-weight: 900; color: #0891b2; background: #ecfeff; border: 1px solid #a5f3fc; padding: 2px 10px; border-radius: 8px;">
              ${onTimeRate}%
            </span>
          </div>

          <!-- Visual Urgency Indicators (No loud sirens, clear visual alerts) -->
          ${overdueCount > 0 ? `
            <span style="font-size: 12px; font-weight: 900; color: #dc2626; background: #fef2f2; border: 1.5px solid #fca5a5; padding: 3px 10px; border-radius: 8px; display: inline-flex; align-items: center; gap: 5px;">
              <i class="fa-solid fa-triangle-exclamation"></i> ${overdueCount} Delayed Overtime
            </span>
          ` : nearingTargetCount > 0 ? `
            <span style="font-size: 12px; font-weight: 850; color: #d97706; background: #fffbeb; border: 1.5px solid #fde68a; padding: 3px 10px; border-radius: 8px; display: inline-flex; align-items: center; gap: 5px;">
              <i class="fa-solid fa-hourglass-end"></i> ${nearingTargetCount} Nearing Target
            </span>
          ` : `
            <span style="font-size: 12px; font-weight: 800; color: #059669; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 3px 10px; border-radius: 8px; display: inline-flex; align-items: center; gap: 5px;">
              <i class="fa-solid fa-circle-check"></i> Kitchen On-Time
            </span>
          `}
        </div>

        <!-- Controls: Filters, Target, Priority Sort -->
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          
          <!-- Order Type Filter Pills -->
          <div class="dash-period-pills" id="kds-type-filter-pills">
            <button type="button" class="dash-period-btn ${this.typeFilter === 'all' ? 'active' : ''}" data-type="all">All</button>
            <button type="button" class="dash-period-btn ${this.typeFilter === 'dine-in' ? 'active' : ''}" data-type="dine-in">Dine-in</button>
            <button type="button" class="dash-period-btn ${this.typeFilter === 'takeaway' ? 'active' : ''}" data-type="takeaway">Parcel</button>
            <button type="button" class="dash-period-btn ${this.typeFilter === 'delivery' ? 'active' : ''}" data-type="delivery">Delivery</button>
          </div>

          <!-- Target SLA Time Select -->
          <div style="display: flex; align-items: center; gap: 4px;">
            <span style="font-size: 11px; font-weight: 750; color: var(--text-muted);">SLA:</span>
            <select id="kds-target-select" class="form-input" style="height: 32px; font-size: 11.5px; padding: 2px 8px; border-radius: 8px; font-weight: 800; width: 110px;">
              <option value="5" ${targetMinutes === 5 ? 'selected' : ''}>5m (Fast)</option>
              <option value="10" ${targetMinutes === 10 ? 'selected' : ''}>10m</option>
              <option value="12" ${targetMinutes === 12 ? 'selected' : ''}>12m</option>
              <option value="15" ${targetMinutes === 15 ? 'selected' : ''}>15m (Std)</option>
              <option value="20" ${targetMinutes === 20 ? 'selected' : ''}>20m</option>
            </select>
          </div>

          <!-- Priority Sort Select -->
          <div style="display: flex; align-items: center; gap: 4px;">
            <span style="font-size: 11px; font-weight: 750; color: var(--text-muted);">Sort:</span>
            <select id="kds-priority-select" class="form-input" style="height: 32px; font-size: 11.5px; padding: 2px 8px; border-radius: 8px; font-weight: 800; width: 130px;">
              <option value="fifo" ${this.prioritySort === 'fifo' ? 'selected' : ''}>Oldest First (FIFO)</option>
              <option value="overdue" ${this.prioritySort === 'overdue' ? 'selected' : ''}>Overdue First</option>
              <option value="newest" ${this.prioritySort === 'newest' ? 'selected' : ''}>Newest First</option>
            </select>
          </div>

        </div>

      </div>

      <!-- 2. Kitchen Station / Category Routing Chips -->
      <div class="kds-station-filter-bar">
        <button type="button" class="kds-station-chip ${this.stationFilter === 'all' ? 'active' : ''}" onclick="views.orders.setStationFilter('all')">
          <i class="fa-solid fa-utensils"></i> All Stations
          <span class="kds-station-count">${cookingTickets.length}</span>
        </button>
        ${categories.map(cat => {
          const count = stationCounts[cat.id] || 0;
          return `
            <button type="button" class="kds-station-chip ${this.stationFilter === cat.id ? 'active' : ''}" onclick="views.orders.setStationFilter('${cat.id}')">
              <span>${cat.name}</span>
              ${count > 0 ? `<span class="kds-station-count">${count}</span>` : ''}
            </button>
          `;
        }).join("")}
      </div>

      <!-- 3. Batch Cook Aggregator Strip (Live Dish Matrix) -->
      ${dishAggregatorList.length > 0 ? `
        <div class="kds-aggregator-bar">
          <div class="kds-agg-title">
            <i class="fa-solid fa-fire-burner" style="color: #2563eb;"></i> Batch Summary:
          </div>
          <div class="kds-agg-items">
            ${dishAggregatorList.map(([dishName, count]) => {
              const isSelected = this.dishFilter === dishName;
              return `
                <div class="kds-agg-chip ${isSelected ? 'active-dish-filter' : ''}" onclick="views.orders.toggleDishFilter('${dishName.replace(/'/g, "\\'")}')" title="Click to filter tickets containing ${dishName}">
                  <span>${dishName}</span>
                  <span class="kds-agg-qty">${count}</span>
                </div>
              `;
            }).join("")}
            ${this.dishFilter ? `
              <button type="button" onclick="views.orders.toggleDishFilter(null)" style="background: none; border: none; color: #dc2626; font-size: 11px; font-weight: 800; cursor: pointer; text-decoration: underline; white-space: nowrap;">
                Clear Filter
              </button>
            ` : ''}
          </div>
        </div>
      ` : ''}

      <!-- 4. Kanban 4-Lane Board -->
      <div class="kds-board view-animate" id="kds-kanban-board">
        
        <!-- LANE 1: PENDING -->
        <div class="kds-column">
          <div class="kds-column-header pending">
            <span><i class="fa-regular fa-clock" style="color: #f59e0b; margin-right: 6px;"></i>Pending Orders</span>
            <span class="kds-order-count">${pendingOrders.length}</span>
          </div>
          <div class="kds-order-list">
            ${this.generateKdsCards(pendingOrders, "Pending", targetSeconds)}
          </div>
        </div>

        <!-- LANE 2: PREPARING (COOKING) -->
        <div class="kds-column">
          <div class="kds-column-header preparing">
            <span><i class="fa-solid fa-fire-burner" style="color: #2563eb; margin-right: 6px;"></i>Cooking (${targetMinutes}m)</span>
            <span class="kds-order-count">${preparingOrders.length}</span>
          </div>
          <div class="kds-order-list">
            ${this.generateKdsCards(preparingOrders, "Preparing", targetSeconds)}
          </div>
        </div>

        <!-- LANE 3: READY FOR PICKUP -->
        <div class="kds-column">
          <div class="kds-column-header ready">
            <span><i class="fa-solid fa-bell" style="color: #10b981; margin-right: 6px;"></i>Ready for Pickup</span>
            <span class="kds-order-count">${readyOrders.length}</span>
          </div>
          <div class="kds-order-list">
            ${this.generateKdsCards(readyOrders, "Ready", targetSeconds)}
          </div>
        </div>

        <!-- LANE 4: RECENTLY CLOSED & RECALL -->
        <div class="kds-column">
          <div class="kds-column-header completed">
            <span><i class="fa-solid fa-circle-check" style="color: #6366f1; margin-right: 6px;"></i>Recently Closed</span>
          </div>
          <div class="kds-order-list">
            ${this.generateClosedKdsCards(allOrders.filter(o => o.status === "Completed" || o.status === "Cancelled").slice(0, 6))}
          </div>
        </div>

      </div>
    `;

    // Hook Target Select
    const targetSelect = document.getElementById("kds-target-select");
    if (targetSelect) {
      targetSelect.onchange = (e) => {
        const val = Number(e.target.value) || 15;
        const curSettings = window.db.get("settings") || {};
        curSettings.targetPrepMinutes = val;
        window.db.set("settings", curSettings);
        window.showToast(`Target Kitchen SLA set to ${val} Minutes`, "info");
        this.renderActiveTab();
      };
    }

    // Hook Priority Sort
    const prioritySelect = document.getElementById("kds-priority-select");
    if (prioritySelect) {
      prioritySelect.onchange = (e) => {
        this.prioritySort = e.target.value;
        this.renderActiveTab();
      };
    }

    // Hook Fulfillment Type Filter Pills
    mount.querySelectorAll("#kds-type-filter-pills button").forEach(pill => {
      pill.onclick = () => {
        this.typeFilter = pill.getAttribute("data-type");
        this.renderActiveTab();
      };
    });

    // Hook Advance buttons (Start Cooking / Mark Ready / Complete)
    mount.querySelectorAll(".kds-btn-advance").forEach(btn => {
      btn.onclick = () => {
        const orderId = btn.getAttribute("data-id");
        const nextStatus = btn.getAttribute("data-next");
        window.db.updateOrderStatus(orderId, nextStatus);
        window.showToast(`Order status updated to ${nextStatus}`, "success");
        this.renderActiveTab();
      };
    });

    // Hook Recall buttons
    mount.querySelectorAll(".kds-btn-recall").forEach(btn => {
      btn.onclick = () => {
        const orderId = btn.getAttribute("data-id");
        const prevStatus = btn.getAttribute("data-prev") || "Preparing";
        window.db.updateOrderStatus(orderId, prevStatus);
        window.showToast(`Order #${orderId} recalled back to ${prevStatus}`, "info");
        this.renderActiveTab();
      };
    });

    // Hook Print KOT buttons
    mount.querySelectorAll(".kds-btn-kot").forEach(btn => {
      btn.onclick = () => {
        const orderId = btn.getAttribute("data-id");
        this.printKotSlip(orderId);
      };
    });

    // Hook Cancel / Void buttons
    mount.querySelectorAll(".kds-btn-cancel").forEach(btn => {
      btn.onclick = () => {
        const orderId = btn.getAttribute("data-id");
        if (confirm(`Cancel and void Order #${orderId}? Stock ingredients will be restored.`)) {
          window.db.updateOrderStatus(orderId, "Cancelled");
          window.showToast("Order cancelled & ingredients refunded.", "info");
          this.renderActiveTab();
        }
      };
    });

    // Hook Interactive Item Checkoff Checklist
    mount.querySelectorAll(".kds-order-item-check").forEach(itemEl => {
      itemEl.onclick = () => {
        const key = itemEl.getAttribute("data-check-key");
        this.checkedItems[key] = !this.checkedItems[key];
        itemEl.classList.toggle("item-done", this.checkedItems[key]);

        const card = itemEl.closest(".kds-order-card");
        if (card) {
          const totalChecks = card.querySelectorAll(".kds-order-item-check").length;
          const doneChecks = card.querySelectorAll(".kds-order-item-check.item-done").length;
          const allDone = totalChecks > 0 && totalChecks === doneChecks;

          card.classList.toggle("all-items-done", allDone);
          const doneBanner = card.querySelector(".kds-all-done-banner");
          if (doneBanner) {
            doneBanner.style.display = allDone ? "block" : "none";
          }
        }
      };
    });
  },

  setStationFilter(catId) {
    this.stationFilter = catId;
    this.renderActiveTab();
  },

  toggleDishFilter(dishName) {
    if (this.dishFilter === dishName) {
      this.dishFilter = null;
    } else {
      this.dishFilter = dishName;
    }
    this.renderActiveTab();
  },

  generateKdsCards(ordersList, lane, targetSeconds = 900) {
    if (ordersList.length === 0) {
      return `
        <div style="text-align: center; color: var(--text-muted); padding: 40px 10px; font-size: 13px; font-weight: 600;">
          <i class="fa-regular fa-folder-open" style="font-size: 24px; opacity: 0.35; display: block; margin-bottom: 8px; color: #2563eb;"></i>
          No tickets in this lane.
        </div>
      `;
    }

    const now = new Date();

    return ordersList.map(order => {
      const formattedTime = new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Interactive items checklist
      let allItemsDone = true;
      const itemsList = order.items || [];
      const itemsHtml = itemsList.map((item, idx) => {
        const checkKey = `${order.id}_${idx}`;
        const isDone = this.checkedItems[checkKey] === true;
        if (!isDone) allItemsDone = false;

        return `
          <li class="kds-order-item-check ${isDone ? 'item-done' : ''}" data-check-key="${checkKey}">
            <div style="display: flex; align-items: center; gap: 6px;">
              <i class="fa-regular ${isDone ? 'fa-square-check' : 'fa-square'}" style="font-size: 13px; color: ${isDone ? '#059669' : '#94a3b8'};"></i>
              <span style="font-weight: 750; color: var(--text-dark);">${item.name}</span>
            </div>
            <span class="kds-item-qty">x${item.quantity}</span>
          </li>
        `;
      }).join("");

      if (itemsList.length === 0) allItemsDone = false;

      let actionBtnText = "Start Cooking";
      let nextStatus = "Preparing";
      let icon = "fa-fire-burner";

      if (lane === "Preparing") {
        actionBtnText = "Mark Ready";
        nextStatus = "Ready";
        icon = "fa-bell";
      } else if (lane === "Ready") {
        actionBtnText = "Complete Order";
        nextStatus = "Completed";
        icon = "fa-circle-check";
      }

      // Timer calculations
      let isOverdue = false;
      let isOneMinLeft = false;
      let delayText = "";
      let cardBorderClass = "";
      let timerLabelHtml = `<i class="fa-regular fa-clock" style="margin-right: 4px;"></i> Time Left:`;
      let timerText = "--:--";
      let timerClass = "kds-timer-countdown";
      let containerClass = "kds-timer-container";
      let progressPct = 0;

      if (lane === "Pending") {
        const created = new Date(order.createdAt);
        const elapsedSecs = Math.floor((now - created) / 1000);
        const remainingSecs = Math.max(0, 15 - elapsedSecs);
        progressPct = Math.min(100, Math.round((elapsedSecs / 15) * 100));
        timerLabelHtml = `<i class="fa-regular fa-hourglass-half" style="margin-right: 4px; color: #f59e0b;"></i> Auto-Start:`;
        timerText = `${remainingSecs}s`;
      } else if (lane === "Preparing") {
        const autoPrepStartTime = new Date(order.createdAt).getTime() + 15 * 1000;
        const start = order.preparingStartedAt 
          ? new Date(Math.min(new Date(order.preparingStartedAt).getTime(), autoPrepStartTime)) 
          : new Date(autoPrepStartTime);
        const elapsedSecs = Math.floor((now - start) / 1000);
        const remainingSecs = targetSeconds - elapsedSecs;
        progressPct = Math.min(100, Math.round((elapsedSecs / targetSeconds) * 100));

        if (remainingSecs <= 0) {
          isOverdue = true;
          const diffSecs = Math.abs(remainingSecs);
          const dm = Math.floor(diffSecs / 60);
          const ds = diffSecs % 60;
          delayText = `+${dm}m ${ds}s Overtime`;
          timerLabelHtml = `<i class="fa-solid fa-triangle-exclamation" style="margin-right: 4px; color: #ef4444;"></i> Overtime:`;
          timerText = `Overdue (-${dm.toString().padStart(2, '0')}:${ds.toString().padStart(2, '0')})`;
          timerClass = "kds-timer-countdown overdue";
          containerClass = "kds-timer-container overdue";
          cardBorderClass = "border: 2px solid #ef4444 !important; background: #fff5f5;";
        } else if (remainingSecs <= 120) {
          isOneMinLeft = true;
          timerLabelHtml = `<i class="fa-solid fa-hourglass-end" style="margin-right: 4px; color: #d97706;"></i> Nearing SLA:`;
          const mins = Math.floor(remainingSecs / 60);
          const secs = remainingSecs % 60;
          timerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
          timerClass = "kds-timer-countdown warning-blink";
          containerClass = "kds-timer-container one-min-warn";
          cardBorderClass = "border: 2px solid #f59e0b !important; background: #fffdf5;";
        } else {
          const mins = Math.floor(remainingSecs / 60);
          const secs = remainingSecs % 60;
          timerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
      } else if (lane === "Ready") {
        const readyTime = new Date(order.readyAt || order.createdAt);
        const elapsedReadyMins = Math.max(0, Math.floor((now - readyTime) / 60000));
        timerLabelHtml = `<i class="fa-solid fa-bell" style="margin-right: 4px; color: #10b981;"></i> At Counter:`;
        timerText = `${elapsedReadyMins}m ago`;
      }

      const isDineIn = (order.type || "Dine-in").toLowerCase().includes("dine");
      const isTakeaway = (order.type || "").toLowerCase().includes("takeaway") || (order.type || "").toLowerCase().includes("parcel");
      const isDelivery = (order.type || "").toLowerCase().includes("delivery");

      let orderTypeBadge = `<span class="kds-order-type dine-in">${order.tableNumber ? `Table ${order.tableNumber}` : 'Dine-in'}</span>`;
      if (isTakeaway) orderTypeBadge = `<span class="kds-order-type takeaway">Parcel 🛍️</span>`;
      else if (isDelivery) orderTypeBadge = `<span class="kds-order-type delivery">Delivery 🛵</span>`;

      return `
        <div class="kds-order-card ${allItemsDone ? 'all-items-done' : ''}" style="${cardBorderClass}">
          
          <!-- Overtime Banner -->
          ${isOverdue ? `
            <div style="background: #dc2626; color: #fff; font-size: 10px; font-weight: 900; text-transform: uppercase; padding: 4px 8px; border-radius: 6px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <span style="display: flex; align-items: center; gap: 4px;"><i class="fa-solid fa-triangle-exclamation"></i> KITCHEN DELAY</span>
              <span>${delayText}</span>
            </div>
          ` : isOneMinLeft ? `
            <div style="background: #d97706; color: #fff; font-size: 10px; font-weight: 900; text-transform: uppercase; padding: 4px 8px; border-radius: 6px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <span style="display: flex; align-items: center; gap: 4px;"><i class="fa-solid fa-hourglass-end"></i> NEARING TARGET</span>
              <span>2 MINS LEFT</span>
            </div>
          ` : ""}

          <!-- Header: Token Number & Order Number -->
          <div class="kds-order-top">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 15px; font-weight: 900; color: #2563eb; background: #eff6ff; border: 1.5px solid #bfdbfe; padding: 2px 8px; border-radius: 8px;">
                TK #${order.tokenNumber || 1}
              </span>
              <span class="kds-order-num">#${order.orderNumber}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="kds-order-time">${formattedTime}</span>
              ${orderTypeBadge}
            </div>
          </div>

          <!-- Special Kitchen Instructions Banner -->
          ${order.notes ? `
            <div class="kds-note-banner">
              <i class="fa-solid fa-triangle-exclamation"></i>
              <span><strong>Note:</strong> ${order.notes}</span>
            </div>
          ` : ''}

          <!-- Items Checklist (Tap to strike off) -->
          <ul class="kds-order-items">
            ${itemsHtml}
          </ul>

          <!-- All Items Cooked Banner -->
          <div class="kds-all-done-banner" style="display: ${allItemsDone ? 'block' : 'none'};">
            <i class="fa-solid fa-circle-check"></i> All Items Prepared! Ready to Bump
          </div>

          <!-- Customer details -->
          <div class="kds-order-cust" style="font-weight: 600; display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
            <span><i class="fa-regular fa-user" style="color: #2563eb; margin-right: 4px;"></i> ${order.customerName || "Walk-in Guest"}</span>
            <span style="font-size: 11px; color: var(--text-muted);">${order.items ? order.items.length : 0} items</span>
          </div>

          <!-- Timer & Progress Bar (for Pending & Preparing) -->
          ${(lane === "Pending" || lane === "Preparing" || lane === "Ready") ? `
            <div class="${containerClass}">
              <span class="kds-timer-label">${timerLabelHtml}</span>
              <span class="${timerClass}">${timerText}</span>
            </div>
            ${lane !== "Ready" ? `
              <div class="kds-card-progress-bar">
                <div class="kds-card-progress-fill ${isOverdue ? 'overdue' : isOneMinLeft ? 'warn' : ''}" style="width: ${progressPct}%;"></div>
              </div>
            ` : ''}
          ` : ""}
          
          <!-- Actions Row -->
          <div style="display: flex; gap: 6px; width: 100%; margin-top: 8px; align-items: center;">
            <button class="kds-btn-advance" data-id="${order.id}" data-next="${nextStatus}" style="flex-grow: 1;">
              <i class="fa-solid ${icon}"></i> ${actionBtnText}
            </button>
            
            <!-- Print KOT button -->
            <button class="kds-btn-kot" data-id="${order.id}" title="Print Kitchen KOT Slip">
              <i class="fa-solid fa-print"></i> KOT
            </button>

            ${lane === "Ready" ? `
              <!-- Recall back to preparing -->
              <button class="kds-btn-recall" data-id="${order.id}" data-prev="Preparing" title="Recall back to Cooking lane">
                <i class="fa-solid fa-arrow-rotate-left"></i> Recall
              </button>
            ` : lane !== "Ready" ? `
              <button class="btn btn-danger kds-btn-cancel" data-id="${order.id}" title="Void Order" style="padding: 8px 10px; border-radius: 12px;">
                <i class="fa-solid fa-ban"></i>
              </button>
            ` : ""}
          </div>
        </div>
      `;
    }).join("");
  },

  generateClosedKdsCards(ordersList) {
    if (ordersList.length === 0) {
      return `<div style="text-align: center; color: var(--text-muted); padding: 40px 10px; font-size: 13px; font-weight: 600;">No recently closed orders.</div>`;
    }

    return ordersList.map(order => {
      const isCompleted = order.status === "Completed";
      const badgeClass = isCompleted ? "badge-completed" : "badge-cancelled";
      const prepDuration = order.prepDurationSeconds ? `${Math.floor(order.prepDurationSeconds / 60)}m ${order.prepDurationSeconds % 60}s` : "";

      return `
        <div class="kds-order-card" style="opacity: 0.9;">
          <div class="kds-order-top">
            <span class="kds-order-num">TK #${order.tokenNumber || 1} (#${order.orderNumber})</span>
            <div style="display: flex; gap: 6px; align-items: center;">
              ${prepDuration ? `<span style="font-size: 10.5px; font-weight: 700; color: #059669; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 1px 6px; border-radius: 6px;"><i class="fa-solid fa-stopwatch"></i> ${prepDuration}</span>` : ""}
              <span class="badge ${badgeClass}">${order.status.toUpperCase()}</span>
            </div>
          </div>
          <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 4px; font-weight: 500;">
            ${(order.items || []).map(i => `${i.name} (x${i.quantity})`).join(", ")}
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; font-size: 12px;">
            <span style="font-weight: 600; color: var(--text-dark);">${order.customerName || 'Walk-in'}</span>
            ${isCompleted ? `
              <button class="kds-btn-recall" data-id="${order.id}" data-prev="Preparing" title="Recall order back to kitchen queue">
                <i class="fa-solid fa-arrow-rotate-left"></i> Re-open
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join("");
  },

  // 2. KOT THERMAL PRINT GENERATOR
  printKotSlip(orderId) {
    const orders = window.db.get("orders") || [];
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const settings = window.db.get("settings") || {};
    const restaurantName = settings.restaurantName || "Crust & Chilly";
    const timeStr = new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const itemsHtml = (order.items || []).map(item => `
      <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 800; padding: 4px 0; border-bottom: 1px dashed #000;">
        <span>${item.name}</span>
        <span style="font-size: 16px;">x${item.quantity}</span>
      </div>
    `).join("");

    const kotHtml = `
      <div id="kot-print-area" style="font-family: 'Courier New', monospace; font-size: 13px; color: #000; background: #fff; padding: 16px; line-height: 1.4;">
        <div style="text-align: center; margin-bottom: 8px;">
          <h2 style="font-size: 18px; font-weight: 900; margin: 0;">*** KITCHEN ORDER TICKET (KOT) ***</h2>
          <p style="font-size: 12px; margin: 2px 0; font-weight: 700;">${restaurantName.toUpperCase()}</p>
        </div>

        <div style="border-top: 1.5px dashed #000; border-bottom: 1.5px dashed #000; padding: 6px 0; margin-bottom: 8px; font-size: 13px;">
          <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: 900;">
            <span>TOKEN: #${order.tokenNumber || 1}</span>
            <span>ORDER #${order.orderNumber || order.id}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 3px;">
            <span>Type: <strong>${order.type || "Dine-in"}</strong></span>
            <span>Time: <strong>${timeStr}</strong></span>
          </div>
          ${order.tableNumber ? `
            <div style="margin-top: 2px; font-weight: 800;">Table: ${order.tableNumber}</div>
          ` : ''}
        </div>

        <div style="margin-bottom: 10px;">
          <div style="font-weight: 800; margin-bottom: 4px;">ITEMS TO PREPARE:</div>
          ${itemsHtml}
        </div>

        ${order.notes ? `
          <div style="border: 1px solid #000; padding: 6px; margin-bottom: 8px; font-weight: 700;">
            KITCHEN NOTE: ${order.notes}
          </div>
        ` : ''}

        <div style="text-align: center; margin-top: 14px; font-size: 11px;">
          Chef Stamp / Cook Initials: _______________
        </div>
      </div>
    `;

    window.customModal.show({
      title: `Kitchen Order Ticket (KOT) #${order.orderNumber || order.id}`,
      bodyHtml: kotHtml,
      confirmText: "Print KOT",
      cancelText: "Close",
      onConfirm: () => {
        window.print();
        return true;
      }
    });
  },

  // 3. ORDER AUDIT & HISTORY TAB
  renderHistory(mount) {
    const orders = window.db.get("orders") || [];
    const settings = window.db.get("settings") || {};
    const currency = settings.currencySymbol || "₹";

    let filtered = orders;
    if (this.searchQuery) {
      const q = this.searchQuery;
      filtered = orders.filter(o =>
        String(o.orderNumber || "").toLowerCase().includes(q) ||
        String(o.tokenNumber || "").includes(q) ||
        (o.customerName && o.customerName.toLowerCase().includes(q)) ||
        (o.customerPhone && String(o.customerPhone).includes(q))
      );
    }

    let rowsHtml = "";
    if (filtered.length === 0) {
      rowsHtml = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 40px; font-weight: 600;">
            No orders found matching search criteria.
          </td>
        </tr>
      `;
    } else {
      rowsHtml = filtered.map(o => {
        const date = new Date(o.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
        const prepTime = o.prepDurationSeconds ? `${Math.floor(o.prepDurationSeconds / 60)}m ${o.prepDurationSeconds % 60}s` : "--";

        let statusBadge = "badge-pending";
        if (o.status === "Preparing") statusBadge = "badge-preparing";
        if (o.status === "Ready") statusBadge = "badge-ready";
        if (o.status === "Completed") statusBadge = "badge-completed";
        if (o.status === "Cancelled") statusBadge = "badge-cancelled";

        return `
          <tr>
            <td>
              <div style="font-weight: 850; color: var(--text-dark);">#${o.orderNumber}</div>
              <div style="font-size: 11px; font-weight: 850; color: #2563eb;">Token #${o.tokenNumber || 1}</div>
            </td>
            <td style="color: var(--text-muted); font-size: 12px; font-weight: 600;">${date}</td>
            <td>
              <div style="font-weight: 750; color: var(--text-dark);">${o.customerName || 'Walk-in'}</div>
              <div style="font-size: 11px; color: var(--text-muted);">${o.customerPhone || 'No Phone'}</div>
            </td>
            <td><span style="font-size: 11.5px; font-weight: 750; background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; padding: 2px 8px; border-radius: 8px;">${o.type}</span></td>
            <td style="font-weight: 850; color: #2563eb; font-size: 13.5px;">${currency}${Number(o.total || 0).toFixed(2)}</td>
            <td>
              <div style="display: flex; flex-direction: column; gap: 3px;">
                <span class="badge ${statusBadge}">${o.status}</span>
                ${o.status === "Completed" ? `<span style="font-size: 10px; color: #059669; font-weight: 700;"><i class="fa-solid fa-stopwatch"></i> ${prepTime}</span>` : ""}
              </div>
            </td>
            <td>
              <div style="display: flex; gap: 6px; align-items: center;">
                <button class="btn btn-secondary btn-reprint" data-id="${o.id}" style="padding: 5px 9px; font-size: 11px; border-radius: 8px;" title="Print Customer Bill Receipt">
                  <i class="fa-solid fa-print" style="color: #2563eb;"></i> Bill
                </button>
                <button class="kds-btn-kot" data-id="${o.id}" style="padding: 5px 9px; font-size: 11px; border-radius: 8px;" title="Print Kitchen KOT Slip">
                  <i class="fa-solid fa-receipt"></i> KOT
                </button>
                ${o.status !== "Cancelled" && o.status !== "Completed" ? `
                  <button class="btn btn-danger btn-cancel-history" data-id="${o.id}" style="padding: 5px 8px; font-size: 11px; border-radius: 8px;" title="Cancel Order">
                    <i class="fa-solid fa-ban"></i>
                  </button>
                ` : ""}
              </div>
            </td>
          </tr>
        `;
      }).join("");
    }

    mount.innerHTML = `
      <div class="table-container view-animate" style="max-height: 540px; overflow-y: auto;">
        <table class="premium-table" style="font-size: 12.5px;">
          <thead>
            <tr>
              <th>Order / Token</th>
              <th>Date & Time</th>
              <th>Customer</th>
              <th>Type</th>
              <th>Total Amount</th>
              <th>Status & Prep</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;

    // Bind reprint receipts
    mount.querySelectorAll(".btn-reprint").forEach(btn => {
      btn.onclick = () => {
        const orderId = btn.getAttribute("data-id");
        if (window.views.counter && window.views.counter.showReceiptModal) {
          window.views.counter.showReceiptModal(orderId);
        } else {
          const order = orders.find(o => o.id === orderId);
          if (order && window.views.pos && window.views.pos.showReceiptModal) {
            window.views.pos.showReceiptModal(order);
          }
        }
      };
    });

    // Bind KOT slips
    mount.querySelectorAll(".kds-btn-kot").forEach(btn => {
      btn.onclick = () => {
        const orderId = btn.getAttribute("data-id");
        this.printKotSlip(orderId);
      };
    });

    // Bind cancellation buttons
    mount.querySelectorAll(".btn-cancel-history").forEach(btn => {
      btn.onclick = () => {
        const orderId = btn.getAttribute("data-id");
        if (confirm(`Cancel and refund Order #${orderId}?`)) {
          window.db.updateOrderStatus(orderId, "Cancelled");
          window.showToast("Order Cancelled and Stock Restored.", "info");
          this.renderActiveTab();
        }
      };
    });
  },

  startGlobalTimerLoop() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    // Silent 1-second ticker for KDS visual countdown without audio
    this.timerInterval = setInterval(() => {
      if (this.activeSubTab === "kds" && window.app && window.app.activeView === "orders") {
        this.renderActiveTab();
      }
    }, 5000); // 5-second re-render interval to keep UI smooth and timers accurate
  }
};
