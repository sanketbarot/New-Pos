// Crust & Chilly POS - Advanced Executive Menu Management & Recipe Engineering Suite
// Features: Executive KPI Overview & Profitability Gauge, Smart Multi-Select Bulk Actions,
// Fast Inline Quick-Add, Category Navigation, Real-Time Filtering & Search, Accurate Food Costing (COGS),
// 1-Click 86'd / In-Stock Toggles, Advanced Recipe Cost Calculator & Inventory Linkage,
// Bulk Price Modifier Suite, Category Manager, Role Permissions Matrix, CSV Export, and Official Menu Sheet Printing.

window.views = window.views || {};
window.views.menu = {
  activeTab: "products", // 'products' | 'categories' | 'permissions'
  searchQuery: "",
  selectedCategory: "all",
  statusFilter: "all", // 'all' | 'in-stock' | 'out-of-stock' | 'veg' | 'non-veg' | 'high-margin' | 'low-margin' | 'recipe-set' | 'recipe-missing'
  marginTierFilter: null, // null | 'high' | 'med' | 'warn' | 'crit'
  sortBy: "name-asc", // 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc' | 'margin-desc' | 'recipe-desc'
  viewMode: "table", // 'table' | 'grid'
  benchmarkCogsPercent: 32, // Default 32% Food Cost / COGS benchmark matching Reports suite
  selectedProductIds: new Set(), // Set of selected IDs for multi-select bulk operations
  showQuickAddBar: false, // Inline fast quick-add bar toggle

  // Standard raw ingredient reference unit costs (INR) for warehouse stock valuation & portion costing
  ingredientCostMap: {
    ing1: 8.0,    // Burger Bun (per pc)
    ing2: 12.0,   // Veg Patty (per pc)
    ing3: 14.0,   // Cheese Slice (per pc)
    ing4: 3.0,    // Sandwich Bread (per slice)
    ing5: 7.0,    // Frankie Roti (per pc)
    ing6: 0.04,   // Raw Potatoes (per g) -> Rs 40/kg
    ing7: 14.0,   // Maggi Packet (per pc)
    ing8: 0.08,   // Mint Leaves (per g)
    ing9: 5.0,    // Lime Fruit (per pc)
    ing10: 0.03,  // Soda Water (per ml)
    ing11: 30.0,  // Soft Drink Can (per can)
    ing12: 0.40,  // Paneer Blocks (per g) -> Rs 400/kg
    ing13: 0.15,  // Mayonnaise (per ml)
    ing14: 0.15   // Chili Sauce (per ml)
  },

  // Calculate accurate plate cost, gross profit, and margin % for a product
  calculateProductCost(product) {
    const price = Number(product.price) || 0;
    const settings = (window.db && window.db.get("settings")) || {};
    const benchmarkRate = (this.benchmarkCogsPercent || settings.cogsPercent || 32) / 100;

    let foodCost = 0;
    let isCustom = false;
    let isFromRecipe = false;

    // 1. Calculate cost from mapped recipe ingredients if available
    const recipe = product.recipe || {};
    const recipeKeys = Object.keys(recipe);
    let recipeSum = 0;
    if (recipeKeys.length > 0) {
      recipeKeys.forEach(ingId => {
        const qty = Number(recipe[ingId]) || 0;
        const unitCost = this.ingredientCostMap[ingId] || 5.0;
        recipeSum += qty * unitCost;
      });
      recipeSum += Number(product.packagingCost) || 0;
    }

    // 2. If explicit cost price is configured on the item, use it
    if (product.costPrice !== undefined && product.costPrice !== null && product.costPrice !== "" && !isNaN(product.costPrice) && Number(product.costPrice) > 0) {
      foodCost = Number(product.costPrice);
      isCustom = true;
    } else if (recipeKeys.length > 0 && recipeSum > 0) {
      foodCost = Math.round(recipeSum * 100) / 100;
      isFromRecipe = true;
    } else {
      // 3. Fallback to standard restaurant Food Cost benchmark (32% COGS)
      foodCost = Math.round(price * benchmarkRate * 100) / 100;
    }

    const grossProfit = Math.max(0, price - foodCost);
    const marginPct = price > 0 ? Math.round((grossProfit / price) * 100) : (100 - this.benchmarkCogsPercent);

    let marginTier = "med";
    if (marginPct >= 65) marginTier = "high";
    else if (marginPct < 35) marginTier = "crit";
    else if (marginPct < 50) marginTier = "warn";

    return {
      foodCost: Math.round(foodCost * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      marginPct,
      marginTier,
      isCustom,
      isFromRecipe,
      hasRecipe: recipeKeys.length > 0,
      recipeCount: recipeKeys.length,
      calculatedRecipeCost: Math.round(recipeSum * 100) / 100
    };
  },

  // Main Entry Point
  init(container) {
    const products = (window.db && window.db.get("products")) || [];
    const categories = (window.db && window.db.get("categories")) || [];
    const currentUser = (window.db && window.db.getCurrentUser()) || {};
    const isAdmin = currentUser.role === "admin";

    container.innerHTML = `
      <div class="view-animate" style="display: flex; flex-direction: column; gap: 14px;">
        
        <!-- Header & Navigation Bar -->
        <div class="glass-card" style="padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; border-radius: 14px;">
          
          <!-- Sub-Tab Buttons -->
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <button class="btn ${this.activeTab === 'products' ? 'btn-primary' : 'btn-secondary'}" id="menu-sub-products" style="height: 38px; border-radius: 12px; padding: 0 16px; font-weight: 800; font-size: 12.5px; display: inline-flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-burger"></i> Menu Catalog <span class="badge" style="background: rgba(255,255,255,0.25); color: inherit; padding: 2px 7px; border-radius: 8px; font-size: 11px; margin-left: 2px;">${products.length}</span>
            </button>
            <button class="btn ${this.activeTab === 'categories' ? 'btn-primary' : 'btn-secondary'}" id="menu-sub-categories" style="height: 38px; border-radius: 12px; padding: 0 16px; font-weight: 800; font-size: 12.5px; display: inline-flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-tags"></i> Food Categories <span class="badge" style="background: rgba(255,255,255,0.25); color: inherit; padding: 2px 7px; border-radius: 8px; font-size: 11px; margin-left: 2px;">${categories.length}</span>
            </button>
            ${isAdmin ? `
            <button class="btn ${this.activeTab === 'permissions' ? 'btn-primary' : 'btn-secondary'}" id="menu-sub-permissions" style="height: 38px; border-radius: 12px; padding: 0 16px; font-weight: 800; font-size: 12.5px; display: inline-flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-user-shield"></i> Role Permissions
            </button>
            ` : ""}
          </div>
          
          <!-- Quick Action Buttons -->
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            ${this.activeTab === 'products' ? `
            <!-- Fast Quick-Add Bar Toggle Button -->
            <button class="btn ${this.showQuickAddBar ? 'btn-primary' : 'btn-secondary'}" id="btn-toggle-quick-add" title="Toggle 1-Row Fast Item Add Bar" style="height: 38px; border-radius: 12px; padding: 0 13px; font-weight: 800; font-size: 12px; display: inline-flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-bolt" style="color: ${this.showQuickAddBar ? '#fff' : '#2563eb'};"></i> Quick Add
            </button>
            <button class="btn btn-secondary" id="btn-menu-bulk-tools" title="Bulk Price Modifier & Quick Actions" style="height: 38px; border-radius: 12px; padding: 0 13px; font-weight: 800; font-size: 12px; display: inline-flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-wand-magic-sparkles" style="color: #d97706;"></i> Bulk Tools
            </button>
            <button class="btn btn-secondary" id="btn-menu-export-csv" title="Download Menu Catalog as CSV" style="height: 38px; border-radius: 12px; padding: 0 13px; font-weight: 800; font-size: 12px; display: inline-flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-file-csv" style="color: #059669;"></i> Export CSV
            </button>
            <button class="btn btn-secondary" id="btn-menu-print-sheet" title="Print Official Restaurant Menu & Price List" style="height: 38px; border-radius: 12px; padding: 0 13px; font-weight: 800; font-size: 12px; display: inline-flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-print" style="color: #2563eb;"></i> Print Menu
            </button>
            ` : ""}

            <button class="btn btn-primary" id="btn-add-menu-entity" style="display: ${this.activeTab === 'permissions' ? 'none' : 'inline-flex'}; height: 38px; border-radius: 12px; padding: 0 18px; font-weight: 800; font-size: 12.5px; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(37, 99, 235, 0.25);">
              <i class="fa-solid fa-plus"></i> <span id="btn-add-text">${this.activeTab === 'categories' ? 'Add Category' : 'Add New Dish'}</span>
            </button>
          </div>
        </div>

        <!-- Render Mount Point -->
        <div id="menu-content-mount"></div>

        <!-- Multi-Select Bulk Operations Floating Action Bar -->
        <div id="menu-bulk-floating-mount"></div>
      </div>
    `;

    this.setupListeners();
    this.render();
  },

  setupListeners() {
    const btnProd = document.getElementById("menu-sub-products");
    const btnCat = document.getElementById("menu-sub-categories");
    const btnPerm = document.getElementById("menu-sub-permissions");
    const btnAdd = document.getElementById("btn-add-menu-entity");
    const addText = document.getElementById("btn-add-text");
    const btnQuickToggle = document.getElementById("btn-toggle-quick-add");
    const btnBulk = document.getElementById("btn-menu-bulk-tools");
    const btnExport = document.getElementById("btn-menu-export-csv");
    const btnPrint = document.getElementById("btn-menu-print-sheet");

    const updateTabUI = () => {
      if (btnProd) btnProd.className = this.activeTab === "products" ? "btn btn-primary" : "btn btn-secondary";
      if (btnCat) btnCat.className = this.activeTab === "categories" ? "btn btn-primary" : "btn btn-secondary";
      if (btnPerm) btnPerm.className = this.activeTab === "permissions" ? "btn btn-primary" : "btn btn-secondary";

      if (btnAdd) {
        btnAdd.style.display = this.activeTab === "permissions" ? "none" : "inline-flex";
        if (addText) addText.textContent = this.activeTab === "categories" ? "Add Category" : "Add New Dish";
      }

      if (btnQuickToggle) btnQuickToggle.style.display = this.activeTab === "products" ? "inline-flex" : "none";
      if (btnBulk) btnBulk.style.display = this.activeTab === "products" ? "inline-flex" : "none";
      if (btnExport) btnExport.style.display = this.activeTab === "products" ? "inline-flex" : "none";
      if (btnPrint) btnPrint.style.display = this.activeTab === "products" ? "inline-flex" : "none";

      this.selectedProductIds.clear();
      this.updateBulkActionBar();
      this.render();
    };

    if (btnProd) {
      btnProd.onclick = () => {
        this.activeTab = "products";
        updateTabUI();
      };
    }

    if (btnCat) {
      btnCat.onclick = () => {
        this.activeTab = "categories";
        updateTabUI();
      };
    }

    if (btnPerm) {
      btnPerm.onclick = () => {
        this.activeTab = "permissions";
        updateTabUI();
      };
    }

    if (btnQuickToggle) {
      btnQuickToggle.onclick = () => {
        this.showQuickAddBar = !this.showQuickAddBar;
        btnQuickToggle.className = `btn ${this.showQuickAddBar ? 'btn-primary' : 'btn-secondary'}`;
        this.render();
      };
    }

    if (btnAdd) {
      btnAdd.onclick = () => {
        if (this.activeTab === "products") {
          this.openProductModal();
        } else if (this.activeTab === "categories") {
          this.openCategoryModal();
        }
      };
    }

    if (btnBulk) {
      btnBulk.onclick = () => this.openBulkOperationsModal();
    }

    if (btnExport) {
      btnExport.onclick = () => this.exportMenuCSV();
    }

    if (btnPrint) {
      btnPrint.onclick = () => this.printMenuPriceList();
    }
  },

  render() {
    const mount = document.getElementById("menu-content-mount");
    if (!mount) return;

    if (this.activeTab === "products") {
      this.renderProducts(mount);
    } else if (this.activeTab === "categories") {
      this.renderCategories(mount);
    } else if (this.activeTab === "permissions") {
      this.renderPermissions(mount);
    }

    this.updateBulkActionBar();
  },

  // =========================================================================
  // 1. PRODUCTS MANAGEMENT & CATALOG ENGINEERING
  // =========================================================================
  renderProducts(mount) {
    const products = (window.db && window.db.get("products")) || [];
    const categories = (window.db && window.db.get("categories")) || [];
    const settings = (window.db && window.db.get("settings")) || {};
    const currency = settings.currencySymbol || "₹";

    // Compute Executive Scorecard Metrics
    const totalCount = products.length;
    const availableCount = products.filter(p => p.available !== false).length;
    const outOfStockCount = totalCount - availableCount;
    const vegCount = products.filter(p => p.veg !== false).length;
    const nonVegCount = totalCount - vegCount;

    // Pricing & Margin Stats
    let totalPriceSum = 0;
    let minPrice = Infinity;
    let maxPrice = 0;
    let totalMarginSum = 0;
    let totalFoodCostSum = 0;
    let customCostCount = 0;
    let recipesMappedCount = 0;

    // Margin Tier Buckets
    let highMarginCount = 0; // >= 65%
    let medMarginCount = 0;  // 50-64%
    let warnMarginCount = 0; // 35-49%
    let critMarginCount = 0; // < 35%

    products.forEach(p => {
      const price = Number(p.price) || 0;
      totalPriceSum += price;
      if (price < minPrice) minPrice = price;
      if (price > maxPrice) maxPrice = price;

      const costInfo = this.calculateProductCost(p);
      totalMarginSum += costInfo.marginPct;
      totalFoodCostSum += costInfo.foodCost;
      if (costInfo.isCustom || costInfo.isFromRecipe) customCostCount++;
      if (costInfo.hasRecipe) recipesMappedCount++;

      if (costInfo.marginTier === "high") highMarginCount++;
      else if (costInfo.marginTier === "med") medMarginCount++;
      else if (costInfo.marginTier === "warn") warnMarginCount++;
      else critMarginCount++;
    });

    const avgPrice = totalCount > 0 ? (totalPriceSum / totalCount).toFixed(0) : "0";
    const avgMargin = totalCount > 0 ? Math.round(totalMarginSum / totalCount) : (100 - this.benchmarkCogsPercent);
    const avgCost = totalCount > 0 ? (totalFoodCostSum / totalCount).toFixed(0) : "0";
    const inStockPct = totalCount > 0 ? Math.round((availableCount / totalCount) * 100) : 0;
    const unmappedCount = totalCount - recipesMappedCount;

    // Filter Products
    let filtered = [...products];

    // Category filter
    if (this.selectedCategory !== "all") {
      filtered = filtered.filter(p => p.category === this.selectedCategory);
    }

    // Status / Dietary Chip Filter
    if (this.statusFilter === "in-stock") {
      filtered = filtered.filter(p => p.available !== false);
    } else if (this.statusFilter === "out-of-stock") {
      filtered = filtered.filter(p => p.available === false);
    } else if (this.statusFilter === "veg") {
      filtered = filtered.filter(p => p.veg !== false);
    } else if (this.statusFilter === "non-veg") {
      filtered = filtered.filter(p => p.veg === false);
    } else if (this.statusFilter === "high-margin") {
      filtered = filtered.filter(p => this.calculateProductCost(p).marginTier === "high");
    } else if (this.statusFilter === "low-margin") {
      filtered = filtered.filter(p => {
        const t = this.calculateProductCost(p).marginTier;
        return t === "warn" || t === "crit";
      });
    } else if (this.statusFilter === "recipe-set") {
      filtered = filtered.filter(p => p.recipe && Object.keys(p.recipe).length > 0);
    } else if (this.statusFilter === "recipe-missing") {
      filtered = filtered.filter(p => !p.recipe || Object.keys(p.recipe).length === 0);
    }

    // Specific Margin Tier Filter from Visual Gauge
    if (this.marginTierFilter) {
      filtered = filtered.filter(p => this.calculateProductCost(p).marginTier === this.marginTierFilter);
    }

    // Search query filter
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(p => {
        const cat = categories.find(c => c.id === p.category);
        const catName = cat ? cat.name.toLowerCase() : "";
        const idMatch = (p.id || "").toLowerCase().includes(q);
        const nameMatch = (p.name || "").toLowerCase().includes(q);
        const subMatch = (p.subCategory || "").toLowerCase().includes(q);
        return idMatch || nameMatch || catName.includes(q) || subMatch.includes(q);
      });
    }

    // Sorting
    filtered.sort((a, b) => {
      const costA = this.calculateProductCost(a);
      const costB = this.calculateProductCost(b);
      switch (this.sortBy) {
        case "name-asc":
          return (a.name || "").localeCompare(b.name || "");
        case "name-desc":
          return (b.name || "").localeCompare(a.name || "");
        case "price-asc":
          return (a.price || 0) - (b.price || 0);
        case "price-desc":
          return (b.price || 0) - (a.price || 0);
        case "margin-desc":
          return costB.marginPct - costA.marginPct;
        case "margin-asc":
          return costA.marginPct - costB.marginPct;
        case "recipe-desc":
          return costB.recipeCount - costA.recipeCount;
        default:
          return 0;
      }
    });

    // Build Category Filter Pills HTML
    const catPillsHtml = `
      <div class="menu-cat-pills-bar" style="display: flex; gap: 6px; overflow-x: auto; padding: 4px 2px; -webkit-overflow-scrolling: touch; flex-wrap: nowrap; scrollbar-width: none;">
        <button type="button" class="menu-cat-pill ${this.selectedCategory === 'all' ? 'active' : ''}" data-cat="all">
          <i class="fa-solid fa-border-all" style="font-size: 10px; margin-right: 4px;"></i> All Items (${products.length})
        </button>
        ${categories.map(c => {
          const cCount = products.filter(p => p.category === c.id).length;
          const isActive = this.selectedCategory === c.id;
          return `
            <button type="button" class="menu-cat-pill ${isActive ? 'active' : ''}" data-cat="${c.id}">
              <i class="fa-solid fa-tag" style="font-size: 10px; margin-right: 4px;"></i> ${c.name} (${cCount})
            </button>
          `;
        }).join("")}
      </div>
    `;

    // Render Table Rows
    let rowsHtml = "";
    if (filtered.length === 0) {
      rowsHtml = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 45px; font-weight: 600;">
            <i class="fa-solid fa-utensils" style="font-size: 34px; opacity: 0.3; display: block; margin-bottom: 10px;"></i>
            No menu items found matching the selected search keyword or filter chip.
          </td>
        </tr>
      `;
    } else {
      rowsHtml = filtered.map(p => {
        const cat = categories.find(c => c.id === p.category);
        const costInfo = this.calculateProductCost(p);
        const isAvail = p.available !== false;
        const isVeg = p.veg !== false;
        const isSelected = this.selectedProductIds.has(p.id);

        return `
          <tr class="${!isAvail ? 'table-row-dimmed' : ''}">
            <!-- Multi-Select Checkbox -->
            <td style="width: 40px; text-align: center;">
              <input type="checkbox" class="menu-item-select-chk" data-id="${p.id}" ${isSelected ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px; accent-color: #2563eb;">
            </td>

            <!-- Dish & Category -->
            <td>
              <div style="display: flex; align-items: center; gap: 10px;">
                <div class="menu-diet-box ${isVeg ? 'veg' : 'non-veg'}" title="${isVeg ? 'Pure Vegetarian' : 'Non-Vegetarian'}">
                  <div class="menu-diet-dot"></div>
                </div>
                <div>
                  <div style="font-weight: 800; color: var(--text-dark); font-size: 13.5px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                    <span>${p.name}</span>
                    ${p.jain ? `<span class="menu-tag-pill menu-tag-jain">Jain 🌿</span>` : ''}
                    ${p.spicyLevel && p.spicyLevel !== 'none' ? `<span class="menu-tag-pill menu-tag-spicy">${p.spicyLevel} 🌶️</span>` : ''}
                    ${p.special ? `<span class="menu-tag-pill menu-tag-special">Special ⭐</span>` : ''}
                    ${p.bogo ? `<span class="menu-tag-pill menu-tag-bogo">BOGO 🎁</span>` : ''}
                  </div>
                  <div style="font-size: 11px; color: var(--text-muted); display: flex; align-items: center; gap: 6px; margin-top: 2px;">
                    <code>${p.id}</code>
                    <span>•</span>
                    <span style="color: #2563eb; font-weight: 700;">${cat ? cat.name : 'Unassigned'}</span>
                    ${p.subCategory ? `<span>•</span><span style="color: #475569; font-weight: 600;">${p.subCategory}</span>` : ''}
                  </div>
                </div>
              </div>
            </td>

            <!-- Selling Price with Fast Inline Edit -->
            <td>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-weight: 900; color: var(--text-dark); font-size: 14.5px;">
                  ${currency}${Number(p.price || 0).toFixed(0)}
                </span>
                <button class="btn btn-secondary btn-quick-price" data-id="${p.id}" data-price="${p.price}" title="Quick Edit Selling Price (₹)" style="padding: 3px 6px; font-size: 10px; border-radius: 6px; border: 1px solid #cbd5e1;">
                  <i class="fa-solid fa-pen"></i>
                </button>
              </div>
            </td>

            <!-- Food Cost, Profit & Gross Margin -->
            <td>
              <div style="display: flex; flex-direction: column; gap: 3px;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span class="menu-margin-badge ${costInfo.marginTier}">
                    <i class="fa-solid fa-chart-line" style="font-size: 9px;"></i> ${costInfo.marginPct}% Margin
                  </span>
                  ${costInfo.isCustom ? `<span style="font-size: 9px; font-weight: 800; background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; padding: 1px 5px; border-radius: 5px;">Custom</span>` : ''}
                  ${costInfo.isFromRecipe ? `<span style="font-size: 9px; font-weight: 800; background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; padding: 1px 5px; border-radius: 5px;">Recipe</span>` : ''}
                </div>
                <div style="font-size: 11px; color: var(--text-muted); font-weight: 600; display: flex; align-items: center; gap: 4px;">
                  <span>Cost: <strong>${currency}${costInfo.foodCost.toFixed(0)}</strong></span>
                  <button class="btn-quick-cost" data-id="${p.id}" title="Quick Edit Cost Price (₹)" style="border: none; background: transparent; cursor: pointer; color: #64748b; padding: 0 2px; font-size: 10px;">
                    <i class="fa-solid fa-pen-to-square"></i>
                  </button>
                  <span>| Profit: <strong style="color: #059669;">${currency}${costInfo.grossProfit.toFixed(0)}</strong></span>
                </div>
              </div>
            </td>

            <!-- Recipe Inventory Tracking -->
            <td>
              <button class="btn ${costInfo.hasRecipe ? 'btn-secondary' : 'btn-outline'} btn-recipe-setup" data-id="${p.id}" title="Configure Raw Ingredients Deduction" style="padding: 4px 10px; font-size: 11.5px; border-radius: 8px; font-weight: 750; display: inline-flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-mortar-pestle" style="color: ${costInfo.hasRecipe ? '#2563eb' : '#d97706'};"></i> 
                ${costInfo.hasRecipe ? `${costInfo.recipeCount} Raw Items` : '<span style="color: #d97706;">+ Inventory Map</span>'}
              </button>
            </td>

            <!-- POS Stock Status (1-Click 86'd Toggle) -->
            <td>
              <div style="display: flex; align-items: center; gap: 8px;">
                <label class="menu-toggle-switch" title="Toggle dish live availability in POS (Green: Live, Grey: 86'd / Hidden)">
                  <input type="checkbox" class="toggle-availability-chk" data-id="${p.id}" ${isAvail ? 'checked' : ''}>
                  <span class="menu-toggle-slider slider-green"></span>
                </label>
                <span style="font-size: 11.5px; font-weight: 800; color: ${isAvail ? '#059669' : '#dc2626'}; white-space: nowrap;">
                  ${isAvail ? '<i class="fa-solid fa-circle-check" style="font-size: 10px;"></i> Live' : '<i class="fa-solid fa-circle-xmark" style="font-size: 10px;"></i> 86\'d'}
                </span>
              </div>
            </td>

            <!-- Actions -->
            <td>
              <div style="display: flex; gap: 5px; align-items: center; justify-content: flex-end;">
                <button class="btn btn-secondary btn-edit-product" data-id="${p.id}" title="Edit Dish & Pricing" style="padding: 5px 8px; font-size: 11.5px; border-radius: 8px;">
                  <i class="fa-solid fa-pen-to-square" style="color: #2563eb;"></i>
                </button>
                <button class="btn btn-secondary btn-duplicate-product" data-id="${p.id}" title="Duplicate Dish (Clone)" style="padding: 5px 8px; font-size: 11.5px; border-radius: 8px;">
                  <i class="fa-solid fa-copy" style="color: #059669;"></i>
                </button>
                <button class="btn btn-danger btn-delete-product" data-id="${p.id}" title="Delete Dish" style="padding: 5px 8px; font-size: 11.5px; border-radius: 8px;">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join("");
    }

    // Render Cards Grid View
    let cardsHtml = "";
    if (filtered.length === 0) {
      cardsHtml = `
        <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 50px; font-weight: 600;">
          <i class="fa-solid fa-utensils" style="font-size: 36px; opacity: 0.3; display: block; margin-bottom: 10px;"></i>
          No dishes match your selected filter.
        </div>
      `;
    } else {
      cardsHtml = filtered.map(p => {
        const cat = categories.find(c => c.id === p.category);
        const costInfo = this.calculateProductCost(p);
        const isAvail = p.available !== false;
        const isVeg = p.veg !== false;
        const isSelected = this.selectedProductIds.has(p.id);

        return `
          <div class="menu-item-card ${!isAvail ? 'out-of-stock' : ''}" style="${isSelected ? 'border-color: #2563eb; background: #eff6ff;' : ''}">
            <!-- Header Row -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
              <div style="display: flex; align-items: flex-start; gap: 8px;">
                <input type="checkbox" class="menu-item-select-chk" data-id="${p.id}" ${isSelected ? 'checked' : ''} style="margin-top: 4px; cursor: pointer; width: 15px; height: 15px; accent-color: #2563eb;">
                <div class="menu-diet-box ${isVeg ? 'veg' : 'non-veg'}" style="margin-top: 3px;" title="${isVeg ? 'Pure Veg' : 'Non-Veg'}">
                  <div class="menu-diet-dot"></div>
                </div>
                <div>
                  <h4 style="margin: 0; font-size: 14.5px; font-weight: 800; color: var(--text-dark);">${p.name}</h4>
                  <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                    <code>${p.id}</code> • <strong style="color: #2563eb;">${cat ? cat.name : 'Unassigned'}</strong>
                    ${p.subCategory ? ` • <span>${p.subCategory}</span>` : ''}
                  </div>
                  <!-- Tags -->
                  <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px;">
                    ${p.jain ? `<span class="menu-tag-pill menu-tag-jain">Jain 🌿</span>` : ''}
                    ${p.spicyLevel && p.spicyLevel !== 'none' ? `<span class="menu-tag-pill menu-tag-spicy">${p.spicyLevel} 🌶️</span>` : ''}
                    ${p.special ? `<span class="menu-tag-pill menu-tag-special">Special ⭐</span>` : ''}
                    ${p.bogo ? `<span class="menu-tag-pill menu-tag-bogo">BOGO 🎁</span>` : ''}
                  </div>
                </div>
              </div>
              <div style="font-size: 17px; font-weight: 900; color: var(--text-dark); white-space: nowrap;">
                ${currency}${Number(p.price || 0).toFixed(0)}
              </div>
            </div>

            <!-- Cost & Margin Progress Meter -->
            <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 10px; padding: 8px 10px;">
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
                <span class="menu-margin-badge ${costInfo.marginTier}">
                  ${costInfo.marginPct}% Margin
                </span>
                <span style="color: var(--text-muted); font-weight: 700;">
                  Cost: ${currency}${costInfo.foodCost.toFixed(0)} (${costInfo.isCustom ? 'Custom' : costInfo.isFromRecipe ? 'Recipe' : `${this.benchmarkCogsPercent}%`})
                </span>
              </div>
              <div style="width: 100%; height: 6px; background: #e2e8f0; border-radius: 4px; overflow: hidden; margin-top: 6px;">
                <div style="width: ${costInfo.marginPct}%; height: 100%; background: ${costInfo.marginTier === 'high' ? '#059669' : costInfo.marginTier === 'med' ? '#2563eb' : costInfo.marginTier === 'warn' ? '#d97706' : '#dc2626'}; border-radius: 4px;"></div>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--text-muted); margin-top: 4px; font-weight: 600;">
                <span>Profit: <strong style="color: #059669;">${currency}${costInfo.grossProfit.toFixed(0)}</strong></span>
                <span>Selling: <strong>${currency}${Number(p.price || 0).toFixed(0)}</strong></span>
              </div>
            </div>

            <!-- Stock Switch Row -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 9px;">
              <span style="font-size: 11px; font-weight: 700; color: var(--text-muted);">POS Billing Status:</span>
              <div style="display: flex; align-items: center; gap: 6px;">
                <label class="menu-toggle-switch" title="Toggle In-Stock">
                  <input type="checkbox" class="toggle-availability-chk" data-id="${p.id}" ${isAvail ? 'checked' : ''}>
                  <span class="menu-toggle-slider slider-green"></span>
                </label>
                <span style="font-size: 11px; font-weight: 800; color: ${isAvail ? '#059669' : '#dc2626'};">
                  ${isAvail ? 'Live' : '86\'d'}
                </span>
              </div>
            </div>

            <!-- Actions Footer -->
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px; border-top: 1px dashed var(--border-color); padding-top: 8px;">
              <button class="btn btn-secondary btn-recipe-setup" data-id="${p.id}" style="padding: 4px 8px; font-size: 11px; font-weight: 750; border-radius: 8px; display: inline-flex; align-items: center; gap: 4px;">
                <i class="fa-solid fa-mortar-pestle" style="color: #2563eb;"></i> Recipe (${costInfo.recipeCount})
              </button>

              <div style="display: flex; gap: 4px;">
                <button class="btn btn-secondary btn-edit-product" data-id="${p.id}" title="Edit Dish" style="padding: 4px 7px; font-size: 11px; border-radius: 8px;">
                  <i class="fa-solid fa-pen" style="color: #2563eb;"></i>
                </button>
                <button class="btn btn-secondary btn-duplicate-product" data-id="${p.id}" title="Duplicate" style="padding: 4px 7px; font-size: 11px; border-radius: 8px;">
                  <i class="fa-solid fa-copy" style="color: #059669;"></i>
                </button>
                <button class="btn btn-danger btn-delete-product" data-id="${p.id}" title="Delete" style="padding: 4px 7px; font-size: 11px; border-radius: 8px;">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              </div>
            </div>
          </div>
        `;
      }).join("");
    }

    mount.innerHTML = `
      <div class="view-animate" style="display: flex; flex-direction: column; gap: 14px;">
        
        <!-- 4-Card Executive Overview Scorecard -->
        <div class="menu-kpi-grid">
          
          <!-- Card 1: Catalog Status & 86'd Out-of-Stock -->
          <div class="menu-kpi-card">
            <div>
              <div class="menu-kpi-title">Catalog Inventory</div>
              <div class="menu-kpi-val">${totalCount} <span style="font-size: 14px; color: var(--text-muted); font-weight: 600;">Dishes</span></div>
              <div class="menu-kpi-sub" style="color: #059669;">
                <i class="fa-solid fa-circle-check"></i> ${availableCount} Live in POS (${inStockPct}%)
                ${outOfStockCount > 0 ? `<span style="color: #dc2626; margin-left: 4px;">• ${outOfStockCount} 86'd</span>` : ''}
              </div>
            </div>
            <div class="menu-kpi-icon" style="background: #eff6ff; color: #2563eb;">
              <i class="fa-solid fa-burger"></i>
            </div>
          </div>

          <!-- Card 2: Price Valuation & Range -->
          <div class="menu-kpi-card">
            <div>
              <div class="menu-kpi-title">Catalog Valuation</div>
              <div class="menu-kpi-val">${currency}${avgPrice} <span style="font-size: 13px; color: var(--text-muted); font-weight: 600;">Avg / Dish</span></div>
              <div class="menu-kpi-sub" style="color: var(--text-muted);">
                <i class="fa-solid fa-arrows-left-right"></i> Range: ${currency}${totalCount > 0 ? minPrice : 0} - ${currency}${maxPrice}
              </div>
            </div>
            <div class="menu-kpi-icon" style="background: #ecfdf5; color: #059669;">
              <i class="fa-solid fa-indian-rupee-sign"></i>
            </div>
          </div>

          <!-- Card 3: Food Cost (COGS) & Profit Margin -->
          <div class="menu-kpi-card">
            <div>
              <div class="menu-kpi-title">Gross Profit & Food Cost</div>
              <div class="menu-kpi-val" style="color: #059669;">${avgMargin}% <span style="font-size: 13px; color: var(--text-muted); font-weight: 600;">Avg Profit</span></div>
              <div class="menu-kpi-sub" style="color: #b45309; display: flex; align-items: center; gap: 4px;">
                <span>${currency}${avgCost} Avg Cost (${this.benchmarkCogsPercent}% COGS)</span>
                ${customCostCount > 0 ? `<span style="color: #2563eb;">• ${customCostCount} Custom</span>` : ''}
              </div>
            </div>
            <div class="menu-kpi-icon" style="background: #f0fdf4; color: #16a34a;">
              <i class="fa-solid fa-percent"></i>
            </div>
          </div>

          <!-- Card 4: Recipe & Dietary Health -->
          <div class="menu-kpi-card">
            <div>
              <div class="menu-kpi-title">Recipe & Dietary Health</div>
              <div class="menu-kpi-val">${recipesMappedCount} <span style="font-size: 13px; color: var(--text-muted); font-weight: 600;">/ ${totalCount} Mapped</span></div>
              <div class="menu-kpi-sub" style="color: #16a34a;">
                <i class="fa-solid fa-leaf"></i> ${vegCount} Veg ${nonVegCount > 0 ? `• <span style="color: #dc2626;">${nonVegCount} Non-Veg</span>` : ''}
                ${unmappedCount > 0 ? `<span style="color: #d97706; margin-left: 4px;">• ${unmappedCount} Unmapped</span>` : ''}
              </div>
            </div>
            <div class="menu-kpi-icon" style="background: #fdf4ff; color: #c026d3;">
              <i class="fa-solid fa-mortar-pestle"></i>
            </div>
          </div>

        </div>

        <!-- Profitability Health Gauge Ribbon -->
        <div class="glass-card" style="padding: 12px 18px; border-radius: 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 11.5px; font-weight: 800; color: var(--text-dark); text-transform: uppercase;">
              <i class="fa-solid fa-gauge-high" style="color: #2563eb; margin-right: 4px;"></i> Profit Health:
            </span>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              <button type="button" class="btn ${this.marginTierFilter === 'high' ? 'btn-primary' : 'btn-secondary'}" onclick="views.menu.filterByMarginTier('high')" style="padding: 3px 10px; font-size: 11px; border-radius: 8px; font-weight: 800;">
                🟢 High Margin (${highMarginCount})
              </button>
              <button type="button" class="btn ${this.marginTierFilter === 'med' ? 'btn-primary' : 'btn-secondary'}" onclick="views.menu.filterByMarginTier('med')" style="padding: 3px 10px; font-size: 11px; border-radius: 8px; font-weight: 800;">
                🔵 Standard (${medMarginCount})
              </button>
              <button type="button" class="btn ${this.marginTierFilter === 'warn' ? 'btn-primary' : 'btn-secondary'}" onclick="views.menu.filterByMarginTier('warn')" style="padding: 3px 10px; font-size: 11px; border-radius: 8px; font-weight: 800;">
                🟡 Low Margin (${warnMarginCount})
              </button>
              ${critMarginCount > 0 ? `
              <button type="button" class="btn ${this.marginTierFilter === 'crit' ? 'btn-danger' : 'btn-secondary'}" onclick="views.menu.filterByMarginTier('crit')" style="padding: 3px 10px; font-size: 11px; border-radius: 8px; font-weight: 800;">
                🔴 Critical (<35%) (${critMarginCount})
              </button>
              ` : ''}
              ${this.marginTierFilter ? `
                <button type="button" onclick="views.menu.filterByMarginTier(null)" style="background: none; border: none; color: #dc2626; font-size: 11px; font-weight: 800; cursor: pointer; text-decoration: underline;">
                  Clear Tier
                </button>
              ` : ''}
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 11px; font-weight: 750; color: var(--text-muted);">COGS Benchmark:</span>
            <div class="cogs-calibrator-pill" style="display: inline-flex; background: #f1f5f9; border: 1px solid var(--border-color); border-radius: 10px; padding: 2px;">
              <button type="button" class="menu-cogs-btn ${this.benchmarkCogsPercent === 28 ? 'active' : ''}" data-rate="28" style="padding: 2px 7px; border: none; background: ${this.benchmarkCogsPercent === 28 ? '#2563eb' : 'transparent'}; color: ${this.benchmarkCogsPercent === 28 ? '#fff' : 'var(--text-muted)'}; border-radius: 8px; font-size: 10.5px; font-weight: 800; cursor: pointer;">28%</button>
              <button type="button" class="menu-cogs-btn ${this.benchmarkCogsPercent === 30 ? 'active' : ''}" data-rate="30" style="padding: 2px 7px; border: none; background: ${this.benchmarkCogsPercent === 30 ? '#2563eb' : 'transparent'}; color: ${this.benchmarkCogsPercent === 30 ? '#fff' : 'var(--text-muted)'}; border-radius: 8px; font-size: 10.5px; font-weight: 800; cursor: pointer;">30%</button>
              <button type="button" class="menu-cogs-btn ${this.benchmarkCogsPercent === 32 ? 'active' : ''}" data-rate="32" style="padding: 2px 7px; border: none; background: ${this.benchmarkCogsPercent === 32 ? '#2563eb' : 'transparent'}; color: ${this.benchmarkCogsPercent === 32 ? '#fff' : 'var(--text-muted)'}; border-radius: 8px; font-size: 10.5px; font-weight: 800; cursor: pointer;">32%</button>
              <button type="button" class="menu-cogs-btn ${this.benchmarkCogsPercent === 35 ? 'active' : ''}" data-rate="35" style="padding: 2px 7px; border: none; background: ${this.benchmarkCogsPercent === 35 ? '#2563eb' : 'transparent'}; color: ${this.benchmarkCogsPercent === 35 ? '#fff' : 'var(--text-muted)'}; border-radius: 8px; font-size: 10.5px; font-weight: 800; cursor: pointer;">35%</button>
            </div>
          </div>
        </div>

        <!-- Fast Inline Quick-Add Dish Bar (When toggled) -->
        ${this.showQuickAddBar ? `
          <div class="menu-quick-add-bar view-animate" id="menu-quick-add-container">
            <div style="font-weight: 850; font-size: 12.5px; color: #2563eb; display: flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-bolt"></i> Quick Add Dish:
            </div>
            
            <input type="text" id="qa-dish-name" class="form-input" placeholder="Dish Name (e.g. Cheese Sandwich)" style="height: 34px; font-size: 12px; border-radius: 8px; flex: 2; min-width: 160px;" required>
            
            <select id="qa-dish-cat" class="form-select" style="height: 34px; font-size: 12px; border-radius: 8px; flex: 1; min-width: 130px;">
              ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join("")}
            </select>

            <input type="number" id="qa-dish-price" class="form-input" placeholder="Price (₹)" min="1" step="any" style="height: 34px; font-size: 12.5px; font-weight: 800; border-radius: 8px; width: 100px;" required>

            <label style="display: flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 750; cursor: pointer;">
              <input type="checkbox" id="qa-dish-veg" checked style="accent-color: #16a34a; width: 15px; height: 15px;">
              <span class="menu-diet-box veg"><span class="menu-diet-dot"></span></span> Veg
            </label>

            <button type="button" class="btn btn-primary" id="btn-qa-submit" style="height: 34px; padding: 0 14px; font-size: 12px; border-radius: 8px; font-weight: 800;">
              <i class="fa-solid fa-plus"></i> Save Dish
            </button>

            <button type="button" class="btn btn-secondary" onclick="views.menu.toggleQuickAddBar()" style="height: 34px; padding: 0 10px; font-size: 12px; border-radius: 8px;">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        ` : ''}

        <!-- Toolbar & Filter Engine -->
        <div class="glass-card" style="padding: 14px 18px; display: flex; flex-direction: column; gap: 12px; border-radius: 14px;">
          
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            
            <!-- Global Search -->
            <div style="position: relative; width: 260px;">
              <input type="text" id="menu-search-input" class="form-input" placeholder="Search dish name, ID, or category..." value="${this.searchQuery}" style="padding: 6px 12px 6px 32px; font-size: 12.5px; height: 36px; border-radius: 10px; width: 100%;">
              <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 10px; top: 11px; color: var(--text-muted); font-size: 12px; pointer-events: none;"></i>
            </div>

            <!-- Sort By Selector -->
            <div style="display: flex; align-items: center; gap: 8px;">
              <label for="menu-sort-select" style="font-size: 12px; font-weight: 700; color: var(--text-muted); white-space: nowrap;">Sort by:</label>
              <select id="menu-sort-select" class="form-select" style="height: 36px; font-size: 12px; border-radius: 10px; padding: 4px 10px; font-weight: 700;">
                <option value="name-asc" ${this.sortBy === 'name-asc' ? 'selected' : ''}>Dish Name (A - Z)</option>
                <option value="name-desc" ${this.sortBy === 'name-desc' ? 'selected' : ''}>Dish Name (Z - A)</option>
                <option value="price-asc" ${this.sortBy === 'price-asc' ? 'selected' : ''}>Price (Low to High)</option>
                <option value="price-desc" ${this.sortBy === 'price-desc' ? 'selected' : ''}>Price (High to Low)</option>
                <option value="margin-desc" ${this.sortBy === 'margin-desc' ? 'selected' : ''}>Profit Margin % (Highest)</option>
                <option value="margin-asc" ${this.sortBy === 'margin-asc' ? 'selected' : ''}>Profit Margin % (Lowest)</option>
                <option value="recipe-desc" ${this.sortBy === 'recipe-desc' ? 'selected' : ''}>Recipe Ingredients (Most)</option>
              </select>
            </div>

            <!-- View Switcher (Table vs Grid) -->
            <div class="menu-view-switcher">
              <button class="menu-view-btn ${this.viewMode === 'table' ? 'active' : ''}" id="btn-view-table" title="Compact Table View">
                <i class="fa-solid fa-table-list"></i> Table
              </button>
              <button class="menu-view-btn ${this.viewMode === 'grid' ? 'active' : ''}" id="btn-view-grid" title="Visual Cards Grid View">
                <i class="fa-solid fa-border-all"></i> Cards
              </button>
            </div>

            <div style="font-size: 12px; color: var(--text-muted); font-weight: 700;">
              Showing <strong style="color: var(--text-dark);">${filtered.length}</strong> of ${products.length} dishes
            </div>
          </div>

          <!-- Quick Status Filter Chips -->
          <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center; border-top: 1px dashed var(--border-color); padding-top: 10px;">
            <button class="menu-filter-chip ${this.statusFilter === 'all' ? 'active' : ''}" data-filter="all">
              All (${totalCount})
            </button>
            <button class="menu-filter-chip ${this.statusFilter === 'in-stock' ? 'active' : ''}" data-filter="in-stock">
              <i class="fa-solid fa-circle-check" style="color: #059669;"></i> In Stock (${availableCount})
            </button>
            <button class="menu-filter-chip ${this.statusFilter === 'out-of-stock' ? 'active' : ''}" data-filter="out-of-stock">
              <i class="fa-solid fa-circle-xmark" style="color: #dc2626;"></i> 86'd Out (${outOfStockCount})
            </button>
            <button class="menu-filter-chip ${this.statusFilter === 'veg' ? 'active' : ''}" data-filter="veg">
              <i class="fa-solid fa-leaf" style="color: #16a34a;"></i> Pure Veg (${vegCount})
            </button>
            ${nonVegCount > 0 ? `
            <button class="menu-filter-chip ${this.statusFilter === 'non-veg' ? 'active' : ''}" data-filter="non-veg">
              <i class="fa-solid fa-drumstick-bite" style="color: #dc2626;"></i> Non-Veg (${nonVegCount})
            </button>
            ` : ''}
            <button class="menu-filter-chip ${this.statusFilter === 'high-margin' ? 'active' : ''}" data-filter="high-margin">
              <i class="fa-solid fa-star" style="color: #059669;"></i> High Margin >65% (${highMarginCount})
            </button>
            <button class="menu-filter-chip ${this.statusFilter === 'recipe-set' ? 'active' : ''}" data-filter="recipe-set">
              <i class="fa-solid fa-mortar-pestle" style="color: #2563eb;"></i> Recipe Mapped (${recipesMappedCount})
            </button>
            <button class="menu-filter-chip ${this.statusFilter === 'recipe-missing' ? 'active' : ''}" data-filter="recipe-missing">
              <i class="fa-solid fa-triangle-exclamation" style="color: #d97706;"></i> Unmapped (${unmappedCount})
            </button>
          </div>

          <!-- Category filter pills -->
          ${catPillsHtml}
        </div>

        <!-- Products View (Table or Cards) -->
        ${this.viewMode === 'table' ? `
          <div class="glass-card" style="padding: 16px 18px; border-radius: 14px;">
            <div class="table-container">
              <table class="premium-table">
                <thead>
                  <tr>
                    <th style="width: 40px; text-align: center;">
                      <input type="checkbox" id="menu-select-all-chk" title="Select All Filtered Dishes" style="cursor: pointer; width: 16px; height: 16px; accent-color: #2563eb;">
                    </th>
                    <th style="min-width: 220px;">Dish & Category</th>
                    <th>Selling Price</th>
                    <th>Food Cost & Margin</th>
                    <th>Inventory Recipe</th>
                    <th>POS Live Status</th>
                    <th style="text-align: right; min-width: 120px;">Actions</th>
                  </tr>
                </thead>
                <tbody id="menu-products-tbody">
                  ${rowsHtml}
                </tbody>
              </table>
            </div>
          </div>
        ` : `
          <div class="menu-cards-grid">
            ${cardsHtml}
          </div>
        `}

      </div>
    `;

    this.bindProductViewEvents(mount, products, filtered);
  },

  bindProductViewEvents(mount, products, filtered) {
    // Bind Search Input
    const searchInput = mount.querySelector("#menu-search-input");
    if (searchInput) {
      searchInput.oninput = (e) => {
        this.searchQuery = e.target.value.trim();
        this.renderProducts(mount);
      };
    }

    // Bind Food Cost Benchmark Calibrator Buttons
    mount.querySelectorAll(".menu-cogs-btn").forEach(btn => {
      btn.onclick = () => {
        const rate = Number(btn.getAttribute("data-rate")) || 32;
        this.benchmarkCogsPercent = rate;
        const settings = (window.db && window.db.get("settings")) || {};
        settings.cogsPercent = rate;
        window.db.set("settings", settings);
        window.showToast(`Food cost benchmark set to ${rate}%.`, "success");
        this.render();
      };
    });

    // Bind Sort selector
    const sortSelect = mount.querySelector("#menu-sort-select");
    if (sortSelect) {
      sortSelect.onchange = (e) => {
        this.sortBy = e.target.value;
        this.renderProducts(mount);
      };
    }

    // Bind View switcher buttons
    const btnTable = mount.querySelector("#btn-view-table");
    const btnGrid = mount.querySelector("#btn-view-grid");
    if (btnTable) {
      btnTable.onclick = () => {
        this.viewMode = "table";
        this.renderProducts(mount);
      };
    }
    if (btnGrid) {
      btnGrid.onclick = () => {
        this.viewMode = "grid";
        this.renderProducts(mount);
      };
    }

    // Bind Category Filter Pills
    mount.querySelectorAll(".menu-cat-pill").forEach(pill => {
      pill.onclick = () => {
        this.selectedCategory = pill.getAttribute("data-cat");
        this.renderProducts(mount);
      };
    });

    // Bind Status Filter Chips
    mount.querySelectorAll(".menu-filter-chip").forEach(chip => {
      chip.onclick = () => {
        this.statusFilter = chip.getAttribute("data-filter");
        this.renderProducts(mount);
      };
    });

    // Bind Quick Price Edit
    mount.querySelectorAll(".btn-quick-price").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-id");
        const oldPrice = btn.getAttribute("data-price");
        const prod = products.find(p => p.id === id);
        if (!prod) return;

        const newPrice = prompt(`Enter new selling price for "${prod.name}" (Current: ₹${oldPrice}):`, oldPrice);
        if (newPrice !== null && !isNaN(newPrice) && Number(newPrice) > 0) {
          prod.price = Number(newPrice);
          window.db.saveProduct(prod);
          window.showToast(`Selling price for "${prod.name}" updated to ₹${prod.price}.`, "success");
          this.render();
        }
      };
    });

    // Bind Quick Cost Edit
    mount.querySelectorAll(".btn-quick-cost").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-id");
        const prod = products.find(p => p.id === id);
        if (!prod) return;

        const currentCost = prod.costPrice !== undefined && prod.costPrice !== null ? prod.costPrice : "";
        const benchmarkEstimate = (Number(prod.price || 0) * (this.benchmarkCogsPercent / 100)).toFixed(1);

        const newCost = prompt(
          `Enter exact food cost price (₹) for "${prod.name}":\n(Leave empty to use automatic ${this.benchmarkCogsPercent}% benchmark: ₹${benchmarkEstimate})`,
          currentCost
        );

        if (newCost !== null) {
          if (newCost.trim() === "") {
            delete prod.costPrice;
            window.db.saveProduct(prod);
            window.showToast(`Food cost for "${prod.name}" reset to ${this.benchmarkCogsPercent}% benchmark.`, "info");
          } else if (!isNaN(newCost) && Number(newCost) >= 0) {
            prod.costPrice = Number(newCost);
            window.db.saveProduct(prod);
            window.showToast(`Food cost for "${prod.name}" set to ₹${prod.costPrice}.`, "success");
          } else {
            window.showToast("Please enter a valid cost number.", "error");
          }
          this.render();
        }
      };
    });

    // Bind item availability toggle (1-Click 86'd / In-Stock)
    mount.querySelectorAll(".toggle-availability-chk").forEach(chk => {
      chk.onchange = () => {
        const id = chk.getAttribute("data-id");
        const prod = products.find(p => p.id === id);
        if (prod) {
          prod.available = chk.checked;
          window.db.saveProduct(prod);
          window.showToast(`${prod.name} is now ${chk.checked ? 'In Stock (Live in POS)' : '86\'d (Hidden from POS)'}.`, chk.checked ? "success" : "info");
          this.render();
        }
      };
    });

    // Bind Multi-Select Checkboxes
    mount.querySelectorAll(".menu-item-select-chk").forEach(chk => {
      chk.onchange = () => {
        const id = chk.getAttribute("data-id");
        if (chk.checked) {
          this.selectedProductIds.add(id);
        } else {
          this.selectedProductIds.delete(id);
        }
        this.updateBulkActionBar();
      };
    });

    // Bind Select All Checkbox
    const selectAllChk = mount.querySelector("#menu-select-all-chk");
    if (selectAllChk) {
      selectAllChk.checked = filtered.length > 0 && filtered.every(p => this.selectedProductIds.has(p.id));
      selectAllChk.onchange = () => {
        if (selectAllChk.checked) {
          filtered.forEach(p => this.selectedProductIds.add(p.id));
        } else {
          filtered.forEach(p => this.selectedProductIds.delete(p.id));
        }
        mount.querySelectorAll(".menu-item-select-chk").forEach(c => {
          c.checked = selectAllChk.checked;
        });
        this.updateBulkActionBar();
      };
    }

    // Bind Quick Add Submit Button
    const btnQaSubmit = mount.querySelector("#btn-qa-submit");
    if (btnQaSubmit) {
      btnQaSubmit.onclick = () => {
        const nameInput = mount.querySelector("#qa-dish-name");
        const catSelect = mount.querySelector("#qa-dish-cat");
        const priceInput = mount.querySelector("#qa-dish-price");
        const vegChk = mount.querySelector("#qa-dish-veg");

        const name = nameInput.value.trim();
        const price = Number(priceInput.value);
        const category = catSelect.value;
        const veg = vegChk.checked;

        if (!name) {
          window.showToast("Please enter a dish name.", "error");
          nameInput.focus();
          return;
        }
        if (!price || isNaN(price) || price <= 0) {
          window.showToast("Please enter a valid price.", "error");
          priceInput.focus();
          return;
        }

        window.db.saveProduct({
          name,
          price,
          category,
          veg,
          available: true
        });

        window.showToast(`Dish "${name}" added to menu!`, "success");
        nameInput.value = "";
        priceInput.value = "";
        nameInput.focus();
        this.render();
      };
    }

    // Bind Edit product
    mount.querySelectorAll(".btn-edit-product").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-id");
        const prod = products.find(p => p.id === id);
        if (prod) this.openProductModal(prod);
      };
    });

    // Bind Duplicate product
    mount.querySelectorAll(".btn-duplicate-product").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-id");
        const prod = products.find(p => p.id === id);
        if (prod) this.duplicateProduct(prod);
      };
    });

    // Bind Delete product
    mount.querySelectorAll(".btn-delete-product").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-id");
        const prod = products.find(p => p.id === id);
        if (!prod) return;
        if (confirm(`Are you sure you want to permanently delete "${prod.name}"?`)) {
          window.db.deleteProduct(id);
          this.selectedProductIds.delete(id);
          window.showToast(`Dish "${prod.name}" deleted from menu.`, "info");
          this.render();
        }
      };
    });

    // Bind Recipe Setup trigger
    mount.querySelectorAll(".btn-recipe-setup").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-id");
        this.openRecipeModal(id);
      };
    });
  },

  // Toggle Quick Add Bar
  toggleQuickAddBar() {
    this.showQuickAddBar = !this.showQuickAddBar;
    const btn = document.getElementById("btn-toggle-quick-add");
    if (btn) btn.className = `btn ${this.showQuickAddBar ? 'btn-primary' : 'btn-secondary'}`;
    this.render();
  },

  // Filter by Margin Tier
  filterByMarginTier(tier) {
    this.marginTierFilter = (this.marginTierFilter === tier) ? null : tier;
    this.render();
  },

  // MULTI-SELECT FLOATING ACTION BAR
  updateBulkActionBar() {
    if (typeof document === "undefined") return;
    const mount = document.getElementById("menu-bulk-floating-mount");
    if (!mount) return;

    if (this.selectedProductIds.size === 0) {
      mount.innerHTML = "";
      return;
    }

    const count = this.selectedProductIds.size;
    const categories = (window.db && window.db.get("categories")) || [];

    mount.innerHTML = `
      <div class="menu-bulk-floating-bar view-animate">
        <span style="font-size: 13px; font-weight: 900; background: #2563eb; color: #fff; padding: 3px 10px; border-radius: 8px;">
          ${count} Dishes Selected
        </span>

        <button type="button" class="menu-bulk-btn" onclick="views.menu.bulkSetAvailability(true)" title="Mark all selected dishes as In-Stock (Live in POS)">
          <i class="fa-solid fa-circle-check" style="color: #10b981;"></i> Mark Live
        </button>

        <button type="button" class="menu-bulk-btn" onclick="views.menu.bulkSetAvailability(false)" title="Mark all selected dishes as 86'd (Hidden from POS)">
          <i class="fa-solid fa-circle-xmark" style="color: #ef4444;"></i> Mark 86'd
        </button>

        <button type="button" class="menu-bulk-btn" onclick="views.menu.openSelectedPriceAdjustModal()" title="Adjust price for selected dishes">
          <i class="fa-solid fa-pen" style="color: #38bdf8;"></i> Adjust Price
        </button>

        <button type="button" class="menu-bulk-btn" onclick="views.menu.openSelectedCategoryModal()" title="Reassign category for selected dishes">
          <i class="fa-solid fa-tags" style="color: #f59e0b;"></i> Move Category
        </button>

        <button type="button" class="menu-bulk-btn danger" onclick="views.menu.bulkDeleteSelected()" title="Delete all selected dishes">
          <i class="fa-solid fa-trash-can"></i> Delete
        </button>

        <button type="button" onclick="views.menu.clearSelection()" style="background: none; border: none; color: #cbd5e1; font-size: 12px; font-weight: 700; cursor: pointer; text-decoration: underline; margin-left: 4px;">
          Deselect All
        </button>
      </div>
    `;
  },

  clearSelection() {
    this.selectedProductIds.clear();
    this.updateBulkActionBar();
    if (typeof document === "undefined") return;
    const selectAllChk = document.getElementById("menu-select-all-chk");
    if (selectAllChk) selectAllChk.checked = false;
    document.querySelectorAll(".menu-item-select-chk").forEach(c => { c.checked = false; });
  },

  bulkSetAvailability(available) {
    const products = (window.db && window.db.get("products")) || [];
    let updated = 0;
    products.forEach(p => {
      if (this.selectedProductIds.has(p.id)) {
        p.available = available;
        window.db.saveProduct(p);
        updated++;
      }
    });
    window.showToast(`Marked ${updated} dishes as ${available ? 'Live (In Stock)' : '86\'d (Out of Stock)'}.`, "success");
    this.render();
  },

  bulkDeleteSelected() {
    const count = this.selectedProductIds.size;
    if (!confirm(`Are you sure you want to permanently delete all ${count} selected dishes?`)) return;

    this.selectedProductIds.forEach(id => {
      window.db.deleteProduct(id);
    });

    window.showToast(`Deleted ${count} dishes from the menu.`, "info");
    this.clearSelection();
    this.render();
  },

  openSelectedPriceAdjustModal() {
    const count = this.selectedProductIds.size;
    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 12px; font-size: 13px;">
        <p style="margin: 0; color: var(--text-muted);">Adjust pricing for <strong>${count} selected dishes</strong>:</p>
        
        <div>
          <label class="form-label" for="bulk-sel-adj-type" style="font-weight: 700; margin-bottom: 4px;">Type of Adjustment:</label>
          <select id="bulk-sel-adj-type" class="form-select" style="height: 36px; border-radius: 8px;">
            <option value="inc-pct">Increase by Percentage (%)</option>
            <option value="dec-pct">Decrease by Percentage (%)</option>
            <option value="inc-fixed">Add Fixed Amount (₹)</option>
            <option value="dec-fixed">Subtract Fixed Amount (₹)</option>
          </select>
        </div>

        <div>
          <label class="form-label" for="bulk-sel-adj-val" style="font-weight: 700; margin-bottom: 4px;">Value (e.g. 10):</label>
          <input type="number" id="bulk-sel-adj-val" class="form-input" placeholder="e.g. 10" min="1" step="any" style="height: 36px; font-size: 13px; font-weight: 800; border-radius: 8px;">
        </div>

        <div>
          <label class="form-label" for="bulk-sel-rounding" style="font-weight: 700; margin-bottom: 4px;">Smart Rounding:</label>
          <select id="bulk-sel-rounding" class="form-select" style="height: 36px; border-radius: 8px;">
            <option value="none">Exact Integer (Round to ₹1)</option>
            <option value="5">Round to nearest ₹5</option>
            <option value="10">Round to nearest ₹10</option>
          </select>
        </div>
      </div>
    `;

    window.customModal.show({
      title: `Bulk Price Adjustment (${count} Items)`,
      bodyHtml: bodyHtml,
      confirmText: "Apply Adjustment",
      onConfirm: () => {
        const type = document.getElementById("bulk-sel-adj-type").value;
        const rawVal = document.getElementById("bulk-sel-adj-val").value;
        const rounding = document.getElementById("bulk-sel-rounding").value;
        const val = Number(rawVal);

        if (!rawVal || isNaN(val) || val <= 0) {
          window.showToast("Please enter a valid positive value.", "error");
          return false;
        }

        const products = (window.db && window.db.get("products")) || [];
        products.forEach(p => {
          if (this.selectedProductIds.has(p.id)) {
            let curr = Number(p.price) || 0;
            if (type === "inc-pct") curr = curr * (1 + val / 100);
            else if (type === "dec-pct") curr = Math.max(1, curr * (1 - val / 100));
            else if (type === "inc-fixed") curr = curr + val;
            else if (type === "dec-fixed") curr = Math.max(1, curr - val);

            if (rounding === "5") curr = Math.round(curr / 5) * 5;
            else if (rounding === "10") curr = Math.round(curr / 10) * 10;
            else curr = Math.round(curr);

            p.price = Math.max(1, curr);
            window.db.saveProduct(p);
          }
        });

        window.showToast(`Updated pricing for ${count} dishes.`, "success");
        this.render();
        return true;
      }
    });
  },

  openSelectedCategoryModal() {
    const count = this.selectedProductIds.size;
    const categories = (window.db && window.db.get("categories")) || [];

    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 12px; font-size: 13px;">
        <p style="margin: 0; color: var(--text-muted);">Assign <strong>${count} selected dishes</strong> to category:</p>
        <div>
          <label class="form-label" for="bulk-sel-cat" style="font-weight: 700; margin-bottom: 4px;">Destination Category:</label>
          <select id="bulk-sel-cat" class="form-select" style="height: 38px; border-radius: 8px;">
            ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join("")}
          </select>
        </div>
      </div>
    `;

    window.customModal.show({
      title: `Move ${count} Dishes to Category`,
      bodyHtml: bodyHtml,
      confirmText: "Move Dishes",
      onConfirm: () => {
        const catId = document.getElementById("bulk-sel-cat").value;
        const products = (window.db && window.db.get("products")) || [];

        products.forEach(p => {
          if (this.selectedProductIds.has(p.id)) {
            p.category = catId;
            window.db.saveProduct(p);
          }
        });

        window.showToast(`Reassigned ${count} dishes.`, "success");
        this.render();
        return true;
      }
    });
  },

  // Duplicate product helper
  duplicateProduct(product) {
    const newName = `${product.name} (Copy)`;
    window.db.saveProduct({
      name: newName,
      price: product.price,
      costPrice: product.costPrice || null,
      ingredientCost: product.ingredientCost || null,
      packagingCost: product.packagingCost || null,
      category: product.category,
      subCategory: product.subCategory || "Regular",
      bogo: product.bogo || false,
      available: product.available !== false,
      veg: product.veg !== false,
      jain: product.jain || false,
      spicyLevel: product.spicyLevel || "none",
      special: product.special || false,
      recipe: { ...(product.recipe || {}) }
    });
    window.showToast(`Duplicated "${product.name}" as "${newName}".`, "success");
    this.render();
  },

  // Product Add / Edit Modal
  openProductModal(product = null) {
    const categories = (window.db && window.db.get("categories")) || [];
    const categoriesOptions = categories.map(c => `
      <option value="${c.id}" ${product && product.category === c.id ? 'selected' : ''}>${c.name}</option>
    `).join("");

    const isVeg = product ? product.veg !== false : true;
    const currentCost = product && product.costPrice !== undefined && product.costPrice !== null ? product.costPrice : "";

    const formHtml = `
      <div style="display: flex; flex-direction: column; gap: 14px; font-size: 13px;">
        
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" for="prod-modal-name" style="font-weight: 700; margin-bottom: 5px;">Dish / Item Name *</label>
          <input type="text" id="prod-modal-name" class="form-input" value="${product ? product.name : ''}" placeholder="e.g. Cheese Veggie Frankie" style="height: 38px; border-radius: 10px;" required>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" for="prod-modal-price" style="font-weight: 700; margin-bottom: 5px;">Selling Price (₹) *</label>
            <input type="number" id="prod-modal-price" class="form-input" value="${product ? product.price : ''}" placeholder="e.g. 110" min="1" step="any" style="height: 38px; font-weight: 800; font-size: 14px; border-radius: 10px;" required>
          </div>

          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" for="prod-modal-cost" style="font-weight: 700; margin-bottom: 5px;">Total Cost Price (₹)</label>
            <input type="number" id="prod-modal-cost" class="form-input" value="${currentCost}" placeholder="Auto (${this.benchmarkCogsPercent}% benchmark)" min="0" step="any" style="height: 38px; font-size: 13px; font-weight: 700; border-radius: 10px;">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" for="prod-modal-ing-cost" style="font-weight: 700; margin-bottom: 5px; font-size: 11.5px;">Raw Ingredient Cost (₹)</label>
            <input type="number" id="prod-modal-ing-cost" class="form-input" value="${product && product.ingredientCost !== undefined && product.ingredientCost !== null ? product.ingredientCost : ''}" placeholder="e.g. 30" min="0" step="any" style="height: 36px; font-size: 12px; font-weight: 700; border-radius: 10px;" oninput="
              const ing = parseFloat(this.value) || 0;
              const pack = parseFloat(document.getElementById('prod-modal-pack-cost').value) || 0;
              if (ing > 0 || pack > 0) document.getElementById('prod-modal-cost').value = (ing + pack).toFixed(1);
              views.menu.calculateSuggestedPrice();
            ">
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" for="prod-modal-pack-cost" style="font-weight: 700; margin-bottom: 5px; font-size: 11.5px;">Packaging Cost (₹)</label>
            <input type="number" id="prod-modal-pack-cost" class="form-input" value="${product && product.packagingCost !== undefined && product.packagingCost !== null ? product.packagingCost : ''}" placeholder="e.g. 3.5" min="0" step="any" style="height: 36px; font-size: 12px; font-weight: 700; border-radius: 10px;" oninput="
              const ing = parseFloat(document.getElementById('prod-modal-ing-cost').value) || 0;
              const pack = parseFloat(this.value) || 0;
              if (ing > 0 || pack > 0) document.getElementById('prod-modal-cost').value = (ing + pack).toFixed(1);
              views.menu.calculateSuggestedPrice();
            ">
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" for="prod-modal-subcat" style="font-weight: 700; margin-bottom: 5px; font-size: 11.5px;">Sub Category</label>
            <input type="text" id="prod-modal-subcat" class="form-input" value="${product && product.subCategory ? product.subCategory : ''}" placeholder="e.g. Classic / Special" style="height: 36px; font-size: 12px; font-weight: 700; border-radius: 10px;">
          </div>
        </div>

        <!-- Target Margin & Selling Price Simulator -->
        <div style="background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 12px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 750; color: #1e40af;">
            <i class="fa-solid fa-calculator" style="color: #2563eb;"></i>
            <span>Target Profit Margin:</span>
            <select id="prod-modal-target-margin" style="border: 1.5px solid #93c5fd; border-radius: 8px; padding: 3px 8px; font-size: 11.5px; font-weight: 800; background: #fff; color: #1e40af; outline: none;" onchange="views.menu.calculateSuggestedPrice()">
              <option value="50">50% Margin (2x Markup)</option>
              <option value="55">55% Margin</option>
              <option value="60" selected>60% Margin (2.5x Markup)</option>
              <option value="65">65% Margin</option>
              <option value="70">70% Margin (3.3x Markup)</option>
              <option value="75">75% Margin (4x Markup)</option>
            </select>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span id="prod-modal-suggested-text" style="font-size: 12px; font-weight: 850; color: #1e3a8a;">Suggested: ₹--</span>
            <button type="button" class="btn btn-primary" id="btn-apply-suggested-price" style="padding: 3px 12px; font-size: 11.5px; height: 28px; border-radius: 8px; font-weight: 800; box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25);" onclick="views.menu.applySuggestedPrice()">Apply</button>
          </div>
        </div>

        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" for="prod-modal-category" style="font-weight: 700; margin-bottom: 5px;">Menu Category</label>
          <select id="prod-modal-category" class="form-select" style="height: 38px; border-radius: 10px; font-weight: 600;">
            ${categoriesOptions || '<option value="cat1">General</option>'}
          </select>
        </div>

        <!-- Dietary & Dietary Tags -->
        <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 12px; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <label class="form-label" style="font-weight: 700; margin: 0;">Dietary Classification:</label>
            <div style="display: flex; gap: 16px;">
              <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-weight: 700;">
                <input type="radio" name="prod-diet" id="prod-diet-veg" value="veg" ${isVeg ? 'checked' : ''}>
                <span class="menu-diet-box veg"><span class="menu-diet-dot"></span></span> Pure Veg
              </label>
              <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-weight: 700;">
                <input type="radio" name="prod-diet" id="prod-diet-nonveg" value="nonveg" ${!isVeg ? 'checked' : ''}>
                <span class="menu-diet-box non-veg"><span class="menu-diet-dot"></span></span> Non-Veg
              </label>
            </div>
          </div>

          <div style="display: flex; gap: 16px; flex-wrap: wrap; border-top: 1px dashed var(--border-color); padding-top: 8px;">
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-weight: 700; font-size: 12px;">
              <input type="checkbox" id="prod-tag-jain" ${product && product.jain ? 'checked' : ''} style="accent-color: #16a34a;">
              <span>Jain Friendly 🌿</span>
            </label>
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-weight: 700; font-size: 12px;">
              <input type="checkbox" id="prod-tag-special" ${product && product.special ? 'checked' : ''} style="accent-color: #d97706;">
              <span>Chef Special ⭐</span>
            </label>
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-weight: 700; font-size: 12px;">
              <input type="checkbox" id="prod-tag-bogo" ${product && product.bogo ? 'checked' : ''} style="accent-color: #2563eb;">
              <span>BOGO Offer 🎁</span>
            </label>

            <div style="display: flex; align-items: center; gap: 6px; margin-left: auto;">
              <span style="font-size: 11.5px; font-weight: 700; color: var(--text-muted);">Spice:</span>
              <select id="prod-tag-spice" class="form-select" style="height: 28px; font-size: 11px; padding: 2px 6px; border-radius: 6px;">
                <option value="none" ${product && product.spicyLevel === 'none' ? 'selected' : ''}>None</option>
                <option value="Mild" ${product && product.spicyLevel === 'Mild' ? 'selected' : ''}>Mild</option>
                <option value="Medium" ${product && product.spicyLevel === 'Medium' ? 'selected' : ''}>Medium</option>
                <option value="Extra" ${product && product.spicyLevel === 'Extra' ? 'selected' : ''}>Extra Spicy</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Live POS Availability Switch -->
        <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 12px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 700; color: var(--text-dark);">Live POS Availability (In Stock)</div>
            <div style="font-size: 11px; color: var(--text-muted);">When turned off, the dish is marked 86'd and hidden from POS cashier terminals.</div>
          </div>
          <label class="menu-toggle-switch">
            <input type="checkbox" id="prod-modal-avail" ${product && product.available === false ? '' : 'checked'}>
            <span class="menu-toggle-slider slider-green"></span>
          </label>
        </div>

      </div>
    `;

    window.customModal.show({
      title: product ? `Edit Dish - ${product.name}` : "Create New Menu Dish",
      bodyHtml: formHtml,
      confirmText: product ? "Update Dish" : "Save Dish",
      onConfirm: () => {
        const name = document.getElementById("prod-modal-name").value.trim();
        const price = document.getElementById("prod-modal-price").value;
        const rawCost = document.getElementById("prod-modal-cost").value.trim();
        const category = document.getElementById("prod-modal-category").value;
        const available = document.getElementById("prod-modal-avail").checked;
        const veg = document.getElementById("prod-diet-veg").checked;

        if (!name || !price || isNaN(price) || Number(price) <= 0) {
          window.showToast("Please enter a valid dish name and price.", "error");
          return false;
        }

        const costPrice = rawCost && !isNaN(rawCost) && Number(rawCost) >= 0 ? Number(rawCost) : null;
        const rawIng = document.getElementById("prod-modal-ing-cost") ? document.getElementById("prod-modal-ing-cost").value.trim() : "";
        const rawPack = document.getElementById("prod-modal-pack-cost") ? document.getElementById("prod-modal-pack-cost").value.trim() : "";
        const subCatInput = document.getElementById("prod-modal-subcat");
        const subCategory = subCatInput && subCatInput.value.trim() ? subCatInput.value.trim() : (product ? (product.subCategory || "Regular") : "Regular");

        const jain = document.getElementById("prod-tag-jain") ? document.getElementById("prod-tag-jain").checked : false;
        const special = document.getElementById("prod-tag-special") ? document.getElementById("prod-tag-special").checked : false;
        const bogo = document.getElementById("prod-tag-bogo") ? document.getElementById("prod-tag-bogo").checked : false;
        const spicyLevel = document.getElementById("prod-tag-spice") ? document.getElementById("prod-tag-spice").value : "none";

        const ingredientCost = rawIng && !isNaN(rawIng) ? Number(rawIng) : null;
        const packagingCost = rawPack && !isNaN(rawPack) ? Number(rawPack) : null;
        const grossProfit = (Number(price) && costPrice !== null) ? Number((Number(price) - costPrice).toFixed(1)) : null;

        window.db.saveProduct({
          id: product ? product.id : null,
          name,
          price: Number(price),
          ingredientCost,
          packagingCost,
          costPrice,
          grossProfit,
          category,
          subCategory,
          available,
          veg,
          jain,
          special,
          bogo,
          spicyLevel,
          recipe: product ? product.recipe : {}
        });

        window.showToast(product ? "Dish details updated successfully." : "New menu dish added successfully.", "success");
        this.render();
        return true;
      }
    });

    // Auto-calculate initial suggested price if cost exists
    setTimeout(() => this.calculateSuggestedPrice(), 50);
  },

  calculateSuggestedPrice() {
    const costInput = document.getElementById("prod-modal-cost");
    const marginSelect = document.getElementById("prod-modal-target-margin");
    const suggestedText = document.getElementById("prod-modal-suggested-text");
    if (!costInput || !marginSelect || !suggestedText) return;

    const cost = parseFloat(costInput.value) || 0;
    const margin = parseFloat(marginSelect.value) || 60;
    if (cost <= 0 || margin >= 100) {
      suggestedText.textContent = "Suggested: ₹--";
      suggestedText.dataset.price = "";
      return;
    }

    const rawSuggested = cost / (1 - (margin / 100));
    // Round to nearest integer (e.g. 79, 89, 99 or clean whole rupees)
    const suggestedPrice = Math.ceil(rawSuggested);
    suggestedText.textContent = `Suggested: ₹${suggestedPrice}`;
    suggestedText.dataset.price = suggestedPrice;
  },

  applySuggestedPrice() {
    const suggestedText = document.getElementById("prod-modal-suggested-text");
    const priceInput = document.getElementById("prod-modal-price");
    const marginSelect = document.getElementById("prod-modal-target-margin");
    if (!suggestedText || !priceInput) return;
    const val = suggestedText.dataset.price;
    if (val) {
      priceInput.value = val;
      const margin = marginSelect ? marginSelect.value : "60";
      window.showToast(`Applied suggested price of ₹${val} (${margin}% margin)`, "success");
    } else {
      window.showToast("Please enter cost price first to calculate suggested price.", "info");
    }
  },

  // =========================================================================
  // 2. RECIPE INVENTORY DEDUCTION & COST CALCULATOR MATRIX
  // =========================================================================
  openRecipeModal(productId) {
    const products = (window.db && window.db.get("products")) || [];
    const ingredients = (window.db && window.db.get("ingredients")) || [];
    const settings = (window.db && window.db.get("settings")) || {};
    const currency = settings.currencySymbol || "₹";
    const product = products.find(p => p.id === productId);

    if (!product) return;

    // Local mutable copy of recipe mapping
    const localRecipe = { ...(product.recipe || {}) };
    let packagingCost = Number(product.packagingCost) || 0;

    // Helper to calculate total raw recipe cost
    const calculateRecipeCostSummary = () => {
      let rawIngCost = 0;
      Object.entries(localRecipe).forEach(([ingId, qty]) => {
        const unitCost = this.ingredientCostMap[ingId] || 5.0;
        rawIngCost += Number(qty) * unitCost;
      });
      const totalCost = rawIngCost + packagingCost;
      const price = Number(product.price) || 0;
      const profit = Math.max(0, price - totalCost);
      const margin = price > 0 ? Math.round((profit / price) * 100) : 0;

      return {
        rawIngCost: Math.round(rawIngCost * 100) / 100,
        packagingCost: Math.round(packagingCost * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        margin
      };
    };

    const renderRecipeTable = () => {
      const rows = Object.entries(localRecipe).map(([ingId, qty]) => {
        const ing = ingredients.find(i => i.id === ingId);
        if (!ing) return "";
        const unitCost = this.ingredientCostMap[ingId] || 5.0;
        const componentVal = (Number(qty) * unitCost).toFixed(2);

        return `
          <tr id="recipe-row-${ingId}">
            <td>
              <div style="font-weight: 800; color: var(--text-dark);">${ing.name}</div>
              <div style="font-size: 11px; color: var(--text-muted);">Warehouse Stock: <strong>${ing.stock} ${ing.unit}</strong></div>
            </td>
            <td style="font-weight: 800; color: #2563eb;">
              ${qty} ${ing.unit}
            </td>
            <td style="color: var(--text-muted); font-size: 12px;">
              ${currency}${unitCost.toFixed(2)} / ${ing.unit}
            </td>
            <td style="font-weight: 800; color: var(--text-dark);">
              ${currency}${componentVal}
            </td>
            <td style="text-align: right;">
              <button class="btn btn-danger btn-delete-recipe-item" data-id="${ingId}" title="Remove Component" style="padding: 4px 8px; font-size: 11px; border-radius: 8px;">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </td>
          </tr>
        `;
      }).join("");

      return `
        <div class="table-container" style="max-height: 220px; overflow-y: auto; margin-bottom: 12px; border: 1px solid var(--border-color); border-radius: 10px;">
          <table class="premium-table" style="font-size: 12.5px;">
            <thead>
              <tr>
                <th>Raw Material Component</th>
                <th>Deduction Portion</th>
                <th>Unit Price</th>
                <th>Portion Cost</th>
                <th style="text-align: right;">Remove</th>
              </tr>
            </thead>
            <tbody id="recipe-modal-table-body">
              ${rows || `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 25px; font-weight: 600;">No raw materials mapped. When orders are checked out, warehouse inventory will not be depleted for this dish.</td></tr>`}
            </tbody>
          </table>
        </div>
      `;
    };

    const renderSummaryBanner = () => {
      const summary = calculateRecipeCostSummary();
      return `
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 12px 14px; margin-bottom: 14px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; text-align: center;">
          <div>
            <div style="font-size: 10.5px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Selling Price</div>
            <div style="font-size: 16px; font-weight: 900; color: var(--text-dark); margin-top: 2px;">${currency}${Number(product.price || 0).toFixed(0)}</div>
          </div>
          <div>
            <div style="font-size: 10.5px; font-weight: 700; color: #b45309; text-transform: uppercase;">Raw Plate Cost</div>
            <div style="font-size: 16px; font-weight: 900; color: #d97706; margin-top: 2px;">
              ${currency}${summary.totalCost.toFixed(1)}
              <span style="font-size: 9.5px; color: var(--text-muted); display: block; font-weight: 600;">(Ing: ₹${summary.rawIngCost} + Pack: ₹${summary.packagingCost})</span>
            </div>
          </div>
          <div>
            <div style="font-size: 10.5px; font-weight: 700; color: #047857; text-transform: uppercase;">Gross Profit</div>
            <div style="font-size: 16px; font-weight: 900; color: #059669; margin-top: 2px;">${currency}${summary.profit.toFixed(1)}</div>
          </div>
          <div>
            <div style="font-size: 10.5px; font-weight: 700; color: #1e40af; text-transform: uppercase;">Calculated Margin</div>
            <div style="font-size: 16px; font-weight: 900; color: #2563eb; margin-top: 2px;">${summary.margin}%</div>
          </div>
        </div>
      `;
    };

    const dropdownOptions = ingredients
      .filter(ing => !localRecipe[ing.id])
      .map(ing => `<option value="${ing.id}">${ing.name} (${ing.unit}) - Stock: ${ing.stock}</option>`)
      .join("");

    const completeHtml = `
      <div style="margin-bottom: 12px; font-size: 12.5px; color: var(--text-muted); font-weight: 500;">
        Map raw ingredients deducted automatically from inventory when <strong style="color: #2563eb;">${product.name}</strong> is ordered on POS.
      </div>
      
      <!-- Live Food Cost & Margin Summary Banner -->
      <div id="recipe-summary-banner-wrapper">
        ${renderSummaryBanner()}
      </div>

      <!-- Current Recipe Table -->
      <div id="recipe-table-wrapper">
        ${renderRecipeTable()}
      </div>

      <!-- Packaging Cost & Quick Apply Cost -->
      <div style="background: #f8fafc; border: 1px solid var(--border-color); padding: 10px 14px; border-radius: 12px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <label for="recipe-pack-cost-input" style="font-size: 12px; font-weight: 700; color: var(--text-dark);">Packaging Cost (₹):</label>
          <input type="number" id="recipe-pack-cost-input" class="form-input" value="${packagingCost || ''}" placeholder="e.g. 3.5" min="0" step="any" style="width: 90px; height: 32px; font-size: 12px; font-weight: 700; border-radius: 8px;">
        </div>
        <button type="button" class="btn btn-secondary" id="btn-sync-recipe-cost" title="Set Product Food Cost equal to calculated Recipe Cost" style="height: 32px; font-size: 11.5px; font-weight: 800; border-radius: 8px; display: inline-flex; align-items: center; gap: 5px;">
          <i class="fa-solid fa-calculator" style="color: #059669;"></i> Apply Recipe Cost to Product
        </button>
      </div>

      <!-- Add New Ingredient Form Wrapper -->
      <div style="background: #f8fafc; border: 1px solid var(--border-color); padding: 12px 14px; border-radius: 12px;">
        <h4 style="font-size: 12px; margin: 0 0 8px 0; color: #2563eb; font-weight: 800; text-transform: uppercase;">
          <i class="fa-solid fa-plus-circle"></i> Add Raw Ingredient Component
        </h4>
        <div style="display: grid; grid-template-columns: 2fr 1fr auto; gap: 8px;">
          <select id="recipe-add-ing-select" class="form-select" style="font-size: 12px; height: 36px; padding: 4px 8px; border-radius: 8px;">
            ${dropdownOptions || '<option value="">All ingredients already mapped</option>'}
          </select>
          <input type="number" id="recipe-add-qty-input" class="form-input" placeholder="Portion Qty" min="0.01" step="any" style="font-size: 12px; height: 36px; padding: 4px 8px; border-radius: 8px; font-weight: 700;">
          <button class="btn btn-primary" id="btn-recipe-add-item-trigger" style="padding: 0 16px; height: 36px; font-size: 12px; border-radius: 8px; font-weight: 700;">Add</button>
        </div>
      </div>
    `;

    const bindTableListeners = () => {
      const body = document.getElementById("recipe-modal-table-body");
      if (!body) return;
      body.querySelectorAll(".btn-delete-recipe-item").forEach(btn => {
        btn.onclick = () => {
          const ingId = btn.getAttribute("data-id");
          delete localRecipe[ingId];
          refreshModalContent();
        };
      });
    };

    const refreshModalContent = () => {
      const packInput = document.getElementById("recipe-pack-cost-input");
      if (packInput) packagingCost = parseFloat(packInput.value) || 0;

      const summaryWrapper = document.getElementById("recipe-summary-banner-wrapper");
      if (summaryWrapper) summaryWrapper.innerHTML = renderSummaryBanner();

      const tableWrapper = document.getElementById("recipe-table-wrapper");
      if (tableWrapper) tableWrapper.innerHTML = renderRecipeTable();
      
      const select = document.getElementById("recipe-add-ing-select");
      if (select) {
        const opts = ingredients
          .filter(ing => !localRecipe[ing.id])
          .map(ing => `<option value="${ing.id}">${ing.name} (${ing.unit}) - Stock: ${ing.stock}</option>`)
          .join("");
        select.innerHTML = opts || '<option value="">All ingredients already mapped</option>';
      }
      bindTableListeners();
    };

    window.customModal.show({
      title: `Inventory Recipe - ${product.name}`,
      bodyHtml: completeHtml,
      confirmText: "Save Inventory Recipe",
      onConfirm: () => {
        const packInput = document.getElementById("recipe-pack-cost-input");
        const packVal = packInput ? parseFloat(packInput.value) : 0;
        product.packagingCost = !isNaN(packVal) ? packVal : 0;
        product.recipe = localRecipe;
        window.db.saveProduct(product);
        window.showToast(`Inventory recipe saved for "${product.name}".`, "success");
        this.render();
        return true;
      }
    });

    // Handle Add Ingredient Button
    const addTrigger = document.getElementById("btn-recipe-add-item-trigger");
    if (addTrigger) {
      addTrigger.onclick = () => {
        const ingId = document.getElementById("recipe-add-ing-select").value;
        const qty = document.getElementById("recipe-add-qty-input").value;

        if (!ingId) {
          window.showToast("Select a raw ingredient.", "error");
          return;
        }
        if (!qty || isNaN(qty) || Number(qty) <= 0) {
          window.showToast("Please enter a valid ingredient portion quantity.", "error");
          return;
        }

        localRecipe[ingId] = Number(qty);
        document.getElementById("recipe-add-qty-input").value = "";
        refreshModalContent();
        window.showToast("Component added to recipe.", "success");
      };
    }

    // Handle Packaging input change
    const packInput = document.getElementById("recipe-pack-cost-input");
    if (packInput) {
      packInput.oninput = () => {
        packagingCost = parseFloat(packInput.value) || 0;
        const summaryWrapper = document.getElementById("recipe-summary-banner-wrapper");
        if (summaryWrapper) summaryWrapper.innerHTML = renderSummaryBanner();
      };
    }

    // Handle Sync Recipe Cost Button
    const btnSyncCost = document.getElementById("btn-sync-recipe-cost");
    if (btnSyncCost) {
      btnSyncCost.onclick = () => {
        const summary = calculateRecipeCostSummary();
        product.ingredientCost = summary.rawIngCost;
        product.packagingCost = summary.packagingCost;
        product.costPrice = summary.totalCost;
        product.recipe = localRecipe;
        window.db.saveProduct(product);
        window.showToast(`Calculated recipe cost ₹${summary.totalCost} applied as dish cost price.`, "success");
        window.customModal.hide();
        this.render();
      };
    }

    bindTableListeners();
  },

  // =========================================================================
  // 3. CATEGORIES MANAGEMENT VIEW
  // =========================================================================
  renderCategories(mount) {
    const categories = (window.db && window.db.get("categories")) || [];
    const products = (window.db && window.db.get("products")) || [];
    const settings = (window.db && window.db.get("settings")) || {};
    const currency = settings.currencySymbol || "₹";

    let rowsHtml = "";
    if (categories.length === 0) {
      rowsHtml = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 40px; font-weight: 600;">No categories found. Click Add Category to create one.</td></tr>`;
    } else {
      rowsHtml = categories.map(c => {
        const items = products.filter(p => p.category === c.id);
        const availCount = items.filter(p => p.available !== false).length;
        const outCount = items.length - availCount;

        // Pricing range in this category
        let catPriceSum = 0;
        let catMin = Infinity;
        let catMax = 0;
        items.forEach(p => {
          const pr = Number(p.price) || 0;
          catPriceSum += pr;
          if (pr < catMin) catMin = pr;
          if (pr > catMax) catMax = pr;
        });
        const catAvg = items.length > 0 ? (catPriceSum / items.length).toFixed(0) : "0";

        return `
          <tr>
            <td>
              <div style="font-weight: 800; color: var(--text-dark); font-size: 14px; display: flex; align-items: center; gap: 8px;">
                <div style="width: 32px; height: 32px; border-radius: 8px; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 13px;">
                  <i class="fa-solid fa-tags"></i>
                </div>
                ${c.name}
              </div>
            </td>
            <td style="color: var(--text-muted); font-size: 12px; font-weight: 600;">
              <code>${c.id}</code>
            </td>
            <td>
              <span style="font-size: 12px; font-weight: 800; background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; padding: 3px 10px; border-radius: 10px;">
                ${items.length} Dishes (${availCount} Live${outCount > 0 ? `, ${outCount} 86'd` : ''})
              </span>
            </td>
            <td>
              <div style="font-size: 12.5px; font-weight: 800; color: var(--text-dark);">
                ${currency}${catAvg} <span style="font-size: 11px; color: var(--text-muted); font-weight: 600;">(${currency}${items.length > 0 ? catMin : 0} - ${currency}${catMax})</span>
              </div>
            </td>
            <td>
              <div style="display: flex; gap: 6px;">
                <button class="btn btn-secondary btn-view-cat-items" data-id="${c.id}" title="Filter catalog dishes in this category" style="padding: 5px 10px; font-size: 11.5px; border-radius: 8px; font-weight: 700; display: inline-flex; align-items: center; gap: 5px;">
                  <i class="fa-solid fa-eye" style="color: #059669;"></i> View Items
                </button>
                <button class="btn btn-secondary btn-edit-category" data-id="${c.id}" title="Rename Category" style="padding: 5px 10px; font-size: 11.5px; border-radius: 8px; font-weight: 700; display: inline-flex; align-items: center; gap: 5px;">
                  <i class="fa-solid fa-pen-to-square" style="color: #2563eb;"></i> Rename
                </button>
                <button class="btn btn-danger btn-delete-category" data-id="${c.id}" title="Delete Category" style="padding: 5px 9px; font-size: 11.5px; border-radius: 8px;">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join("");
    }

    mount.innerHTML = `
      <div class="glass-card view-animate" style="padding: 18px 20px; border-radius: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
          <div>
            <h3 style="font-size: 16px; font-weight: 800; color: var(--text-dark); margin: 0;">
              <i class="fa-solid fa-tags" style="color: #2563eb; margin-right: 6px;"></i> Food Categories Directory
            </h3>
            <p style="font-size: 12px; color: var(--text-muted); margin: 2px 0 0 0;">Organize menu items into navigation groups for fast cashier selection on the POS screen.</p>
          </div>
          <span style="font-size: 12px; font-weight: 800; color: #2563eb; background: #eff6ff; border: 1px solid #bfdbfe; padding: 4px 12px; border-radius: 10px;">
            ${categories.length} Total Categories
          </span>
        </div>

        <div class="table-container">
          <table class="premium-table">
            <thead>
              <tr>
                <th>Category Name</th>
                <th>Internal ID</th>
                <th>Assigned Items</th>
                <th>Average Dish Price</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Bind View Cat Items
    mount.querySelectorAll(".btn-view-cat-items").forEach(btn => {
      btn.onclick = () => {
        const catId = btn.getAttribute("data-id");
        this.selectedCategory = catId;
        this.activeTab = "products";
        const btnProd = document.getElementById("menu-sub-products");
        const btnCat = document.getElementById("menu-sub-categories");
        if (btnProd) btnProd.className = "btn btn-primary";
        if (btnCat) btnCat.className = "btn btn-secondary";
        const btnBulk = document.getElementById("btn-menu-bulk-tools");
        const btnExport = document.getElementById("btn-menu-export-csv");
        const btnPrint = document.getElementById("btn-menu-print-sheet");
        if (btnBulk) btnBulk.style.display = "inline-flex";
        if (btnExport) btnExport.style.display = "inline-flex";
        if (btnPrint) btnPrint.style.display = "inline-flex";
        this.render();
      };
    });

    // Bind Edit Cat
    mount.querySelectorAll(".btn-edit-category").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-id");
        const cat = categories.find(c => c.id === id);
        if (cat) this.openCategoryModal(cat);
      };
    });

    // Bind Delete Cat
    mount.querySelectorAll(".btn-delete-category").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-id");
        const cat = categories.find(c => c.id === id);
        if (!cat) return;
        if (confirm(`Deleting category "${cat.name}" will make all items inside it unassigned. Proceed?`)) {
          window.db.deleteCategory(id);
          window.showToast(`Category "${cat.name}" deleted.`, "info");
          this.render();
        }
      };
    });
  },

  openCategoryModal(category = null) {
    const formHtml = `
      <div style="display: flex; flex-direction: column; gap: 12px; font-size: 13px;">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" for="cat-modal-name" style="font-weight: 700; margin-bottom: 5px;">Category Title *</label>
          <input type="text" id="cat-modal-name" class="form-input" value="${category ? category.name : ''}" placeholder="e.g. Burgers, Wraps, Shakes" style="height: 38px; border-radius: 10px;" required>
        </div>
      </div>
    `;

    window.customModal.show({
      title: category ? `Edit Category - ${category.name}` : "Create New Food Category",
      bodyHtml: formHtml,
      confirmText: category ? "Update Category" : "Save Category",
      onConfirm: () => {
        const name = document.getElementById("cat-modal-name").value.trim();
        if (!name) {
          window.showToast("Please enter a category title.", "error");
          return false;
        }

        window.db.saveCategory({
          id: category ? category.id : null,
          name: name
        });

        window.showToast(category ? "Category updated successfully." : "New category added.", "success");
        this.render();
        return true;
      }
    });
  },

  // =========================================================================
  // 4. PERMISSIONS ACCESS CONTROL MATRIX
  // =========================================================================
  renderPermissions(mount) {
    const permissions = (window.db && window.db.get("permissions")) || {
      admin: ["dashboard", "reports", "counter", "pos", "orders", "menu"],
      manager: ["dashboard", "reports", "counter", "pos", "orders", "menu"],
      staff: ["pos", "orders"]
    };

    const viewsList = [
      { id: "dashboard", name: "Executive Dashboard", icon: "fa-gauge-high", desc: "View executive revenue summaries, real-time KPI metrics, and sales charts." },
      { id: "reports", name: "Sales & Profit Reports", icon: "fa-chart-pie", desc: "Access P&L analytics, COGS calibrations, daily financial trends, and CSV exports." },
      { id: "counter", name: "Daily Counter & Cash Register", icon: "fa-cash-register", desc: "Daily cash & UPI counter totals, physical drawer tally, bill history & reprints." },
      { id: "pos", name: "POS Billing Terminal", icon: "fa-cart-shopping", desc: "Access the cashier billing screen to place orders and generate bills." },
      { id: "orders", name: "KDS Kitchen Queue", icon: "fa-fire-burner", desc: "Live kitchen display system for tracking active cooking orders and tickets." },
      { id: "menu", name: "Menu Catalog & Recipes", icon: "fa-burger", desc: "Manage food items, pricing, raw recipes, and categories." }
    ];

    const rolesList = [
      { id: "admin", name: "Administrator" },
      { id: "manager", name: "Manager" },
      { id: "staff", name: "Kitchen / Staff" }
    ];

    let rowsHtml = viewsList.map(v => {
      const cols = rolesList.map(r => {
        const isChecked = (permissions[r.id] || []).includes(v.id);
        const isDisabled = r.id === "admin";

        return `
          <td style="text-align: center; padding: 12px 16px;">
            <label class="menu-toggle-switch" style="cursor: ${isDisabled ? 'not-allowed' : 'pointer'};">
              <input type="checkbox" class="perm-checkbox-toggle" data-role="${r.id}" data-view="${v.id}" 
                ${isChecked ? 'checked' : ''} ${isDisabled ? 'disabled' : ''}>
              <span class="menu-toggle-slider ${r.id === 'manager' ? 'slider-green' : ''}"></span>
            </label>
          </td>
        `;
      }).join("");

      return `
        <tr>
          <td style="padding: 12px 18px;">
            <div style="font-weight: 800; color: var(--text-dark); display: flex; align-items: center; gap: 8px;">
              <i class="fa-solid ${v.icon}" style="color: #2563eb; width: 16px;"></i>
              ${v.name}
            </div>
            <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">${v.desc}</div>
          </td>
          ${cols}
        </tr>
      `;
    }).join("");

    mount.innerHTML = `
      <div class="glass-card view-animate" style="padding: 20px; border-radius: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid var(--border-color); padding-bottom: 14px; margin-bottom: 16px;">
          <div>
            <h3 style="font-size: 16px; font-weight: 800; color: var(--text-dark); margin: 0;">
              <i class="fa-solid fa-user-shield" style="color: #2563eb; margin-right: 6px;"></i> Role Access Control Matrix
            </h3>
            <p style="font-size: 12px; color: var(--text-muted); margin: 3px 0 0 0;">Manage which POS features each user level is allowed to view.</p>
          </div>
          <span style="font-size: 11.5px; font-weight: 800; background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 4px 12px; border-radius: 10px;">
            <i class="fa-solid fa-cloud-arrow-up"></i> Live Auto-Save Active
          </span>
        </div>
        
        <div class="table-container">
          <table class="premium-table">
            <thead>
              <tr>
                <th style="width: 45%; padding: 12px 18px;">POS Screen / Feature</th>
                <th style="text-align: center; padding: 12px 16px;">Administrator</th>
                <th style="text-align: center; padding: 12px 16px;">Manager</th>
                <th style="text-align: center; padding: 12px 16px;">Kitchen / Staff</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Bind switch changes
    mount.querySelectorAll(".perm-checkbox-toggle").forEach(chk => {
      chk.onchange = () => {
        const roleId = chk.getAttribute("data-role");
        const viewId = chk.getAttribute("data-view");

        if (roleId === "admin") return;

        permissions[roleId] = permissions[roleId] || [];
        if (chk.checked) {
          if (!permissions[roleId].includes(viewId)) {
            permissions[roleId].push(viewId);
          }
        } else {
          permissions[roleId] = permissions[roleId].filter(id => id !== viewId);
        }

        window.db.set("permissions", permissions);
        window.showToast(`Access permissions updated for ${roleId.toUpperCase()} role.`, "success");
      };
    });
  },

  // =========================================================================
  // 5. BULK OPERATIONS SUITE & PRICE MODIFIER
  // =========================================================================
  openBulkOperationsModal() {
    const categories = (window.db && window.db.get("categories")) || [];
    const products = (window.db && window.db.get("products")) || [];

    const catOptions = categories.map(c => `
      <option value="${c.id}">${c.name} (${products.filter(p => p.category === c.id).length} dishes)</option>
    `).join("");

    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 14px; font-size: 13px;">
        
        <!-- Action 1: Bulk Price Adjustment -->
        <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 12px; padding: 14px;">
          <h4 style="margin: 0 0 10px 0; font-size: 13.5px; font-weight: 800; color: #2563eb; display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-tags"></i> Bulk Price Modifier
          </h4>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
            <div>
              <label class="form-label" for="bulk-target-cat" style="font-weight: 700; margin-bottom: 4px;">Target Group:</label>
              <select id="bulk-target-cat" class="form-select" style="height: 36px; font-size: 12px; border-radius: 8px;">
                <option value="all">All Menu Items (${products.length} Dishes)</option>
                ${catOptions}
              </select>
            </div>

            <div>
              <label class="form-label" for="bulk-action-type" style="font-weight: 700; margin-bottom: 4px;">Adjustment Type:</label>
              <select id="bulk-action-type" class="form-select" style="height: 36px; font-size: 12px; border-radius: 8px;">
                <option value="inc-pct">Increase by Percentage (%)</option>
                <option value="dec-pct">Decrease by Percentage (%)</option>
                <option value="inc-fixed">Add Fixed Amount (₹)</option>
                <option value="dec-fixed">Subtract Fixed Amount (₹)</option>
              </select>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
            <div>
              <label class="form-label" for="bulk-action-val" style="font-weight: 700; margin-bottom: 4px;">Value (e.g. 10):</label>
              <input type="number" id="bulk-action-val" class="form-input" placeholder="e.g. 10" min="1" step="any" style="height: 36px; font-size: 13px; font-weight: 800; border-radius: 8px;">
            </div>

            <div>
              <label class="form-label" for="bulk-rounding" style="font-weight: 700; margin-bottom: 4px;">Smart Rounding:</label>
              <select id="bulk-rounding" class="form-select" style="height: 36px; font-size: 12px; border-radius: 8px;">
                <option value="none">Exact Integer (Round to ₹1)</option>
                <option value="5">Round to nearest ₹5</option>
                <option value="10">Round to nearest ₹10</option>
              </select>
            </div>
          </div>

          <button class="btn btn-primary" id="btn-apply-bulk-price" style="height: 36px; padding: 0 16px; font-size: 12px; border-radius: 8px; font-weight: 800; width: 100%;">
            Apply Bulk Price Adjustment
          </button>
        </div>

        <!-- Action 2: Stock Availability Reset -->
        <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 12px; padding: 14px;">
          <h4 style="margin: 0 0 10px 0; font-size: 13.5px; font-weight: 800; color: #059669; display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-boxes-stacked"></i> Bulk Stock Availability (86'd Controls)
          </h4>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button class="btn btn-secondary" id="btn-bulk-stock-all-on" style="height: 36px; font-size: 12px; font-weight: 800; border-radius: 8px; display: inline-flex; align-items: center; gap: 5px;">
              <i class="fa-solid fa-circle-check" style="color: #059669;"></i> Mark All Dishes In-Stock (Morning Open)
            </button>
          </div>
        </div>

      </div>
    `;

    window.customModal.show({
      title: "Menu Bulk Operations Suite",
      bodyHtml: bodyHtml,
      confirmText: "Done",
      hideFooter: true,
      onConfirm: () => true
    });

    // Handle Bulk Price Change
    const btnApplyPrice = document.getElementById("btn-apply-bulk-price");
    if (btnApplyPrice) {
      btnApplyPrice.onclick = () => {
        const targetCat = document.getElementById("bulk-target-cat").value;
        const actionType = document.getElementById("bulk-action-type").value;
        const rawVal = document.getElementById("bulk-action-val").value;
        const rounding = document.getElementById("bulk-rounding").value;
        const val = Number(rawVal);

        if (!rawVal || isNaN(val) || val <= 0) {
          window.showToast("Please enter a valid positive adjustment value.", "error");
          return;
        }

        let targetProducts = targetCat === "all" ? products : products.filter(p => p.category === targetCat);
        if (targetProducts.length === 0) {
          window.showToast("No products found in target group.", "error");
          return;
        }

        if (!confirm(`Are you sure you want to modify prices for ${targetProducts.length} items? This cannot be undone automatically.`)) {
          return;
        }

        targetProducts.forEach(p => {
          let curr = Number(p.price) || 0;
          if (actionType === "inc-pct") {
            curr = curr * (1 + val / 100);
          } else if (actionType === "dec-pct") {
            curr = Math.max(1, curr * (1 - val / 100));
          } else if (actionType === "inc-fixed") {
            curr = curr + val;
          } else if (actionType === "dec-fixed") {
            curr = Math.max(1, curr - val);
          }

          if (rounding === "5") {
            curr = Math.round(curr / 5) * 5;
          } else if (rounding === "10") {
            curr = Math.round(curr / 10) * 10;
          } else {
            curr = Math.round(curr);
          }

          p.price = Math.max(1, curr);
          window.db.saveProduct(p);
        });

        window.showToast(`Updated pricing for ${targetProducts.length} dishes successfully.`, "success");
        window.customModal.hide();
        this.render();
      };
    }

    // Handle Mark All In-Stock
    const btnStockOn = document.getElementById("btn-bulk-stock-all-on");
    if (btnStockOn) {
      btnStockOn.onclick = () => {
        products.forEach(p => {
          p.available = true;
          window.db.saveProduct(p);
        });
        window.showToast(`All ${products.length} menu items marked as In-Stock (Live in POS).`, "success");
        window.customModal.hide();
        this.render();
      };
    }
  },

  // =========================================================================
  // 6. CSV EXPORT & MENU SHEET PRINTING
  // =========================================================================
  exportMenuCSV() {
    const products = (window.db && window.db.get("products")) || [];
    const categories = (window.db && window.db.get("categories")) || [];

    if (products.length === 0) {
      window.showToast("No products found to export.", "error");
      return;
    }

    const headers = [
      "Product ID",
      "Dish Name",
      "Category",
      "Sub Category",
      "Dietary",
      "Selling Price (INR)",
      "Ingredient Cost (INR)",
      "Packaging (INR)",
      "Total Food Cost (INR)",
      "Gross Profit (INR)",
      "Gross Margin (%)",
      "POS Available"
    ];

    const rows = products.map(p => {
      const cat = categories.find(c => c.id === p.category);
      const costInfo = this.calculateProductCost(p);
      const ingCost = p.ingredientCost !== undefined && p.ingredientCost !== null ? Number(p.ingredientCost).toFixed(2) : costInfo.foodCost.toFixed(2);
      const packCost = p.packagingCost !== undefined && p.packagingCost !== null ? Number(p.packagingCost).toFixed(2) : "0.00";
      return [
        `"${p.id}"`,
        `"${(p.name || '').replace(/"/g, '""')}"`,
        `"${cat ? cat.name.replace(/"/g, '""') : 'Unassigned'}"`,
        `"${(p.subCategory || '').replace(/"/g, '""')}"`,
        `"${p.veg !== false ? 'Veg' : 'Non-Veg'}"`,
        Number(p.price || 0).toFixed(2),
        ingCost,
        packCost,
        costInfo.foodCost.toFixed(2),
        costInfo.grossProfit.toFixed(2),
        `${costInfo.marginPct}%`,
        p.available !== false ? "YES" : "NO"
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Menu_Catalog_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    window.showToast("Menu catalog CSV exported successfully.", "success");
  },

  printMenuPriceList() {
    const products = (window.db && window.db.get("products")) || [];
    const categories = (window.db && window.db.get("categories")) || [];
    const settings = (window.db && window.db.get("settings")) || {};
    const restaurantName = settings.restaurantName || "Crust & Chilly Fast Food";
    const currency = settings.currencySymbol || "₹";

    // Group items by category
    const grouped = {};
    categories.forEach(c => {
      grouped[c.name] = products.filter(p => p.category === c.id);
    });

    const unassigned = products.filter(p => !categories.find(c => c.id === p.category));
    if (unassigned.length > 0) grouped["Other Special Dishes"] = unassigned;

    let sectionsHtml = "";
    Object.entries(grouped).forEach(([catTitle, items]) => {
      if (items.length === 0) return;
      const itemRows = items.map(p => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-bottom: 1px dotted #e2e8f0; font-size: 13.5px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${p.veg !== false ? '#16a34a' : '#dc2626'};"></span>
            <strong style="color: #0f172a;">${p.name}</strong>
            ${p.subCategory ? `<span style="font-size: 11px; color: #64748b;">(${p.subCategory})</span>` : ''}
            ${p.jain ? `<span style="font-size: 9.5px; font-weight: 800; background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; padding: 1px 4px; border-radius: 4px;">Jain</span>` : ''}
            ${p.bogo ? `<span style="font-size: 10px; font-weight: 800; background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; padding: 1px 5px; border-radius: 6px; margin-left: 4px;">BOGO</span>` : ''}
            ${p.available === false ? `<span style="font-size: 10px; color: #dc2626; margin-left: 4px;">(Out of Stock)</span>` : ''}
          </div>
          <div style="font-weight: 900; color: #0f172a; font-size: 14px;">${currency}${Number(p.price || 0).toFixed(0)}</div>
        </div>
      `).join("");

      sectionsHtml += `
        <div style="margin-bottom: 22px; page-break-inside: avoid;">
          <h3 style="font-size: 15px; font-weight: 900; color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 4px; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px;">
            ${catTitle} (${items.length})
          </h3>
          <div style="display: flex; flex-direction: column;">
            ${itemRows}
          </div>
        </div>
      `;
    });

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      window.showToast("Popup was blocked by your browser. Please allow popups to print menu.", "error");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Menu Price List - ${restaurantName}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 30px; color: #0f172a; max-width: 800px; margin: 0 auto; }
          @media print {
            body { padding: 10px; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 20px; display: flex; justify-content: space-between;">
          <button onclick="window.print()" style="background: #2563eb; color: #fff; border: none; padding: 8px 18px; border-radius: 8px; font-weight: 700; cursor: pointer;">
            Print / Save PDF
          </button>
          <button onclick="window.close()" style="background: #64748b; color: #fff; border: none; padding: 8px 18px; border-radius: 8px; font-weight: 700; cursor: pointer;">
            Close
          </button>
        </div>

        <div style="text-align: center; margin-bottom: 24px; border-bottom: 2px solid #0f172a; padding-bottom: 12px;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px;">${restaurantName}</h1>
          <div style="font-size: 13px; color: #64748b; margin-top: 4px;">OFFICIAL RESTAURANT MENU & PRICE SHEET • ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
        </div>

        ${sectionsHtml}

        <div style="text-align: center; margin-top: 30px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px;">
          Generated automatically from Crust & Chilly POS • All prices in Indian Rupee (${currency})
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
  }
};
