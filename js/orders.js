// Crust & Chilly POS - Advanced Kitchen Display System (KDS 2.0)
// High-Visibility Kanban Board, Chef Expo Batch Prep View, Live In-Place Urgency Timers,
// Station Routing, Smart Modifiers, Fast 1-Touch Bump, Instant Recall & Thermal KOT Slips.
// (Sound-Free: 100% visual cues, zero audio disturbances)

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
  activeSubTab: "kds", // 'kds' (Kanban) | 'expo' (Chef Batch Prep) | 'history' (Order Audit & KOT)
  stationFilter: "all", // 'all' | categoryId
  typeFilter: "all", // 'all' | 'dine-in' | 'takeaway' | 'delivery'
  dishFilter: null, // null | specific dish name from aggregator
  rushOnlyFilter: false, // boolean: show only overdue / urgent orders
  layoutMode: "4-lane", // '4-lane' default (with completed column) | '3-lane'
  prioritySort: "fifo", // 'fifo' (oldest first) | 'overdue' | 'newest'
  searchQuery: "",
  checkedItems: {}, // In-memory session checklist: { `${orderId}_${itemIndex}`: true }
  timerInterval: null,
  containerEl: null,

  init(container) {
    this.containerEl = container;
    if (this.timerInterval) clearInterval(this.timerInterval);

    container.innerHTML = `
      <div class="view-animate" style="display: flex; flex-direction: column; gap: 12px; width: 100%; min-width: 0;">
        
        <!-- Top Sub-Navigation Header & Controls -->
        <div class="kds-top-header-bar">
          
          <!-- View Modes Navigation -->
          <div class="kds-subnav-group">
            <button class="btn ${this.activeSubTab === 'kds' ? 'btn-primary' : 'btn-secondary'} kds-subtab-btn" id="btn-sub-kds">
              <i class="fa-solid fa-kitchen-set"></i> Kitchen Kanban
              <span id="kds-tab-active-badge" class="kds-tab-badge">0</span>
            </button>

            <button class="btn ${this.activeSubTab === 'expo' ? 'btn-primary' : 'btn-secondary'} kds-subtab-btn" id="btn-sub-expo" title="Consolidated Chef Batch Prep View">
              <i class="fa-solid fa-fire-burner"></i> Chef Expo / Batch Cook
              <span id="kds-tab-expo-badge" class="kds-tab-badge expo">0</span>
            </button>

            <button class="btn ${this.activeSubTab === 'history' ? 'btn-primary' : 'btn-secondary'} kds-subtab-btn" id="btn-sub-history">
              <i class="fa-solid fa-clock-rotate-left"></i> Order Audit & KOT Slips
            </button>
          </div>
          
          <!-- Fast Kitchen Utility Bar -->
          <div class="kds-util-group">
            <!-- Live Search Input -->
            <div class="kds-search-wrapper">
              <i class="fa-solid fa-magnifying-glass kds-search-icon"></i>
              <input type="text" id="kds-quick-search-input" class="dash-search-input kds-search-input" placeholder="Search Token, #, dish..." value="${this.searchQuery}">
            </div>

            <!-- Overdue Quick Filter Button -->
            <button type="button" id="btn-kds-rush-filter" class="btn ${this.rushOnlyFilter ? 'btn-danger' : 'btn-secondary'} kds-util-btn" title="Filter Only Delayed / Overdue Orders">
              <i class="fa-solid fa-triangle-exclamation"></i>
              <span id="kds-rush-filter-label">Overdue Only</span>
            </button>

            <!-- Recall Recently Bumped Modal Trigger -->
            <button type="button" id="btn-kds-recall-modal" class="btn btn-secondary kds-util-btn" title="View & Recall Recently Bumped Orders">
              <i class="fa-solid fa-arrow-rotate-left" style="color: #4361ee;"></i> Recall Bumped
            </button>

            <!-- 3-Lane vs 4-Lane Layout Toggle -->
            <button type="button" id="btn-kds-layout-toggle" class="btn btn-secondary kds-util-btn" title="Toggle 4-Lane Expanded vs 3-Lane Focus View">
              <i class="fa-solid ${this.layoutMode === '4-lane' ? 'fa-table-columns' : 'fa-columns'}"></i>
              <span>${this.layoutMode === '4-lane' ? '4 Lanes (+Closed)' : '3 Lanes (Focus)'}</span>
            </button>

            <!-- Fullscreen Mode Toggle -->
            <button type="button" id="btn-kds-fullscreen" class="kds-btn-fullscreen" title="Toggle Fullscreen Kitchen Screen">
              <i class="fa-solid fa-expand"></i> Fullscreen
            </button>
          </div>
        </div>

        <!-- Dynamic Mount View Body -->
        <div id="orders-content-mount"></div>
      </div>
    `;

    this.setupSubNavListeners();
    this.renderActiveTab();
    this.startGlobalTimerLoop();
  },

  setupSubNavListeners() {
    const btnKds = document.getElementById("btn-sub-kds");
    const btnExpo = document.getElementById("btn-sub-expo");
    const btnHistory = document.getElementById("btn-sub-history");
    const btnRush = document.getElementById("btn-kds-rush-filter");
    const btnRecallModal = document.getElementById("btn-kds-recall-modal");
    const btnLayout = document.getElementById("btn-kds-layout-toggle");
    const searchInput = document.getElementById("kds-quick-search-input");
    const btnFullscreen = document.getElementById("btn-kds-fullscreen");

    if (btnKds && btnExpo && btnHistory) {
      btnKds.onclick = () => {
        this.activeSubTab = "kds";
        this.updateTabButtons();
        this.renderActiveTab();
      };

      btnExpo.onclick = () => {
        this.activeSubTab = "expo";
        this.updateTabButtons();
        this.renderActiveTab();
      };

      btnHistory.onclick = () => {
        this.activeSubTab = "history";
        this.updateTabButtons();
        this.renderActiveTab();
      };
    }

    if (btnRush) {
      btnRush.onclick = () => {
        this.rushOnlyFilter = !this.rushOnlyFilter;
        btnRush.className = `btn ${this.rushOnlyFilter ? 'btn-danger' : 'btn-secondary'}`;
        this.renderActiveTab();
      };
    }

    if (btnRecallModal) {
      btnRecallModal.onclick = () => {
        this.showRecentlyBumpedModal();
      };
    }

    if (btnLayout) {
      btnLayout.onclick = () => {
        this.layoutMode = this.layoutMode === "4-lane" ? "3-lane" : "4-lane";
        const iconEl = btnLayout.querySelector("i");
        const spanEl = btnLayout.querySelector("span");
        if (iconEl) iconEl.className = `fa-solid ${this.layoutMode === '4-lane' ? 'fa-table-columns' : 'fa-columns'}`;
        if (spanEl) spanEl.textContent = this.layoutMode === "4-lane" ? "4 Lanes (+Closed)" : "3 Lanes (Focus)";
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

  updateTabButtons() {
    const btnKds = document.getElementById("btn-sub-kds");
    const btnExpo = document.getElementById("btn-sub-expo");
    const btnHistory = document.getElementById("btn-sub-history");

    if (btnKds) btnKds.className = `btn ${this.activeSubTab === 'kds' ? 'btn-primary' : 'btn-secondary'} kds-subtab-btn`;
    if (btnExpo) btnExpo.className = `btn ${this.activeSubTab === 'expo' ? 'btn-primary' : 'btn-secondary'} kds-subtab-btn`;
    if (btnHistory) btnHistory.className = `btn ${this.activeSubTab === 'history' ? 'btn-primary' : 'btn-secondary'} kds-subtab-btn`;
  },

  renderActiveTab() {
    const mount = document.getElementById("orders-content-mount");
    if (!mount) return;

    if (this.activeSubTab === "kds") {
      this.renderKds(mount);
    } else if (this.activeSubTab === "expo") {
      this.renderExpo(mount);
    } else {
      this.renderHistory(mount);
    }
  },

  // Smart Parser for Kitchen Modifiers & Custom Notes
  parseModifiers(notes = "", itemName = "") {
    const combined = `${notes || ""} ${itemName || ""}`.toLowerCase();
    const mods = [];

    if (combined.includes("jain")) {
      mods.push({ label: "Jain 🌿", class: "kds-mod-jain" });
    }
    if (combined.includes("extra spicy") || combined.includes("spicy schezwan")) {
      mods.push({ label: "Extra Spicy 🌶️", class: "kds-mod-spicy" });
    } else if (combined.includes("less spicy") || combined.includes("mild")) {
      mods.push({ label: "Less Spicy 🍃", class: "kds-mod-mild" });
    }
    if (combined.includes("no onion") || combined.includes("no garlic") || combined.includes("without onion")) {
      mods.push({ label: "No Onion/Garlic 🧅", class: "kds-mod-onion" });
    }
    if (combined.includes("extra cheese") || combined.includes("cheese burst") || combined.includes("double cheese")) {
      mods.push({ label: "Extra Cheese 🧀", class: "kds-mod-cheese" });
    }
    if (combined.includes("parcel") || combined.includes("takeaway") || combined.includes("packing")) {
      mods.push({ label: "Parcel 🛍️", class: "kds-mod-parcel" });
    }
    if (combined.includes("urgent") || combined.includes("fast") || combined.includes("rush") || combined.includes("priority")) {
      mods.push({ label: "Urgent ⚡", class: "kds-mod-urgent" });
    }

    return mods;
  },

  // 1. KITCHEN KANBAN DISPLAY QUEUE
  renderKds(mount) {
    const allOrders = window.db.get("orders") || [];
    const products = window.db.get("products") || [];
    const categories = window.db.get("categories") || [];
    const settings = window.db.get("settings") || {};

    const targetMinutes = Number(settings.targetPrepMinutes) || 15;
    const targetSeconds = targetMinutes * 60;
    const now = new Date();

    // 1. Active cooking orders
    let activeOrders = allOrders.filter(o => o.status === "Pending" || o.status === "Preparing" || o.status === "Ready");

    // 2. Filter by fulfillment type
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

    // 6. Overdue / SLA Metrics Calculation
    let overdueCount = 0;
    let nearingTargetCount = 0;

    activeOrders.forEach(o => {
      if (o.status === "Preparing") {
        const start = new Date(o.preparingStartedAt || o.createdAt);
        const elapsedSecs = Math.floor((now - start) / 1000);
        const remaining = targetSeconds - elapsedSecs;
        if (remaining <= 0) overdueCount++;
        else if (remaining <= 120) nearingTargetCount++;
      }
    });

    // 7. Filter by Rush / Overdue Only
    if (this.rushOnlyFilter) {
      activeOrders = activeOrders.filter(o => {
        if (o.notes && (o.notes.toLowerCase().includes("urgent") || o.notes.toLowerCase().includes("rush"))) return true;
        if (o.status === "Preparing") {
          const start = new Date(o.preparingStartedAt || o.createdAt);
          const elapsedSecs = Math.floor((now - start) / 1000);
          return (targetSeconds - elapsedSecs) <= 0;
        }
        return false;
      });
    }

    // 8. Sort Active Orders (FIFO / Urgent Overdue / Newest)
    const getOrderUrgencyAge = (o) => {
      const created = new Date(o.createdAt).getTime();
      return isNaN(created) ? 0 : created;
    };

    activeOrders.sort((a, b) => {
      if (this.prioritySort === "newest") {
        return getOrderUrgencyAge(b) - getOrderUrgencyAge(a);
      } else if (this.prioritySort === "overdue") {
        const aStart = new Date(a.preparingStartedAt || a.createdAt).getTime();
        const bStart = new Date(b.preparingStartedAt || b.createdAt).getTime();
        return aStart - bStart;
      } else {
        return getOrderUrgencyAge(a) - getOrderUrgencyAge(b);
      }
    });

    const pendingOrders = activeOrders.filter(o => o.status === "Pending");
    const preparingOrders = activeOrders.filter(o => o.status === "Preparing");
    const readyOrders = activeOrders.filter(o => o.status === "Ready");

    // Update top header badges
    const tabActiveBadge = document.getElementById("kds-tab-active-badge");
    if (tabActiveBadge) tabActiveBadge.textContent = activeOrders.length;

    // Today's turnaround time calculation
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
    let totalItemsCooking = 0;
    const dishCountMap = {};
    cookingTickets.forEach(o => {
      if (Array.isArray(o.items)) {
        o.items.forEach(it => {
          const qty = Number(it.quantity) || 1;
          dishCountMap[it.name] = (dishCountMap[it.name] || 0) + qty;
          totalItemsCooking += qty;
        });
      }
    });
    const dishAggregatorList = Object.entries(dishCountMap).sort((a, b) => b[1] - a[1]);

    const tabExpoBadge = document.getElementById("kds-tab-expo-badge");
    if (tabExpoBadge) tabExpoBadge.textContent = `${totalItemsCooking} Items`;

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

    // Recently closed orders for quick recall
    const recentlyClosedOrders = allOrders
      .filter(o => o.status === "Completed" || o.status === "Cancelled")
      .slice(0, 10);

    mount.innerHTML = `
      <!-- Consolidated Kitchen Command & Station Console -->
      <div class="kds-command-console">
        <!-- Telemetry & Controls Row -->
        <div class="kds-console-top-row">
          <!-- Metrics / Live SLAs -->
          <div class="kds-metric-pill-group">
            <div class="kds-metric-chip indigo">
              <span class="kds-metric-dot indigo"></span>
              <span class="kds-metric-lbl">Active Queue:</span>
              <span class="kds-metric-num">${pendingOrders.length + preparingOrders.length} Tickets (${totalItemsCooking} Items)</span>
            </div>
            
            <div class="kds-metric-chip emerald">
              <span class="kds-metric-dot emerald"></span>
              <span class="kds-metric-lbl">Avg Speed:</span>
              <span class="kds-metric-num">${avgSpeedText}</span>
            </div>

            <div class="kds-metric-chip cyan">
              <span class="kds-metric-dot cyan"></span>
              <span class="kds-metric-lbl">On-Time SLA:</span>
              <span class="kds-metric-num">${onTimeRate}%</span>
            </div>

            ${overdueCount > 0 ? `
              <div class="kds-metric-chip alert" onclick="views.orders.toggleRushFilter()" title="Click to filter delayed tickets">
                <span class="kds-metric-dot alert"></span>
                <span class="kds-metric-lbl">Alert:</span>
                <span class="kds-metric-num">${overdueCount} Delayed Overtime</span>
              </div>
            ` : nearingTargetCount > 0 ? `
              <div class="kds-metric-chip warning">
                <span class="kds-metric-dot warning"></span>
                <span class="kds-metric-lbl">SLA Warning:</span>
                <span class="kds-metric-num">${nearingTargetCount} Nearing Target</span>
              </div>
            ` : activeOrders.length >= 8 ? `
              <div class="kds-metric-chip rush">
                <span class="kds-metric-dot rush"></span>
                <span class="kds-metric-lbl">Rush:</span>
                <span class="kds-metric-num">High Kitchen Volume</span>
              </div>
            ` : `
              <div class="kds-metric-chip normal">
                <span class="kds-metric-dot normal"></span>
                <span class="kds-metric-lbl">Status:</span>
                <span class="kds-metric-num">Pace Normal</span>
              </div>
            `}
          </div>

          <!-- Controls: Filters, SLA, Sort -->
          <div class="kds-console-controls">
            <!-- Order Type Filter Pills -->
            <div class="kds-segmented-pills" id="kds-type-filter-pills">
              <button type="button" class="kds-segment-btn ${this.typeFilter === 'all' ? 'active' : ''}" data-type="all">All</button>
              <button type="button" class="kds-segment-btn ${this.typeFilter === 'dine-in' ? 'active' : ''}" data-type="dine-in">Dine-in</button>
              <button type="button" class="kds-segment-btn ${this.typeFilter === 'takeaway' ? 'active' : ''}" data-type="takeaway">Parcel</button>
              <button type="button" class="kds-segment-btn ${this.typeFilter === 'delivery' ? 'active' : ''}" data-type="delivery">Delivery</button>
            </div>

            <!-- Target SLA Time Select -->
            <div class="kds-select-pill">
              <i class="fa-regular fa-clock" style="color: #94a3b8; font-size: 11px;"></i>
              <span class="kds-select-lbl">SLA:</span>
              <select id="kds-target-select" class="kds-select-element">
                <option value="5" ${targetMinutes === 5 ? 'selected' : ''}>5m (Fast)</option>
                <option value="10" ${targetMinutes === 10 ? 'selected' : ''}>10m</option>
                <option value="12" ${targetMinutes === 12 ? 'selected' : ''}>12m</option>
                <option value="15" ${targetMinutes === 15 ? 'selected' : ''}>15m (Std)</option>
                <option value="20" ${targetMinutes === 20 ? 'selected' : ''}>20m</option>
              </select>
            </div>

            <!-- Priority Sort Select -->
            <div class="kds-select-pill">
              <i class="fa-solid fa-arrow-down-wide-short" style="color: #94a3b8; font-size: 11px;"></i>
              <span class="kds-select-lbl">Sort:</span>
              <select id="kds-priority-select" class="kds-select-element">
                <option value="fifo" ${this.prioritySort === 'fifo' ? 'selected' : ''}>Oldest First (FIFO)</option>
                <option value="overdue" ${this.prioritySort === 'overdue' ? 'selected' : ''}>Overdue First</option>
                <option value="newest" ${this.prioritySort === 'newest' ? 'selected' : ''}>Newest First</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Station Routing & Live Batch Cook Matrix Row -->
        <div class="kds-console-bottom-row">
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

          ${dishAggregatorList.length > 0 ? `
            <div class="kds-inline-batch-wrap">
              <div class="kds-agg-title">
                <i class="fa-solid fa-fire-burner"></i> Batch:
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
                  <button type="button" onclick="views.orders.toggleDishFilter(null)" class="kds-clear-filter-btn">
                    Clear
                  </button>
                ` : ''}
              </div>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Kanban Board (Default: 4-Lane Expanded) -->
      <div class="kds-board ${this.layoutMode === '4-lane' ? 'kds-4-lanes' : 'kds-3-lanes'} view-animate" id="kds-kanban-board">
        
        <!-- LANE 1: PENDING -->
        <div class="kds-column">
          <div class="kds-column-header pending">
            <div class="kds-lane-badge pending">
              <i class="fa-regular fa-clock"></i>
              <span>New Orders</span>
              <span class="kds-order-count">${pendingOrders.length}</span>
            </div>
            ${pendingOrders.length > 0 ? `
              <div class="kds-col-actions">
                <button type="button" class="kds-col-action-btn" onclick="views.orders.startAllPending()" title="Start cooking all new orders">
                  <i class="fa-solid fa-play"></i> Start All
                </button>
              </div>
            ` : ''}
          </div>
          <div class="kds-order-list">
            ${this.generateKdsCards(pendingOrders, "Pending", targetSeconds)}
          </div>
        </div>

        <!-- LANE 2: PREPARING (COOKING) -->
        <div class="kds-column">
          <div class="kds-column-header preparing">
            <div class="kds-lane-badge preparing">
              <i class="fa-solid fa-fire-burner"></i>
              <span>Cooking (${targetMinutes}m SLA)</span>
              <span class="kds-order-count">${preparingOrders.length}</span>
            </div>
          </div>
          <div class="kds-order-list">
            ${this.generateKdsCards(preparingOrders, "Preparing", targetSeconds)}
          </div>
        </div>

        <!-- LANE 3: READY FOR PICKUP -->
        <div class="kds-column">
          <div class="kds-column-header ready">
            <div class="kds-lane-badge ready">
              <i class="fa-solid fa-bell"></i>
              <span>Ready for Serve</span>
              <span class="kds-order-count">${readyOrders.length}</span>
            </div>
            ${readyOrders.length > 0 ? `
              <div class="kds-col-actions">
                <button type="button" class="kds-col-action-btn" onclick="views.orders.bumpAllReady()" title="Complete and bump all ready orders">
                  <i class="fa-solid fa-check-double"></i> Bump All
                </button>
              </div>
            ` : ''}
          </div>
          <div class="kds-order-list">
            ${this.generateKdsCards(readyOrders, "Ready", targetSeconds)}
          </div>
        </div>

        <!-- LANE 4 (Optional in 4-Lane mode): RECENTLY CLOSED -->
        ${this.layoutMode === '4-lane' ? `
          <div class="kds-column">
            <div class="kds-column-header completed">
              <div class="kds-lane-badge completed">
                <i class="fa-solid fa-circle-check"></i>
                <span>Recently Closed</span>
                <span class="kds-order-count">${recentlyClosedOrders.length}</span>
              </div>
            </div>
            <div class="kds-order-list">
              ${this.generateClosedKdsCards(recentlyClosedOrders.slice(0, 8))}
            </div>
          </div>
        ` : ''}

      </div>

      <!-- 5. Bottom Quick Recall Bar (When in 3-Lane mode) -->
      ${this.layoutMode === '3-lane' && recentlyClosedOrders.length > 0 ? `
        <div class="kds-recent-bar">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 11.5px; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">
              <i class="fa-solid fa-arrow-rotate-left" style="color: #2563eb;"></i> Recently Bumped:
            </span>
            <div class="kds-recent-pills">
              ${recentlyClosedOrders.slice(0, 4).map(o => `
                <div class="kds-recent-chip">
                  <span>TK #${o.tokenNumber || 1} (#${o.orderNumber})</span>
                  <button type="button" onclick="views.orders.recallOrder('${o.id}')">↺ Recall</button>
                </div>
              `).join("")}
            </div>
          </div>

          <button type="button" onclick="views.orders.showRecentlyBumpedModal()" style="background: none; border: none; color: #2563eb; font-size: 12px; font-weight: 800; cursor: pointer;">
            View All Bumped (${recentlyClosedOrders.length}) →
          </button>
        </div>
      ` : ''}
    `;

    // Hook Target Select
    const targetSelect = document.getElementById("kds-target-select");
    if (targetSelect) {
      targetSelect.onchange = (e) => {
        const val = Number(e.target.value) || 15;
        const curSettings = window.db.get("settings") || {};
        curSettings.targetPrepMinutes = val;
        window.db.set("settings", curSettings);
        window.showToast(`Kitchen SLA set to ${val} Minutes`, "info");
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

    // Hook Advance buttons
    mount.querySelectorAll(".kds-btn-advance").forEach(btn => {
      btn.onclick = () => {
        const orderId = btn.getAttribute("data-id");
        const nextStatus = btn.getAttribute("data-next");
        this.advanceOrder(orderId, nextStatus);
      };
    });

    // Hook Recall buttons
    mount.querySelectorAll(".kds-btn-recall").forEach(btn => {
      btn.onclick = () => {
        const orderId = btn.getAttribute("data-id");
        const prevStatus = btn.getAttribute("data-prev") || "Preparing";
        this.recallOrder(orderId, prevStatus);
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

          // Live Progress Bar update
          const progressBar = card.querySelector(".kds-prep-progress-fill");
          const progressText = card.querySelector(".kds-prep-progress-text");
          const progressPctEl = card.querySelector(".kds-prep-progress-pct");
          if (progressBar && totalChecks > 0) {
            const pct = Math.round((doneChecks / totalChecks) * 100);
            progressBar.style.width = `${pct}%`;
            progressBar.style.background = pct === 100 ? "#10b981" : "#3b82f6";
            if (progressText) progressText.innerHTML = `<i class="fa-solid fa-list-check" style="color: ${pct === 100 ? '#059669' : '#2563eb'};"></i> Plated: ${doneChecks}/${totalChecks}`;
            if (progressPctEl) {
              progressPctEl.textContent = `${pct}%`;
              progressPctEl.style.color = pct === 100 ? "#059669" : "#2563eb";
            }
          }
        }
      };
    });
  },

  // 2. CHEF EXPO / BATCH COOK VIEW (New Advanced Feature)
  renderExpo(mount) {
    const allOrders = window.db.get("orders") || [];
    const products = window.db.get("products") || [];
    const categories = window.db.get("categories") || [];

    // Active cooking orders (Pending & Preparing)
    let activeOrders = allOrders.filter(o => o.status === "Pending" || o.status === "Preparing");

    // Group items by category / station
    const stationMap = {};
    categories.forEach(cat => {
      stationMap[cat.id] = {
        name: cat.name,
        dishes: {}
      };
    });
    stationMap["uncategorized"] = { name: "Other Items", dishes: {} };

    let totalItems = 0;

    activeOrders.forEach(o => {
      if (Array.isArray(o.items)) {
        o.items.forEach((item, itemIdx) => {
          const prod = products.find(p => p.name === item.name);
          const catId = (prod && prod.category && stationMap[prod.category]) ? prod.category : "uncategorized";
          const qty = Number(item.quantity) || 1;
          totalItems += qty;

          if (!stationMap[catId].dishes[item.name]) {
            stationMap[catId].dishes[item.name] = {
              name: item.name,
              totalQty: 0,
              tickets: []
            };
          }

          const checkKey = `${o.id}_${itemIdx}`;
          const isDone = this.checkedItems[checkKey] === true;

          stationMap[catId].dishes[item.name].totalQty += qty;
          stationMap[catId].dishes[item.name].tickets.push({
            orderId: o.id,
            orderNumber: o.orderNumber,
            tokenNumber: o.tokenNumber || 1,
            tableNumber: o.tableNumber,
            type: o.type,
            quantity: qty,
            notes: o.notes,
            itemIdx: itemIdx,
            checkKey: checkKey,
            isDone: isDone
          });
        });
      }
    });

    const activeStations = Object.entries(stationMap).filter(([_, data]) => Object.keys(data.dishes).length > 0);

    let contentHtml = "";

    if (activeStations.length === 0) {
      contentHtml = `
        <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 16px; padding: 60px 20px; text-align: center;">
          <i class="fa-solid fa-fire-burner" style="font-size: 38px; color: #cbd5e1; margin-bottom: 12px; display: block;"></i>
          <h3 style="font-size: 16px; font-weight: 850; color: var(--text-dark); margin-bottom: 4px;">No Active Items on the Line</h3>
          <p style="font-size: 13px; color: var(--text-muted); margin: 0;">Kitchen queue is currently clear. New POS orders will appear here automatically.</p>
        </div>
      `;
    } else {
      contentHtml = `
        <div class="kds-expo-container view-animate">
          
          <!-- Top Expo Summary Bar -->
          <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 16px; padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 13px; font-weight: 900; color: #2563eb; background: #eff6ff; border: 1.5px solid #bfdbfe; padding: 3px 12px; border-radius: 8px;">
                <i class="fa-solid fa-kitchen-set"></i> ${totalItems} Total Dishes to Prepare
              </span>
              <span style="font-size: 12px; font-weight: 750; color: var(--text-muted);">
                Across ${activeOrders.length} Active Tickets
              </span>
            </div>

            <div style="display: flex; align-items: center; gap: 8px;">
              <button class="btn btn-primary" onclick="views.orders.startAllPending()" style="border-radius: 10px; padding: 6px 14px; font-size: 12px; font-weight: 800;">
                <i class="fa-solid fa-play"></i> Start All Pending
              </button>
            </div>
          </div>

          <!-- Stations Grid -->
          ${activeStations.map(([catId, station]) => {
            const dishesList = Object.values(station.dishes);
            const stationTotalQty = dishesList.reduce((sum, d) => sum + d.totalQty, 0);

            return `
              <div class="kds-expo-station-block">
                <div class="kds-expo-station-header">
                  <div class="kds-expo-station-title">
                    <i class="fa-solid fa-utensils" style="color: #2563eb;"></i>
                    <span>${station.name}</span>
                    <span style="font-size: 11px; font-weight: 800; background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; padding: 2px 8px; border-radius: 8px;">
                      ${stationTotalQty} qty
                    </span>
                  </div>
                  <span style="font-size: 12px; font-weight: 700; color: var(--text-muted);">
                    ${dishesList.length} distinct items
                  </span>
                </div>

                <div class="kds-expo-grid">
                  ${dishesList.map(dish => {
                    const doneTicketsCount = dish.tickets.filter(t => t.isDone).length;
                    const allBatchDone = doneTicketsCount === dish.tickets.length;

                    return `
                      <div class="kds-expo-card ${allBatchDone ? 'all-items-done' : ''}">
                        <div class="kds-expo-card-header">
                          <div class="kds-expo-dish-name">${dish.name}</div>
                          <div class="kds-expo-dish-qty">x${dish.totalQty}</div>
                        </div>

                        <!-- Ticket sources -->
                        <div class="kds-expo-tickets-list">
                          ${dish.tickets.map(t => {
                            const mods = this.parseModifiers(t.notes, dish.name);
                            return `
                              <div class="kds-expo-ticket-pill ${t.isDone ? 'item-done' : ''}" style="cursor: pointer;" onclick="views.orders.toggleExpoItem('${t.checkKey}')" title="Click to check off for Token #${t.tokenNumber}">
                                <i class="fa-regular ${t.isDone ? 'fa-square-check' : 'fa-square'}" style="color: ${t.isDone ? '#059669' : '#94a3b8'};"></i>
                                <span>TK #${t.tokenNumber} (x${t.quantity})</span>
                                ${mods.length > 0 ? mods.map(m => `<span class="kds-mod-pill ${m.class}" style="padding: 1px 4px; font-size: 9px;">${m.label}</span>`).join("") : ''}
                              </div>
                            `;
                          }).join("")}
                        </div>

                        <!-- Batch Action Button -->
                        <button type="button" class="kds-expo-card-btn" onclick="views.orders.markDishBatchDone('${dish.name.replace(/'/g, "\\'")}')">
                          <i class="fa-solid fa-check-double"></i> Mark Entire Batch Ready (${dish.totalQty})
                        </button>
                      </div>
                    `;
                  }).join("")}
                </div>
              </div>
            `;
          }).join("")}

        </div>
      `;
    }

    mount.innerHTML = contentHtml;
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
                ${o.status === "Completed" ? `
                  <button class="btn btn-secondary btn-recall-hist" data-id="${o.id}" style="padding: 5px 8px; font-size: 11px; border-radius: 8px;" title="Recall Back to Kitchen">
                    <i class="fa-solid fa-arrow-rotate-left" style="color: #2563eb;"></i>
                  </button>
                ` : o.status !== "Cancelled" ? `
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
      <div class="table-container view-animate" style="max-height: 560px; overflow-y: auto;">
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

    // Bind history recall
    mount.querySelectorAll(".btn-recall-hist").forEach(btn => {
      btn.onclick = () => {
        const orderId = btn.getAttribute("data-id");
        this.recallOrder(orderId, "Preparing");
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

  // CARD GENERATOR FOR KANBAN LANES
  generateKdsCards(ordersList, lane, targetSeconds = 900) {
    if (ordersList.length === 0) {
      let emptyIcon = "fa-clock";
      let emptyTitle = "Queue Clear";
      let emptySub = "No incoming orders in this lane";
      let emptyTheme = "pending";

      if (lane === "Preparing") {
        emptyIcon = "fa-fire-burner";
        emptyTitle = "Line is Free";
        emptySub = "All stations prepped and waiting";
        emptyTheme = "preparing";
      } else if (lane === "Ready") {
        emptyIcon = "fa-bell-concierge";
        emptyTitle = "Pass is Clear";
        emptySub = "All ready tickets have been served";
        emptyTheme = "ready";
      }

      return `
        <div class="kds-empty-box ${emptyTheme}">
          <div class="kds-empty-emblem ${emptyTheme}">
            <i class="fa-solid ${emptyIcon}"></i>
          </div>
          <div class="kds-empty-title">${emptyTitle}</div>
          <div class="kds-empty-subtitle">${emptySub}</div>
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

        const itemModifiers = this.parseModifiers(order.notes, item.name);

        return `
          <li class="kds-order-item-check ${isDone ? 'item-done' : ''}" data-check-key="${checkKey}">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <div class="kds-check-box ${isDone ? 'checked' : ''}">
                <i class="fa-solid fa-check"></i>
              </div>
              <span class="kds-item-name">${item.name}</span>
              ${itemModifiers.map(m => `<span class="kds-mod-pill ${m.class}">${m.label}</span>`).join("")}
            </div>
            <span class="kds-item-qty">x${item.quantity}</span>
          </li>
        `;
      }).join("");

      if (itemsList.length === 0) allItemsDone = false;

      let actionBtnText = "Start Cooking";
      let nextStatus = "Preparing";
      let icon = "fa-fire-burner";
      let btnClass = "kds-btn-advance";

      if (lane === "Preparing") {
        actionBtnText = "Mark Ready";
        nextStatus = "Ready";
        icon = "fa-bell";
      } else if (lane === "Ready") {
        actionBtnText = "Bump / Complete";
        nextStatus = "Completed";
        icon = "fa-circle-check";
        btnClass = "kds-btn-advance kds-btn-bump-ready";
      }

      // Timer calculations
      let isOverdue = false;
      let isOneMinLeft = false;
      let delayText = "";
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
          timerLabelHtml = `<i class="fa-solid fa-triangle-exclamation" style="margin-right: 4px; color: #e11d48;"></i> Overtime:`;
          timerText = `Overdue (-${dm.toString().padStart(2, '0')}:${ds.toString().padStart(2, '0')})`;
          timerClass = "kds-timer-countdown overdue";
          containerClass = "kds-timer-container overdue";
        } else if (remainingSecs <= 120) {
          isOneMinLeft = true;
          timerLabelHtml = `<i class="fa-solid fa-hourglass-end" style="margin-right: 4px; color: #d97706;"></i> Nearing SLA:`;
          const mins = Math.floor(remainingSecs / 60);
          const secs = remainingSecs % 60;
          timerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
          timerClass = "kds-timer-countdown warning-blink";
          containerClass = "kds-timer-container one-min-warn";
        } else {
          const mins = Math.floor(remainingSecs / 60);
          const secs = remainingSecs % 60;
          timerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
      } else if (lane === "Ready") {
        const readyTime = new Date(order.readyAt || order.createdAt);
        const elapsedReadyMins = Math.max(0, Math.floor((now - readyTime) / 60000));
        timerLabelHtml = `<i class="fa-solid fa-bell" style="margin-right: 4px; color: #10b981;"></i> At Pass:`;
        timerText = `${elapsedReadyMins}m ago`;
      }

      const isDineIn = (order.type || "Dine-in").toLowerCase().includes("dine");
      const isTakeaway = (order.type || "").toLowerCase().includes("takeaway") || (order.type || "").toLowerCase().includes("parcel");
      const isDelivery = (order.type || "").toLowerCase().includes("delivery");

      let orderTypeBadge = `<span class="kds-order-type dine-in">${order.tableNumber ? `Table ${order.tableNumber}` : 'Dine-in'}</span>`;
      if (isTakeaway) orderTypeBadge = `<span class="kds-order-type takeaway">Parcel 🛍️</span>`;
      else if (isDelivery) orderTypeBadge = `<span class="kds-order-type delivery">Delivery 🛵</span>`;

      // Order-level modifiers from notes
      const orderNotesModifiers = this.parseModifiers(order.notes);

      return `
        <div class="kds-order-card ${allItemsDone ? 'all-items-done' : ''} ${isOverdue ? 'kds-card-overdue' : isOneMinLeft ? 'kds-card-warning' : ''}" data-card-id="${order.id}">
          
          <!-- Overtime Banner -->
          ${isOverdue ? `
            <div class="kds-overtime-pill">
              <span class="kds-overtime-tag"><i class="fa-solid fa-triangle-exclamation"></i> KITCHEN DELAY</span>
              <span class="kds-overtime-val">${delayText}</span>
            </div>
          ` : isOneMinLeft ? `
            <div class="kds-warning-pill">
              <span class="kds-warning-tag"><i class="fa-solid fa-hourglass-end"></i> NEARING TARGET</span>
              <span class="kds-warning-val">2 MINS LEFT</span>
            </div>
          ` : ""}

          <!-- Header: Token Number & Order Number -->
          <div class="kds-order-top">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="kds-token-badge">
                TK #${order.tokenNumber || 1}
              </span>
              <span class="kds-order-num">#${order.orderNumber}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="kds-order-time">${formattedTime}</span>
              ${orderTypeBadge}
            </div>
          </div>

          <!-- Special Kitchen Instructions Banner & Modifier Badges -->
          ${order.notes ? `
            <div class="kds-note-banner">
              <i class="fa-solid fa-triangle-exclamation"></i>
              <div style="display: flex; flex-direction: column; gap: 2px;">
                <span><strong>Kitchen Note:</strong> ${order.notes}</span>
                ${orderNotesModifiers.length > 0 ? `
                  <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 2px;">
                    ${orderNotesModifiers.map(m => `<span class="kds-mod-pill ${m.class}">${m.label}</span>`).join("")}
                  </div>
                ` : ''}
              </div>
            </div>
          ` : ''}

          <!-- Plating Checklist Progress Bar -->
          ${(order.items && order.items.length > 1) ? `
            <div class="kds-plating-progress-wrapper" style="margin: 6px 0 6px 0; padding: 4px 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10.5px; font-weight: 800; margin-bottom: 3px;">
                <span class="kds-prep-progress-text" style="color: #475569;"><i class="fa-solid fa-list-check" style="color: #2563eb;"></i> Plated: ${(order.items || []).filter((_, i) => this.checkedItems[`${order.id}_${i}`] === true).length}/${(order.items || []).length}</span>
                <span class="kds-prep-progress-pct" style="color: ${allItemsDone ? '#059669' : '#2563eb'};">${Math.round(((order.items || []).filter((_, i) => this.checkedItems[`${order.id}_${i}`] === true).length / Math.max(1, (order.items || []).length)) * 100)}%</span>
              </div>
              <div style="width: 100%; height: 5px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
                <div class="kds-prep-progress-fill" style="width: ${Math.round(((order.items || []).filter((_, i) => this.checkedItems[`${order.id}_${i}`] === true).length / Math.max(1, (order.items || []).length)) * 100)}%; height: 100%; background: ${allItemsDone ? '#10b981' : '#3b82f6'}; border-radius: 4px; transition: width 0.25s ease;"></div>
              </div>
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

          <!-- Customer details & Bill Amount -->
          <div class="kds-order-cust">
            <span><i class="fa-regular fa-user" style="color: #94a3b8; margin-right: 5px;"></i> ${order.customerName || "Walk-in Guest"}</span>
            <span style="display: inline-flex; align-items: center; gap: 6px;">
              <span class="kds-order-item-count">${order.items ? order.items.length : 0} items</span>
              <span style="background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 2px 8px; border-radius: 8px; font-weight: 850; font-size: 12px; font-variant-numeric: tabular-nums;">
                ₹${Math.round(Number(order.total) || 0).toLocaleString("en-IN")}
              </span>
            </span>
          </div>

          <!-- Timer & Progress Bar (for Pending & Preparing) -->
          ${(lane === "Pending" || lane === "Preparing" || lane === "Ready") ? `
            <div class="${containerClass}" data-timer-id="${order.id}">
              <span class="kds-timer-label">${timerLabelHtml}</span>
              <span class="${timerClass}" data-timer-val="${order.id}" data-lane="${lane}" data-created="${order.createdAt}" data-started="${order.preparingStartedAt || ''}">${timerText}</span>
            </div>
            ${lane !== "Ready" ? `
              <div class="kds-card-progress-bar">
                <div class="kds-card-progress-fill ${isOverdue ? 'overdue' : isOneMinLeft ? 'warn' : ''}" data-progress-fill="${order.id}" style="width: ${progressPct}%;"></div>
              </div>
            ` : ''}
          ` : ""}
          
          <!-- Actions Row -->
          <div class="kds-card-action-row">
            <button class="${btnClass}" data-id="${order.id}" data-next="${nextStatus}">
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
              <button class="kds-btn-cancel" data-id="${order.id}" title="Void Order">
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
      return `
        <div class="kds-empty-box completed">
          <div class="kds-empty-emblem completed">
            <i class="fa-solid fa-circle-check"></i>
          </div>
          <div class="kds-empty-title">No Closed Orders</div>
          <div class="kds-empty-subtitle">Completed or cancelled orders will appear here automatically</div>
        </div>
      `;
    }

    return ordersList.map(order => {
      const isCompleted = order.status === "Completed";
      const prepDuration = order.prepDurationSeconds ? `${Math.floor(order.prepDurationSeconds / 60)}m ${order.prepDurationSeconds % 60}s` : "";

      return `
        <div class="kds-closed-order-card ${isCompleted ? 'status-completed' : 'status-cancelled'}">
          <div class="kds-order-top">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="kds-token-badge ${isCompleted ? 'completed' : 'cancelled'}">
                TK #${order.tokenNumber || 1}
              </span>
              <span class="kds-order-num">#${order.orderNumber}</span>
            </div>
            <div style="display: flex; gap: 6px; align-items: center;">
              ${prepDuration ? `<span class="kds-prep-duration-badge"><i class="fa-solid fa-stopwatch"></i> ${prepDuration}</span>` : ""}
              <span class="badge ${isCompleted ? 'badge-completed' : 'badge-cancelled'}">${order.status.toUpperCase()}</span>
            </div>
          </div>
          <div class="kds-closed-dish-wrap">
            ${(order.items || []).map(i => `<span class="kds-closed-dish-chip">${i.name} <strong class="kds-closed-dish-qty">x${i.quantity}</strong></span>`).join("")}
          </div>
          <div class="kds-closed-card-footer">
            <span class="kds-closed-cust"><i class="fa-regular fa-user" style="color: #94a3b8; margin-right: 5px;"></i> ${order.customerName || 'Walk-in'}</span>
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

  // FAST KITCHEN COMMANDS
  advanceOrder(orderId, nextStatus) {
    window.db.updateOrderStatus(orderId, nextStatus);
    window.showToast(`Order status updated to ${nextStatus}`, "success");
    this.renderActiveTab();
  },

  recallOrder(orderId, prevStatus = "Preparing") {
    window.db.updateOrderStatus(orderId, prevStatus);
    window.showToast(`Order #${orderId} recalled back to ${prevStatus}`, "info");
    this.renderActiveTab();
  },

  startAllPending() {
    const orders = window.db.get("orders") || [];
    const pending = orders.filter(o => o.status === "Pending");
    if (pending.length === 0) {
      window.showToast("No pending orders to start", "info");
      return;
    }
    pending.forEach(o => {
      window.db.updateOrderStatus(o.id, "Preparing");
    });
    window.showToast(`Started cooking ${pending.length} orders`, "success");
    this.renderActiveTab();
  },

  bumpAllReady() {
    const orders = window.db.get("orders") || [];
    const ready = orders.filter(o => o.status === "Ready");
    if (ready.length === 0) {
      window.showToast("No ready orders to bump", "info");
      return;
    }
    ready.forEach(o => {
      window.db.updateOrderStatus(o.id, "Completed");
    });
    window.showToast(`Completed and bumped ${ready.length} orders`, "success");
    this.renderActiveTab();
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

  toggleRushFilter() {
    this.rushOnlyFilter = !this.rushOnlyFilter;
    const btn = document.getElementById("btn-kds-rush-filter");
    if (btn) btn.className = `btn ${this.rushOnlyFilter ? 'btn-danger' : 'btn-secondary'}`;
    this.renderActiveTab();
  },

  toggleExpoItem(checkKey) {
    this.checkedItems[checkKey] = !this.checkedItems[checkKey];
    this.renderActiveTab();
  },

  markDishBatchDone(dishName) {
    const allOrders = window.db.get("orders") || [];
    let count = 0;
    allOrders.forEach(o => {
      if ((o.status === "Pending" || o.status === "Preparing") && Array.isArray(o.items)) {
        o.items.forEach((it, idx) => {
          if (it.name === dishName) {
            this.checkedItems[`${o.id}_${idx}`] = true;
            count += (Number(it.quantity) || 1);
          }
        });
      }
    });
    window.showToast(`Marked ${count}x ${dishName} as prepared!`, "success");
    this.renderActiveTab();
  },

  // RECENTLY BUMPED MODAL
  showRecentlyBumpedModal() {
    const orders = window.db.get("orders") || [];
    const closed = orders.filter(o => o.status === "Completed" || o.status === "Cancelled").slice(0, 15);

    if (closed.length === 0) {
      window.showToast("No recently bumped orders to recall", "info");
      return;
    }

    const modalBody = `
      <div style="max-height: 400px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
        ${closed.map(o => {
          const formattedTime = new Date(o.updatedAt || o.completedAt || o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const isCompleted = o.status === "Completed";
          return `
            <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 12px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-weight: 850; font-size: 13.5px; color: var(--text-dark);">
                  TK #${o.tokenNumber || 1} (#${o.orderNumber})
                  <span class="badge ${isCompleted ? 'badge-completed' : 'badge-cancelled'}" style="margin-left: 6px;">${o.status}</span>
                </div>
                <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">
                  ${(o.items || []).map(i => `${i.name} (x${i.quantity})`).join(", ")}
                </div>
                <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                  Bumped at: ${formattedTime} • ${o.customerName || 'Walk-in'}
                </div>
              </div>
              <button class="btn btn-secondary" onclick="views.orders.recallOrder('${o.id}'); window.customModal.hide();" style="border-radius: 8px; padding: 6px 12px; font-size: 11.5px; font-weight: 800;">
                <i class="fa-solid fa-arrow-rotate-left" style="color: #2563eb;"></i> Recall to Kitchen
              </button>
            </div>
          `;
        }).join("")}
      </div>
    `;

    window.customModal.show({
      title: "Recently Bumped Orders (Recall)",
      bodyHtml: modalBody,
      cancelText: "Close"
    });
  },

  // 4. KOT THERMAL PRINT GENERATOR
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

  // 5. IN-PLACE LIVE TIMER LOOP (ZERO FLICKERING)
  startGlobalTimerLoop() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      if (this.activeSubTab !== "kds" || !window.app || window.app.activeView !== "orders") return;

      const settings = window.db.get("settings") || {};
      const targetMinutes = Number(settings.targetPrepMinutes) || 15;
      const targetSeconds = targetMinutes * 60;
      const now = new Date();

      const timerEls = document.querySelectorAll("[data-timer-val]");
      timerEls.forEach(el => {
        const lane = el.getAttribute("data-lane");
        const createdStr = el.getAttribute("data-created");
        const startedStr = el.getAttribute("data-started");
        const orderId = el.getAttribute("data-timer-val");

        if (lane === "Pending") {
          const created = new Date(createdStr);
          const elapsedSecs = Math.floor((now - created) / 1000);
          const remainingSecs = Math.max(0, 15 - elapsedSecs);
          el.textContent = `${remainingSecs}s`;

          // If auto-start period elapsed, auto-advance to preparing
          if (remainingSecs === 0) {
            window.db.updateOrderStatus(orderId, "Preparing");
            this.renderActiveTab();
          }
        } else if (lane === "Preparing") {
          const autoPrepStartTime = new Date(createdStr).getTime() + 15 * 1000;
          const start = startedStr
            ? new Date(Math.min(new Date(startedStr).getTime(), autoPrepStartTime))
            : new Date(autoPrepStartTime);
          const elapsedSecs = Math.floor((now - start) / 1000);
          const remainingSecs = targetSeconds - elapsedSecs;
          const progressPct = Math.min(100, Math.round((elapsedSecs / targetSeconds) * 100));

          const fillEl = document.querySelector(`[data-progress-fill="${orderId}"]`);
          if (fillEl) fillEl.style.width = `${progressPct}%`;

          const container = document.querySelector(`[data-timer-id="${orderId}"]`);
          const card = document.querySelector(`[data-card-id="${orderId}"]`);

          if (remainingSecs <= 0) {
            const diffSecs = Math.abs(remainingSecs);
            const dm = Math.floor(diffSecs / 60);
            const ds = diffSecs % 60;
            el.textContent = `Overdue (-${dm.toString().padStart(2, '0')}:${ds.toString().padStart(2, '0')})`;
            el.className = "kds-timer-countdown overdue";
            if (container) container.className = "kds-timer-container overdue";
            if (fillEl) fillEl.className = "kds-card-progress-fill overdue";
            if (card) card.style.cssText = "border: 2px solid #ef4444 !important; background: #fff5f5;";
          } else if (remainingSecs <= 120) {
            const mins = Math.floor(remainingSecs / 60);
            const secs = remainingSecs % 60;
            el.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            el.className = "kds-timer-countdown warning-blink";
            if (container) container.className = "kds-timer-container one-min-warn";
            if (fillEl) fillEl.className = "kds-card-progress-fill warn";
            if (card) card.style.cssText = "border: 2px solid #f59e0b !important; background: #fffdf5;";
          } else {
            const mins = Math.floor(remainingSecs / 60);
            const secs = remainingSecs % 60;
            el.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
          }
        }
      });
    }, 1000); // Smooth 1-second in-place tick
  }
};
