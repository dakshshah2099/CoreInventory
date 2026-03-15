document.addEventListener("DOMContentLoaded", async () => {
    // 1. Read URL Params
    const urlParams = new URLSearchParams(window.location.search);
    const opType = urlParams.get("type"); // receipt or delivery
    const opId = urlParams.get("id"); // optional ID
    const userRole = localStorage.getItem("user_role");

    if (!opType || (opType !== "receipt" && opType !== "delivery")) {
        document.getElementById("page-title").textContent = "Invalid Operation Type";
        document.getElementById("spinner").style.display = "none";
        return;
    }

    const isEdit = !!opId;
    const capType = opType.charAt(0).toUpperCase() + opType.slice(1);
    const pageTitleText = isEdit ? `Edit ${capType}` : `New ${capType}`;

    window.loadLayout(opType === "receipt" ? "Receipts" : "Deliveries");

    // Staff enforcement — runs before anything else
    if (userRole !== "manager") {
        // Show staff info bar
        const infoBar = document.getElementById("staff-info-bar");
        if (infoBar) infoBar.style.display = "block";

        // Hide manager-only buttons
        const saveBtn = document.getElementById("save-btn");
        const cancelBtn = document.getElementById("cancel-btn");
        if (saveBtn) saveBtn.style.display = "none";
        if (cancelBtn) cancelBtn.style.display = "none";

        // Make all form inputs read-only
        document.querySelectorAll(".input-field").forEach(input => {
            input.setAttribute("disabled", "true");
        });

        // Disable add product row button
        const addRowBtn = document.getElementById("add-line-btn");
        if (addRowBtn) addRowBtn.style.display = "none";
    }

    // If staff and no id (trying to create new) — block entirely
    if (userRole !== "manager" && !opId) {
        alert("Staff cannot create new operations.");
        const redirectPage = opType === "receipt" ? "receipts.html" : "deliveries.html";
        window.location.href = `/app/pages/${redirectPage}`;
        return;
    }

    document.getElementById("page-title").textContent = pageTitleText;
    document.getElementById("partner-label").textContent = opType === "receipt" ? "Supplier" : "Customer";

    // DOM Elements
    const spinner = document.getElementById("spinner");
    const formContent = document.getElementById("form-content");
    const actionBar = document.getElementById("action-bar");
    const partnerInput = document.getElementById("partner-input");
    const dateInput = document.getElementById("date-input");
    const statusInput = document.getElementById("status-input");
    const linesTbody = document.getElementById("lines-tbody");

    const successBanner = document.getElementById("success-banner");
    const errorBanner = document.getElementById("error-banner");
    const errorText = document.getElementById("error-text");

    let productsData = [];
    let warehousesData = [];
    let locationsData = [];
    let warehouseSelect = null; // SearchableSelect instance

    // --- Banner Helpers ---
    function showSuccess(msg = "Validated successfully") {
        successBanner.querySelector("span").textContent = `✅ ${msg}`;
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
            value: String(l.id),
            label: l.name
        }));
    }

    function getProductOptions() {
        return productsData.map(p => ({
            value: String(p.id),
            label: `[${p.sku}] ${p.name}`
        }));
    }

    function getWarehouseOptions() {
        return warehousesData.map(w => ({
            value: String(w.id),
            label: w.name
        }));
    }

    // --- Loading Logic ---
    try {
        const prodRes = await window.apiFetch("/api/products");
        if (prodRes && prodRes.success) {
            productsData = prodRes.data;
        }

        const whRes = await window.apiFetch("/api/warehouses");

        if (whRes && whRes.success) {
            warehousesData = whRes.data;
            locationsData = warehousesData.flatMap(w => w.locations || []);
        }

        // Populate Warehouse via SearchableSelect
        const whContainer = document.getElementById("warehouse-input-container");
        warehouseSelect = new SearchableSelect(whContainer, {
            placeholder: "Search warehouse...",
            options: getWarehouseOptions(),
            disabled: userRole !== "manager",
            onSelect: (value) => {
                const whId = parseInt(value);
                // Update all existing location searchable selects
                document.querySelectorAll(".line-row").forEach(tr => {
                    const locSS = tr._locationSS;
                    if (locSS) {
                        locSS.setOptions(getLocationOptions(whId));
                        locSS.clear();
                    }
                });
            }
        });

        if (isEdit) {
            // Fetch existing operation
            const apiBasePath = opType === "receipt" ? "/api/receipts" : "/api/deliveries";
            const opRes = await window.apiFetch(`${apiBasePath}/${opId}`);
            if (opRes && opRes.success) {
                const data = opRes.data;

                // Set fields
                partnerInput.value = opType === "receipt" ? (data.supplier || "") : (data.customer || "");
                if (data.scheduled_date) {
                    dateInput.value = data.scheduled_date.split("T")[0]; // YYYY-MM-DD
                }
                // If it's a legacy done/cancelled, we still need the value to be correct in the dropdown visually
                if (data.status === "done" || data.status === "cancelled") {
                    const extraOpt = document.createElement("option");
                    extraOpt.value = data.status;
                    extraOpt.textContent = data.status === "done" ? "Done" : "Cancelled";
                    statusInput.appendChild(extraOpt);
                }
                statusInput.value = data.status || "draft";

                // Set Warehouse
                if (data.warehouse_id) {
                    warehouseSelect.setValue(String(data.warehouse_id));
                }

                // Add rows
                if (data.lines && data.lines.length > 0) {
                    data.lines.forEach(line => addProductRow(line.product_id, line.quantity, line.location_id));
                } else {
                    addProductRow(); // Add empty row if none
                }

                // Handle Validate and Cancel Button visibility
                if (data.status === "draft" || data.status === "waiting" || data.status === "ready") {
                    document.getElementById("validate-btn").style.display = "inline-block";
                    if (userRole === "manager") {
                        document.getElementById("cancel-btn").style.display = "inline-block";
                    }
                }

                // Disable entire form if done or cancelled
                if (data.status === "done" || data.status === "cancelled") {
                    partnerInput.disabled = true;
                    dateInput.disabled = true;
                    statusInput.disabled = true;
                    warehouseSelect.setDisabled(true);
                    document.getElementById("add-line-btn").style.display = "none";
                    document.getElementById("save-btn").style.display = "none";
                }

            } else {
                showError("Failed to load operation data.");
            }
        } else {
            // New Form initialization
            addProductRow();
        }

        spinner.style.display = "none";
        formContent.style.display = "block";
        actionBar.style.display = "flex";

    } catch (e) {
        console.error(e);
        showError("Network error occurred while loading form.");
        spinner.style.display = "none";
        return; // Halt logic
    }

    // --- Dynamic Line Rows ---
    function addProductRow(productId = null, quantity = 1, locationId = null) {
        const tr = document.createElement("tr");
        tr.className = "line-row";

        const isDisabled = userRole !== 'manager';

        // Product cell
        const productTd = document.createElement("td");
        const productContainer = document.createElement("div");
        const productSS = new SearchableSelect(productContainer, {
            placeholder: "Search product...",
            options: getProductOptions(),
            disabled: isDisabled
        });
        if (productId) productSS.setValue(String(productId));
        productTd.appendChild(productContainer);

        // Location cell
        const locationTd = document.createElement("td");
        const locationContainer = document.createElement("div");
        locationContainer.style.minWidth = "140px";
        const whId = warehouseSelect ? parseInt(warehouseSelect.getValue()) : null;
        const locationSS = new SearchableSelect(locationContainer, {
            placeholder: "Search location...",
            options: getLocationOptions(whId),
            disabled: isDisabled
        });
        if (locationId) locationSS.setValue(String(locationId));
        locationTd.appendChild(locationContainer);

        // Quantity cell
        const qtyTd = document.createElement("td");
        const qtyInput = document.createElement("input");
        qtyInput.type = "number";
        qtyInput.min = "1";
        qtyInput.className = "qty-input line-quantity";
        qtyInput.value = quantity;
        qtyInput.required = true;
        if (isDisabled) qtyInput.disabled = true;
        qtyTd.appendChild(qtyInput);

        // Remove cell
        const removeTd = document.createElement("td");
        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "btn-icon remove-row-btn";
        removeBtn.style.cssText = `color:var(--accent); font-weight:bold; ${isDisabled ? 'display:none;' : ''}`;
        removeBtn.textContent = "✕";
        removeBtn.addEventListener("click", () => tr.remove());
        removeTd.appendChild(removeBtn);

        tr.appendChild(productTd);
        tr.appendChild(locationTd);
        tr.appendChild(qtyTd);
        tr.appendChild(removeTd);

        // Store SS references on the row element for retrieval
        tr._productSS = productSS;
        tr._locationSS = locationSS;

        linesTbody.appendChild(tr);
    }

    document.getElementById("add-line-btn").addEventListener("click", () => {
        addProductRow();
    });

    // --- Save Logic ---
    document.getElementById("save-btn").addEventListener("click", async () => {
        // Collect Lines
        const lines = [];
        let validationFailed = false;

        document.querySelectorAll("#lines-tbody .line-row").forEach(tr => {
            const pId = tr._productSS.getValue();
            const lId = tr._locationSS.getValue();
            const qty = parseInt(tr.querySelector(".line-quantity").value);

            if (!pId || !lId || isNaN(qty) || qty < 1) {
                validationFailed = true;
            } else {
                lines.push({ product_id: parseInt(pId), location_id: parseInt(lId), quantity: qty });
            }
        });

        if (lines.length === 0) {
            showError("You must add at least one line item.");
            return;
        }

        if (validationFailed) {
            showError("Please fill out all product lines with valid quantities.");
            return;
        }

        if (!dateInput.value) {
            showError("You must select a Scheduled Date.");
            return;
        }

        const wh_id = warehouseSelect ? parseInt(warehouseSelect.getValue()) : null;
        if (!wh_id || isNaN(wh_id)) {
            showError("You must select a target warehouse.");
            return;
        }

        const payload = {
            scheduled_date: dateInput.value || null,
            status: statusInput.value,
            warehouse_id: wh_id,
            lines: lines
        };

        if (opType === "receipt") payload.supplier = partnerInput.value;
        if (opType === "delivery") payload.customer = partnerInput.value;

        const btn = document.getElementById("save-btn");
        const originText = btn.textContent;
        btn.disabled = true;
        btn.textContent = "...";

        try {
            const apiBasePath = opType === "receipt" ? "/api/receipts" : "/api/deliveries";
            const endpoint = isEdit ? `${apiBasePath}/${opId}` : apiBasePath;
            const method = isEdit ? "PUT" : "POST";

            const res = await window.apiFetch(endpoint, {
                method: method,
                body: JSON.stringify(payload)
            });

            if (res && res.success) {
                if (!isEdit) {
                    // Redirect to the newly created edit page
                    window.location.href = `operation-form.html?type=${opType}&id=${res.data.id}`;
                } else {
                    showSuccess("Saved successfully");
                    // Refresh if Validate should appear or hide
                    if (res.data.status !== "done" && res.data.status !== "cancelled") {
                        document.getElementById("validate-btn").style.display = "inline-block";
                    }
                }
            } else {
                showError(res ? res.message : "Failed to save.");
            }
        } catch (e) {
            showError("Network error while saving.");
        } finally {
            btn.disabled = false;
            btn.textContent = originText;
        }
    });

    // --- Validate Logic ---
    const validateBtn = document.getElementById("validate-btn");
    if (validateBtn) {
        validateBtn.addEventListener("click", async () => {
            if (!isEdit) return; // cannot validate an unsaved record

            validateBtn.disabled = true;
            validateBtn.textContent = "Validating...";

            try {
                const apiBasePath = opType === "receipt" ? "/api/receipts" : "/api/deliveries";
                const res = await window.apiFetch(`${apiBasePath}/${opId}/validate`, {
                    method: "PUT"
                });

                if (res && res.success) {
                    showSuccess("Validated successfully!");
                    statusInput.value = "done";

                    // Lock UI down
                    partnerInput.disabled = true;
                    dateInput.disabled = true;
                    statusInput.disabled = true;
                    warehouseSelect.setDisabled(true);
                    document.getElementById("add-line-btn").style.display = "none";
                    document.getElementById("save-btn").style.display = "none";
                    document.querySelectorAll(".remove-row-btn").forEach(b => b.style.display = 'none');
                    document.querySelectorAll(".line-row").forEach(tr => {
                        tr._productSS.setDisabled(true);
                        tr._locationSS.setDisabled(true);
                        tr.querySelector(".line-quantity").disabled = true;
                    });

                    validateBtn.style.display = "none"; // Hide validate
                    const cancelBtn = document.getElementById("cancel-btn");
                    if (cancelBtn) cancelBtn.style.display = "none";
                } else {
                    showError(res ? res.message : "Failed to validate order (Insufficient Stock?)");
                    validateBtn.disabled = false;
                    validateBtn.textContent = "Validate";
                }
            } catch (e) {
                showError("Network error during validation.");
                validateBtn.disabled = false;
                validateBtn.textContent = "Validate";
            }
        });
    }

    // --- Cancel Logic ---
    const cancelBtnMain = document.getElementById("cancel-btn");
    if (cancelBtnMain && userRole === "manager") {
        cancelBtnMain.addEventListener("click", async () => {
            if (!isEdit) return; // cannot cancel an unsaved record

            if (!confirm("Are you sure you want to cancel this operation? This cannot be undone.")) {
                return;
            }

            cancelBtnMain.disabled = true;
            cancelBtnMain.textContent = "Cancelling...";

            try {
                const apiBasePath = opType === "receipt" ? "/api/receipts" : "/api/deliveries";
                const res = await window.apiFetch(`${apiBasePath}/${opId}/cancel`, {
                    method: "PUT"
                });

                if (res && res.success) {
                    showSuccess("Operation Cancelled!");

                    const extraOpt = document.createElement("option");
                    extraOpt.value = "cancelled";
                    extraOpt.textContent = "Cancelled";
                    statusInput.appendChild(extraOpt);
                    statusInput.value = "cancelled";

                    // Lock UI down
                    partnerInput.disabled = true;
                    dateInput.disabled = true;
                    statusInput.disabled = true;
                    warehouseSelect.setDisabled(true);
                    document.getElementById("add-line-btn").style.display = "none";
                    document.getElementById("save-btn").style.display = "none";
                    document.querySelectorAll(".remove-row-btn").forEach(b => b.style.display = 'none');
                    document.querySelectorAll(".line-row").forEach(tr => {
                        tr._productSS.setDisabled(true);
                        tr._locationSS.setDisabled(true);
                        tr.querySelector(".line-quantity").disabled = true;
                    });

                    if (validateBtn) validateBtn.style.display = "none";
                    cancelBtnMain.style.display = "none";
                } else {
                    showError(res ? res.message : "Failed to cancel operation.");
                    cancelBtnMain.disabled = false;
                    cancelBtnMain.textContent = "Cancel";
                }
            } catch (e) {
                showError("Network error during cancellation.");
                cancelBtnMain.disabled = false;
                cancelBtnMain.textContent = "Cancel";
            }
        });
    }

    // --- Back Link ---
    document.getElementById("back-link").addEventListener("click", () => {
        window.location.href = opType === "receipt" ? "receipts.html" : "deliveries.html";
    });

});
