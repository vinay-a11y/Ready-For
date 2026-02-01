// Pincode validation variables
const AVAILABLE_PINCODES = [
  '411032', '411046', '411051', '411007', // Pune
  '400001', '400002', '400003', '400004', '400005', // Mumbai
  '110001', '110002', '110003', '110004', '110005', // Delhi
  '560001', '560002', '560003', '560004', '560005'  // Bangalore
]

let userPincode = null
let isPincodeValidated = false

// Function to show toast messages
function showToast(message, type) {
  console.log(`[v0] Showing toast message: ${message} with type: ${type}`);
  // Implementation of showToast goes here
}

// Initialize pincode check on page load
function initializePincodeCheck() {
  console.log("[v0] Initializing pincode check...")
  const savedPincode = localStorage.getItem("userPincode")
  console.log("[v0] Saved pincode from localStorage:", savedPincode)
  
  if (savedPincode && AVAILABLE_PINCODES.includes(savedPincode)) {
    console.log("[v0] User has valid saved pincode:", savedPincode)
    userPincode = savedPincode
    isPincodeValidated = true
    console.log("[v0] Pincode validation skipped - user has saved pincode")
    closePincodeModal()
  } else {
    console.log("[v0] No valid saved pincode found - showing modal")
    openPincodeModal()
  }
}

// Open pincode modal
function openPincodeModal() {
  console.log("[v0] Opening pincode modal...")
  const modal = document.getElementById("pincodeModal")
  
  if (modal) {
    modal.style.display = "flex !important"
    modal.style.visibility = "visible !important"
    modal.style.opacity = "1 !important"
    modal.style.pointerEvents = "auto !important"
    document.body.style.overflow = "hidden"
    console.log("[v0] Modal opened successfully")
  } else {
    console.error("[v0] ERROR: Modal element with id 'pincodeModal' not found!")
  }
}

// Close pincode modal
function closePincodeModal() {
  console.log("[v0] Closing pincode modal...")
  const modal = document.getElementById("pincodeModal")
  if (modal) {
    modal.style.display = "none"
    document.body.style.overflow = "auto"
    console.log("[v0] Modal closed successfully")
  }
}

// Select a quick pincode
function selectQuickPincode(pincode) {
  console.log("[v0] Quick pincode selected:", pincode)
  const input = document.getElementById("pincodeInputField")
  if (input) {
    input.value = pincode
    validatePincodeInput(pincode)
  }
}

// Validate pincode input in real-time
function validatePincodeInput(value) {
  const pincode = value.trim()
  const errorMsg = document.getElementById("pincodeErrorMessage")
  const successMsg = document.getElementById("pincodeSuccessMessage")
  const submitBtn = document.getElementById("pincodeSubmitBtn")
  const statusIndicator = document.getElementById("pincodeInputStatus")

  console.log("[v0] Validating pincode:", pincode)

  // Reset messages
  if (errorMsg) errorMsg.style.display = "none"
  if (successMsg) successMsg.style.display = "none"
  if (statusIndicator) {
    statusIndicator.classList.remove("valid", "invalid")
  }

  // Validate only if 6 digits entered
  if (pincode.length === 6 && /^\d{6}$/.test(pincode)) {
    if (AVAILABLE_PINCODES.includes(pincode)) {
      console.log("[v0] Pincode is VALID:", pincode)
      if (successMsg) successMsg.style.display = "block"
      if (statusIndicator) statusIndicator.classList.add("valid")
      if (submitBtn) submitBtn.disabled = false
    } else {
      console.log("[v0] Pincode is INVALID (not in available list):", pincode)
      if (errorMsg) errorMsg.style.display = "block"
      if (statusIndicator) statusIndicator.classList.add("invalid")
      if (submitBtn) submitBtn.disabled = true
    }
  } else {
    console.log("[v0] Pincode format invalid:", pincode)
    if (submitBtn) submitBtn.disabled = true
  }
}

// Handle Enter key on pincode input
function handlePincodeKeyPress(event) {
  if (event.key === "Enter") {
    const submitBtn = document.getElementById("pincodeSubmitBtn")
    if (submitBtn && !submitBtn.disabled) {
      confirmPincode()
    }
  }
}

// Confirm and save pincode
function confirmPincode() {
  const input = document.getElementById("pincodeInputField")
  const pincode = input?.value.trim()

  console.log("[v0] Confirming pincode:", pincode)

  if (pincode && pincode.length === 6 && AVAILABLE_PINCODES.includes(pincode)) {
    userPincode = pincode
    isPincodeValidated = true
    localStorage.setItem("userPincode", pincode)
    console.log("[v0] Pincode saved to localStorage:", pincode)
    closePincodeModal()
    
    // Show success message
    showToast(`Delivery available for pincode ${pincode}!`, "success")
  } else {
    console.error("[v0] Invalid pincode:", pincode)
    const errorMsg = document.getElementById("pincodeErrorMessage")
    if (errorMsg) errorMsg.style.display = "block"
    
    showToast("Invalid pincode. Please try again.", "error")
  }
}

// Export functions to global scope
window.initializePincodeCheck = initializePincodeCheck
window.openPincodeModal = openPincodeModal
window.closePincodeModal = closePincodeModal
window.selectQuickPincode = selectQuickPincode
window.validatePincodeInput = validatePincodeInput
window.handlePincodeKeyPress = handlePincodeKeyPress
window.confirmPincode = confirmPincode

console.log("[v0] Pincode functions loaded and available globally")
