document.addEventListener("DOMContentLoaded", () => {
    window.loadLayout("Move History");

    let activeType = "";
    let dateFrom = "";
    let dateTo = "";
    let searchQuery = "";
    let currentView = "list";
    let typingTimer;

    const tbody = document.getElementById("moves-tbody");
    const tableEl = document.getElementById("moves-table");
    const kanbanBoard = document.getElementById("kanban-view");
    const emptyState = document.getElementById("empty-state");
    const spinner = document.getElementById("spinner");

    async function fetchMoves() {
        tbody.innerHTML = "";
        spinner.style.display = "flex";
        tableEl.style.display = "table";
        emptyState.style.display = "none";

        try {
            const params = new URLSearchParams();
            if (activeType) params.append("move_type", activeType);
            if (dateFrom) params.append("date_from", dateFrom);
            if (dateTo) params.append("date_to", dateTo);
            if (searchQuery) params.append("search", searchQuery);

            const queryStr = params.toString() ? `?${params.toString()}` : "";

            const res = await window.apiFetch(`/api/moves${queryStr}`);

            if (res && res.success) {
                const data = res.data;
                if (data.length === 0) {
                    tableEl.style.display = "none";
                    kanbanBoard.style.display = "none";
                    emptyState.style.display = "block";
                } else {
                    if (currentView === "list") {
                        tableEl.style.display = "table";
                        kanbanBoard.style.display = "none";
                        renderRows(data);
                    } else {
                        tableEl.style.display = "none";
                        kanbanBoard.style.display = "flex";
                        renderKanban(data);
                    }
                }
            } else {
                tableEl.style.display = "none";
                kanbanBoard.style.display = "none";
                emptyState.textContent = "Failed to load move history";
                emptyState.style.display = "block";
            }
        } catch (e) {
            console.error(e);
            tableEl.style.display = "none";
            emptyState.textContent = "Connection error";
            emptyState.style.display = "block";
        } finally {
            spinner.style.display = "none";
        }
    }

    function renderRows(data) {
        data.forEach(m => {
            const tr = document.createElement("tr");

            const dt = new Date(m.created_at);
            const dtStr = `${dt.toLocaleDateString()} ${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

            let color = "";
            let t = m.move_type.toLowerCase();
            if (t === "receipt") color = "#16a34a"; // green
            else if (t === "delivery") color = "var(--accent)"; // rose
            else if (t === "transfer") color = "#2563eb"; // blue
            else if (t === "adjustment") color = "#ca8a04"; // yellow

            const badge = `<span class="badge" style="background-color: ${color}">${m.move_type}</span>`;

            tr.innerHTML = `
                <td style="color:var(--text-muted); font-size: 0.85rem">${dtStr}</td>
                <td style="font-weight:600;">${m.product_name}</td>
                <td>${m.from_location_name || '<span style="color:#555">Vendor/Virtual</span>'}</td>
                <td>${m.to_location_name || '<span style="color:#555">Customer/Virtual</span>'}</td>
                <td style="font-weight:bold;">${m.quantity}</td>
                <td>${badge}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function renderKanban(data) {
        kanbanBoard.innerHTML = "";

        const types = ["receipt", "delivery", "transfer", "adjustment"];

        types.forEach(type => {
            const columnData = data.filter(d => d.move_type.toLowerCase() === type);

            const col = document.createElement("div");
            col.className = "kanban-column";

            const titleHtml = `
                <div class="kanban-column-title">
                    <span style="text-transform: capitalize;">${type}s</span>
                    <span class="kanban-column-count">${columnData.length}</span>
                </div>
            `;
            col.innerHTML = titleHtml;

            columnData.forEach(m => {
                const card = document.createElement("div");
                card.className = "kanban-card";

                const dt = new Date(m.created_at);
                const dtStr = `${dt.toLocaleDateString()}`;

                let color = "";
                if (type === "receipt") color = "#16a34a";
                else if (type === "delivery") color = "var(--accent)";
                else if (type === "transfer") color = "#2563eb";
                else if (type === "adjustment") color = "#ca8a04";

                const badge = `<span class="badge" style="background-color: ${color}; font-size: 0.65rem; padding: 2px 6px;">${m.move_type}</span>`;

                card.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:start;">
                        <span class="kanban-card-title">${m.product_name}</span>
                        ${badge}
                    </div>
                    <div class="kanban-card-subtitle" style="font-size: 0.75rem; color: var(--text-muted);">
                        ${m.from_location_name || 'Vendor'} ➔ ${m.to_location_name || 'Customer'}
                    </div>
                    <div class="kanban-card-meta">
                        <span>Qty: <strong>${m.quantity}</strong></span>
                        <span>${dtStr}</span>
                    </div>
                `;

                // No click-through link for moves natively in this mock, so we keep it static
                card.style.cursor = "default";
                col.appendChild(card);
            });

            kanbanBoard.appendChild(col);
        });
    }

    // --- Listeners ---
    document.querySelectorAll(".filter-pill").forEach(pill => {
        pill.addEventListener("click", (e) => {
            document.querySelectorAll(".filter-pill").forEach(p => p.classList.remove("active"));
            e.currentTarget.classList.add("active");
            activeType = e.currentTarget.getAttribute("data-type");
            fetchMoves();
        });
    });

    document.getElementById("date-from").addEventListener("change", (e) => {
        dateFrom = e.target.value;
        fetchMoves();
    });

    document.getElementById("date-to").addEventListener("change", (e) => {
        dateTo = e.target.value;
        fetchMoves();
    });

    document.getElementById("search-input").addEventListener("input", (e) => {
        clearTimeout(typingTimer);
        searchQuery = e.target.value.trim();
        typingTimer = setTimeout(() => {
            fetchMoves();
        }, 400); // Debounce
    });

    document.getElementById("search-input").addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            clearTimeout(typingTimer);
            fetchMoves();
        }
    });

    const btnList = document.getElementById("btn-view-list");
    const btnKanban = document.getElementById("btn-view-kanban");

    if (btnList && btnKanban) {
        btnList.addEventListener("click", () => {
            if (currentView === "list") return;
            currentView = "list";
            btnList.classList.add("active");
            btnKanban.classList.remove("active");
            fetchMoves();
        });

        btnKanban.addEventListener("click", () => {
            if (currentView === "kanban") return;
            currentView = "kanban";
            btnKanban.classList.add("active");
            btnList.classList.remove("active");
            fetchMoves();
        });
    }

    // RBAC Enforcement
    const userRole = localStorage.getItem("user_role");
    if (userRole !== "manager") {
        document.querySelectorAll(".filter-pill").forEach(el => el.style.display = "none");
    }

    // Init
    fetchMoves();
});
