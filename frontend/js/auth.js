document.addEventListener("DOMContentLoaded", () => {

    // Elements
    const errorMsg = document.getElementById("error-msg");
    const successMsg = document.getElementById("success-msg");

    const loginForm = document.getElementById("login-form");
    const signupForm = document.getElementById("signup-form");
    const signupVerifyForm = document.getElementById("signup-verify-form");
    const forgotForm = document.getElementById("forgot-form");
    const verifyForm = document.getElementById("verify-form");
    const resetForm = document.getElementById("reset-form");

    // Utilities
    const showError = (msg) => {
        if (errorMsg) {
            errorMsg.textContent = msg;
            errorMsg.style.display = "block";
            if (successMsg) successMsg.style.display = "none";
        }
    };

    const showSuccess = (msg) => {
        if (successMsg) {
            successMsg.textContent = msg;
            successMsg.style.display = "block";
            if (errorMsg) errorMsg.style.display = "none";
        }
    };

    const hideMessages = () => {
        if (errorMsg) errorMsg.style.display = "none";
        if (successMsg) successMsg.style.display = "none";
    };

    // Global state for forgot password flow
    let currentSessionId = "";
    let currentResetToken = "";

    // Global state for signup flow
    let signupSessionId = "";
    let signupPayload = null;

    // -- SHARED STEP LOGIC --
    const switchStep = (stepNum) => {
        document.querySelectorAll(".step").forEach(el => el.classList.remove("active"));
        document.querySelectorAll(".step-dot").forEach(el => el.classList.remove("active"));

        const stepEl = document.getElementById(`step-${stepNum}`);
        if (stepEl) stepEl.classList.add("active");

        for (let i = 1; i <= stepNum; i++) {
            const dotEl = document.getElementById(`dot-${i}`);
            if (dotEl) dotEl.classList.add("active");
        }
    };

    // -- LOGIN LOGIC --
    if (loginForm) {
        // Check for ?registered=1
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get("registered") === "1") {
            showSuccess("Account created successfully. Please log in.");
        }

        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            hideMessages();
            const btn = document.getElementById("login-btn");
            const originalText = btn.textContent;
            btn.innerHTML = "<div class='spinner' style='width:20px; height:20px; border-width:2px; margin: 0 auto;'></div>";
            btn.disabled = true;

            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;

            try {
                const res = await window.apiFetch("/api/auth/login", {
                    method: "POST",
                    body: JSON.stringify({ email, password })
                });

                if (res && res.success) {
                    localStorage.setItem("token", res.data.token);
                    localStorage.setItem("user_name", res.data.user.name);
                    localStorage.setItem("user_role", res.data.user.role);
                    localStorage.setItem("user_id", res.data.user.id);

                    window.location.href = "dashboard.html";
                } else {
                    showError(res ? res.message : "An error occurred");
                }
            } catch (err) {
                showError("Network error. Could not connect to server.");
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }

    // -- SIGNUP LOGIC --
    if (signupForm) {
        signupForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            hideMessages();
            const btn = document.getElementById("signup-btn-step1");
            const originalText = btn.textContent;
            btn.innerHTML = "<div class='spinner' style='width:20px; height:20px; border-width:2px; margin: 0 auto;'></div>";
            btn.disabled = true;

            const name = document.getElementById("name").value;
            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;
            const role = document.getElementById("role").value;

            signupPayload = { name, email, password, role };

            try {
                const res = await window.apiFetch("/api/auth/signup-init", {
                    method: "POST",
                    body: JSON.stringify({ email })
                });

                if (res && res.success) {
                    signupSessionId = res.data.session_id;
                    showSuccess("OTP sent to your email.");
                    switchStep(2);
                } else {
                    showError(res ? res.message : "An error occurred");
                }
            } catch (err) {
                showError("Network error. Could not connect to server.");
            } finally {
                if (btn) {
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                }
            }
        });
    }

    if (signupVerifyForm) {
        signupVerifyForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            hideMessages();
            const btn = document.getElementById("signup-btn-step2");
            const originalText = btn.textContent;
            btn.innerHTML = "<div class='spinner' style='width:20px; height:20px; border-width:2px; margin: 0 auto;'></div>";
            btn.disabled = true;

            const otp = document.getElementById("otp").value;
            const fullPayload = { ...signupPayload, session_id: signupSessionId, otp: otp };

            try {
                const res = await window.apiFetch("/api/auth/signup", {
                    method: "POST",
                    body: JSON.stringify(fullPayload)
                });

                if (res && res.success) {
                    const managerText = fullPayload.role === "manager" ? "super manager" : "manager";
                    showSuccess(`Account created! A ${managerText} will approve your account in some time.`);
                    setTimeout(() => {
                        window.location.href = "login.html";
                    }, 4000);
                } else {
                    showError(res ? res.message : "An error occurred");
                }
            } catch (err) {
                showError("Network error. Could not connect to server.");
            } finally {
                if (btn) {
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                }
            }
        });
    }

    // -- FORGOT PASSWORD LOGIC --

    if (forgotForm) {
        forgotForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            hideMessages();
            const btn = document.getElementById("btn-step-1");
            const originalText = btn.textContent;
            btn.textContent = "...";
            btn.disabled = true;

            const email = document.getElementById("email").value;

            try {
                const res = await window.apiFetch("/api/auth/forgot-password", {
                    method: "POST",
                    body: JSON.stringify({ email })
                });

                if (res && res.success) {
                    currentSessionId = res.data.session_id;
                    showSuccess("OTP sent to your email.");
                    switchStep(2);
                } else {
                    showError(res ? res.message : "An error occurred");
                }
            } catch (err) {
                showError("Network error.");
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });
    }

    if (verifyForm) {
        verifyForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            hideMessages();
            const btn = document.getElementById("btn-step-2");
            const originalText = btn.textContent;
            btn.textContent = "...";
            btn.disabled = true;

            const otp = document.getElementById("otp").value;

            try {
                const res = await window.apiFetch("/api/auth/verify-otp", {
                    method: "POST",
                    body: JSON.stringify({ session_id: currentSessionId, otp })
                });

                if (res && res.success) {
                    currentResetToken = res.data.reset_token;
                    switchStep(3);
                } else {
                    showError(res ? res.message : "An error occurred");
                }
            } catch (err) {
                showError("Network error.");
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });
    }

    if (resetForm) {
        resetForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            hideMessages();

            const new_password = document.getElementById("new_password").value;
            const confirm_password = document.getElementById("confirm_password").value;

            if (new_password !== confirm_password) {
                showError("Passwords do not match");
                return;
            }

            const btn = document.getElementById("btn-step-3");
            const originalText = btn.textContent;
            btn.textContent = "...";
            btn.disabled = true;

            try {
                const res = await window.apiFetch("/api/auth/reset-password", {
                    method: "POST",
                    body: JSON.stringify({ reset_token: currentResetToken, new_password })
                });

                if (res && res.success) {
                    showSuccess("Password updated successfully. Redirecting to login...");
                    setTimeout(() => {
                        window.location.href = "login.html";
                    }, 2000);
                } else {
                    showError(res ? res.message : "An error occurred");
                }
            } catch (err) {
                showError("Network error.");
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });
    }

});
