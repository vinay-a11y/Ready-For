// ============================================
// REGISTER PAGE JAVASCRIPT
// ============================================

const registerForm = document.getElementById("registerForm")
const switchToLoginBtn = document.getElementById("switchToLogin")
const acceptTermsInput = document.getElementById("acceptTerms")

// Form field references
const firstNameInput = document.getElementById("firstName")
const phoneInput = document.getElementById("phone")
const security_q1Input = document.getElementById("security_q1")
const security_q2Input = document.getElementById("security_q2")
const passwordInput = document.getElementById("password")
const confirmPasswordInput = document.getElementById("confirmPassword")

// ============================================
// EVENT LISTENERS
// ============================================

registerForm.addEventListener("submit", handleRegisterSubmit)
switchToLoginBtn.addEventListener("click", goToLogin)

// Real-time password strength validation
passwordInput.addEventListener("input", validatePasswordStrength)

// Password visibility toggles
document.querySelectorAll(".toggle-password").forEach((btn) => {
  btn.addEventListener("click", togglePasswordVisibility)
})

// Real-time field validation
firstNameInput.addEventListener("blur", validateFirstName)
phoneInput.addEventListener("blur", validatePhone)
security_q1Input.addEventListener("blur", validateSecurityAnswers)
security_q2Input.addEventListener("blur", validateSecurityAnswers)
confirmPasswordInput.addEventListener("input", validatePasswordMatch)

// ============================================
// FORM SUBMISSION
// ============================================

async function handleRegisterSubmit(e) {
  e.preventDefault()

  // Validate all fields
  if (!validateAllFields()) return

  const submitBtn = registerForm.querySelector(".btn-primary")
  setButtonLoading(submitBtn, true)

  try {
    const formData = new FormData()
    formData.append("firstName", firstNameInput.value)
    formData.append("phone", phoneInput.value)
    formData.append("security_q1", security_q1Input.value)
    formData.append("security_q2", security_q2Input.value)
    formData.append("password", passwordInput.value)
    formData.append("confirmPassword", confirmPasswordInput.value)

    const response = await fetch("/register", {
      method: "POST",
      body: formData,
    })

    const data = await response.json()

    if (response.ok) {
      showSuccess("Account created successfully! Redirecting to login...")
      setTimeout(() => (window.location.href = "/login"), 1500)
    } else {
      showError(data.error || "Registration failed. Please try again.")
    }
  } catch (error) {
    console.error("Registration error:", error)
    showError("An error occurred. Please try again.")
  } finally {
    setButtonLoading(submitBtn, false)
  }
}

// ============================================
// FIELD VALIDATION
// ============================================

function validateAllFields() {
  clearAllErrors()
  let isValid = true

  if (!validateFirstName()) isValid = false
  if (!validatePhone()) isValid = false
  if (!validateSecurityAnswers()) isValid = false
  if (!validatePassword()) isValid = false
  if (!validatePasswordMatch()) isValid = false
  if (!validateTerms()) isValid = false

  return isValid
}
function validateTerms() {
  const errorElement = document.getElementById("termsError")

  if (!acceptTermsInput.checked) {
    if (errorElement) {
      errorElement.textContent = "You must accept the Terms & Conditions"
    }
    return false
  }

  if (errorElement) errorElement.textContent = ""
  return true
}


function validateFirstName() {
  const value = firstNameInput.value.trim()
  const errorElement = document.getElementById("firstNameError")

  if (!value) {
    if (errorElement) errorElement.textContent = "First name is required"
    return false
  }

  if (value.length < 2) {
    if (errorElement) errorElement.textContent = "First name must be at least 2 characters"
    return false
  }

  if (!/^[a-zA-Z\s'-]+$/.test(value)) {
    if (errorElement) errorElement.textContent = "First name can only contain letters, spaces, hyphens, and apostrophes"
    return false
  }

  if (errorElement) errorElement.textContent = ""
  return true
}

function validatePhone() {
  const value = phoneInput.value.trim()
  const errorElement = document.getElementById("phoneError")

  if (!value) {
    if (errorElement) errorElement.textContent = "Phone number is required"
    return false
  }

  if (!/^\d{10}$/.test(value)) {
    if (errorElement) errorElement.textContent = "Please enter a valid 10-digit phone number"
    return false
  }

  if (errorElement) errorElement.textContent = ""
  return true
}

function validateSecurityAnswers() {
  const q1 = security_q1Input.value.trim()
  const q2 = security_q2Input.value.trim()
  const errorElement1 = document.getElementById("security_q1Error")
  const errorElement2 = document.getElementById("security_q2Error")

  if (!q1) {
    if (errorElement1) errorElement1.textContent = "This field is required"
    return false
  }

  if (!q2) {
    if (errorElement2) errorElement2.textContent = "This field is required"
    return false
  }

  if (errorElement1) errorElement1.textContent = ""
  if (errorElement2) errorElement2.textContent = ""
  return true
}

function validatePassword() {
  const password = passwordInput.value
  const errorElement = document.getElementById("passwordError")

  if (!password) {
    if (errorElement) errorElement.textContent = "Password is required"
    return false
  }

  const requirements = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
  }

  const allMet = Object.values(requirements).every(Boolean)

  if (!allMet) {
    if (errorElement) errorElement.textContent = "Password does not meet all requirements"
    return false
  }

  if (errorElement) errorElement.textContent = ""
  return true
}

function validatePasswordMatch() {
  const password = passwordInput.value
  const confirm = confirmPasswordInput.value
  const errorElement = document.getElementById("confirmPasswordError")

  if (confirm && password !== confirm) {
    if (errorElement) errorElement.textContent = "Passwords do not match"
    return false
  }

  if (errorElement) errorElement.textContent = ""
  return true
}

function validatePasswordStrength(e) {
  const password = e.target.value
  const strengthDiv = document.getElementById("passwordStrength")

  if (!password) {
    strengthDiv.style.display = "none"
    return
  }

  strengthDiv.style.display = "flex"

  const requirements = {
    "8chars": password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
  }

  // Update requirement indicators
  Object.keys(requirements).forEach((key) => {
    const elem = document.getElementById(`req-${key}`)
    if (elem) {
      if (requirements[key]) {
        elem.classList.add("met")
      } else {
        elem.classList.remove("met")
      }
    }
  })

  // Calculate strength percentage
  const metCount = Object.values(requirements).filter(Boolean).length
  const strength = (metCount / 5) * 100

  // Update strength bar
  const strengthBar = document.querySelector(".strength-bar")
  if (strengthBar) {
    const fill = strengthBar.querySelector("div") || strengthBar
    if (fill) {
      fill.style.width = strength + "%"
      if (strength < 40) fill.style.background = "#ef4444"
      else if (strength < 70) fill.style.background = "#f59e0b"
      else fill.style.background = "#10b981"
    }
  }

  const strengthText = document.querySelector(".strength-text")
  if (strengthText) {
    if (strength < 40) strengthText.textContent = "Weak password"
    else if (strength < 70) strengthText.textContent = "Fair password"
    else strengthText.textContent = "Strong password"
  }
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
    e.target.textContent = "🙈"
  } else {
    input.type = "password"
    e.target.textContent = "👁️"
  }
}

// ============================================
// NAVIGATION
// ============================================

function goToLogin() {
  window.location.href = "/login"
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function showError(message) {
  const successDiv = document.getElementById("successMessage")
  if (successDiv) {
    successDiv.classList.add("hidden")
  }

  // Show error in first available field
  const firstError = registerForm.querySelector(".error-message")
  if (firstError) {
    firstError.textContent = message
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

function clearAllErrors() {
  document.querySelectorAll(".error-message").forEach((el) => {
    el.textContent = ""
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
