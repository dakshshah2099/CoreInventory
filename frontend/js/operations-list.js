document.addEventListener("DOMContentLoaded", function () {
    loadLayout(OPERATION_TYPE === "receipt" ? "Receipts" : "Deliveries");

    const userRole = localStorage.getItem("user_role");

    // Hide New button for staff immediately on load
    const newBtn = document.getElementById("new-operation-btn");
    if (newBtn && userRole !== "manager") {
        newBtn.style.display = "none";
    }

    document.getElementById("page-title").textContent = OPERATION_TYPE === "receipt" ? "Receipts" : "Deliveries";

    const ENDPOINT = OPERATION_TYPE === "receipt" ? "/api/receipts" : "/api/deliveries";

    let activeStatus = "";
    let searchQuery = "";
    let currentView = "list"; // "list" or "kanban"
    let typingTimer;

    const tbody = document.getElementById("ops-tbody");
    const tableEl = document.getElementById("ops-table");
    const kanbanBoard = document.getElementById("kanban-view");
    const spinner = document.getElementById("spinner");

    async function fetchList() {
        tbody.innerHTML = "";
        spinner.style.display = "flex";

        try {
            const params = new URLSearchParams();
            if (activeStatus) params.append("status", activeStatus);
            if (searchQuery) params.append("search", searchQuery);

            const queryStr = params.toString() ? `?${params.toString()}` : "";

            const res = await window.apiFetch(ENDPOINT + queryStr);
            if (res && res.success) {
                if (currentView === "list") {
                    tableEl.style.display = "table";
                    kanbanBoard.style.display = "none";
                    renderRows(res.data);
                } else {
                    tableEl.style.display = "none";
                    kanbanBoard.style.display = "flex";
                    renderKanban(res.data);
                }
            }
        } catch (e) {
            console.error(e);
            tbody.innerHTML = `<tr><td colspan="6" style="color:var(--accent);text-align:center;">Failed to connect</td></tr>`;
        } finally {
            spinner.style.display = "none";
        }
    }

    function renderRows(data) {
        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted)">No ${OPERATION_TYPE}s found.</td></tr>`;
            return;
        }

        data.forEach(item => {
            const tr = document.createElement("tr");

            // Abstract the partner field (supplier vs customer)
            const partnerName = OPERATION_TYPE === "receipt" ? item.supplier : item.customer;
            const dateStr = item.scheduled_date ? new Date(item.scheduled_date).toLocaleDateString() : "-";
            const badgeClass = `badge badge-${item.status.toLowerCase()}`;

            tr.innerHTML = `
                <td><span style="font-weight:bold; color:var(--accent)">${item.reference || 'Draft'}</span></td>
                <td>${partnerName || "-"}</td>
                <td><span style="color:var(--text-muted); font-size: 0.85em;">${item.warehouse_name || "-"}</span></td>
                <td>${dateStr}</td>
                <td>${item.line_count || 0} items</td>
                <td><span class="${badgeClass}">${item.status}</span></td>
                <td>
                    <button class="btn-icon view-btn" data-id="${item.id}">👁️ View / Edit</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll(".view-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const id = e.currentTarget.getAttribute("data-id");
                window.location.href = `operation-form.html?type=${OPERATION_TYPE}&id=${id}`;
            });
        });
    }

    function renderKanban(data) {
        kanbanBoard.innerHTML = "";

        const statuses = ["draft", "waiting", "ready", "done", "cancelled"];

        statuses.forEach(status => {
            const columnData = data.filter(d => d.status.toLowerCase() === status);

            const col = document.createElement("div");
            col.className = "kanban-column";

            const titleHtml = `
                <div class="kanban-column-title">
                    <span style="text-transform: capitalize;">${status}</span>
                    <span class="kanban-column-count">${columnData.length}</span>
                </div>
            `;
            col.innerHTML = titleHtml;

            columnData.forEach(item => {
                const card = document.createElement("div");
                card.className = "kanban-card";

                const partnerName = OPERATION_TYPE === "receipt" ? item.supplier : item.customer;
                const badgeClass = `badge badge-${item.status.toLowerCase()}`;

                card.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:start;">
                        <span class="kanban-card-title">${item.reference || 'Draft'}</span>
                        <span class="${badgeClass}" style="font-size: 0.65rem; padding: 2px 6px;">${item.status}</span>
                    </div>
                    <div class="kanban-card-subtitle">${partnerName || "-"}</div>
                    <div class="kanban-card-meta">
                        <span>${item.warehouse_name || "-"}</span>
                        <span>${item.line_count || 0} lines</span>
                    </div>
                `;

                card.addEventListener("click", () => {
                    window.location.href = `operation-form.html?type=${OPERATION_TYPE}&id=${item.id}`;
                });

                col.appendChild(card);
            });

            kanbanBoard.appendChild(col);
        });
    }

    // --- Event Listeners ---
    const newOpBtn = document.getElementById("new-operation-btn");
    if (newOpBtn) {
        newOpBtn.addEventListener("click", () => {
            window.location.href = `operation-form.html?type=${OPERATION_TYPE}`;
        });
    }

    document.querySelectorAll(".filter-pill").forEach(pill => {
        pill.addEventListener("click", (e) => {
            // Unset previous active
            document.querySelectorAll(".filter-pill").forEach(p => p.classList.remove("active"));
            // Set new active
            e.currentTarget.classList.add("active");

            activeStatus = e.currentTarget.getAttribute("data-status");
            fetchList();
        });
    });

    const btnList = document.getElementById("btn-view-list");
    const btnKanban = document.getElementById("btn-view-kanban");

    if (btnList && btnKanban) {
        btnList.addEventListener("click", () => {
            if (currentView === "list") return;
            currentView = "list";
            btnList.classList.add("active");
            btnKanban.classList.remove("active");
            fetchList();
        });

        btnKanban.addEventListener("click", () => {
            if (currentView === "kanban") return;
            currentView = "kanban";
            btnKanban.classList.add("active");
            btnList.classList.remove("active");
            fetchList();
        });
    }

    document.getElementById("search-input").addEventListener("input", (e) => {
        clearTimeout(typingTimer);
        searchQuery = e.target.value.trim();
        typingTimer = setTimeout(() => {
            fetchList();
        }, 400); // 400ms debounce
    });

    document.getElementById("search-input").addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            clearTimeout(typingTimer);
            fetchList();
        }
    });

    // Initial load
    fetchList();
});
