// Base URL for API calls. Empty string uses the current host + standard relative path.
const BASE_URL = "";

async function apiFetch(endpoint, options = {}) {
    const token = localStorage.getItem("token");

    // Setup default headers
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    // Add auth token if exists
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const config = {
        ...options,
        headers
    };

    try {
        const response = await fetch(BASE_URL + endpoint, config);

        // Handle unauthorized globally
        if (response.status === 401) {
            localStorage.removeItem("token");
            localStorage.removeItem("user_name");
            localStorage.removeItem("user_role");
            localStorage.removeItem("user_id");
            window.location.href = "login.html";
            return null; // Stop execution in caller
        }

        const data = await response.json();

        if (!response.ok) {
            // FastAPI validation errors come in 'detail' array or string
            let errMsg = "API Error";
            if (data.detail) {
                if (typeof data.detail === 'string') errMsg = data.detail;
                else if (Array.isArray(data.detail) && data.detail[0]?.msg) errMsg = data.detail[0].msg;
            } else if (data.message) {
                errMsg = data.message;
            }
            return { success: false, message: errMsg };
        }

        return data;
    } catch (error) {
        console.error("API Fetch Error:", error);
        throw error;
    }
}

// Attach to window to ensure global availability without modules
window.apiFetch = apiFetch;
