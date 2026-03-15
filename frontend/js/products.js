document.addEventListener("DOMContentLoaded", () => {
    window.loadLayout("Products");

    const userRole = localStorage.getItem("user_role");

    // Hide manager-only UI immediately
    if (userRole !== "manager") {
        const newBtn = document.getElementById("new-product-btn");
        if (newBtn) newBtn.style.display = "none";
    }

    const tbody = document.getElementById("products-tbody");
    const searchInput = document.getElementById("search-input");
    const spinner = document.getElementById("spinner");

    // Modal Elements
    const modalOverlay = document.getElementById("modal-overlay");
    const modalTitle = document.getElementById("modal-title");
    const modalError = document.getElementById("modal-error");

    // Form Inputs
    const fId = document.getElementById("product-id");
    const fName = document.getElementById("product-name");
    const fSku = document.getElementById("product-sku");
    const fCat = document.getElementById("product-category");
    const fUnit = document.getElementById("product-unit");
    const fReorder = document.getElementById("product-reorder");

    let allProducts = [];

    // Check URL initially
    const urlParams = new URLSearchParams(window.location.search);
    let activeFilter = urlParams.get("filter") || "";

    // Set initial active pill
    document.querySelectorAll(".filter-pill").forEach(pill => {
        if (pill.getAttribute("data-filter") === activeFilter) {
            pill.classList.add("active");
        } else {
            pill.classList.remove("active");
        }
    });

    async function fetchProducts() {
        tbody.innerHTML = "";
        spinner.style.display = "flex";

        let filterParam = "";
        if (activeFilter === "low_stock") {
            filterParam = "?low_stock=true";
        } else if (activeFilter === "out_of_stock") {
            filterParam = "?out_of_stock=true";
        }

        try {
            const res = await window.apiFetch(`/api/products${filterParam}`);
            if (res && res.success) {
                allProducts = res.data;
                applySearchFilter();
            }
        } catch (e) {
            console.error("Failed to load products", e);
        } finally {
            spinner.style.display = "none";
        }
    }

    function renderRows(products) {
        tbody.innerHTML = "";
        const userRole = localStorage.getItem("user_role");

        if (products.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted)">No products found.</td></tr>`;
            return;
        }

        products.forEach(p => {
            const tr = document.createElement("tr");

            const isNoStock = p.on_hand === 0;
            const isLowStock = p.reorder_level > 0 && p.on_hand > 0 && p.on_hand <= p.reorder_level;
            const stockClass = isNoStock ? "no-stock" : (isLowStock ? "low-stock" : "");

            tr.innerHTML = `
                <td>${p.name}</td>
                <td><span style="font-family: monospace; color:var(--text-muted)">${p.sku}</span></td>
                <td>${p.category || '-'}</td>
                <td>${p.unit_of_measure || '-'}</td>
                <td class="${stockClass}">${p.on_hand}</td>
                <td>${p.reorder_level}</td>
                <td>
                    ${userRole === "manager" ? `<button class="btn-icon edit-btn" data-id="${p.id}">✏️ Edit</button>` : ""}
                    <button class="btn-icon stock-btn" data-id="${p.id}">📦 View Stock</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Attach dynamic listeners
        if (userRole === "manager") {
            document.querySelectorAll(".edit-btn").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    const id = parseInt(e.currentTarget.getAttribute("data-id"));
                    const product = allProducts.find(x => x.id === id);
                    if (product) openModal(product);
                });
            });
        }

        document.querySelectorAll(".stock-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const id = e.currentTarget.getAttribute("data-id");
                window.location.href = `product-stock.html?id=${id}`;
            });
        });
    }

    // --- Search Filtering ---
    function applySearchFilter() {
        if (!searchInput) return;
        const val = searchInput.value.toLowerCase();
        const filtered = allProducts.filter(p =>
            p.name.toLowerCase().includes(val) ||
            p.sku.toLowerCase().includes(val)
        );
        renderRows(filtered);
    }

    searchInput.addEventListener("input", applySearchFilter);

    // --- Filter Pills ---
    document.querySelectorAll(".filter-pill").forEach(pill => {
        pill.addEventListener("click", (e) => {
            document.querySelectorAll(".filter-pill").forEach(p => p.classList.remove("active"));
            e.currentTarget.classList.add("active");
            activeFilter = e.currentTarget.getAttribute("data-filter");

            // Optionally update URL so reload keeps filter
            const newUrl = new URL(window.location);
            if (activeFilter) {
                newUrl.searchParams.set("filter", activeFilter);
            } else {
                newUrl.searchParams.delete("filter");
            }
            window.history.replaceState({}, "", newUrl);

            fetchProducts();
        });
    });

    // --- Modal Logic ---
    function openModal(product = null) {
        modalError.style.display = "none";

        if (product) {
            modalTitle.textContent = "Edit Product";
            fId.value = product.id;
            fName.value = product.name;
            fSku.value = product.sku;
            fCat.value = product.category || "";
            fUnit.value = product.unit_of_measure || "";
            fReorder.value = product.reorder_level;
        } else {
            modalTitle.textContent = "New Product";
            fId.value = "";
            fName.value = "";
            fSku.value = "";
            fCat.value = "";
            fUnit.value = "";
            fReorder.value = "0";
        }

        modalOverlay.style.display = "flex";
    }

    function closeModal() {
        modalOverlay.style.display = "none";
    }

    document.getElementById("new-product-btn").addEventListener("click", () => openModal(null));
    document.getElementById("modal-close").addEventListener("click", closeModal);
    document.getElementById("modal-cancel-btn").addEventListener("click", closeModal);

    // Close on overlay click
    modalOverlay.addEventListener("click", (e) => {
        if (e.target === modalOverlay) closeModal();
    });

    // Save Data
    document.getElementById("modal-save-btn").addEventListener("click", async () => {
        modalError.style.display = "none";
        const id = fId.value;
        const payload = {
            name: fName.value.trim(),
            sku: fSku.value.trim(),
            category: fCat.value.trim(),
            unit_of_measure: fUnit.value.trim(),
            reorder_level: parseInt(fReorder.value) || 0
        };

        if (!payload.name || !payload.sku) {
            modalError.textContent = "Name and SKU are required.";
            modalError.style.display = "block";
            return;
        }

        if (!/^\d{6}$/.test(payload.sku)) {
            modalError.textContent = "SKU must be exactly 6 digits.";
            modalError.style.display = "block";
            return;
        }

        try {
            document.getElementById("modal-save-btn").disabled = true;
            document.getElementById("modal-save-btn").textContent = "...";

            const isEdit = id !== "";
            const endpoint = isEdit ? `/api/products/${id}` : `/api/products`;
            const method = isEdit ? "PUT" : "POST";

            const res = await window.apiFetch(endpoint, {
                method: method,
                body: JSON.stringify(payload)
            });

            if (res && res.success) {
                closeModal();
                fetchProducts();
            } else {
                modalError.textContent = res ? res.message : "Error saving product";
                modalError.style.display = "block";
            }
        } catch (e) {
            modalError.textContent = "Network error occurred.";
            modalError.style.display = "block";
        } finally {
            document.getElementById("modal-save-btn").disabled = false;
            document.getElementById("modal-save-btn").textContent = "Save";
        }
    });

    // Init
    fetchProducts();
});
