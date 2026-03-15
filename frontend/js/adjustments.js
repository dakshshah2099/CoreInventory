document.addEventListener("DOMContentLoaded", async () => {
    window.loadLayout("Adjustments");

    const userRole = localStorage.getItem("user_role");

    // Block staff
    if (userRole !== "manager") {
        document.querySelector(".page-content").innerHTML = "<h2>Access Denied</h2><p>Only managers can perform stock adjustments.</p>";
        return;
    }

    const successBanner = document.getElementById("success-banner");
    const errorBanner = document.getElementById("error-banner");
    const successText = document.getElementById("success-text");
    const errorText = document.getElementById("error-text");
    const currentStockInput = document.getElementById("current-stock");
    const newQtyInput = document.getElementById("new-quantity");
    const adjBtn = document.getElementById("adjust-btn");
    const tbody = document.getElementById("adj-tbody");
    const tableEl = document.getElementById("adj-table");
    const emptyState = document.getElementById("empty-state");

    let productsData = [];
    let warehousesData = [];
    let locationsData = [];
    let warehouseSelect, productSelect, locationSelect;

    function showSuccess(msg) {
        successText.textContent = `✅ ${msg}`;
        successBanner.style.display = "flex";
        errorBanner.style.display = "none";
        setTimeout(() => { successBanner.style.display = "none"; }, 4000);
    }

    function showError(msg) {
        errorText.textContent = `❌ ${msg}`;
        errorBanner.style.display = "flex";
        successBanner.style.display = "none";
        setTimeout(() => { errorBanner.style.display = "none"; }, 4000);
    }

    function getLocationOptions(whId) {
        if (!whId || isNaN(whId)) return [];
        return locationsData.filter(l => l.warehouse_id === whId).map(l => ({
            value: String(l.id), label: l.name
        }));
    }

    // --- Load data ---
    try {
        const [prodRes, whRes] = await Promise.all([
            window.apiFetch("/api/products"),
            window.apiFetch("/api/warehouses")
        ]);

        if (prodRes && prodRes.success) productsData = prodRes.data;
        if (whRes && whRes.success) {
            warehousesData = whRes.data;
            locationsData = warehousesData.flatMap(w => w.locations || []);
        }
    } catch (e) {
        showError("Failed to load reference data.");
        return;
    }

    // Warehouse searchable select
    warehouseSelect = new SearchableSelect(document.getElementById("adj-warehouse-container"), {
        placeholder: "Search warehouse...",
        options: warehousesData.map(w => ({ value: String(w.id), label: w.name })),
        onSelect: (value) => {
            locationSelect.setOptions(getLocationOptions(parseInt(value)));
            locationSelect.clear();
            currentStockInput.value = "—";
        }
    });

    // Product searchable select
    productSelect = new SearchableSelect(document.getElementById("adj-product-container"), {
        placeholder: "Search product...",
        options: productsData.map(p => ({ value: String(p.id), label: `[${p.sku}] ${p.name}` })),
        onSelect: () => { fetchCurrentStock(); }
    });

    // Location searchable select
    locationSelect = new SearchableSelect(document.getElementById("adj-location-container"), {
        placeholder: "Search location...",
        options: [],
        onSelect: () => { fetchCurrentStock(); }
    });

    // Fetch current stock when both product and location are selected
    async function fetchCurrentStock() {
        const productId = productSelect.getValue();
        const locationId = locationSelect.getValue();

        if (!productId || !locationId) {
            currentStockInput.value = "—";
            return;
        }

        try {
            const res = await window.apiFetch(`/api/adjustments/stock?product_id=${productId}&location_id=${locationId}`);
            if (res && res.success) {
                currentStockInput.value = res.quantity;
            } else {
                currentStockInput.value = "0";
            }
        } catch (e) {
            currentStockInput.value = "?";
        }
    }

    // Save adjustment with confirmation
    adjBtn.addEventListener("click", async () => {
        const productId = productSelect.getValue();
        const locationId = locationSelect.getValue();
        const newQty = parseInt(newQtyInput.value);

        if (!productId) { showError("Please select a product."); return; }
        if (!locationId) { showError("Please select a location."); return; }
        if (isNaN(newQty) || newQty < 0) { showError("Please enter a valid non-negative quantity."); return; }

        const currentQty = currentStockInput.value;
        const delta = newQty - parseInt(currentQty || 0);
        const deltaStr = delta >= 0 ? `+${delta}` : `${delta}`;

        if (!confirm(`⚠️ Stock Override Confirmation\n\nCurrent: ${currentQty}\nNew: ${newQty} (${deltaStr})\n\nAre you sure you want to adjust this stock level?`)) {
            return;
        }

        adjBtn.disabled = true;
        adjBtn.textContent = "Saving...";

        try {
            const res = await window.apiFetch("/api/adjustments", {
                method: "POST",
                body: JSON.stringify({
                    product_id: parseInt(productId),
                    location_id: parseInt(locationId),
                    new_quantity: newQty
                })
            });

            if (res && res.success) {
                showSuccess(res.message);
                currentStockInput.value = newQty;
                newQtyInput.value = "";
                loadRecentAdjustments();
            } else {
                showError(res ? res.message : "Failed to save adjustment.");
            }
        } catch (e) {
            showError("Network error.");
        } finally {
            adjBtn.disabled = false;
            adjBtn.textContent = "💾 Save Adjustment";
        }
    });

    // Load recent adjustments (stock moves of type adjustment)
    async function loadRecentAdjustments() {
        tbody.innerHTML = "";
        try {
            const res = await window.apiFetch("/api/moves?move_type=adjustment");
            if (res && res.success && res.data.length > 0) {
                tableEl.style.display = "table";
                emptyState.style.display = "none";
                res.data.forEach(m => {
                    const tr = document.createElement("tr");
                    const dt = new Date(m.created_at);
                    const dtStr = `${dt.toLocaleDateString()} ${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

                    // Determine direction: to_location means increase, from_location means decrease
                    const isIncrease = !!m.to_location_name;
                    const sign = isIncrease ? "+" : "-";
                    const color = isIncrease ? "#16a34a" : "#dc2626";

                    tr.innerHTML = `
                        <td style="color:var(--text-muted); font-size: 0.85rem">${dtStr}</td>
                        <td style="font-weight:600;">${m.product_name}</td>
                        <td>${m.from_location_name || m.to_location_name || '-'}</td>
                        <td style="font-weight:bold; color: ${color}">${sign}${m.quantity}</td>
                        <td><span class="badge" style="background-color: #ca8a04">Adjustment</span></td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                tableEl.style.display = "none";
                emptyState.style.display = "block";
            }
        } catch (e) {
            tableEl.style.display = "none";
            emptyState.style.display = "block";
        }
    }

    loadRecentAdjustments();
});
