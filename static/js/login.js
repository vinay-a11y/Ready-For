console.log("Login JS loaded");

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const errorMessage = document.getElementById("errorMessage");
  const errorText = document.getElementById("errorText");
  const successMessage = document.getElementById("successMessage");
  const successText = document.getElementById("successText");

  const forgotPasswordBtn = document.querySelector(".forgot-password");
  const sendOtpButton = document.getElementById("sendOtpButton");
  const signInBtn = document.getElementById("signInBtn");
  const passwordGroup = document.getElementById("passwordGroup");
  const formOptions = document.querySelector(".form-options");
  const otpInputGroup = document.getElementById("otpInputGroup");
  const mobileInput = document.getElementById("mobile_number");
  const otpValidation = document.getElementById("otpValidation");
  const h2 = document.getElementById("hh");
  const h3 = document.getElementById("h3");
  const rememberMe = document.getElementById("rememberMe");
  const resetPasswordGroup = document.getElementById("resetPasswordGroup");
  const resetBtn = document.getElementById("resetBtn");

  let isOtpSent = false;
  let isOtpVerified = false;

  /* ---------------- LOGIN ---------------- */
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideMessages();

    try {
      const formData = new FormData(loginForm);

      const response = await fetch("/login", {
        method: "POST",
        body: formData,
        credentials: "include", // ⭐ REQUIRED FOR COOKIES
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "Invalid credentials");
      }

      // Save safe user info (NOT TOKEN)
      localStorage.setItem("user", JSON.stringify(result.user));

      successText.textContent = result.message || "Login successful!";
      successMessage.style.display = "block";

      setTimeout(() => {
       
          window.location.href = "/";
        
      }, 800);

    } catch (err) {
      errorText.textContent = err.message || "Login failed";
      errorMessage.style.display = "block";
    }
  });

  /* ---------------- FORGOT PASSWORD ---------------- */
  forgotPasswordBtn.addEventListener("click", () => {
    passwordGroup.style.display = "none";
    formOptions.style.display = "none";
    signInBtn.style.display = "none";
    forgotPasswordBtn.style.display = "none";
    if (rememberMe?.closest("label")) rememberMe.closest("label").style.display = "none";

    sendOtpButton.style.display = "block";
    h3.style.display = "block";
    h2.style.display = "none";
  });

  /* ---------------- SEND / VERIFY OTP ---------------- */
  sendOtpButton.addEventListener("click", async () => {
    const phone = mobileInput.value.trim();

    if (!/^\d{10}$/.test(phone)) {
      return alert("Enter a valid 10-digit phone number");
    }

    try {
      if (!isOtpSent) {
        const res = await fetch("/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ phone: `+91${phone}` }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "OTP send failed");

        isOtpSent = true;
        otpInputGroup.style.display = "block";
        sendOtpButton.textContent = "Submit OTP";
      } else if (!isOtpVerified) {
        const code = document.getElementById("otpInput").value.trim();
        if (!/^\d{6}$/.test(code)) {
          otpValidation.textContent = "Invalid OTP";
          return;
        }

        const res = await fetch("/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ phone: `+91${phone}`, code }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "OTP verification failed");

        isOtpVerified = true;
        otpInputGroup.style.display = "none";
        sendOtpButton.style.display = "none";
        resetPasswordGroup.style.display = "block";
        resetBtn.style.display = "block";
      }
    } catch (err) {
      alert(err.message);
    }
  });

  /* ---------------- RESET PASSWORD ---------------- */
  resetBtn.addEventListener("click", async (e) => {
    e.preventDefault();

    const newPassword = document.getElementById("newPassword").value.trim();
    const confirmPassword = document.getElementById("confirmNewPassword").value.trim();
    const phone = mobileInput.value.trim();

    if (!newPassword || newPassword !== confirmPassword) {
      return alert("Passwords do not match");
    }

    try {
      const res = await fetch("/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Reset failed");

      alert("Password reset successful");
      window.location.reload();
    } catch (err) {
      alert(err.message);
    }
  });

  function hideMessages() {
    errorMessage.style.display = "none";
    successMessage.style.display = "none";
  }
});

/* ---------------- TOGGLE PASSWORD ---------------- */
function togglePassword(inputId) {
  const input = document.getElementById(inputId);
  const icon = input.nextElementSibling;

  if (input.type === "password") {
    input.type = "text";
    icon.classList.replace("fa-eye", "fa-eye-slash");
  } else {
    input.type = "password";
    icon.classList.replace("fa-eye-slash", "fa-eye");
  }
}
