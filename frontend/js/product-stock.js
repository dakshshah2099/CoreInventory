document.addEventListener("DOMContentLoaded", async () => {
    window.loadLayout("Product Stock");

    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get("id");

    if (!productId) {
        document.getElementById("page-title").textContent = "Invalid Product ID";
        return;
    }

    const tbody = document.getElementById("stock-tbody");
    const spinner = document.getElementById("spinner");

    document.getElementById("back-btn").addEventListener("click", () => {
        window.history.back();
    });

    spinner.style.display = "flex";

    try {
        const res = await window.apiFetch(`/api/products/${productId}/stock`);
        if (res && res.success) {

            // Assuming the API gives us context. If product details aren't included 
            // directly we just set a generic title, but usually APIs provide some context or we can guess.
            // Let's set the title indicating it's the breakdown.
            document.getElementById("page-title").textContent = `Stock Breakdown`;

            const records = res.data;
            tbody.innerHTML = "";

            if (records.length === 0) {
                tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-muted)">No stock available in any location.</td></tr>`;
                return;
            }

            let totalAcc = 0;

            records.forEach(r => {
                totalAcc += r.quantity;
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${r.location_name}</td>
                    <td>${r.warehouse_name}</td>
                    <td><strong>${r.quantity}</strong></td>
                `;
                tbody.appendChild(tr);
            });

            // Add a total row
            const totalTr = document.createElement("tr");
            totalTr.innerHTML = `
                <td colspan="2" style="text-align:right; color:var(--text-muted)"><strong>Total On Hand:</strong></td>
                <td style="color:var(--accent); font-size:1.1rem;"><strong>${totalAcc}</strong></td>
            `;
            tbody.appendChild(totalTr);

        } else {
            document.getElementById("page-title").textContent = "Error Loading Stock";
        }
    } catch (e) {
        console.error(e);
        document.getElementById("page-title").textContent = "Connection Error";
    } finally {
        spinner.style.display = "none";
    }
});
