const API = "https://dummyjson.com";
const PAGE_SIZE = 12;

const $ = id => document.getElementById(id);

let filteredProducts = [];   // منتجات الصفحة الحالية فقط (جاية من الـ API)
let totalProducts = 0;       // إجمالي النتائج على الـ API
let controller = null;       // AbortController للطلب الحالي
const productCache = new Map(); // id -> product (للسلة والـ Wishlist والتفاصيل)
let selectedCategory = "all";
let currentPage = 1;
let searchQuery = "";
let currentProduct = null;

let cart = JSON.parse(localStorage.getItem("searchlyCart")) || [];
let wishlist = JSON.parse(localStorage.getItem("searchlyWishlist")) || [];

// DARK MODE
function initializeTheme() {
    const savedTheme = localStorage.getItem("searchlyTheme");

    if (savedTheme === "dark") {
        document.body.classList.add("dark-mode");
    }

    updateThemeIcon();
}

function updateThemeIcon() {
    const icon = $("themeToggle").querySelector("i");

    if (document.body.classList.contains("dark-mode")) {
        icon.className = "fa-solid fa-sun";
    } else {
        icon.className = "fa-solid fa-moon";
    }
}

$("themeToggle").addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");

    const isDark = document.body.classList.contains("dark-mode");

    localStorage.setItem("searchlyTheme", isDark ? "dark" : "light");

    updateThemeIcon();
});

// TOAST
let toastTimer;

function showToast(message) {
    const toast = $("toast");

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}

// ESCAPE HTML
function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// PRODUCT IMAGE
function getProductImage(product) {
    return product.images?.[0] || product.thumbnail || "";
}

// CATEGORIES
async function getCategories() {
    try {
        const response = await axios.get(`${API}/products/category-list`);

        const categories = response.data;

        $("categoryList").innerHTML = `
            <button class="category-btn active" data-category="all">
                <i class="fa-solid fa-border-all"></i>
                All Products
            </button>

            ${categories.map(category => `
                <button class="category-btn"
                    data-category="${escapeHTML(category)}">
                    ${escapeHTML(category.replaceAll("-", " "))}
                </button>
            `).join("")}
        `;

    } catch (error) {
        console.error(error);

        $("categoryList").innerHTML = `
            <button class="category-btn active" data-category="all">
                All Products
            </button>
        `;
    }
}

// GET PRODUCTS (limit / skip من الـ API + AbortController)
function buildRequest() {
    const params = {
        limit: PAGE_SIZE,
        skip: (currentPage - 1) * PAGE_SIZE
    };

    let path = "/products";

    if (searchQuery) {
        path = "/products/search";
        params.q = searchQuery;
    } else if (selectedCategory !== "all") {
        path = `/products/category/${encodeURIComponent(selectedCategory)}`;
    }

    const sortValue = $("sortFilter").value;

    if (sortValue === "price-low") {
        params.sortBy = "price";
        params.order = "asc";
    } else if (sortValue === "price-high") {
        params.sortBy = "price";
        params.order = "desc";
    } else if (sortValue === "rating") {
        params.sortBy = "rating";
        params.order = "desc";
    }

    return { path, params };
}

async function getProducts() {
    // إلغاء الطلب القديم لو لسه شغال
    if (controller) controller.abort();

    controller = new AbortController();
    const currentController = controller;

    showLoading();

    try {
        const { path, params } = buildRequest();

        const response = await axios.get(`${API}${path}`, {
            params,
            signal: currentController.signal
        });

        filteredProducts = response.data.products;
        totalProducts = response.data.total;

        filteredProducts.forEach(product => productCache.set(product.id, product));

        renderProducts();

    } catch (error) {
        if (axios.isCancel(error)) return; // طلب اتلغى، مفيش خطأ نعرضه

        console.error(error);

        $("loading").classList.add("hidden");
        $("error").classList.remove("hidden");
    }
}

function showLoading() {
    $("loading").classList.remove("hidden");
    $("error").classList.add("hidden");
    $("empty").classList.add("hidden");

    $("productsContainer").innerHTML = "";
    $("pagination").innerHTML = "";
}


// RENDER PRODUCTS
function renderProducts() {
    $("loading").classList.add("hidden");
    $("error").classList.add("hidden");

    $("productsCount").textContent =
        `${totalProducts} products found`;

    if (filteredProducts.length === 0) {
        $("productsContainer").innerHTML = "";
        $("pagination").innerHTML = "";
        $("empty").classList.remove("hidden");
        return;
    }

    $("empty").classList.add("hidden");

    const pageProducts = filteredProducts;

    $("productsContainer").innerHTML = pageProducts.map(product => {
        const isLiked = wishlist.some(item => item.id === product.id);
        const image = getProductImage(product);

        return `
            <article class="product-card">

                <div class="product-image"
                    onclick="openProductDetails(${product.id})">

                    <img
                        src="${escapeHTML(image)}"
                        alt="${escapeHTML(product.title)}"
                        loading="lazy"
                        onerror="
                            this.onerror=null;
                            this.style.display='none';
                            this.parentElement.classList.add('image-error');
                        "
                    >

                    <div class="product-actions">

                        <button class="small-action ${isLiked ? "liked" : ""}"
                            onclick="event.stopPropagation(); toggleWishlist(${product.id})">

                            <i class="${isLiked ? "fa-solid" : "fa-regular"} fa-heart"></i>

                        </button>

                        <button class="small-action"
                            onclick="event.stopPropagation(); openQuickView(${product.id})">

                            <i class="fa-regular fa-eye"></i>

                        </button>

                    </div>
                </div>

                <div class="product-info">

                    <span class="product-category">
                        ${escapeHTML(product.category)}
                    </span>

                    <h3 onclick="openProductDetails(${product.id})">
                        ${escapeHTML(product.title)}
                    </h3>

                    <div class="product-meta">

                        <span class="product-price">
                            $${product.price.toFixed(2)}
                        </span>

                        <span class="product-rating">
                            <i class="fa-solid fa-star"></i>
                            ${product.rating.toFixed(1)}
                        </span>

                    </div>

                    <button class="add-cart-btn"
                        onclick="addToCart(${product.id})">

                        <i class="fa-solid fa-plus"></i>
                        Add to Cart

                    </button>

                </div>
            </article>
        `;
    }).join("");

    renderPagination();
}


// PAGINATION
function renderPagination() {
    const totalPages = Math.ceil(totalProducts / PAGE_SIZE);

    if (totalPages <= 1) {
        $("pagination").innerHTML = "";
        return;
    }

    let html = `
        <button class="page-btn"
            onclick="changePage(${currentPage - 1})"
            ${currentPage === 1 ? "disabled" : ""}>
            <i class="fa-solid fa-chevron-left"></i>
        </button>
    `;

    for (let i = 1; i <= totalPages; i++) {
        html += `
            <button class="page-btn ${currentPage === i ? "active" : ""}"
                onclick="changePage(${i})">
                ${i}
            </button>
        `;
    }

    html += `
        <button class="page-btn"
            onclick="changePage(${currentPage + 1})"
            ${currentPage === totalPages ? "disabled" : ""}>
            <i class="fa-solid fa-chevron-right"></i>
        </button>
    `;

    $("pagination").innerHTML = html;
}

function changePage(page) {
    const totalPages = Math.ceil(totalProducts / PAGE_SIZE);

    if (page < 1 || page > totalPages) return;

    currentPage = page;
    getProducts();

    $("products").scrollIntoView({ behavior: "smooth" });
}

// DEBOUNCE
function debounce(fn, delay = 500) {
    let timer;

    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

function setActiveCategory(category) {
    selectedCategory = category;

    document.querySelectorAll(".category-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.category === category);
    });
}

// CATEGORY CLICK
$("categoryList").addEventListener("click", event => {
    const button = event.target.closest("[data-category]");

    if (!button) return;

    // الـ API مبيدعمش البحث + الفئة مع بعض، فاختيار فئة بيصفّر البحث
    searchQuery = "";
    $("searchInput").value = "";

    setActiveCategory(button.dataset.category);

    currentPage = 1;
    getProducts();
});

// SEARCH (Debounce 500ms)
function runSearch() {
    const query = $("searchInput").value.trim().toLowerCase();

    if (query === searchQuery) return;

    searchQuery = query;

    // البحث بيصفّر الفئة
    if (query) setActiveCategory("all");

    currentPage = 1;
    getProducts();
}

const debouncedSearch = debounce(runSearch, 500);

$("searchForm").addEventListener("submit", event => {
    event.preventDefault();
    runSearch();
});

$("searchInput").addEventListener("input", debouncedSearch);

// SORT
$("sortFilter").addEventListener("change", () => {
    currentPage = 1;
    getProducts();
});

// FIND PRODUCT
function findProduct(id) {
    return productCache.get(id);
}

// PRODUCT DETAILS
function productDetailsHTML(product) {
    const isLiked = wishlist.some(item => item.id === product.id);
    const image = getProductImage(product);

    return `
        <div class="details-layout">

            <div class="details-image">
                <img
                    src="${escapeHTML(image)}"
                    alt="${escapeHTML(product.title)}"
                    onerror="this.onerror=null; this.src='${escapeHTML(product.thumbnail)}'"
                >
            </div>

            <div class="details-info">

                <span class="product-category">
                    ${escapeHTML(product.category)}
                </span>

                <h1>${escapeHTML(product.title)}</h1>

                <div class="product-rating">
                    <i class="fa-solid fa-star"></i>
                    ${product.rating} / 5
                </div>

                <div class="details-price">
                    $${product.price.toFixed(2)}
                </div>

                <p>${escapeHTML(product.description)}</p>

                <p>
                    <strong>Brand:</strong>
                    ${escapeHTML(product.brand || "Not specified")}
                </p>

                <p>
                    <strong>Stock:</strong>
                    ${product.stock}
                </p>

                <div class="details-actions">

                    <button class="primary-btn"
                        onclick="addToCart(${product.id})">

                        <i class="fa-solid fa-bag-shopping"></i>
                        Add to Cart

                    </button>

                    <button class="back-btn"
                        onclick="toggleWishlist(${product.id})">

                        <i class="${isLiked ? "fa-solid" : "fa-regular"} fa-heart"></i>
                        Wishlist

                    </button>

                </div>
            </div>
        </div>
    `;
}

function openProductDetails(id) {
    const product = findProduct(id);

    if (!product) return;

    currentProduct = product;

    $("home").classList.add("hidden");
    $("offers").classList.add("hidden");
    $("products").classList.add("hidden");

    $("detailsContent").innerHTML = productDetailsHTML(product);

    $("productDetails").classList.remove("hidden");

    window.scrollTo({ top: 0, behavior: "smooth" });
}

$("backBtn").addEventListener("click", () => {
    $("productDetails").classList.add("hidden");

    $("home").classList.remove("hidden");
    $("offers").classList.remove("hidden");
    $("products").classList.remove("hidden");
});

// QUICK VIEW
function openQuickView(id) {
    const product = findProduct(id);

    if (!product) return;

    const image = getProductImage(product);

    $("quickViewContent").innerHTML = `
        <div class="quick-layout">
<div class="quick-image">
                <img
                    src="${escapeHTML(image)}"
                    alt="${escapeHTML(product.title)}"
                    onerror="this.onerror=null; this.src='${escapeHTML(product.thumbnail)}'"
                >
            </div>

            <div class="quick-info">

                <span class="product-category">
                    ${escapeHTML(product.category)}
                </span>

                <h2>${escapeHTML(product.title)}</h2>

                <div class="product-rating">
                    <i class="fa-solid fa-star"></i>
                    ${product.rating}
                </div>

                <div class="details-price">
                    $${product.price.toFixed(2)}
                </div>

                <p>${escapeHTML(product.description)}</p>

                <button class="primary-btn"
                    onclick="addToCart(${product.id})">

                    <i class="fa-solid fa-bag-shopping"></i>
                    Add to Cart

                </button>

                <button class="back-btn"
                    onclick="closeQuickView(); openProductDetails(${product.id})">

                    View Full Details

                </button>

            </div>
        </div>
    `;

    $("quickViewOverlay").classList.add("active");
}

function closeQuickView() {
    $("quickViewOverlay").classList.remove("active");
}

$("closeQuickView").addEventListener("click", closeQuickView);

$("quickViewOverlay").addEventListener("click", event => {
    if (event.target === $("quickViewOverlay")) {
        closeQuickView();
    }
});

// CART
function saveCart() {
    localStorage.setItem("searchlyCart", JSON.stringify(cart));
    renderCart();
}

function addToCart(id) {
    const product = findProduct(id);

    if (!product) return;

    const existing = cart.find(item => item.id === id);

    if (existing) {
        existing.quantity++;
    } else {
        cart.push({ ...product, quantity: 1 });
    }

    saveCart();

    showToast("Product added to your cart!");
}

function changeQuantity(id, amount) {
    const item = cart.find(product => product.id === id);

    if (!item) return;

    item.quantity += amount;

    if (item.quantity <= 0) {
        cart = cart.filter(product => product.id !== id);
    }

    saveCart();
}

function removeFromCart(id) {
    cart = cart.filter(product => product.id !== id);

    saveCart();
}

function renderCart() {
    const count = cart.reduce(
        (sum, item) => sum + item.quantity,
        0
    );

    const total = cart.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
    );

    $("cartCount").textContent = count;
    $("cartTotal").textContent = "$" + total.toFixed(2);

    if (!cart.length) {
        $("cartItems").innerHTML = `
            <div class="empty-drawer">
                <i class="fa-solid fa-bag-shopping"></i>
                Your cart is empty.
            </div>
        `;

        return;
    }

    $("cartItems").innerHTML = cart.map(item => `
        <div class="drawer-item">

            <img
                src="${escapeHTML(getProductImage(item))}"
                alt="${escapeHTML(item.title)}"
                onerror="this.onerror=null; this.src='${escapeHTML(item.thumbnail)}'"
            >

            <div>
                <h4>${escapeHTML(item.title)}</h4>

                <p>
                    $${(item.price * item.quantity).toFixed(2)}
                </p>

                <div class="quantity-controls">

                    <button onclick="changeQuantity(${item.id}, -1)">-</button>

                    <span>${item.quantity}</span>

                    <button onclick="changeQuantity(${item.id}, 1)">+</button>

                </div>
            </div>

            <button class="remove-btn"
                onclick="removeFromCart(${item.id})">

                <i class="fa-solid fa-trash"></i>

            </button>

        </div>
    `).join("");
}

// WISHLIST
function saveWishlist() {
    localStorage.setItem(
        "searchlyWishlist",
        JSON.stringify(wishlist)
    );

    renderWishlist();
    renderProducts();
}

function toggleWishlist(id) {
    const product = findProduct(id);

    if (!product) return;

    const exists = wishlist.some(item => item.id === id);

    if (exists) {
        wishlist = wishlist.filter(item => item.id !== id);
        showToast("Removed from wishlist");
    } else {
        wishlist.push(product);
        showToast("Added to wishlist!");
    }

    saveWishlist();

    if (
        currentProduct?.id === id &&
        !$("productDetails").classList.contains("hidden")
    ) {
        $("detailsContent").innerHTML = productDetailsHTML(product);
    }
}

function removeFromWishlist(id) {
    wishlist = wishlist.filter(item => item.id !== id);

    saveWishlist();
}

function renderWishlist() {
    $("wishlistCount").textContent = wishlist.length;

    if (!wishlist.length) {
        $("wishlistItems").innerHTML = `
            <div class="empty-drawer">
                <i class="fa-regular fa-heart"></i>
                Your wishlist is empty.
            </div>
        `;

        return;
    }

    $("wishlistItems").innerHTML = wishlist.map(item => `
        <div class="drawer-item">

            <img
                src="${escapeHTML(getProductImage(item))}"
                alt="${escapeHTML(item.title)}"
                onerror="this.onerror=null; this.src='${escapeHTML(item.thumbnail)}'"
            >

            <div>
                <h4>${escapeHTML(item.title)}</h4>

                <p>$${item.price.toFixed(2)}</p>

                <button class="remove-btn"
                    onclick="addToCart(${item.id})">
                    Add to Cart
                </button>
            </div>

            <button class="remove-btn"
                onclick="removeFromWishlist(${item.id})">

                <i class="fa-solid fa-trash"></i>

            </button>

        </div>
    `).join("");
}

// DRAWERS
function openDrawer(drawerId, overlayId) {
    $(drawerId).classList.add("active");
    $(overlayId).classList.add("active");
}

function closeDrawer(drawerId, overlayId) {
    $(drawerId).classList.remove("active");
    $(overlayId).classList.remove("active");
}

$("cartBtn").addEventListener("click", () => {
    openDrawer("cartDrawer", "cartOverlay");
});

$("closeCart").addEventListener("click", () => {
    closeDrawer("cartDrawer", "cartOverlay");
});

$("cartOverlay").addEventListener("click", () => {
    closeDrawer("cartDrawer", "cartOverlay");
});

$("wishlistBtn").addEventListener("click", () => {
    openDrawer("wishlistDrawer", "wishlistOverlay");
});

$("closeWishlist").addEventListener("click", () => {
    closeDrawer("wishlistDrawer", "wishlistOverlay");
});

$("wishlistOverlay").addEventListener("click", () => {
    closeDrawer("wishlistDrawer", "wishlistOverlay");
});

// CHECKOUT
$("checkoutBtn").addEventListener("click", () => {
    if (!cart.length) {
        showToast("Your cart is empty!");
        return;
    }

    alert("Thank you for shopping with Searchly! This is a demo checkout.");

    cart = [];

    saveCart();

    closeDrawer("cartDrawer", "cartOverlay");
});

// RETRY
$("retryBtn").addEventListener("click", getProducts);

// INITIALIZE
async function initializeApp() {
    initializeTheme();

    renderCart();
    renderWishlist();

    await getCategories();
    await getProducts();
}

initializeApp();