function decodeJWT(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}

async function fetchCurrentUser() {
    // As per user request: "Reads user info from localStorage (name, role)"
    const name = localStorage.getItem("user_name") || "User";
    const role = localStorage.getItem("user_role") || "staff";
    return { name, role };
}

function loadLayout(pageTitle) {
    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "login.html";
        return;
    }

    const userName = localStorage.getItem("user_name") || "User";
    const userRole = localStorage.getItem("user_role") || "staff";
    const firstLetter = userName.charAt(0).toUpperCase();

    const managerOnlyPages = ["warehouse.html"];
    const currentPage = window.location.pathname.split("/").pop();

    if (managerOnlyPages.includes(currentPage) && userRole !== "manager") {
        alert("Access denied. This page is for managers only.");
        window.location.href = "/app/pages/dashboard.html";
        return;
    }

    const currentPath = window.location.pathname;
    const isOps = currentPath.includes("receipts.html") ||
        currentPath.includes("deliveries.html") ||
        currentPath.includes("transfers.html") ||
        currentPath.includes("moves.html");

    const sidebarHTML = `
        <a href="dashboard.html" class="sidebar-logo">CoreInventory</a>
        
        <nav>
            <a href="dashboard.html" class="nav-link ${currentPath.includes('dashboard.html') ? 'active' : ''}">Dashboard</a>
            
            <div class="nav-parent" id="ops-parent">
                <span>Operations</span>
                <span class="ops-arrow">${isOps ? '▼' : '▶'}</span>
            </div>
            <ul class="nav-sub-list ${isOps ? 'open' : ''}" id="ops-sub">
                <li><a href="receipts.html" class="nav-link ${currentPath.includes('receipts.html') ? 'active' : ''}">Receipts</a></li>
                <li><a href="deliveries.html" class="nav-link ${currentPath.includes('deliveries.html') ? 'active' : ''}">Deliveries</a></li>
                <li><a href="transfers.html" class="nav-link ${currentPath.includes('transfers.html') ? 'active' : ''}">Internal Transfers</a></li>
                <li><a href="moves.html" class="nav-link ${currentPath.includes('moves.html') ? 'active' : ''}">Move History</a></li>
            </ul>

            <a href="products.html" class="nav-link ${currentPath.includes('product') ? 'active' : ''}">Products</a>
            <a href="logs.html" class="nav-link ${currentPath.includes('logs.html') ? 'active' : ''}">Activity Logs</a>
            <a href="warehouse.html" class="nav-link ${currentPath.includes('warehouse.html') ? 'active' : ''}">Warehouses</a>
            <a href="adjustments.html" class="nav-link ${currentPath.includes('adjustments.html') ? 'active' : ''}">Stock Adjustments</a>
            <a href="users.html" class="nav-link ${currentPath.includes('users.html') ? 'active' : ''}">Approvals</a>
        </nav>

        <div class="sidebar-user">
            <div class="user-info">
                <span class="user-name" title="${userName}">${userName}</span>
                <span class="role-pill ${userRole === 'manager' ? 'manager' : ''}">${userRole}</span>
            </div>
            <button class="logout-btn" id="logout-btn">Log out</button>
        </div>
    `;

    const topnavHTML = `
        <div class="breadcrumb">${pageTitle}</div>
        <div class="avatar" title="${userName}">${firstLetter}</div>
    `;

    document.getElementById("sidebar").innerHTML = sidebarHTML;
    document.getElementById("topnav").innerHTML = topnavHTML;

    if (userRole !== "manager") {
        const warehouseLink = document.querySelector('a[href*="warehouse.html"]');
        if (warehouseLink) warehouseLink.style.display = "none";

        const adjustmentsLink = document.querySelector('a[href*="adjustments.html"]');
        if (adjustmentsLink) adjustmentsLink.style.display = "none";

        const usersLink = document.querySelector('a[href*="users.html"]');
        if (usersLink) usersLink.style.display = "none";
    }

    // Attach ops toggle
    const opsParent = document.getElementById("ops-parent");
    const opsSub = document.getElementById("ops-sub");
    if (opsParent && opsSub) {
        opsParent.addEventListener("click", () => {
            opsSub.classList.toggle("open");
            const arrow = opsParent.querySelector(".ops-arrow");
            if (opsSub.classList.contains("open")) {
                arrow.textContent = "▼";
            } else {
                arrow.textContent = "▶";
            }
        });
    }

    // Attach logout handling
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.removeItem("token");
            localStorage.removeItem("user_name");
            localStorage.removeItem("user_role");
            localStorage.removeItem("user_id");
            window.location.href = "/app/pages/login.html";
        });
    }
}

// Global exposure
window.loadLayout = loadLayout;
