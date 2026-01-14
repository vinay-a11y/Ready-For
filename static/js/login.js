// ============================================
// LOGIN PAGE JAVASCRIPT
// ============================================

const loginForm = document.getElementById("loginForm")
const changePasswordForm = document.getElementById("changePasswordForm")
const forgotPasswordVerifyForm = document.getElementById("forgotPasswordVerifyForm")
const forgotPasswordResetForm = document.getElementById("forgotPasswordResetForm")
const forgotPasswordBtn = document.getElementById("forgotPasswordBtn")
const changePasswordBtn = document.getElementById("changePasswordBtn")
const resetPasswordBtn = document.getElementById("resetPasswordBtn")
const backToLoginBtn = document.getElementById("backToLoginBtn")
const backToVerifyBtn = document.getElementById("backToVerifyBtn")
const backToLoginFromChangeBtn = document.getElementById("backToLoginFromChangeBtn")
const switchToRegisterBtn = document.getElementById("switchToRegister")

// Form Data Storage
const forgotPasswordData = {}

// ============================================
// EVENT LISTENERS
// ============================================

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault()
  clearErrors()

  const submitBtn = loginForm.querySelector(".btn-primary")
  if (submitBtn) setButtonLoading(submitBtn, true)

  try {
    const formData = new FormData(loginForm)

    const response = await fetch("/login", {
      method: "POST",
      body: formData,
      credentials: "include",
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.detail || "Invalid credentials")
    }

    if (result.user) {
      localStorage.setItem("user", JSON.stringify(result.user))
    }

    showSuccess(result.message || "Login successful! Redirecting...")

    setTimeout(() => {
      window.location.href = "/"
    }, 800)
  } catch (err) {
    console.error("Login failed:", err)
    showError("mobileError", err.message || "Login failed")
  } finally {
    if (submitBtn) setButtonLoading(submitBtn, false)
  }
})

forgotPasswordBtn.addEventListener("click", (e) => {
  e.preventDefault()
  switchToForgotPassword(e)
})

changePasswordBtn.addEventListener("click", (e) => {
  e.preventDefault()
  switchToChangePassword(e)
})

backToLoginBtn.addEventListener("click", (e) => {
  e.preventDefault()
  switchToLogin()
})

backToVerifyBtn.addEventListener("click", (e) => {
  e.preventDefault()
  switchToVerify()
})

backToLoginFromChangeBtn.addEventListener("click", (e) => {
  e.preventDefault()
  switchToLogin()
})

switchToRegisterBtn.addEventListener("click", goToRegister)

// Password visibility toggles
document.querySelectorAll(".toggle-password").forEach((btn) => {
  btn.addEventListener("click", togglePasswordVisibility)
})

// Real-time validation
document.getElementById("password").addEventListener("input", validatePassword)
document.getElementById("newPassword").addEventListener("input", validateNewPassword)
document.getElementById("changeNewPassword").addEventListener("input", validateChangeNewPassword)

// ============================================
// LOGIN FORM SUBMISSION
// ============================================

function validateLoginInputs(mobile, password) {
  let isValid = true

  // Clear errors
  document.getElementById("mobileError").textContent = ""
  document.getElementById("passwordError").textContent = ""

  // Validate mobile
  if (!mobile || mobile.length !== 10 || !/^\d{10}$/.test(mobile)) {
    showError("mobileError", "Please enter a valid 10-digit phone number")
    isValid = false
  }

  // Validate password
  if (!password || password.length < 8) {
    showError("passwordError", "Password must be at least 8 characters")
    isValid = false
  }

  return isValid
}

// ============================================
// FORGOT PASSWORD - STEP 1: VERIFY
// ============================================

async function handleForgotPasswordVerify(e) {
  e.preventDefault()

  const phone = document.getElementById("resetMobile").value
  const answer1 = document.getElementById("securityAnswer1").value
  const answer2 = document.getElementById("securityAnswer2").value

  // Validate inputs
  if (!phone || phone.length !== 10 || !/^\d{10}$/.test(phone)) {
    showError("resetMobileError", "Please enter a valid 10-digit phone number")
    return
  }

  if (!answer1.trim()) {
    showError("answer1Error", "Please provide an answer")
    return
  }

  if (!answer2.trim()) {
    showError("answer2Error", "Please provide an answer")
    return
  }

  const submitBtn = forgotPasswordVerifyForm.querySelector(".btn-primary")
  setButtonLoading(submitBtn, true)

  try {
    const formData = new FormData()
    formData.append("phone", phone)
    formData.append("answer1", answer1)
    formData.append("answer2", answer2)

    const response = await fetch("/forgot-password/verify", {
      method: "POST",
      body: formData,
    })

    if (response.ok) {
      // Store phone for next step
      forgotPasswordData.phone = phone
      switchToReset()
    } else {
      const data = await response.json()
      showError("answer1Error", data.detail || "Verification failed. Please check your answers.")
    }
  } catch (error) {
    console.error("Verification error:", error)
    showError("answer1Error", "An error occurred. Please try again.")
  } finally {
    setButtonLoading(submitBtn, false)
  }
}

// ============================================
// FORGOT PASSWORD - STEP 2: RESET PASSWORD
// ============================================

async function handleForgotPasswordReset(e) {
  e.preventDefault()

  const newPassword = document.getElementById("newPassword").value
  const confirmPassword = document.getElementById("confirmNewPassword").value

  // Clear errors
  clearErrors()

  // Validate passwords
  if (!validatePasswordReset(newPassword, confirmPassword)) return

  const submitBtn = forgotPasswordResetForm.querySelector(".btn-primary")
  setButtonLoading(submitBtn, true)

  try {
    const formData = new FormData()
    formData.append("phone", forgotPasswordData.phone)
    formData.append("new_password", newPassword)
    formData.append("confirm_password", confirmPassword)

    const response = await fetch("/forgot-password/reset", {
      method: "POST",
      body: formData,
    })

    const data = await response.json()

    if (response.ok) {
      showSuccess("Password reset successful! Redirecting to login...")
      setTimeout(() => switchToLogin(), 1500)
    } else {
      showError("newPasswordError", data.detail || "Password reset failed")
    }
  } catch (error) {
    console.error("Reset error:", error)
    showError("newPasswordError", "An error occurred. Please try again.")
  } finally {
    setButtonLoading(submitBtn, false)
  }
}

function validatePasswordReset(newPassword, confirmPassword) {
  let isValid = true

  if (!validatePasswordStrength(newPassword)) {
    showError("newPasswordError", "Password does not meet requirements")
    isValid = false
  }

  if (newPassword !== confirmPassword) {
    showError("confirmNewPasswordError", "Passwords do not match")
    isValid = false
  }

  return isValid
}

// ============================================
// CHANGE PASSWORD FORM HANDLER
// ============================================

async function handleChangePassword(e) {
  e.preventDefault()

  const mobile = document.getElementById("changeMobile").value
  const currentPassword = document.getElementById("currentPassword").value
  const newPassword = document.getElementById("changeNewPassword").value
  const confirmPassword = document.getElementById("changeConfirmPassword").value

  // Clear errors
  clearErrors()

  // Validate inputs
  if (!mobile || mobile.length !== 10 || !/^\d{10}$/.test(mobile)) {
    showError("changeMobileError", "Please enter a valid 10-digit phone number")
    return
  }

  if (!currentPassword) {
    showError("currentPasswordError", "Please enter your current password")
    return
  }

  if (!validatePasswordStrength(newPassword)) {
    showError("changeNewPasswordError", "New password does not meet requirements")
    return
  }

  if (newPassword !== confirmPassword) {
    showError("changeConfirmPasswordError", "Passwords do not match")
    return
  }

  const submitBtn = changePasswordForm.querySelector(".btn-primary")
  setButtonLoading(submitBtn, true)

  try {
    const formData = new FormData()
    formData.append("phone", mobile)
    formData.append("current_password", currentPassword)
    formData.append("new_password", newPassword)
    formData.append("confirm_password", confirmPassword)

    const response = await fetch("/change-password", {
      method: "POST",
      body: formData,
    })

    const data = await response.json()

    if (response.ok) {
      showSuccess("Password changed successfully! Redirecting to login...")
      setTimeout(() => switchToLogin(), 1500)
    } else {
      showError("currentPasswordError", data.detail || "Password change failed")
    }
  } catch (error) {
    console.error("Change password error:", error)
    showError("currentPasswordError", "An error occurred. Please try again.")
  } finally {
    setButtonLoading(submitBtn, false)
  }
}

function validateChangeNewPassword(e) {
  const password = e.target.value
  const strengthDiv = document.getElementById("changePasswordStrength")

  if (!password) {
    strengthDiv.style.display = "none"
    return
  }

  strengthDiv.style.display = "flex"
  updatePasswordStrength(password, "changeNewPassword")
}

// ============================================
// PASSWORD VALIDATION & STRENGTH
// ============================================

function showForm(formToShow) {
  document.querySelectorAll(".auth-form").forEach((form) => {
    form.classList.remove("active-form")
  })
  formToShow.classList.add("active-form")
}

function validatePassword(e) {
  const password = e.target.value
  const strengthDiv = document.getElementById("passwordStrength")

  if (!password) {
    strengthDiv.style.display = "none"
    return
  }

  strengthDiv.style.display = "flex"
  updatePasswordStrength(password, "password")
}

function validateNewPassword(e) {
  const password = e.target.value
  const strengthDiv = document.getElementById("passwordStrength")

  if (!password) {
    strengthDiv.style.display = "none"
    return
  }

  strengthDiv.style.display = "flex"
  updatePasswordStrength(password, "newPassword")
}

function updatePasswordStrength(password, fieldId) {
  const requirements = {
    "8chars": password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
  }

  // Update requirement indicators
  updateRequirementUI(requirements)

  // Calculate strength
  const metRequirements = Object.values(requirements).filter(Boolean).length
  const strength = (metRequirements / 5) * 100

  // Update strength bar
  const strengthBar = document.querySelector(".strength-bar::after") || document.querySelector(".strength-bar")
  if (strengthBar) {
    const bar = strengthBar.style || strengthBar
    bar.width = strength + "%"

    if (strength < 40) bar.background = "#ef4444"
    else if (strength < 70) bar.background = "#f59e0b"
    else bar.background = "#10b981"
  }
}

function updateRequirementUI(requirements) {
  const ids = {
    "8chars": "req-8chars",
    uppercase: "req-uppercase",
    lowercase: "req-lowercase",
    number: "req-number",
    special: "req-special",
  }

  Object.keys(ids).forEach((key) => {
    const elem = document.getElementById(ids[key])
    if (elem) {
      if (requirements[key]) {
        elem.classList.add("met")
      } else {
        elem.classList.remove("met")
      }
    }
  })
}

function validatePasswordStrength(password) {
  const requirements = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
  }

  return Object.values(requirements).every(Boolean)
}

// ============================================
// UI SWITCHING FUNCTIONS
// ============================================

function switchToChangePassword(e) {
  if (e && e.preventDefault) e.preventDefault()
  console.log("[v0] Switching to change password form")
  showForm(changePasswordForm)
  clearErrors()
}

function switchToResetPassword(e) {
  e.preventDefault()
  showForm(forgotPasswordResetForm)
  clearErrors()
}

function switchToForgotPassword(e) {
  if (e && e.preventDefault) e.preventDefault()
  console.log("[v0] Switching to forgot password form")
  showForm(forgotPasswordVerifyForm)
  clearErrors()
}

function switchToLogin() {
  console.log("[v0] Switching back to login form")
  showForm(loginForm)
  clearForm(changePasswordForm)
  clearForm(forgotPasswordVerifyForm)
  clearForm(forgotPasswordResetForm)
  clearErrors()
}

function switchToVerify() {
  console.log("[v0] Switching to verify form")
  showForm(forgotPasswordVerifyForm)
  clearForm(forgotPasswordResetForm)
  clearErrors()
}

function switchToReset() {
  showForm(forgotPasswordResetForm)
  clearForm(forgotPasswordVerifyForm)
  clearErrors()
}

function goToRegister() {
  window.location.href = "/register"
}

// ============================================
// PASSWORD VISIBILITY TOGGLE
// ============================================

function togglePasswordVisibility(e) {
  e.preventDefault()
  const fieldId = e.target.dataset.target
  const input = document.getElementById(fieldId)

  if (input.type === "password") {
    input.type = "text"
    e.target.textContent = "🙈" // Changed to closed eye emoji when text is visible
  } else {
    input.type = "password"
    e.target.textContent = "👁️" // Changed back to open eye when hidden
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function showError(fieldId, message) {
  const errorElement = document.getElementById(fieldId)
  if (errorElement) {
    errorElement.textContent = message
  }
}

function showSuccess(message) {
  const successDiv = document.getElementById("successMessage")
  const successText = document.getElementById("successText")
  if (successDiv && successText) {
    successText.textContent = message
    successDiv.classList.remove("hidden")
  }
}

function clearErrors() {
  document.querySelectorAll(".error-message").forEach((el) => {
    el.textContent = ""
  })
}

function clearForm(form) {
  form.querySelectorAll("input").forEach((input) => {
    input.value = ""
  })
}

function setButtonLoading(btn, isLoading) {
  const btnText = btn.querySelector(".btn-text")
  const btnLoader = btn.querySelector(".btn-loader")

  if (isLoading) {
    btn.disabled = true
    btnText.classList.add("hidden")
    btnLoader.classList.remove("hidden")
  } else {
    btn.disabled = false
    btnText.classList.remove("hidden")
    btnLoader.classList.add("hidden")
  }
}

// Attach form listeners
changePasswordForm.addEventListener("submit", handleChangePassword)
forgotPasswordVerifyForm.addEventListener("submit", handleForgotPasswordVerify)
forgotPasswordResetForm.addEventListener("submit", handleForgotPasswordReset)

document.addEventListener("DOMContentLoaded", () => {
  // Handle back button click for verify form
  const backBtnInline = document.getElementById("backToLoginBtn")
  if (backBtnInline) {
    backBtnInline.addEventListener("click", (e) => {
      e.preventDefault()
      console.log("[v0] Back button clicked from verify form")
      switchToLogin()
    })
  }
})
