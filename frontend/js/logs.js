document.addEventListener("DOMContentLoaded", function () {
    window.loadLayout("Activity Logs");

    const tbody = document.getElementById("logs-tbody");
    const spinner = document.getElementById("spinner");

    function fetchLogs() {
        spinner.style.display = "flex";
        window.apiFetch("/api/logs")
            .then(data => {
                tbody.innerHTML = "";
                if (data && data.success && data.data.length > 0) {
                    data.data.forEach(log => {
                        const tr = document.createElement("tr");

                        // Format timestamp securely
                        const rawDate = new Date(log.timestamp);
                        const formatTimestamp = rawDate.toLocaleString([], {
                            year: 'numeric', month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                        });

                        // Badging logic
                        let actionBadge = "";
                        if (log.action === "created") {
                            actionBadge = `<span class="status-badge waiting">Created</span>`;
                        } else if (log.action === "validated") {
                            actionBadge = `<span class="status-badge done">Validated</span>`;
                        } else if (log.action === "cancelled") {
                            actionBadge = `<span class="status-badge cancelled">Cancelled</span>`;
                        }

                        let typeBadge = "";
                        if (log.operation_type === "receipt") {
                            typeBadge = `<span class="status-badge ready">Receipt</span>`;
                        } else if (log.operation_type === "delivery") {
                            typeBadge = `<span class="status-badge draft">Delivery</span>`;
                        } else if (log.operation_type === "transfer") {
                            typeBadge = `<span class="status-badge waiting">Transfer</span>`;
                        } else if (log.operation_type === "adjustment") {
                            typeBadge = `<span class="status-badge cancelled">Adjustment</span>`;
                        }

                        // Target link to quickly view the operation
                        let idRoute = "";
                        if (log.operation_type === "receipt" || log.operation_type === "delivery") {
                            idRoute = `<a href="operation-form.html?type=${log.operation_type}&id=${log.operation_id}" style="color:var(--primary); font-family:monospace; font-weight:bold;">#${log.operation_id}</a>`;
                        } else if (log.operation_type === "transfer") {
                            idRoute = `<a href="transfer-form.html?id=${log.operation_id}" style="color:var(--primary); font-family:monospace; font-weight:bold;">#${log.operation_id}</a>`;
                        } else if (log.operation_type === "adjustment") {
                            idRoute = `<a href="adjustments.html" style="color:var(--primary); font-family:monospace; font-weight:bold;">#${log.operation_id}</a>`;
                        } else {
                            idRoute = `<span style="font-family:monospace; font-weight:bold;">#${log.operation_id}</span>`;
                        }

                        tr.innerHTML = `
                            <td>${formatTimestamp}</td>
                            <td style="font-weight: 500;">${log.user_name}</td>
                            <td>${actionBadge}</td>
                            <td>${typeBadge}</td>
                            <td>${idRoute}</td>
                        `;
                        tbody.appendChild(tr);
                    });
                } else {
                    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:30px;">No operational logs found in system history.</td></tr>`;
                }
            })
            .catch(err => {
                console.error(err);
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--accent);">Failed to retrieve logs. Please check server.</td></tr>`;
            })
            .finally(() => {
                spinner.style.display = "none";
            });
    }

    fetchLogs();
});
