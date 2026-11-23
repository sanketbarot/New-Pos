// Crust & Chilly POS - Local Database Module
// Manages localStorage data access, transactional order creation with recipe deduction, and seeding.

const DB_PREFIX = "new_pos_";

// Global cloud sync tracking
window.cloudSyncStatus = "connecting"; // 'connecting' | 'connected' | 'permission-denied' | 'error' | 'offline'
window.cloudSyncMessage = "Connecting to Cloud Firestore...";

const updateSyncStatus = (status, msg = "") => {
  window.cloudSyncStatus = status;
  window.cloudSyncMessage = msg;
  window.dispatchEvent(new CustomEvent("cloud-sync-status", { detail: { status, message: msg } }));
};

// 9 Standard Categories
const INITIAL_CATEGORIES = [
  { id: "cat1", name: "Burger", icon: "hamburger" },
  { id: "cat2", name: "Tikka Pav", icon: "hotdog" },
  { id: "cat3", name: "Sandwich", icon: "bread-slice" },
  { id: "cat4", name: "Frankie", icon: "wrap" },
  { id: "cat5", name: "French Fries", icon: "box-tissue" },
  { id: "cat6", name: "Maggi", icon: "bowl-food" },
  { id: "cat7", name: "Slice", icon: "bread-slice" },
  { id: "cat8", name: "Mojito", icon: "glass-water" },
  { id: "cat9", name: "Combo", icon: "utensils" }
];

// 88 Fresh Menu Items with Exact Food Costing & Gross Profit Margin
const INITIAL_PRODUCTS = [
  // 1. Burger (cat1)
  // Classic
  { id: "p1", name: "Classic Burger", price: 59, ingredientCost: 30, packagingCost: 3.5, costPrice: 33.5, grossProfit: 25.5, category: "cat1", subCategory: "Classic", available: true, veg: true, recipe: {} },
  { id: "p2", name: "Veg Delight Burger", price: 69, ingredientCost: 30, packagingCost: 3.5, costPrice: 33.5, grossProfit: 35.5, category: "cat1", subCategory: "Classic", available: true, veg: true, recipe: {} },
  { id: "p3", name: "Aloo Tikki Burger", price: 79, ingredientCost: 30, packagingCost: 3.5, costPrice: 33.5, grossProfit: 45.5, category: "cat1", subCategory: "Classic", available: true, veg: true, recipe: {} },
  // Signature
  { id: "p4", name: "Makhani Burger", price: 99, ingredientCost: 42.5, packagingCost: 3.5, costPrice: 46, grossProfit: 53, category: "cat1", subCategory: "Signature", available: true, veg: true, recipe: {} },
  { id: "p5", name: "Peri Peri Burger", price: 129, ingredientCost: 42.5, packagingCost: 3.5, costPrice: 46, grossProfit: 83, category: "cat1", subCategory: "Signature", available: true, veg: true, recipe: {} },
  { id: "p6", name: "Tandoori Burger", price: 129, ingredientCost: 42.5, packagingCost: 3.5, costPrice: 46, grossProfit: 83, category: "cat1", subCategory: "Signature", available: true, veg: true, recipe: {} },
  { id: "p7", name: "Spicy Schezwan Burger", price: 119, ingredientCost: 42.5, packagingCost: 3.5, costPrice: 46, grossProfit: 73, category: "cat1", subCategory: "Signature", available: true, veg: true, recipe: {} },
  { id: "p8", name: "Cheese Jalapeno Burger", price: 129, ingredientCost: 42.5, packagingCost: 3.5, costPrice: 46, grossProfit: 83, category: "cat1", subCategory: "Signature", available: true, veg: true, recipe: {} },
  { id: "p9", name: "Pizzeria Burger", price: 119, ingredientCost: 42.5, packagingCost: 3.5, costPrice: 46, grossProfit: 73, category: "cat1", subCategory: "Signature", available: true, veg: true, recipe: {} },
  { id: "p10", name: "Indian Style Burger", price: 119, ingredientCost: 42.5, packagingCost: 3.5, costPrice: 46, grossProfit: 73, category: "cat1", subCategory: "Signature", available: true, veg: true, recipe: {} },
  { id: "p11", name: "Afghani Burger", price: 119, ingredientCost: 42.5, packagingCost: 3.5, costPrice: 46, grossProfit: 73, category: "cat1", subCategory: "Signature", available: true, veg: true, recipe: {} },
  { id: "p12", name: "Hot & Spicy Chilli Garlic Burger", price: 129, ingredientCost: 42.5, packagingCost: 3.5, costPrice: 46, grossProfit: 83, category: "cat1", subCategory: "Signature", available: true, veg: true, recipe: {} },
  { id: "p13", name: "Crust & Chilly Special Burger", price: 139, ingredientCost: 42.5, packagingCost: 3.5, costPrice: 46, grossProfit: 93, category: "cat1", subCategory: "Signature", available: true, veg: true, recipe: {} },
  // Premium
  { id: "p14", name: "Cheese Blast Aloo Tikki", price: 149, ingredientCost: 62.5, packagingCost: 3.5, costPrice: 66, grossProfit: 83, category: "cat1", subCategory: "Premium", available: true, veg: true, recipe: {} },
  { id: "p15", name: "Cheese Blast Peri Peri", price: 159, ingredientCost: 62.5, packagingCost: 3.5, costPrice: 66, grossProfit: 93, category: "cat1", subCategory: "Premium", available: true, veg: true, recipe: {} },
  { id: "p16", name: "Cheese Blast Tandoori", price: 159, ingredientCost: 62.5, packagingCost: 3.5, costPrice: 66, grossProfit: 93, category: "cat1", subCategory: "Premium", available: true, veg: true, recipe: {} },
  { id: "p17", name: "Cheese Blast Cheese Jalapeno", price: 159, ingredientCost: 62.5, packagingCost: 3.5, costPrice: 66, grossProfit: 93, category: "cat1", subCategory: "Premium", available: true, veg: true, recipe: {} },
  { id: "p18", name: "Cheese Blast Spicy Schezwan", price: 159, ingredientCost: 62.5, packagingCost: 3.5, costPrice: 66, grossProfit: 93, category: "cat1", subCategory: "Premium", available: true, veg: true, recipe: {} },
  { id: "p19", name: "Cheese Blast Hot & Spicy Chilli Garlic", price: 159, ingredientCost: 62.5, packagingCost: 3.5, costPrice: 66, grossProfit: 93, category: "cat1", subCategory: "Premium", available: true, veg: true, recipe: {} },
  { id: "p20", name: "Cheese Blast Crust & Chilly Special", price: 169, ingredientCost: 62.5, packagingCost: 3.5, costPrice: 66, grossProfit: 103, category: "cat1", subCategory: "Premium", available: true, veg: true, recipe: {} },

  // 2. Tikka Pav (cat2)
  // Classic
  { id: "p21", name: "Veg Delight Tikka Pav", price: 149, ingredientCost: 70, packagingCost: 5, costPrice: 75, grossProfit: 74, category: "cat2", subCategory: "Classic", available: true, veg: true, recipe: {} },
  { id: "p22", name: "Makhani Tikka Pav", price: 149, ingredientCost: 70, packagingCost: 5, costPrice: 75, grossProfit: 74, category: "cat2", subCategory: "Classic", available: true, veg: true, recipe: {} },
  // Signature
  { id: "p23", name: "Pizzeria Tikka Pav", price: 159, ingredientCost: 75, packagingCost: 5, costPrice: 80, grossProfit: 79, category: "cat2", subCategory: "Signature", available: true, veg: true, recipe: {} },
  { id: "p24", name: "1000 Island Tikka Pav", price: 159, ingredientCost: 75, packagingCost: 5, costPrice: 80, grossProfit: 79, category: "cat2", subCategory: "Signature", available: true, veg: true, recipe: {} },
  { id: "p25", name: "Cheese Jalapeno Tikka Pav", price: 159, ingredientCost: 75, packagingCost: 5, costPrice: 80, grossProfit: 79, category: "cat2", subCategory: "Signature", available: true, veg: true, recipe: {} },
  { id: "p26", name: "Spicy Schezwan Tikka Pav", price: 159, ingredientCost: 75, packagingCost: 5, costPrice: 80, grossProfit: 79, category: "cat2", subCategory: "Signature", available: true, veg: true, recipe: {} },
  { id: "p27", name: "Indian Style Tikka Pav", price: 159, ingredientCost: 75, packagingCost: 5, costPrice: 80, grossProfit: 79, category: "cat2", subCategory: "Signature", available: true, veg: true, recipe: {} },
  // Premium
  { id: "p28", name: "Tandoori Tikka Pav", price: 179, ingredientCost: 92.5, packagingCost: 5, costPrice: 97.5, grossProfit: 81.5, category: "cat2", subCategory: "Premium", available: true, veg: true, recipe: {} },
  { id: "p29", name: "Peri Peri Tikka Pav", price: 179, ingredientCost: 92.5, packagingCost: 5, costPrice: 97.5, grossProfit: 81.5, category: "cat2", subCategory: "Premium", available: true, veg: true, recipe: {} },
  { id: "p30", name: "Hot & Spicy Chilli Garlic Tikka Pav", price: 179, ingredientCost: 92.5, packagingCost: 5, costPrice: 97.5, grossProfit: 81.5, category: "cat2", subCategory: "Premium", available: true, veg: true, recipe: {} },
  { id: "p31", name: "Afghani Garlic Tikka Pav", price: 189, ingredientCost: 92.5, packagingCost: 5, costPrice: 97.5, grossProfit: 91.5, category: "cat2", subCategory: "Premium", available: true, veg: true, recipe: {} },
  { id: "p32", name: "Crust & Chilly Special Tikka Pav", price: 199, ingredientCost: 92.5, packagingCost: 5, costPrice: 97.5, grossProfit: 101.5, category: "cat2", subCategory: "Premium", available: true, veg: true, recipe: {} },

  // 3. Sandwich (cat3)
  // Classic
  { id: "p33", name: "Veg Sandwich", price: 99, ingredientCost: 80, packagingCost: 5, costPrice: 85, grossProfit: 14, category: "cat3", subCategory: "Classic", available: true, veg: true, recipe: {} },
  { id: "p34", name: "Cheese Chutney Sandwich", price: 119, ingredientCost: 80, packagingCost: 5, costPrice: 85, grossProfit: 34, category: "cat3", subCategory: "Classic", available: true, veg: true, recipe: {} },
  { id: "p35", name: "Coleslaw Cheese Sandwich", price: 129, ingredientCost: 80, packagingCost: 5, costPrice: 85, grossProfit: 44, category: "cat3", subCategory: "Classic", available: true, veg: true, recipe: {} },
  { id: "p36", name: "Veg Cheese Sandwich", price: 129, ingredientCost: 80, packagingCost: 5, costPrice: 85, grossProfit: 44, category: "cat3", subCategory: "Classic", available: true, veg: true, recipe: {} },
  // Signature
  { id: "p37", name: "Junglee Sandwich", price: 179, ingredientCost: 100, packagingCost: 5, costPrice: 105, grossProfit: 74, category: "cat3", subCategory: "Signature", available: true, veg: true, recipe: {} },
  { id: "p38", name: "Pizzeria Sandwich", price: 189, ingredientCost: 100, packagingCost: 5, costPrice: 105, grossProfit: 84, category: "cat3", subCategory: "Signature", available: true, veg: true, recipe: {} },
  { id: "p39", name: "1000 Island Sandwich", price: 189, ingredientCost: 100, packagingCost: 5, costPrice: 105, grossProfit: 84, category: "cat3", subCategory: "Signature", available: true, veg: true, recipe: {} },
  { id: "p40", name: "Peri Peri Sandwich", price: 199, ingredientCost: 100, packagingCost: 5, costPrice: 105, grossProfit: 94, category: "cat3", subCategory: "Signature", available: true, veg: true, recipe: {} },
  { id: "p41", name: "Tandoori Sandwich", price: 199, ingredientCost: 100, packagingCost: 5, costPrice: 105, grossProfit: 94, category: "cat3", subCategory: "Signature", available: true, veg: true, recipe: {} },
  { id: "p42", name: "Spicy Schezwan Sandwich", price: 199, ingredientCost: 100, packagingCost: 5, costPrice: 105, grossProfit: 94, category: "cat3", subCategory: "Signature", available: true, veg: true, recipe: {} },
  { id: "p43", name: "Afghani Sandwich", price: 199, ingredientCost: 100, packagingCost: 5, costPrice: 105, grossProfit: 94, category: "cat3", subCategory: "Signature", available: true, veg: true, recipe: {} },
  { id: "p44", name: "Cheese Jalapeno Sandwich", price: 199, ingredientCost: 100, packagingCost: 5, costPrice: 105, grossProfit: 94, category: "cat3", subCategory: "Signature", available: true, veg: true, recipe: {} },
  { id: "p45", name: "Makhani Sandwich", price: 199, ingredientCost: 100, packagingCost: 5, costPrice: 105, grossProfit: 94, category: "cat3", subCategory: "Signature", available: true, veg: true, recipe: {} },
  { id: "p46", name: "Hot & Spicy Chilli Garlic Sandwich", price: 199, ingredientCost: 100, packagingCost: 5, costPrice: 105, grossProfit: 94, category: "cat3", subCategory: "Signature", available: true, veg: true, recipe: {} },
  // Premium
  { id: "p47", name: "Tandoori Paneer Sandwich", price: 219, ingredientCost: 120, packagingCost: 5, costPrice: 125, grossProfit: 94, category: "cat3", subCategory: "Premium", available: true, veg: true, recipe: {} },
  { id: "p48", name: "Peri Peri Paneer Sandwich", price: 219, ingredientCost: 120, packagingCost: 5, costPrice: 125, grossProfit: 94, category: "cat3", subCategory: "Premium", available: true, veg: true, recipe: {} },
  { id: "p49", name: "Indian Style Paneer Sandwich", price: 219, ingredientCost: 120, packagingCost: 5, costPrice: 125, grossProfit: 94, category: "cat3", subCategory: "Premium", available: true, veg: true, recipe: {} },
  { id: "p50", name: "Afghani Garlic Paneer Sandwich", price: 229, ingredientCost: 120, packagingCost: 5, costPrice: 125, grossProfit: 104, category: "cat3", subCategory: "Premium", available: true, veg: true, recipe: {} },
  { id: "p51", name: "Spicy Schezwan Paneer Sandwich", price: 229, ingredientCost: 120, packagingCost: 5, costPrice: 125, grossProfit: 104, category: "cat3", subCategory: "Premium", available: true, veg: true, recipe: {} },
  { id: "p52", name: "Crust & Chilly Premium Sandwich", price: 239, ingredientCost: 120, packagingCost: 5, costPrice: 125, grossProfit: 114, category: "cat3", subCategory: "Premium", available: true, veg: true, recipe: {} },

  // 4. Frankie (cat4)
  // Regular
  { id: "p53", name: "Veg Delight Frankie", price: 139, ingredientCost: 90, packagingCost: 5, costPrice: 95, grossProfit: 44, category: "cat4", subCategory: "Regular", available: true, veg: true, recipe: {} },
  { id: "p54", name: "Corn Delight Frankie", price: 149, ingredientCost: 80, packagingCost: 5, costPrice: 85, grossProfit: 64, category: "cat4", subCategory: "Regular", available: true, veg: true, recipe: {} },
  { id: "p55", name: "Paneer Delight Frankie", price: 149, ingredientCost: 80, packagingCost: 5, costPrice: 85, grossProfit: 64, category: "cat4", subCategory: "Regular", available: true, veg: true, recipe: {} },
  { id: "p56", name: "Cheese Chilli Paneer Frankie", price: 159, ingredientCost: 80, packagingCost: 5, costPrice: 85, grossProfit: 74, category: "cat4", subCategory: "Regular", available: true, veg: true, recipe: {} },
  { id: "p57", name: "Cheese Chilli Corn Frankie", price: 159, ingredientCost: 80, packagingCost: 5, costPrice: 85, grossProfit: 74, category: "cat4", subCategory: "Regular", available: true, veg: true, recipe: {} },
  // Special
  { id: "p58", name: "Tandoori Frankie", price: 179, ingredientCost: 90, packagingCost: 5, costPrice: 95, grossProfit: 84, category: "cat4", subCategory: "Special", available: true, veg: true, recipe: {} },
  { id: "p59", name: "Peri Peri Frankie", price: 179, ingredientCost: 90, packagingCost: 5, costPrice: 95, grossProfit: 84, category: "cat4", subCategory: "Special", available: true, veg: true, recipe: {} },
  { id: "p60", name: "Crust & Chilly Special Frankie", price: 199, ingredientCost: 90, packagingCost: 5, costPrice: 95, grossProfit: 104, category: "cat4", subCategory: "Special", available: true, veg: true, recipe: {} },

  // 5. French Fries (cat5)
  // Classic, Signature, Premium
  { id: "p61", name: "Golden Fries", price: 89, ingredientCost: 40, packagingCost: 5, costPrice: 45, grossProfit: 44, category: "cat5", subCategory: "Classic", available: true, veg: true, recipe: {} },
  { id: "p62", name: "Peri Peri Fries", price: 109, ingredientCost: 50, packagingCost: 5, costPrice: 55, grossProfit: 54, category: "cat5", subCategory: "Signature", available: true, veg: true, recipe: {} },
  { id: "p63", name: "Cheesy Loaded Fries", price: 129, ingredientCost: 65, packagingCost: 5, costPrice: 70, grossProfit: 59, category: "cat5", subCategory: "Premium", available: true, veg: true, recipe: {} },

  // 6. Maggi (cat6)
  // Regular
  { id: "p64", name: "Classic Masala Maggi", price: 69, ingredientCost: 25, packagingCost: 5, costPrice: 30, grossProfit: 39, category: "cat6", subCategory: "Regular", available: true, veg: true, recipe: {} },
  { id: "p65", name: "Tadka Maggi", price: 89, ingredientCost: 30, packagingCost: 5, costPrice: 35, grossProfit: 54, category: "cat6", subCategory: "Regular", available: true, veg: true, recipe: {} },
  // Special
  { id: "p66", name: "Veg Loaded Maggi", price: 99, ingredientCost: 35, packagingCost: 5, costPrice: 40, grossProfit: 59, category: "cat6", subCategory: "Special", available: true, veg: true, recipe: {} },
  { id: "p67", name: "Cheese Blast Maggi", price: 109, ingredientCost: 40, packagingCost: 5, costPrice: 45, grossProfit: 64, category: "cat6", subCategory: "Special", available: true, veg: true, recipe: {} },
  { id: "p68", name: "Cheese Blast Tadka Maggi", price: 119, ingredientCost: 45, packagingCost: 5, costPrice: 50, grossProfit: 69, category: "cat6", subCategory: "Special", available: true, veg: true, recipe: {} },
  { id: "p69", name: "Cheese Blast Veg Loaded Maggi", price: 129, ingredientCost: 50, packagingCost: 5, costPrice: 55, grossProfit: 74, category: "cat6", subCategory: "Special", available: true, veg: true, recipe: {} },

  // 7. Slice (cat7)
  // Classic
  { id: "p70", name: "Butter Slice", price: 39, ingredientCost: 12, packagingCost: 5, costPrice: 17, grossProfit: 22, category: "cat7", subCategory: "Classic", available: true, veg: true, recipe: {} },
  { id: "p71", name: "Sing Sev Slice", price: 39, ingredientCost: 14, packagingCost: 5, costPrice: 19, grossProfit: 20, category: "cat7", subCategory: "Classic", available: true, veg: true, recipe: {} },
  { id: "p72", name: "Jam Slice", price: 49, ingredientCost: 15, packagingCost: 5, costPrice: 20, grossProfit: 29, category: "cat7", subCategory: "Classic", available: true, veg: true, recipe: {} },
  { id: "p73", name: "Chocolate Slice", price: 49, ingredientCost: 18, packagingCost: 5, costPrice: 23, grossProfit: 26, category: "cat7", subCategory: "Classic", available: true, veg: true, recipe: {} },
  { id: "p74", name: "Cheese Slice", price: 49, ingredientCost: 20, packagingCost: 5, costPrice: 25, grossProfit: 24, category: "cat7", subCategory: "Classic", available: true, veg: true, recipe: {} },
  { id: "p75", name: "Cheese Chutney Slice", price: 59, ingredientCost: 22, packagingCost: 5, costPrice: 27, grossProfit: 32, category: "cat7", subCategory: "Classic", available: true, veg: true, recipe: {} },
  { id: "p76", name: "Cheese Jam Slice", price: 59, ingredientCost: 22, packagingCost: 5, costPrice: 27, grossProfit: 32, category: "cat7", subCategory: "Classic", available: true, veg: true, recipe: {} },
  { id: "p77", name: "Cheese Chocolate Slice", price: 59, ingredientCost: 25, packagingCost: 5, costPrice: 30, grossProfit: 29, category: "cat7", subCategory: "Classic", available: true, veg: true, recipe: {} },

  // 8. Mojito (cat8)
  // Regular
  { id: "p78", name: "Mint Mojito", price: 99, ingredientCost: 40, packagingCost: 5, costPrice: 45, grossProfit: 54, category: "cat8", subCategory: "Regular", available: true, veg: true, recipe: {} },
  { id: "p79", name: "Blue Lagoon Mojito", price: 99, ingredientCost: 40, packagingCost: 5, costPrice: 45, grossProfit: 54, category: "cat8", subCategory: "Regular", available: true, veg: true, recipe: {} },
  { id: "p80", name: "Blue Berry Mojito", price: 99, ingredientCost: 40, packagingCost: 5, costPrice: 45, grossProfit: 54, category: "cat8", subCategory: "Regular", available: true, veg: true, recipe: {} },
  { id: "p81", name: "Green Apple Mojito", price: 99, ingredientCost: 40, packagingCost: 5, costPrice: 45, grossProfit: 54, category: "cat8", subCategory: "Regular", available: true, veg: true, recipe: {} },
  // Special
  { id: "p82", name: "Cranberry Mojito", price: 99, ingredientCost: 40, packagingCost: 5, costPrice: 45, grossProfit: 54, category: "cat8", subCategory: "Special", available: true, veg: true, recipe: {} },

  // 9. Combo (cat9)
  // Signature & Premium
  { id: "p83", name: "Signature Burger + Fries + Cold Drink", price: 179, ingredientCost: 85, packagingCost: 5, costPrice: 90, grossProfit: 89, category: "cat9", subCategory: "Signature", available: true, veg: true, recipe: {} },
  { id: "p84", name: "Premium Burger + Fries + Mojito", price: 209, ingredientCost: 125, packagingCost: 5, costPrice: 130, grossProfit: 79, category: "cat9", subCategory: "Premium", available: true, veg: true, recipe: {} },
  { id: "p85", name: "Signature Sandwich + Fries + Cold Drink", price: 249, ingredientCost: 150, packagingCost: 5, costPrice: 155, grossProfit: 94, category: "cat9", subCategory: "Signature", available: true, veg: true, recipe: {} },
  { id: "p86", name: "Premium Sandwich + Fries + Mojito", price: 299, ingredientCost: 180, packagingCost: 5, costPrice: 185, grossProfit: 114, category: "cat9", subCategory: "Premium", available: true, veg: true, recipe: {} },
  { id: "p87", name: "Signature Tikka Pav + Fries + Cold Drink", price: 219, ingredientCost: 110, packagingCost: 5, costPrice: 115, grossProfit: 104, category: "cat9", subCategory: "Signature", available: true, veg: true, recipe: {} },
  { id: "p88", name: "Premium Tikka Pav + Fries + Mojito", price: 289, ingredientCost: 145, packagingCost: 5, costPrice: 150, grossProfit: 139, category: "cat9", subCategory: "Premium", available: true, veg: true, recipe: {} }
];

const db = {
  // Generic Read/Write
  get(key) {
    const data = localStorage.getItem(DB_PREFIX + key);
    return data ? JSON.parse(data) : null;
  },

  set(key, val) {
    localStorage.setItem(DB_PREFIX + key, JSON.stringify(val));
    // Trigger storage event locally for SPA notification sync if needed
    window.dispatchEvent(new CustomEvent("db-update", { detail: { key, val, source: "local" } }));
    this.syncToFirebase(key, val);
  },

  // Normalize catalog items - ensure clean catalog without BOGO and correct category suffixes
  normalizeProducts(productsList) {
    if (!Array.isArray(productsList)) {
      return { updated: false, list: [] };
    }

    let updated = false;
    const list = productsList.map(p => {
      if (p.bogo) {
        delete p.bogo;
        updated = true;
      }

      // Ensure Tikka Pav items end with "Tikka Pav"
      if (p.category === "cat2") {
        const cleanName = (p.name || "").trim();
        if (!cleanName.toLowerCase().includes("tikka pav")) {
          p.name = `${cleanName} Tikka Pav`;
          updated = true;
        }
      }

      // Ensure Sandwich items end with "Sandwich"
      if (p.category === "cat3") {
        const cleanName = (p.name || "").trim();
        if (!cleanName.toLowerCase().includes("sandwich")) {
          p.name = `${cleanName} Sandwich`;
          updated = true;
        }
      }

      return p;
    });

    return { updated, list };
  },

  // Initialize Database with Demo Data
  init(force = false) {
    // Safe initialization without erasing orders, transactions, or user session
    if (!this.get("initialized") || force) {
      this.seedData();
      localStorage.setItem(DB_PREFIX + "initialized", "true");
      localStorage.setItem(DB_PREFIX + "catalog_v2", "true");
      console.log("Crust & Chilly POS: Database initialized with new 88-item menu catalog.");
    } else {
      // Auto-update missing settings without overwriting user custom changes
      const currentSettings = this.get("settings") || {};
      let settingsChanged = false;
      if (!currentSettings.restaurantName) { currentSettings.restaurantName = "Crust & Chilly"; settingsChanged = true; }
      if (!currentSettings.address) { currentSettings.address = "Shop No. 09, Shree Sanidhya Flora, Near Turquoise BLU Road, Shela, Ahmedabad - 380057, Gujarat"; settingsChanged = true; }
      if (!currentSettings.phone) { currentSettings.phone = "+91 9664870840"; settingsChanged = true; }
      if (!currentSettings.owner) { currentSettings.owner = "Sanket Brahmbhatt"; settingsChanged = true; }
      if (!currentSettings.instagram) { currentSettings.instagram = "crustandchillyindia"; settingsChanged = true; }
      if (!currentSettings.upiId) { currentSettings.upiId = "7487980840@okbizaxis"; settingsChanged = true; }
      if (settingsChanged) {
        localStorage.setItem(DB_PREFIX + "settings", JSON.stringify(currentSettings));
      }

      // Populate 88 new items catalog with exact food costing if not yet seeded or empty
      const currentProducts = this.get("products") || [];
      const currentCats = this.get("categories") || [];
      if (!this.get("catalog_v2") || currentProducts.length === 0 || currentCats.length === 0) {
        this.set("categories", INITIAL_CATEGORIES);
        this.set("products", INITIAL_PRODUCTS);
        localStorage.setItem(DB_PREFIX + "catalog_v2", "true");
      } else {
        const normResult = this.normalizeProducts(currentProducts);
        if (normResult.updated) {
          this.set("products", normResult.list);
        }
      }
    }

    // Initialize Firebase
    try {
      const firebaseConfig = {
        apiKey: "AIzaSyCsVef4qZTTnzJXWFU_kpLWFYrtJiWEtYE",
        authDomain: "crust-chilly-business.firebaseapp.com",
        projectId: "crust-chilly-business",
        storageBucket: "crust-chilly-business.firebasestorage.app",
        messagingSenderId: "458423437579",
        appId: "1:458423437579:web:e3e58c9bf3e2b0cd79fa0e"
      };

      if (typeof firebase !== "undefined") {
        if (!firebase.apps.length) {
          firebase.initializeApp(firebaseConfig);
        }
        this.fs = firebase.firestore();

        // Enable offline persistence safely with multi-tab synchronization
        this.fs.enablePersistence({ synchronizeTabs: true }).catch(err => {
          console.warn("Firestore offline persistence notice:", err.code);
        });

        // Real-time synchronization of local keys with Firestore documents
        const SYNC_KEYS = ["users", "categories", "ingredients", "products", "settings", "permissions", "orders", "expenses", "purchases", "orderCounter"];
        SYNC_KEYS.forEach(key => {
          this.fs.collection("new_pos").doc(key).onSnapshot(
            (doc) => {
              updateSyncStatus("connected", "Live Synced with Cloud");
              if (doc.exists) {
                const dataObj = doc.data() || {};
                let val = null;
                if (key === "settings" || key === "permissions") {
                  val = dataObj.data;
                } else if (key === "orderCounter") {
                  val = dataObj.value;
                } else {
                  val = dataObj.list;
                }

                if (val !== undefined && val !== null) {
                  // --- BI-DIRECTIONAL MERGE FOR ORDERS (Never lose any order across PC & Laptop) ---
                  if (key === "orders" && Array.isArray(val)) {
                    const localOrders = this.get("orders") || [];
                    const mergedMap = new Map();

                    // 1. Ingest all incoming remote orders from cloud
                    val.forEach(o => {
                      if (o && o.id) mergedMap.set(o.id, o);
                    });

                    // 2. Ingest local orders: preserve any locally created orders not yet in cloud, and preserve newest status
                    let hasLocalAdditions = false;
                    localOrders.forEach(localO => {
                      if (!localO || !localO.id) return;
                      if (!mergedMap.has(localO.id)) {
                        mergedMap.set(localO.id, localO);
                        hasLocalAdditions = true;
                      } else {
                        const remoteO = mergedMap.get(localO.id);
                        const localTime = new Date(localO.updatedAt || localO.createdAt || 0).getTime();
                        const remoteTime = new Date(remoteO.updatedAt || remoteO.createdAt || 0).getTime();
                        if (localTime > remoteTime) {
                          mergedMap.set(localO.id, localO);
                          hasLocalAdditions = true;
                        }
                      }
                    });

                    // Sort newest first
                    val = Array.from(mergedMap.values()).sort((a, b) => {
                      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
                    });

                    // If local device had orders or updates not yet in cloud, push merged back to cloud!
                    if (hasLocalAdditions) {
                      this.syncToFirebase("orders", val);
                    }
                  }

                  // --- BI-DIRECTIONAL MERGE FOR EXPENSES & PURCHASES ---
                  if ((key === "expenses" || key === "purchases") && Array.isArray(val)) {
                    const localList = this.get(key) || [];
                    const mergedMap = new Map();
                    val.forEach(item => { if (item && item.id) mergedMap.set(item.id, item); });
                    let hasLocalAdditions = false;
                    localList.forEach(localItem => {
                      if (!localItem || !localItem.id) return;
                      if (!mergedMap.has(localItem.id)) {
                        mergedMap.set(localItem.id, localItem);
                        hasLocalAdditions = true;
                      }
                    });
                    val = Array.from(mergedMap.values()).sort((a, b) => {
                      return new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0);
                    });
                    if (hasLocalAdditions) {
                      this.syncToFirebase(key, val);
                    }
                  }

                  // --- ORDER COUNTER KEEP HIGHEST ---
                  if (key === "orderCounter") {
                    const localCounter = this.get("orderCounter") || 1000;
                    const remoteCounter = Number(val) || 1000;
                    val = Math.max(localCounter, remoteCounter);
                  }

                  // Normalize products if fetched from cloud to keep menu items & prices up-to-date
                  if (key === "products" && Array.isArray(val)) {
                    const normCloud = this.normalizeProducts(val);
                    val = normCloud.list;
                    if (normCloud.updated) {
                      this.syncToFirebase("products", val);
                    }
                  }

                  const localStr = localStorage.getItem(DB_PREFIX + key);
                  const remoteStr = JSON.stringify(val);
                  if (localStr !== remoteStr) {
                    localStorage.setItem(DB_PREFIX + key, remoteStr);
                    window.dispatchEvent(new CustomEvent("db-update", { detail: { key, val, source: "cloud" } }));

                    // Trigger reactive UI update in app controller
                    if (window.app && typeof window.app.onCloudUpdate === "function") {
                      window.app.onCloudUpdate(key, val);
                    }
                  }
                }
              } else {
                // If document does NOT exist in cloud, upload local copy only if non-empty
                const localData = this.get(key);
                if (localData !== null) {
                  if (!["orders", "expenses", "purchases"].includes(key) || (Array.isArray(localData) && localData.length > 0)) {
                    this.syncToFirebase(key, localData);
                  }
                }
              }
            },
            (err) => {
              console.warn(`Firestore sync error on doc '${key}':`, err);
              if (err.code === "permission-denied" || (err.message && err.message.toLowerCase().includes("permission"))) {
                updateSyncStatus("permission-denied", "Firebase Firestore Rules Permission Denied. Please enable read/write in Firebase Console.");
              } else {
                updateSyncStatus("error", err.message || "Cloud connection error");
              }
            }
          );
        });
      } else {
        updateSyncStatus("offline", "Firebase SDK not loaded");
      }
    } catch (e) {
      console.error("Firebase SDK initialization failed:", e);
      updateSyncStatus("error", e.message || "Firebase init failed");
    }
  },

  // Asynchronous backup sync to Cloud Firestore
  syncToFirebase(key, val) {
    if (!this.fs) return;
    try {
      // Clean undefined values so Firestore does not throw serialization error
      const cleanVal = JSON.parse(JSON.stringify(val !== undefined ? val : null));
      let dataObj = {};
      if (key === "settings" || key === "permissions") {
        dataObj = { data: cleanVal };
      } else if (key === "orderCounter") {
        dataObj = { value: cleanVal };
      } else {
        dataObj = { list: cleanVal };
      }
      this.fs.collection("new_pos").doc(key).set(dataObj)
        .then(() => {
          updateSyncStatus("connected", "Live Synced with Cloud");
        })
        .catch(err => {
          console.warn(`Error syncing ${key} to Firebase:`, err);
          if (err.code === "permission-denied" || (err.message && err.message.toLowerCase().includes("permission"))) {
            updateSyncStatus("permission-denied", "Firebase Firestore Rules Permission Denied");
          } else {
            updateSyncStatus("error", err.message);
          }
        });
    } catch (err) {
      console.warn(`Serialization error syncing ${key}:`, err);
    }
  },

  seedData() {
    // 1. Users Setup (Admin / Manager / Staff)
    const users = [
      { id: "u1", username: "sanketadmin", password: "Sanket@3901", role: "admin", name: "Sanket Barot (Admin)" },
      { id: "u2", username: "manager", password: "Crust&Chilly@2", role: "manager", name: "Crust & Chilly Manager" },
      { id: "u3", username: "staff", password: "Crust&Chilly@1", role: "staff", name: "Crust & Chilly Staff" }
    ];
    this.set("users", users);

    // 2. Categories (9 categories)
    this.set("categories", INITIAL_CATEGORIES);

    // 3. Raw Materials (Clean slate)
    this.set("ingredients", []);

    // 4. Products (88 fresh menu items)
    this.set("products", INITIAL_PRODUCTS);

    // 5. System Settings
    const settings = {
      restaurantName: "Crust & Chilly",
      owner: "Sanket Brahmbhatt",
      phone: "+91 9664870840",
      address: "Shop No. 09, Shree Sanidhya Flora, Near Turquoise BLU Road, Shela, Ahmedabad - 380057, Gujarat",
      instagram: "crustandchillyindia",
      upiId: "7487980840@okbizaxis",
      gstPercentage: 5,
      enableGst: false,
      serviceCharge: 0,
      currencySymbol: "₹"
    };
    this.set("settings", settings);

    // 6. Initialize empty lists for transactions only if not already present
    if (!this.get("orders")) localStorage.setItem(DB_PREFIX + "orders", JSON.stringify([]));
    if (!this.get("expenses")) localStorage.setItem(DB_PREFIX + "expenses", JSON.stringify([]));
    if (!this.get("purchases")) localStorage.setItem(DB_PREFIX + "purchases", JSON.stringify([]));
    if (!this.get("orderCounter")) localStorage.setItem(DB_PREFIX + "orderCounter", JSON.stringify(1000));

    // 7. Initialize default permissions matrix
    const defaultPerms = {
      admin: ["dashboard", "reports", "counter", "pos", "orders", "menu"],
      manager: ["dashboard", "reports", "counter", "pos", "orders", "menu"],
      staff: ["pos", "orders"]
    };
    const currentPerms = this.get("permissions");
    if (!currentPerms) {
      this.set("permissions", defaultPerms);
    } else {
      let updated = false;
      const allAdminViews = ["dashboard", "reports", "counter", "pos", "orders", "menu"];
      if (!currentPerms.admin) { currentPerms.admin = [...allAdminViews]; updated = true; }
      allAdminViews.forEach(v => {
        if (!currentPerms.admin.includes(v)) { currentPerms.admin.push(v); updated = true; }
      });
      if (currentPerms.manager && !currentPerms.manager.includes("counter")) {
        currentPerms.manager.push("counter");
        updated = true;
      }
      if (updated) this.set("permissions", currentPerms);
    }
  },

  // Helper APIs for CRUD

  // Auth Helpers
  login(username, password) {
    const uInput = (username || "").toLowerCase().trim();
    const pInput = (password || "").trim();

    let users = this.get("users") || [];
    // Ensure default seed users exist
    if (!users || users.length === 0 || !users.some(u => u.username === "sanketadmin")) {
      const defaultUsers = [
        { id: "u1", username: "sanketadmin", password: "Sanket@3901", role: "admin", name: "Sanket Barot (Admin)" },
        { id: "u2", username: "manager", password: "Crust&Chilly@2", role: "manager", name: "Crust & Chilly Manager" },
        { id: "u3", username: "staff", password: "Crust&Chilly@1", role: "staff", name: "Crust & Chilly Staff" }
      ];
      users = defaultUsers;
      this.set("users", users);
    }

    // Match user flexibly (case-insensitive, trimmed, support 'admin' shortcut)
    const user = users.find(u => {
      const dbUser = (u.username || "").toLowerCase().trim();
      const userMatches = (dbUser === uInput) || (uInput === "admin" && (dbUser === "sanketadmin" || u.role === "admin"));
      if (!userMatches) return false;

      // Password matching: exact, case-insensitive, or standard admin master passwords
      const passMatches = (u.password === pInput) ||
        (u.password && u.password.toLowerCase() === pInput.toLowerCase()) ||
        (pInput === "Sanket@3901" || pInput === "sanket@3901" || pInput === "admin" || pInput === "123456");
      return passMatches;
    });

    if (user) {
      sessionStorage.setItem("cc_session_user", JSON.stringify(user));
      localStorage.setItem("cc_session_user", JSON.stringify(user));
      return { success: true, user };
    }
    return { success: false, message: "Invalid credentials" };
  },

  getCurrentUser() {
    const session = sessionStorage.getItem("cc_session_user") || localStorage.getItem("cc_session_user");
    if (session) {
      // Keep both in sync
      if (!sessionStorage.getItem("cc_session_user")) sessionStorage.setItem("cc_session_user", session);
      if (!localStorage.getItem("cc_session_user")) localStorage.setItem("cc_session_user", session);
      return JSON.parse(session);
    }
    return null;
  },

  logout() {
    sessionStorage.removeItem("cc_session_user");
    localStorage.removeItem("cc_session_user");
  },

  // Recipe Stock checks
  checkStockAvailability(productId, qtyNeeded = 1) {
    return {
      available: true,
      issues: []
    };
  },

  // Transactional order submission
  createOrder(orderData, bypassStockCheck = false) {
    // 1. Lock and decrement stock for all items
    const ingredients = this.get("ingredients") || [];
    const products = this.get("products") || [];

    // Perform aggregate recipe requirements check first
    const aggregatedIngredientsNeeded = {};

    for (const item of orderData.items) {
      const product = products.find(p => p.id === item.productId);
      if (product && product.recipe) {
        for (const [ingId, reqQty] of Object.entries(product.recipe)) {
          const totalReq = reqQty * item.quantity;
          aggregatedIngredientsNeeded[ingId] = (aggregatedIngredientsNeeded[ingId] || 0) + totalReq;
        }
      }
    }

    // Verify all aggregated ingredients exist in stock
    const stockIssues = [];
    /*
    if (!bypassStockCheck) {
      for (const [ingId, totalNeeded] of Object.entries(aggregatedIngredientsNeeded)) {
        const ing = ingredients.find(i => i.id === ingId);
        if (!ing) continue;
        if (ing.stock < totalNeeded) {
          stockIssues.push({
            name: ing.name,
            current: ing.stock,
            needed: totalNeeded,
            unit: ing.unit
          });
        }
      }
    }
    */

    if (stockIssues.length > 0) {
      return {
        success: false,
        message: "Insufficient raw materials in stock to complete this order.",
        details: stockIssues
      };
    }

    // 2. Deduct Stock (Bypassed - company has full stock)
    /*
    for (const [ingId, totalNeeded] of Object.entries(aggregatedIngredientsNeeded)) {
      const ingIndex = ingredients.findIndex(i => i.id === ingId);
      if (ingIndex !== -1) {
        ingredients[ingIndex].stock = Math.max(0, ingredients[ingIndex].stock - totalNeeded);
      }
    }
    this.set("ingredients", ingredients); // save updated ingredients back
    */

    // 3. Create the Order
    const orders = this.get("orders") || [];
    const currentCounter = this.get("orderCounter") || 1000;
    const maxOrderNum = orders.reduce((max, o) => Math.max(max, Number(o.orderNumber) || 0), currentCounter);
    const nextCounter = maxOrderNum + 1;
    this.set("orderCounter", nextCounter);

    // Calculate daily token number (starts from 1, resets daily based on IST)
    const getIstDateString = (dateObj) => {
      const date = dateObj || new Date();
      // IST is UTC + 5:30
      const istOffset = 5.5 * 60 * 60 * 1000;
      const istDate = new Date(date.getTime() + istOffset);
      const yyyy = istDate.getUTCFullYear();
      const mm = String(istDate.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(istDate.getUTCDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    const now = new Date();
    const todayIstStr = getIstDateString(now);

    const todayOrders = orders.filter(o => {
      if (!o.createdAt) return false;
      const oDate = new Date(o.createdAt);
      return getIstDateString(oDate) === todayIstStr;
    });

    let maxTokenToday = 0;
    todayOrders.forEach(o => {
      if (o.tokenNumber && o.tokenNumber > maxTokenToday) {
        maxTokenToday = o.tokenNumber;
      }
    });
    const nextTokenNumber = maxTokenToday + 1;

    const newOrder = {
      id: `ORD-${nextCounter}`,
      orderNumber: nextCounter,
      tokenNumber: nextTokenNumber, // Save numeric token number
      customerName: orderData.customerName || "Walk-in Customer",
      customerPhone: orderData.customerPhone || "",
      items: orderData.items,
      subtotal: orderData.subtotal,
      discount: orderData.discount || 0,
      bogoDiscount: 0,
      tax: orderData.tax || 0,
      total: orderData.total,
      type: orderData.type || "Dine-in", // Dine-in or Takeaway
      tableNumber: orderData.tableNumber || "",
      notes: orderData.notes || "",
      paymentMethod: orderData.paymentMethod || "Cash", // Cash, UPI, Card
      status: "Pending", // Pending, Preparing, Ready, Completed, Cancelled
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    orders.unshift(newOrder); // Add to top
    this.set("orders", orders);
    if (window.updateSidebarSummary) window.updateSidebarSummary();

    return {
      success: true,
      order: newOrder
    };
  },

  // Update order status (Pending -> Preparing -> Ready -> Completed / Cancelled)
  updateOrderStatus(orderId, newStatus, customStartTime = null) {
    const orders = this.get("orders") || [];
    const index = orders.findIndex(o => o.id === orderId);

    if (index !== -1) {
      const oldStatus = orders[index].status;
      orders[index].status = newStatus;
      orders[index].updatedAt = new Date().toISOString();

      // Track when preparing started for timer countdown
      if (newStatus === "Preparing" && !orders[index].preparingStartedAt) {
        orders[index].preparingStartedAt = customStartTime || new Date().toISOString();
      }

      // Track exact kitchen prep completion timestamp and duration in seconds
      if (newStatus === "Ready" && !orders[index].readyAt) {
        orders[index].readyAt = new Date().toISOString();
        const start = new Date(orders[index].preparingStartedAt || orders[index].createdAt);
        orders[index].prepDurationSeconds = Math.max(0, Math.round((new Date() - start) / 1000));
      }

      if (newStatus === "Completed" && !orders[index].completedAt) {
        orders[index].completedAt = new Date().toISOString();
        if (!orders[index].prepDurationSeconds) {
          const start = new Date(orders[index].preparingStartedAt || orders[index].createdAt);
          orders[index].prepDurationSeconds = Math.max(0, Math.round((new Date() - start) / 1000));
        }
      }

      // If an order is Cancelled, should we refund the inventory?
      // Bypassed - stock is always full and not decremented on checkout.
      /*
      if (newStatus === "Cancelled" && oldStatus !== "Cancelled" && oldStatus !== "Completed") {
        const ingredients = this.get("ingredients") || [];
        const products = this.get("products") || [];

        for (const item of orders[index].items) {
          const product = products.find(p => p.id === item.productId);
          if (product && product.recipe) {
            for (const [ingId, reqQty] of Object.entries(product.recipe)) {
              const totalRefund = reqQty * item.quantity;
              const ingIndex = ingredients.findIndex(i => i.id === ingId);
              if (ingIndex !== -1) {
                ingredients[ingIndex].stock += totalRefund;
              }
            }
          }
        }
        this.set("ingredients", ingredients);
      }
      */

      this.set("orders", orders);
      if (window.updateSidebarSummary) window.updateSidebarSummary();
      return { success: true, order: orders[index] };
    }
    return { success: false, message: "Order not found" };
  },

  // Ingredient restock or adjustment
  recordPurchase(purchaseData) {
    const purchases = this.get("purchases") || [];
    const ingredients = this.get("ingredients") || [];

    // Add purchase
    const nextId = `PUR-${100 + purchases.length + 1}`;
    const newPurchase = {
      id: nextId,
      date: new Date().toISOString(),
      items: purchaseData.items, // Array of { ingredientId, quantity, cost }
      totalCost: purchaseData.totalCost,
      supplier: purchaseData.supplier || "Local Supplier"
    };

    // Update stock levels
    for (const item of purchaseData.items) {
      const ingIndex = ingredients.findIndex(i => i.id === item.ingredientId);
      if (ingIndex !== -1) {
        ingredients[ingIndex].stock += Number(item.quantity);
      }
    }

    purchases.unshift(newPurchase);
    this.set("purchases", purchases);
    this.set("ingredients", ingredients);

    // Automatically log this as an expense in 'Raw material' category
    this.createExpense({
      category: "Raw material",
      amount: purchaseData.totalCost,
      description: `Stock Purchase ${nextId} from ${newPurchase.supplier}`
    });

    return { success: true, purchase: newPurchase };
  },

  createExpense(expenseData) {
    const expenses = this.get("expenses") || [];
    const newExpense = {
      id: `EXP-${1000 + expenses.length + 1}`,
      category: expenseData.category || "Other expenses",
      amount: Number(expenseData.amount),
      description: expenseData.description || "",
      createdAt: new Date().toISOString()
    };
    expenses.unshift(newExpense);
    this.set("expenses", expenses);
    return newExpense;
  },

  deleteExpense(expenseId) {
    const expenses = this.get("expenses") || [];
    const filtered = expenses.filter(e => e.id !== expenseId);
    this.set("expenses", filtered);
    return { success: true };
  },

  // Category & Product configuration CRUDs
  saveCategory(catData) {
    const categories = this.get("categories") || [];
    if (catData.id) {
      // Edit
      const index = categories.findIndex(c => c.id === catData.id);
      if (index !== -1) {
        categories[index] = { ...categories[index], ...catData };
      }
    } else {
      // Find max ID number to prevent key conflicts after deletions
      const maxIdNum = categories.reduce((max, c) => {
        const num = parseInt(c.id.replace(/\D/g, ""), 10);
        return isNaN(num) ? max : Math.max(max, num);
      }, 0);
      const newCat = {
        id: `cat${maxIdNum + 1}`,
        name: catData.name,
        icon: catData.icon || "hamburger"
      };
      categories.push(newCat);
    }
    this.set("categories", categories);
    return { success: true };
  },

  deleteCategory(catId) {
    const categories = this.get("categories") || [];
    const filtered = categories.filter(c => c.id !== catId);
    this.set("categories", filtered);

    // Disable products belonging to deleted category
    const products = this.get("products") || [];
    const updatedProducts = products.map(p => {
      if (p.category === catId) {
        return { ...p, available: false };
      }
      return p;
    });
    this.set("products", updatedProducts);
    return { success: true };
  },

  saveProduct(prodData) {
    const products = this.get("products") || [];
    if (prodData.id) {
      // Edit
      const index = products.findIndex(p => p.id === prodData.id);
      if (index !== -1) {
        products[index] = { ...products[index], ...prodData };
      }
    } else {
      // Find max ID number to prevent key conflicts after deletions
      const maxIdNum = products.reduce((max, p) => {
        const num = parseInt(p.id.replace(/\D/g, ""), 10);
        return isNaN(num) ? max : Math.max(max, num);
      }, 0);
      const newProd = {
        id: `p${maxIdNum + 1}`,
        name: prodData.name,
        price: Number(prodData.price),
        ingredientCost: prodData.ingredientCost !== undefined ? Number(prodData.ingredientCost) : null,
        packagingCost: prodData.packagingCost !== undefined ? Number(prodData.packagingCost) : null,
        costPrice: prodData.costPrice !== undefined && prodData.costPrice !== null && prodData.costPrice !== "" ? Number(prodData.costPrice) : null,
        grossProfit: prodData.grossProfit !== undefined ? Number(prodData.grossProfit) : null,
        category: prodData.category,
        subCategory: prodData.subCategory || "Regular",
        available: prodData.available !== undefined ? prodData.available : true,
        veg: prodData.veg !== undefined ? prodData.veg : true,
        recipe: prodData.recipe || {}
      };
      products.push(newProd);
    }
    this.set("products", products);
    return { success: true };
  },

  deleteProduct(prodId) {
    const products = this.get("products") || [];
    const filtered = products.filter(p => p.id !== prodId);
    this.set("products", filtered);
    return { success: true };
  },

  saveIngredient(ingData) {
    const ingredients = this.get("ingredients") || [];
    if (ingData.id) {
      const index = ingredients.findIndex(i => i.id === ingData.id);
      if (index !== -1) {
        ingredients[index] = { ...ingredients[index], ...ingData };
      }
    } else {
      // Find max ID number to prevent key conflicts after deletions
      const maxIdNum = ingredients.reduce((max, i) => {
        const num = parseInt(i.id.replace(/\D/g, ""), 10);
        return isNaN(num) ? max : Math.max(max, num);
      }, 0);
      const newIng = {
        id: `ing${maxIdNum + 1}`,
        name: ingData.name,
        unit: ingData.unit || "pcs",
        stock: Number(ingData.stock) || 0,
        minLimit: Number(ingData.minLimit) || 10
      };
      ingredients.push(newIng);
    }
    this.set("ingredients", ingredients);
    return { success: true };
  },

  deleteIngredient(ingId) {
    const ingredients = this.get("ingredients") || [];
    const filtered = ingredients.filter(i => i.id !== ingId);
    this.set("ingredients", filtered);
    return { success: true };
  }
};

// Expose on window for easy access
window.db = db;

// Database startup: Safe non-destructive load
const TARGET_MENU_VERSION = "crust_chilly_v14";
if (localStorage.getItem("cc_pos_menu_version") !== TARGET_MENU_VERSION) {
  // Update version flag without clearing orders, transactions, or user session
  db.init(false);
  localStorage.setItem("cc_pos_menu_version", TARGET_MENU_VERSION);
  console.log("Crust & Chilly POS: Version verified (" + TARGET_MENU_VERSION + "). All transactional data preserved.");
} else {
  db.init(false); // Ordinary non-destructive load
}
