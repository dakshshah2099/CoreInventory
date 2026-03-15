document.addEventListener("DOMContentLoaded", async () => {
    window.loadLayout("Approvals");

    // Auth Check - Block Staff
    const userRole = localStorage.getItem("user_role");
    if (userRole !== "manager") {
        document.querySelector(".page-content").innerHTML = "<h2>Access Denied</h2><p>You do not have permission to view approvals.</p>";
        return;
    }

    const tbody = document.getElementById("users-tbody");
    const table = document.getElementById("users-table");
    const spinner = document.getElementById("spinner");

    const successBanner = document.getElementById("success-banner");
    const errorBanner = document.getElementById("error-banner");
    const successText = document.getElementById("success-text");
    const errorText = document.getElementById("error-text");

    function showMsg(msg, isError = false) {
        if (isError) {
            errorText.textContent = `❌ ${msg}`;
            errorBanner.style.display = "flex";
            successBanner.style.display = "none";
        } else {
            successText.textContent = `✅ ${msg}`;
            successBanner.style.display = "flex";
            errorBanner.style.display = "none";
        }
        setTimeout(() => {
            errorBanner.style.display = "none";
            successBanner.style.display = "none";
        }, 4000);
    }

    async function loadPendingUsers() {
        spinner.style.display = "flex";
        table.style.display = "none";
        tbody.innerHTML = "";

        try {
            const res = await window.apiFetch("/api/users/pending");
            if (res && res.success) {
                renderUsers(res.data);
            } else {
                showMsg(res ? res.message : "Failed to load pending users", true);
            }
        } catch (e) {
            showMsg("Network error occurred", true);
        } finally {
            spinner.style.display = "none";
            table.style.display = "table";
        }
    }

    function renderUsers(users) {
        if (!users || users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No pending accounts.</td></tr>`;
            return;
        }

        users.forEach(u => {
            const tr = document.createElement("tr");
            const dateStr = new Date(u.created_at).toLocaleString();

            const isManagerClass = u.role === "manager" ? "badge-ready" : "badge-waiting";

            tr.innerHTML = `
                <td><strong>${u.name}</strong></td>
                <td>${u.email}</td>
                <td><span class="badge ${isManagerClass}">${u.role.toUpperCase()}</span></td>
                <td>${dateStr}</td>
                <td class="approval-actions">
                    <button class="btn-primary approve-btn" data-id="${u.id}" style="padding:4px 12px; height:auto; min-height:0; width:auto; border-radius:4px; font-size:0.85rem;">Approve</button>
                    <button class="btn-outline reject-btn" data-id="${u.id}" style="padding:4px 12px; height:auto; min-height:0; width:auto; border-radius:4px; font-size:0.85rem; color: #dc2626; border-color: #dc2626; margin-left:8px;">Reject</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Bind events
        document.querySelectorAll(".approve-btn").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                const uid = e.currentTarget.getAttribute("data-id");
                await setApproval(uid, "approve");
            });
        });

        document.querySelectorAll(".reject-btn").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                const uid = e.currentTarget.getAttribute("data-id");
                if (confirm("Are you sure you want to permanently delete this account registration?")) {
                    await setApproval(uid, "reject");
                }
            });
        });
    }

    async function setApproval(userId, action) {
        const method = action === "approve" ? "PUT" : "DELETE";
        try {
            const res = await window.apiFetch(`/api/users/${userId}/${action}`, { method });
            if (res && res.success) {
                showMsg(res.message);
                loadPendingUsers(); // Reload list
            } else {
                showMsg(res ? res.message : `Failed to ${action} account`, true);
            }
        } catch (e) {
            showMsg("Network error.", true);
        }
    }

    loadPendingUsers();
});
