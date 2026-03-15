document.addEventListener("DOMContentLoaded", async () => {
    // 1. Read URL Params
    const urlParams = new URLSearchParams(window.location.search);
    const opId = urlParams.get("id"); // optional ID
    const userRole = localStorage.getItem("user_role");

    const isEdit = !!opId;
    const pageTitleText = isEdit ? `Edit Internal Transfer` : `New Internal Transfer`;

    window.loadLayout("Internal Transfers");

    // Staff enforcement — runs before anything else
    if (userRole !== "manager") {
        const infoBar = document.getElementById("staff-info-bar");
        if (infoBar) infoBar.style.display = "block";

        const saveBtn = document.getElementById("save-btn");
        const cancelBtn = document.getElementById("cancel-btn");
        if (saveBtn) saveBtn.style.display = "none";
        if (cancelBtn) cancelBtn.style.display = "none";

        document.querySelectorAll(".input-field").forEach(input => {
            input.setAttribute("disabled", "true");
        });

        const addRowBtn = document.getElementById("add-line-btn");
        if (addRowBtn) addRowBtn.style.display = "none";
    }

    // If staff and no id — block new creation
    if (userRole !== "manager" && !opId) {
        alert("Staff cannot create new operations.");
        window.location.href = `/app/pages/transfers.html`;
        return;
    }

    document.getElementById("page-title").textContent = pageTitleText;

    // DOM Elements
    const spinner = document.getElementById("spinner");
    const formContent = document.getElementById("form-content");
    const actionBar = document.getElementById("action-bar");
    const dateInput = document.getElementById("date-input");
    const statusInput = document.getElementById("status-input");
    const linesTbody = document.getElementById("lines-tbody");

    const successBanner = document.getElementById("success-banner");
    const errorBanner = document.getElementById("error-banner");
    const errorText = document.getElementById("error-text");

    let productsData = [];
    let warehousesData = [];
    let locationsData = [];
    let sourceWarehouseSelect = null;
    let destWarehouseSelect = null;

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

        // Source Warehouse SearchableSelect
        const srcContainer = document.getElementById("source-warehouse-container");
        sourceWarehouseSelect = new SearchableSelect(srcContainer, {
            placeholder: "Search source warehouse...",
            options: getWarehouseOptions(),
            disabled: userRole !== "manager",
            onSelect: (value) => {
                const whId = parseInt(value);
                document.querySelectorAll(".line-row").forEach(tr => {
                    const srcLocSS = tr._srcLocationSS;
                    if (srcLocSS) {
                        srcLocSS.setOptions(getLocationOptions(whId));
                        srcLocSS.clear();
                    }
                });
            }
        });

        // Destination Warehouse SearchableSelect
        const destContainer = document.getElementById("destination-warehouse-container");
        destWarehouseSelect = new SearchableSelect(destContainer, {
            placeholder: "Search destination warehouse...",
            options: getWarehouseOptions(),
            disabled: userRole !== "manager",
            onSelect: (value) => {
                const whId = parseInt(value);
                document.querySelectorAll(".line-row").forEach(tr => {
                    const destLocSS = tr._destLocationSS;
                    if (destLocSS) {
                        destLocSS.setOptions(getLocationOptions(whId));
                        destLocSS.clear();
                    }
                });
            }
        });

        if (isEdit) {
            const opRes = await window.apiFetch(`/api/transfers/${opId}`);
            if (opRes && opRes.success) {
                const data = opRes.data;

                if (data.scheduled_date) {
                    dateInput.value = data.scheduled_date.split("T")[0];
                }

                if (data.status === "done" || data.status === "cancelled") {
                    const extraOpt = document.createElement("option");
                    extraOpt.value = data.status;
                    extraOpt.textContent = data.status === "done" ? "Done" : "Cancelled";
                    statusInput.appendChild(extraOpt);
                }
                statusInput.value = data.status || "draft";

                if (data.source_warehouse_id) {
                    sourceWarehouseSelect.setValue(String(data.source_warehouse_id));
                }
                if (data.destination_warehouse_id) {
                    destWarehouseSelect.setValue(String(data.destination_warehouse_id));
                }

                if (data.lines && data.lines.length > 0) {
                    data.lines.forEach(line => addProductRow(line.product_id, line.quantity, line.source_location_id, line.destination_location_id));
                } else {
                    addProductRow();
                }

                if (data.status === "draft" || data.status === "waiting" || data.status === "ready") {
                    document.getElementById("validate-btn").style.display = "inline-block";
                    if (userRole === "manager") {
                        document.getElementById("cancel-btn").style.display = "inline-block";
                    }
                }

                if (data.status === "done" || data.status === "cancelled") {
                    dateInput.disabled = true;
                    statusInput.disabled = true;
                    sourceWarehouseSelect.setDisabled(true);
                    destWarehouseSelect.setDisabled(true);
                    document.getElementById("add-line-btn").style.display = "none";
                    document.getElementById("save-btn").style.display = "none";
                }

            } else {
                showError("Failed to load transfer data.");
            }
        } else {
            addProductRow();
        }

        spinner.style.display = "none";
        formContent.style.display = "block";
        actionBar.style.display = "flex";

    } catch (e) {
        console.error(e);
        showError("Network error occurred while loading form.");
        spinner.style.display = "none";
        return;
    }

    // --- Dynamic Line Rows ---
    function addProductRow(productId = null, quantity = 1, srcLocationId = null, destLocationId = null) {
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

        // Source Location cell
        const srcLocTd = document.createElement("td");
        const srcLocContainer = document.createElement("div");
        srcLocContainer.style.minWidth = "140px";
        const srcWhId = sourceWarehouseSelect ? parseInt(sourceWarehouseSelect.getValue()) : null;
        const srcLocSS = new SearchableSelect(srcLocContainer, {
            placeholder: "Search source loc...",
            options: getLocationOptions(srcWhId),
            disabled: isDisabled
        });
        if (srcLocationId) srcLocSS.setValue(String(srcLocationId));
        srcLocTd.appendChild(srcLocContainer);

        // Destination Location cell
        const destLocTd = document.createElement("td");
        const destLocContainer = document.createElement("div");
        destLocContainer.style.minWidth = "140px";
        const destWhId = destWarehouseSelect ? parseInt(destWarehouseSelect.getValue()) : null;
        const destLocSS = new SearchableSelect(destLocContainer, {
            placeholder: "Search dest loc...",
            options: getLocationOptions(destWhId),
            disabled: isDisabled
        });
        if (destLocationId) destLocSS.setValue(String(destLocationId));
        destLocTd.appendChild(destLocContainer);

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
        tr.appendChild(srcLocTd);
        tr.appendChild(destLocTd);
        tr.appendChild(qtyTd);
        tr.appendChild(removeTd);

        // Store SS references on the row element
        tr._productSS = productSS;
        tr._srcLocationSS = srcLocSS;
        tr._destLocationSS = destLocSS;

        linesTbody.appendChild(tr);
    }

    document.getElementById("add-line-btn").addEventListener("click", () => {
        addProductRow();
    });

    // --- Save Logic ---
    document.getElementById("save-btn").addEventListener("click", async () => {
        const lines = [];
        let validationFailed = false;

        document.querySelectorAll("#lines-tbody .line-row").forEach(tr => {
            const pId = tr._productSS.getValue();
            const srcId = tr._srcLocationSS.getValue();
            const destId = tr._destLocationSS.getValue();
            const qty = parseInt(tr.querySelector(".line-quantity").value);

            if (!pId || !srcId || !destId || isNaN(qty) || qty < 1) {
                validationFailed = true;
            } else {
                lines.push({ product_id: parseInt(pId), source_location_id: parseInt(srcId), destination_location_id: parseInt(destId), quantity: qty });
            }
        });

        if (lines.length === 0) {
            showError("You must add at least one line item.");
            return;
        }

        if (validationFailed) {
            showError("Please fill out all product lines with valid quantities and locations.");
            return;
        }

        if (!dateInput.value) {
            showError("You must select a Scheduled Date.");
            return;
        }

        const src_wh_id = sourceWarehouseSelect ? parseInt(sourceWarehouseSelect.getValue()) : null;
        const dest_wh_id = destWarehouseSelect ? parseInt(destWarehouseSelect.getValue()) : null;

        if (!src_wh_id || isNaN(src_wh_id) || !dest_wh_id || isNaN(dest_wh_id)) {
            showError("You must select both source and destination warehouses.");
            return;
        }

        const payload = {
            scheduled_date: dateInput.value || null,
            status: statusInput.value,
            source_warehouse_id: src_wh_id,
            destination_warehouse_id: dest_wh_id,
            lines: lines
        };

        const btn = document.getElementById("save-btn");
        const originText = btn.textContent;
        btn.disabled = true;
        btn.textContent = "...";

        try {
            const endpoint = isEdit ? `/api/transfers/${opId}` : "/api/transfers";
            const method = isEdit ? "PUT" : "POST";

            const res = await window.apiFetch(endpoint, {
                method: method,
                body: JSON.stringify(payload)
            });

            if (res && res.success) {
                if (!isEdit) {
                    window.location.href = `transfer-form.html?id=${res.data.id}`;
                } else {
                    showSuccess("Saved successfully");
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
            if (!isEdit) return;

            validateBtn.disabled = true;
            validateBtn.textContent = "Validating...";

            try {
                const res = await window.apiFetch(`/api/transfers/${opId}/validate`, {
                    method: "PUT"
                });

                if (res && res.success) {
                    showSuccess("Validated successfully!");
                    statusInput.value = "done";

                    dateInput.disabled = true;
                    statusInput.disabled = true;
                    sourceWarehouseSelect.setDisabled(true);
                    destWarehouseSelect.setDisabled(true);
                    document.getElementById("add-line-btn").style.display = "none";
                    document.getElementById("save-btn").style.display = "none";
                    document.querySelectorAll(".remove-row-btn").forEach(b => b.style.display = 'none');
                    document.querySelectorAll(".line-row").forEach(tr => {
                        tr._productSS.setDisabled(true);
                        tr._srcLocationSS.setDisabled(true);
                        tr._destLocationSS.setDisabled(true);
                        tr.querySelector(".line-quantity").disabled = true;
                    });

                    validateBtn.style.display = "none";
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
            if (!isEdit) return;

            if (!confirm("Are you sure you want to cancel this transfer? This cannot be undone.")) {
                return;
            }

            cancelBtnMain.disabled = true;
            cancelBtnMain.textContent = "Cancelling...";

            try {
                const res = await window.apiFetch(`/api/transfers/${opId}/cancel`, {
                    method: "PUT"
                });

                if (res && res.success) {
                    showSuccess("Transfer Cancelled!");

                    const extraOpt = document.createElement("option");
                    extraOpt.value = "cancelled";
                    extraOpt.textContent = "Cancelled";
                    statusInput.appendChild(extraOpt);
                    statusInput.value = "cancelled";

                    dateInput.disabled = true;
                    statusInput.disabled = true;
                    sourceWarehouseSelect.setDisabled(true);
                    destWarehouseSelect.setDisabled(true);
                    document.getElementById("add-line-btn").style.display = "none";
                    document.getElementById("save-btn").style.display = "none";
                    document.querySelectorAll(".remove-row-btn").forEach(b => b.style.display = 'none');
                    document.querySelectorAll(".line-row").forEach(tr => {
                        tr._productSS.setDisabled(true);
                        tr._srcLocationSS.setDisabled(true);
                        tr._destLocationSS.setDisabled(true);
                        tr.querySelector(".line-quantity").disabled = true;
                    });

                    if (validateBtn) validateBtn.style.display = "none";
                    cancelBtnMain.style.display = "none";
                } else {
                    showError(res ? res.message : "Failed to cancel transfer.");
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
        window.location.href = "transfers.html";
    });

});
