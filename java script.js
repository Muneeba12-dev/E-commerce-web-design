/* =========================================================
   ECOMMERCE FRONTEND — script.js
   Works across: index.html, products.html, product-details.html
   No dependencies. Vanilla JS only.
   ========================================================= */

/* ---------------------------
   0) Small Utilities
----------------------------*/
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const on = (el, evt, cb) => el && el.addEventListener(evt, cb);
const fmt = (n) => `$${Number(n).toFixed(2)}`;
const getParam = (key) => new URLSearchParams(location.search).get(key);
const storage = {
  get: (k, fallback) => {
    try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; }
  },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v))
};

/* ---------------------------
   1) Sample Catalog (extend as needed)
   You can replace images with your own in /assets/products/
----------------------------*/
const CATEGORIES = {
  electronics: "Electronics",
  fashion: "Fashion",
  cameras: "Cameras",
  audio: "Audio",
  watches: "Watches"
};

const BRANDS = ["Apple", "Samsung", "Huawei", "Canon", "LogiSound", "Generic"];

const catalog = [
  { id: 1,  name: "Smart Watch Pro",     price: 199,  brand: "Generic",  category: "watches",    rating: 4.5, image: "assets/products/product1.jpg" },
  { id: 2,  name: "Laptop Pro 15",       price: 1199, brand: "Generic",  category: "electronics",rating: 4.7, image: "assets/products/product2.jpg" },
  { id: 3,  name: "Canon EOS 2000",      price: 780,  brand: "Canon",    category: "cameras",    rating: 4.4, image: "assets/products/product3.jpg" },
  { id: 4,  name: "Headphones X100",     price: 150,  brand: "LogiSound",category: "audio",      rating: 4.2, image: "assets/products/product4.jpg" },
  { id: 5,  name: "iPhone 14",           price: 999,  brand: "Apple",    category: "electronics",rating: 4.8, image: "assets/products/product5.jpg" },
  { id: 6,  name: "Galaxy S23",          price: 949,  brand: "Samsung",  category: "electronics",rating: 4.6, image: "assets/products/product6.jpg" },
  { id: 7,  name: "Huawei Watch Fit",    price: 169,  brand: "Huawei",   category: "watches",    rating: 4.1, image: "assets/products/product7.jpg" },
  { id: 8,  name: "Mirrorless Alpha Z",  price: 1128, brand: "Generic",  category: "cameras",    rating: 4.3, image: "assets/products/product8.jpg" },
  { id: 9,  name: "Studio Headset",      price: 98,   brand: "LogiSound",category: "audio",      rating: 4.0, image: "assets/products/product9.jpg" },
  { id: 10, name: "MacBook Air 13",      price: 1299, brand: "Apple",    category: "electronics",rating: 4.9, image: "assets/products/product10.jpg" },
];

/* ---------------------------
   2) Toast (lightweight)
----------------------------*/
function toast(message) {
  let t = $("#toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.style.cssText = `
      position:fixed;right:24px;bottom:24px;padding:12px 16px;
      background:#111;color:#fff;border-radius:8px;opacity:0;
      transform:translateY(8px);transition:all .25s ease;z-index:9999;
      box-shadow:0 8px 24px rgba(0,0,0,.15);font:14px/1.2 system-ui,Segoe UI,Arial;
    `;
    document.body.appendChild(t);
  }
  t.textContent = message;
  requestAnimationFrame(() => {
    t.style.opacity = "1";
    t.style.transform = "translateY(0)";
  });
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transform = "translateY(8px)";
  }, 1600);
}

/* ---------------------------
   3) Cart (localStorage)
----------------------------*/
const CART_KEY = "ec_cart";
function getCart() { return storage.get(CART_KEY, []); }
function setCart(items) { storage.set(CART_KEY, items); updateCartBadge(); }
function addToCart(productId, qty = 1, size = null) {
  const cart = getCart();
  const idx = cart.findIndex(i => i.id === productId && i.size === size);
  if (idx > -1) cart[idx].qty += qty;
  else cart.push({ id: productId, qty, size });
  setCart(cart);
  const p = catalog.find(x => x.id === productId);
  toast(`Added to cart: ${p ? p.name : "Item"}`);
}
function cartCount() {
  return getCart().reduce((sum, i) => sum + i.qty, 0);
}
function updateCartBadge() {
  const badge = $("#cart-count");
  if (badge) badge.textContent = cartCount();
}

/* ---------------------------
   4) Header Search (all pages)
----------------------------*/
function initHeaderSearch() {
  const input = $("#searchInput");
  const btn = $("#searchBtn");
  const select = $(".search-bar select");

  const doSearch = () => {
    const q = (input?.value || "").trim();
    const cat = select?.value || "all";
    // If we are on products page, filter in place via event
    if ($("#productList")) {
      document.dispatchEvent(new CustomEvent("search:update", { detail: { q, cat } }));
    } else {
      // Navigate to products with querystring (works even from home)
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (cat && cat !== "all") params.set("cat", cat);
      location.href = `products.html?${params.toString()}`;
    }
  };

  on(btn, "click", doSearch);
  on(input, "keydown", (e) => {
    if (e.key === "Enter") doSearch();
  });
}

/* ---------------------------
   5) Home Page: Featured
----------------------------*/
function initHomeFeatured() {
  const grid = $("#featuredProducts");
  if (!grid) return;

  const featured = catalog.slice(0, 6); // pick first 6 as “deals”
  grid.innerHTML = featured.map(cardHtml).join("");

  // Delegate clicks for “Buy Now”
  on(grid, "click", (e) => {
    const card = e.target.closest("[data-card]");
    if (!card) return;
    if (e.target.matches("[data-details]")) {
      const id = Number(card.dataset.id);
      location.href = `product-details.html?id=${id}`;
    }
  });
}

/* ---------------------------
   6) Products Listing
   - Filters, Sort, Pagination, Search syncing
----------------------------*/
const PAGE_SIZE = 8;

const listState = {
  q: "", cat: "all", brands: new Set(), maxPrice: null, sort: "relevance",
  page: 1
};

function initListing() {
  const listEl = $("#productList");
  if (!listEl) return;

  // Wire filters if present
  // Category checkboxes: <input type="checkbox" value="electronics" data-filter="category">
  $$('input[data-filter="category"]').forEach(cb => {
    on(cb, "change", () => {
      // Support multiple categories: choose first selected, else all
      const checked = $$('input[data-filter="category"]:checked').map(i => i.value);
      listState.cat = checked[0] || "all";
      listState.page = 1;
      renderList();
    });
  });

  // Brand checkboxes: <input type="checkbox" value="Apple" data-filter="brand">
  $$('input[data-filter="brand"]').forEach(cb => {
    on(cb, "change", () => {
      listState.brands = new Set($$('input[data-filter="brand"]:checked').map(i => i.value));
      listState.page = 1;
      renderList();
    });
  });

  // Price range: <input type="range" id="priceRange" min="50" max="2000">
  const priceRange = $("#priceRange");
  const priceOut = $("#priceOut");
  if (priceRange) {
    const setPrice = () => {
      listState.maxPrice = Number(priceRange.value);
      if (priceOut) priceOut.textContent = `Up to ${fmt(listState.maxPrice)}`;
      listState.page = 1;
      renderList();
    };
    on(priceRange, "input", setPrice);
    setPrice(); // initialize
  }

  // Sorting: <select id="sortSelect"><option value="relevance|price_asc|price_desc|name_asc"></select>
  const sortSelect = $("#sortSelect");
  on(sortSelect, "change", () => {
    listState.sort = sortSelect.value;
    listState.page = 1;
    renderList();
  });

  // Read initial query from URL (q, cat)
  const q = getParam("q");
  if (q) listState.q = q;
  const cat = getParam("cat");
  if (cat) listState.cat = cat;

  // Listen to header search updates (if searching on the same page)
  document.addEventListener("search:update", (e) => {
    listState.q = e.detail.q || "";
    listState.cat = e.detail.cat || "all";
    listState.page = 1;
    renderList();
  });

  // First render
  renderList();

  // Pagination clicks
  on(document, "click", (e) => {
    const btn = e.target.closest("[data-page]");
    if (!btn) return;
    listState.page = Number(btn.dataset.page);
    renderList();
  });

  // Navigate to details on card “View Details” click
  on(listEl, "click", (e) => {
    const card = e.target.closest("[data-card]");
    if (!card) return;
    if (e.target.matches("[data-details]")) {
      const id = Number(card.dataset.id);
      location.href = `product-details.html?id=${id}`;
    }
  });
}

function applyFilters(items) {
  let out = [...items];

  // Text query
  if (listState.q) {
    const q = listState.q.toLowerCase();
    out = out.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      CATEGORIES[p.category]?.toLowerCase().includes(q)
    );
  }

  // Category
  if (listState.cat !== "all") {
    out = out.filter(p => p.category === listState.cat);
  }

  // Brands
  if (listState.brands.size) {
    out = out.filter(p => listState.brands.has(p.brand));
  }

  // Max price
  if (typeof listState.maxPrice === "number" && !Number.isNaN(listState.maxPrice)) {
    out = out.filter(p => p.price <= listState.maxPrice);
  }

  // Sort
  switch (listState.sort) {
    case "price_asc":  out.sort((a,b)=>a.price-b.price); break;
    case "price_desc": out.sort((a,b)=>b.price-a.price); break;
    case "name_asc":   out.sort((a,b)=>a.name.localeCompare(b.name)); break;
    default: /* relevance/basic */ break;
  }

  return out;
}

function paginate(items, page, pageSize) {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pages);
  const start = (current - 1) * pageSize;
  const slice = items.slice(start, start + pageSize);
  return { slice, current, pages, total };
}

function renderList() {
  const listEl = $("#productList");
  if (!listEl) return;

  const filtered = applyFilters(catalog);
  const { slice, current, pages, total } = paginate(filtered, listState.page, PAGE_SIZE);

  // Cards
  listEl.innerHTML = slice.map(cardHtml).join("");

  // Summary + Pagination (if you have containers)
  const summary = $("#listSummary");
  if (summary) {
    const start = (current - 1) * PAGE_SIZE + 1;
    const end = Math.min(start + PAGE_SIZE - 1, total);
    summary.textContent = total
      ? `Showing ${start}-${end} of ${total} products`
      : `No products found`;
  }

  const pager = $("#pager");
  if (pager) {
    pager.innerHTML = renderPager(current, pages);
  }
}

function renderPager(current, pages) {
  if (pages <= 1) return "";
  let html = `<button data-page="${Math.max(1, current-1)}" ${current===1?"disabled":""}>Prev</button>`;
  for (let p = 1; p <= pages; p++) {
    html += `<button data-page="${p}" ${p===current?"disabled":""}>${p}</button>`;
  }
  html += `<button data-page="${Math.min(pages, current+1)}" ${current===pages?"disabled":""}>Next</button>`;
  return html;
}

/* ---------------------------
   7) Product Details Page
----------------------------*/
function initDetails() {
  const detailsRoot = $(".product-details");
  if (!detailsRoot) return;

  const id = Number(getParam("id"));
  const product = catalog.find(p => p.id === id) || catalog[0]; // fallback

  // Fill content (works with your markup)
  const img = $(".product-image img", detailsRoot);
  const title = $(".product-info h2", detailsRoot);
  const price = $(".product-info .price", detailsRoot);
  const desc = $(".product-info p:not(.price)", detailsRoot);

  if (img && product.image) img.src = product.image;
  if (title) title.textContent = product.name;
  if (price) price.textContent = fmt(product.price);
  if (desc)  desc.textContent = `${product.name} with premium features. Brand: ${product.brand}. Category: ${CATEGORIES[product.category] || product.category}.`;

  // Add to cart (with size if present)
  const addBtn = $(".add-cart", detailsRoot);
  const sizeSel = $("#size", detailsRoot);
  on(addBtn, "click", () => {
    const size = sizeSel ? sizeSel.value : null;
    addToCart(product.id, 1, size);
  });

  // Render related (simple: same category)
  const relWrap = $("#related");
  if (relWrap) {
    const related = catalog.filter(p => p.category === product.category && p.id !== product.id).slice(0, 4);
    relWrap.innerHTML = related.map(cardHtml).join("");
    on(relWrap, "click", (e) => {
      const card = e.target.closest("[data-card]");
      if (!card) return;
      if (e.target.matches("[data-details]")) {
        const pid = Number(card.dataset.id);
        location.href = `product-details.html?id=${pid}`;
      }
    });
  }
}

/* ---------------------------
   8) Card Template
----------------------------*/
function cardHtml(p) {
  return `
    <article class="card" data-card data-id="${p.id}" tabindex="0" aria-label="${p.name}">
      <img src="${p.image}" alt="${p.name}" loading="lazy">
      <h4>${p.name}</h4>
      <div class="meta">
        <span class="price">${fmt(p.price)}</span>
        <span class="rating" aria-label="rating ${p.rating}">★ ${p.rating.toFixed(1)}</span>
      </div>
      <div class="actions">
        <button class="btn-primary" data-details>View Details</button>
      </div>
    </article>
  `;
}

/* ---------------------------
   9) Init on DOM Ready
----------------------------*/
document.addEventListener("DOMContentLoaded", () => {
  updateCartBadge();
  initHeaderSearch();
  initHomeFeatured();
  initListing();
  initDetails();
});
