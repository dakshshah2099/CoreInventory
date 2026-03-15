document.addEventListener("DOMContentLoaded", () => {
    window.loadLayout("Settings");

    const grid = document.getElementById("warehouses-grid");
    const spinner = document.getElementById("spinner");

    // WH Modal
    const whModal = document.getElementById("wh-modal-overlay");
    const whName = document.getElementById("wh-name");
    const whCode = document.getElementById("wh-code");
    const whAddress = document.getElementById("wh-address");
    const whError = document.getElementById("wh-modal-error");

    // Loc Modal
    const locModal = document.getElementById("loc-modal-overlay");
    const locWhId = document.getElementById("loc-wh-id");
    const locName = document.getElementById("loc-name");
    const locCode = document.getElementById("loc-code");
    const locError = document.getElementById("loc-modal-error");

    async function fetchWarehouses() {
        grid.innerHTML = "";
        spinner.style.display = "flex";

        try {
            const res = await window.apiFetch("/api/warehouses");
            if (res && res.success) {
                renderGrid(res.data);
            }
        } catch (e) {
            console.error(e);
            grid.innerHTML = "<p style='color:var(--accent)'>Failed to connect to server</p>";
        } finally {
            spinner.style.display = "none";
        }
    }

    function renderGrid(data) {
        if (data.length === 0) {
            grid.innerHTML = "<p style='color:var(--text-muted); width:100%; text-align:center;'>No warehouses configured.</p>";
            return;
        }

        data.forEach(wh => {
            const card = document.createElement("div");
            card.classList.add("warehouse-card");

            let locsHtml = "";
            if (wh.locations && wh.locations.length > 0) {
                locsHtml = wh.locations.map(loc => `<span class="chip">${loc.name} <span style="opacity:0.5">(${loc.short_code})</span></span>`).join("");
            } else {
                locsHtml = `<span style="color:var(--text-muted); font-size: 0.8rem;">No locations yet.</span>`;
            }

            card.innerHTML = `
                <div class="warehouse-name">${wh.name}</div>
                <div class="warehouse-meta">Code: ${wh.short_code} • ${wh.address || 'No Address'}</div>
                
                <div class="locations-section">
                    <div class="locations-label">Locations</div>
                    <div class="chips-row">
                        ${locsHtml}
                    </div>
                </div>
                <button class="btn-outline add-loc-btn" data-id="${wh.id}">+ Add Location</button>
            `;

            grid.appendChild(card);
        });

        document.querySelectorAll(".add-loc-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const whId = e.currentTarget.getAttribute("data-id");
                openLocModal(whId);
            });
        });
    }

    // --- Modals Logic ---
    function openWhModal() {
        whName.value = "";
        whCode.value = "";
        whAddress.value = "";
        whError.style.display = "none";
        whModal.style.display = "flex";
    }

    function closeWhModal() { whModal.style.display = "none"; }

    function openLocModal(whId) {
        locWhId.value = whId;
        locName.value = "";
        locCode.value = "";
        locError.style.display = "none";
        locModal.style.display = "flex";
    }

    function closeLocModal() { locModal.style.display = "none"; }

    // WH Listeners
    document.getElementById("add-wh-btn").addEventListener("click", openWhModal);
    document.getElementById("wh-modal-close").addEventListener("click", closeWhModal);
    document.getElementById("wh-modal-cancel").addEventListener("click", closeWhModal);
    whModal.addEventListener("click", (e) => { if (e.target === whModal) closeWhModal(); });

    document.getElementById("wh-save-btn").addEventListener("click", async () => {
        whError.style.display = "none";
        const payload = {
            name: whName.value.trim(),
            short_code: whCode.value.trim(),
            address: whAddress.value.trim()
        };

        if (!payload.name || !payload.short_code) {
            whError.textContent = "Name and Short Code are required.";
            whError.style.display = "block";
            return;
        }

        const btn = document.getElementById("wh-save-btn");
        btn.disabled = true; btn.textContent = "...";

        try {
            const res = await window.apiFetch("/api/warehouses", {
                method: "POST", body: JSON.stringify(payload)
            });
            if (res && res.success) {
                closeWhModal();
                fetchWarehouses();
            } else {
                whError.textContent = res ? res.message : "Error creating warehouse";
                whError.style.display = "block";
            }
        } catch (e) {
            whError.textContent = "Network error";
            whError.style.display = "block";
        } finally {
            btn.disabled = false; btn.textContent = "Create Warehouse";
        }
    });

    // Loc Listeners
    document.getElementById("loc-modal-close").addEventListener("click", closeLocModal);
    document.getElementById("loc-modal-cancel").addEventListener("click", closeLocModal);
    locModal.addEventListener("click", (e) => { if (e.target === locModal) closeLocModal(); });

    document.getElementById("loc-save-btn").addEventListener("click", async () => {
        locError.style.display = "none";
        const payload = {
            name: locName.value.trim(),
            short_code: locCode.value.trim(),
            warehouse_id: parseInt(locWhId.value)
        };

        if (!payload.name) {
            locError.textContent = "Name is required.";
            locError.style.display = "block";
            return;
        }

        const btn = document.getElementById("loc-save-btn");
        btn.disabled = true; btn.textContent = "...";

        try {
            const res = await window.apiFetch(`/api/locations`, {
                method: "POST", body: JSON.stringify(payload)
            });
            if (res && res.success) {
                closeLocModal();
                fetchWarehouses();
            } else {
                locError.textContent = res ? res.message : "Error creating location";
                locError.style.display = "block";
            }
        } catch (e) {
            locError.textContent = "Network error";
            locError.style.display = "block";
        } finally {
            btn.disabled = false; btn.textContent = "Create Location";
        }
    });

    // Init
    fetchWarehouses();
});
