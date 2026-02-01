// Modern Cart Management System - Gokhale Bandhu
// ============================================

let cart = []
let userDetails = {}
let selectedAddress = null
let savedAddresses = []
let checkoutExpanded = false
let sectionsState = {
  address: true,
  date: false
}

const pincodes = {
  available: [
    "411032", "411046", "411051", "411007", "411027", "411002", "411045", "411021",
    "411042", "411038", "411004", "411052", "411011", "413130", "411003", "411030",
    "411037", "411016", "411028", "411036", "411048", "411041", "411009", "412108",
    "410512", "412303", "411017", "411001", "411020", "411023", "411005", "411057",
    "411058", "411006", "412106", "411015", "400001", "400002", "400003", "400004",
    "400005", "400006", "400007", "400008", "400009", "400010", "400011", "400012",
    "400013", "400014", "400015", "400016", "400017", "400018", "400019", "400020",
    "110001", "110002", "110003", "110004", "110005", "110006", "110007",
    "560001", "560002", "560003", "560004", "560005", "560006", "560007",
  ],
}

const DISCOUNT_PERCENTAGE = 17
const DELIVERY_CHARGE = 90
const FREE_DELIVERY_THRESHOLD = 1800

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener("DOMContentLoaded", async () => {
  try {
    loadCartFromStorage()
    await loadUserDetails()
    await fetchCartFromBackend()
    setupMinDeliveryDate()
    renderCart()
  } catch (error) {
    console.error("Initialization error:", error)
    showToast("Failed to load cart data", "error")
  }
})

// ============================================
// DATA LOADING
// ============================================
function loadCartFromStorage() {
  try {
    const savedCart = localStorage.getItem("cart")
    if (savedCart) {
      cart = JSON.parse(savedCart)
    }
  } catch (error) {
    console.error("Error loading cart from storage:", error)
    cart = []
  }
}

async function loadUserDetails() {
  try {
    const user = JSON.parse(localStorage.getItem("user"))
    if (user) {
      userDetails = user
      await loadSavedAddresses()
    } else {
      userDetails = { id: 1 }
    }
  } catch (error) {
    console.error("Error loading user details:", error)
    userDetails = { id: 1 }
  }
}

async function loadSavedAddresses() {
  try {
    const response = await fetch(`/api/user/addresses?id=${userDetails.id}`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })

    if (response.ok) {
      const data = await response.json()
      savedAddresses = Array.isArray(data) ? data : Array.isArray(data?.addresses) ? data.addresses : []

      const storedAddressId = localStorage.getItem("selectedAddressId")
      if (storedAddressId && savedAddresses.length > 0) {
        const storedAddress = savedAddresses.find((addr) => addr.id == storedAddressId)
        if (storedAddress) selectedAddress = storedAddress
      }

      if (!selectedAddress && savedAddresses.length > 0) {
        selectedAddress = savedAddresses[0]
        localStorage.setItem("selectedAddressId", selectedAddress.id)
      }
    }
  } catch (error) {
    console.error("Error loading saved addresses:", error)
    savedAddresses = []
  }
}
function prefillUserPincode() {
  const savedPincode = localStorage.getItem("userPincode")
  const pincodeInput = document.getElementById("pincodeInput")

  if (!savedPincode || !pincodeInput) return

  pincodeInput.value = savedPincode
  checkPincode() // reuse existing validation
}

async function fetchCartFromBackend() {
  try {
    const response = await fetch("/cart", {
      credentials: "include"
    })
    
    const contentType = response.headers.get("content-type")
    if (!contentType || !contentType.includes("application/json")) {
      console.warn("Cart endpoint returned non-JSON response, using localStorage")
      return
    }

    const data = await response.json()
    if (Array.isArray(data)) {
      cart = data
      localStorage.setItem("cart", JSON.stringify(cart))
    }
  } catch (error) {
    console.error("Error fetching cart:", error)
  }
}

// ============================================
// PRICING CALCULATIONS (FIXED)
// ============================================
function calculatePricing() {
  // item.price is the FINAL selling price (what customer pays)
  // displayPrice = sellingPrice * 1.17 (to show as crossed out)
  // discount = displayPrice - sellingPrice
  
  const subtotal = cart.reduce((sum, item) => {
    const sellingPrice = item.price // This is what customer pays
    const displayPrice = sellingPrice * 1.17 // This is what we show crossed out
    return sum + displayPrice * item.quantity
  }, 0)

  const discount = cart.reduce((sum, item) => {
    const sellingPrice = item.price
    const displayPrice = sellingPrice * 1.17
    const discountAmount = displayPrice - sellingPrice
    return sum + discountAmount * item.quantity
  }, 0)

  const actualTotal = cart.reduce((sum, item) => {
    return sum + item.price * item.quantity
  }, 0)

  const shipping = actualTotal > FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_CHARGE
  const total = actualTotal + shipping

  return { subtotal, discount, total, shipping, actualTotal }
}

function updateAllPricing() {
  const { subtotal, discount, total, shipping } = calculatePricing()

  // Mobile bottom bar
  document.getElementById("bottomTotal").textContent = `₹${total.toFixed(2)}`
  document.getElementById("detailSubtotal").textContent = `₹${subtotal.toFixed(2)}`
  document.getElementById("detailDiscount").textContent = `-₹${discount.toFixed(2)}`
  
  const shippingDisplay = shipping === 0 ? "FREE" : `₹${shipping.toFixed(2)}`
  document.getElementById("detailShipping").textContent = shippingDisplay
  document.getElementById("detailTotal").textContent = `₹${total.toFixed(2)}`
  document.getElementById("savingsText").textContent = `Save ₹${discount.toFixed(2)} (${DISCOUNT_PERCENTAGE}% OFF)`

  // Desktop sidebar
  if (window.innerWidth >= 768) {
    document.getElementById("sidebarSubtotal").textContent = `₹${subtotal.toFixed(2)}`
    document.getElementById("sidebarDiscount").textContent = `-₹${discount.toFixed(2)}`
    document.getElementById("sidebarShipping").textContent = shippingDisplay
    document.getElementById("sidebarTotal").textContent = `₹${total.toFixed(2)}`
    document.getElementById("sidebarSavingsText").textContent = `Save ₹${discount.toFixed(2)} on this order`
  }
}

// ============================================
// RENDERING
// ============================================
function renderCart() {
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0)
  
  // Update cart count
  document.getElementById('mobileCartCount').textContent = totalItems
  document.getElementById('itemCount').textContent = `${totalItems} item${totalItems !== 1 ? 's' : ''}`

  if (cart.length === 0) {
    showEmptyCart()
  } else {
    showCartContent()
    renderCartItems()
    renderSelectedAddress()
  }

  updateAllPricing()
}

function showEmptyCart() {
  document.getElementById('emptyCartState').style.display = 'block'
  document.getElementById('cartSection').style.display = 'none'
  document.getElementById('deliverySection').style.display = 'none'
  document.getElementById('bottomCheckoutBar').style.display = 'none'
  
  if (window.innerWidth >= 768) {
    document.querySelector('.checkout-sidebar').style.display = 'none'
  }
}

function showCartContent() {
  document.getElementById('emptyCartState').style.display = 'none'
  document.getElementById('cartSection').style.display = 'block'
  document.getElementById('deliverySection').style.display = 'block'
  document.getElementById('bottomCheckoutBar').style.display = 'block'
  
  if (window.innerWidth >= 768) {
    document.querySelector('.checkout-sidebar').style.display = 'block'
  }
}

function renderCartItems() {
  const container = document.getElementById('cartItemsList')
  
  container.innerHTML = cart.map((item, index) => {
    const sellingPrice = item.price // Final price customer pays
    const displayPrice = sellingPrice * 1.17 // Price to show crossed out

    return `
      <div class="cart-item" style="animation-delay: ${index * 0.1}s">
        <div class="item-image-wrapper">
          <div class="item-image">
            ${item.image 
              ? `<img src="${item.image}" alt="${item.name || item.item_name}" loading="lazy">` 
              : `<div class="placeholder">${item.icon || '🛍️'}</div>`
            }
          </div>
        </div>

        <div class="item-details">
          <div class="item-name">${item.name || item.item_name}</div>
          <div class="item-variant">₹${sellingPrice.toFixed(2)} each</div>
          
          <div class="item-pricing">
            <span class="item-price">₹${(sellingPrice * item.quantity).toFixed(2)}</span>
            <span class="item-original-price">₹${(displayPrice * item.quantity).toFixed(2)}</span>
            <span class="item-discount">${DISCOUNT_PERCENTAGE}% OFF</span>
          </div>
        </div>

        <div class="item-actions">
          <div class="quantity-controls">
            <button class="quantity-btn decrease" onclick="updateQuantity(${item.id}, -1)" aria-label="Decrease quantity">
              ${item.quantity === 1 ? '<i class="fas fa-trash"></i>' : '-'}
            </button>
            <input type="number" class="quantity-display" value="${item.quantity}" readonly aria-label="Quantity">
            <button class="quantity-btn" onclick="updateQuantity(${item.id}, 1)" aria-label="Increase quantity">+</button>
          </div>
        </div>
      </div>
    `
  }).join('')
}

function renderSelectedAddress() {
  const container = document.getElementById('selectedAddressCard')
  const statusText = document.getElementById('addressStatus')

  if (!selectedAddress) {
    statusText.textContent = 'Select address'
    container.innerHTML = `
      <div class="no-address">
        <i class="fas fa-map-marker-alt"></i>
        <p>No address selected</p>
        <button class="add-address-btn" onclick="openAddressModal()">
          <i class="fas fa-plus"></i>
          Add Address
        </button>
      </div>
    `
  } else {
    statusText.textContent = 'Address selected'
    container.innerHTML = `
      <div class="address-info">
        <span class="address-type-badge">
          <i class="fas fa-${selectedAddress.type === 'home' ? 'home' : selectedAddress.type === 'office' ? 'building' : 'map-marker-alt'}"></i>
          ${selectedAddress.type}
        </span>
        <div class="address-text">
          ${selectedAddress.line1}<br>
          ${selectedAddress.line2 ? selectedAddress.line2 + '<br>' : ''}
          ${selectedAddress.city}, ${selectedAddress.state} - ${selectedAddress.pincode}
        </div>
        <button class="change-address-btn" onclick="openAddressModal()">
          <i class="fas fa-edit"></i>
          Change Address
        </button>
      </div>
    `
  }
}

// ============================================
// CART ACTIONS
// ============================================
async function updateQuantity(productId, change) {
  try {
    const itemIndex = cart.findIndex((item) => item.id === productId)

    if (itemIndex !== -1) {
      cart[itemIndex].quantity += change

      if (cart[itemIndex].quantity <= 0) {
        cart.splice(itemIndex, 1)
        showToast("Item removed from cart", "success")
      } else {
        showToast("Cart updated", "success")
      }

      localStorage.setItem("cart", JSON.stringify(cart))
      renderCart()
    }
  } catch (error) {
    console.error("Error updating quantity:", error)
    showToast("Error updating cart", "error")
  }
}

// ============================================
// SECTION TOGGLE
// ============================================
function toggleSection(section) {
  const content = document.getElementById(`${section}Content`)
  const toggle = document.getElementById(`${section}Toggle`)
  
  sectionsState[section] = !sectionsState[section]
  
  if (sectionsState[section]) {
    content.classList.remove('collapsed')
    toggle.classList.add('rotated')
  } else {
    content.classList.add('collapsed')
    toggle.classList.remove('rotated')
  }
}

// ============================================
// CHECKOUT DETAILS TOGGLE (Mobile)
// ============================================
function toggleCheckoutDetails() {
  const details = document.getElementById('checkoutDetails')
  checkoutExpanded = !checkoutExpanded
  
  if (checkoutExpanded) {
    details.classList.add('expanded')
  } else {
    details.classList.remove('expanded')
  }
}

// ============================================
// DELIVERY DATE
// ============================================
function setupMinDeliveryDate() {
  const dateInput = document.getElementById('deliveryDate')
  if (!dateInput) return

  const today = new Date()
  today.setDate(today.getDate() + 2)
  const minDate = today.toISOString().split('T')[0]

  const maxDate = new Date()
  maxDate.setDate(maxDate.getDate() + 20)
  const maxDateStr = maxDate.toISOString().split('T')[0]

  dateInput.min = minDate
  dateInput.max = maxDateStr

  const saved = localStorage.getItem('selectedDeliveryDate')
  if (saved) {
    dateInput.value = saved
    document.getElementById('dateStatus').textContent = new Date(saved).toLocaleDateString()
  }
}

function updateDeliveryDate() {
  const dateInput = document.getElementById('deliveryDate')
  const date = dateInput.value
  
  if (date) {
    localStorage.setItem('selectedDeliveryDate', date)
    document.getElementById('dateStatus').textContent = new Date(date).toLocaleDateString()
    showToast('Delivery date updated', 'success')
  }
}

// ============================================
// ADDRESS MODAL
// ============================================
function openAddressModal() {
  const modal = document.getElementById('addressModal')
  modal.classList.add('active')
  renderAddressModal()
}

function closeAddressModal() {
  const modal = document.getElementById('addressModal')
  modal.classList.remove('active')
}

function renderAddressModal() {
  const container = document.getElementById('addressModalBody')
  
  container.innerHTML = `
    <div class="address-form">
      <h4 style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">Add New Address</h4>
      
      <div class="form-group">
        <label for="addressLine1">Address Line 1 *</label>
        <input type="text" id="addressLine1" placeholder="House no, Building name" required>
      </div>

      <div class="form-group">
        <label for="addressLine2">Address Line 2</label>
        <input type="text" id="addressLine2" placeholder="Road name, Area, Colony">
      </div>

      <div class="form-group">
        <label for="city">City *</label>
        <input type="text" id="city" placeholder="City" required>
      </div>

      <div class="form-group">
        <label for="state">State *</label>
        <input type="text" id="state" placeholder="State" required>
      </div>

      <div class="form-group">
        <label for="pincodeInput">Pincode *</label>
        <div class="pincode-wrapper">
          <input type="text" id="pincodeInput" placeholder="6-digit pincode" maxlength="6" oninput="checkPincode()" required>
          <span id="pincodeStatus" class="pincode-status"></span>
        </div>
        <div id="pincodeError" class="pincode-error" style="display: none;">
          Delivery not available in your area
        </div>
      </div>

      <div class="form-group">
        <label for="addressType">Address Type</label>
        <select id="addressType">
          <option value="home">Home</option>
          <option value="office">Office</option>
          <option value="other">Other</option>
        </select>
      </div>

      <button class="submit-address-btn" onclick="addNewAddress()">
        <i class="fas fa-plus"></i>
        Save Address
      </button>
    </div>

    ${savedAddresses.length > 0 ? `
      <div class="saved-addresses">
        <h4>Saved Addresses (${savedAddresses.length})</h4>
        ${renderSavedAddresses()}
      </div>
    ` : ''}
  `
    setTimeout(prefillUserPincode, 0)

}

function renderSavedAddresses() {
  return savedAddresses.map((address, index) => `
    <div class="saved-address-item ${selectedAddress && selectedAddress.id === address.id ? 'selected' : ''}" onclick="selectSavedAddress(${index})">
      <div class="address-content">
        <span class="address-type-badge">
          <i class="fas fa-${address.type === 'home' ? 'home' : address.type === 'office' ? 'building' : 'map-marker-alt'}"></i>
          ${address.type}
        </span>
        <div class="address-text">
          ${address.line1}<br>
          ${address.line2 ? address.line2 + '<br>' : ''}
          ${address.city}, ${address.state} - ${address.pincode}
        </div>
      </div>
      <div class="address-actions">
        <button class="delete-btn" onclick="deleteAddress(${index}); event.stopPropagation();" aria-label="Delete address">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `).join('')
}

function checkPincode() {
  const pincodeInput = document.getElementById("pincodeInput")
  const pincodeStatus = document.getElementById("pincodeStatus")
  const pincodeError = document.getElementById("pincodeError")
  const pincode = pincodeInput.value.trim()

  if (pincode.length === 6) {
    if (pincodes.available.includes(pincode)) {
      pincodeStatus.textContent = "✅"
      pincodeError.style.display = "none"
      pincodeInput.style.borderColor = "var(--success)"
    } else {
      pincodeStatus.textContent = "❌"
      pincodeError.style.display = "block"
      pincodeInput.style.borderColor = "var(--error)"
    }
  } else {
    pincodeStatus.textContent = ""
    pincodeError.style.display = "none"
    pincodeInput.style.borderColor = "var(--border-color)"
  }
}

async function addNewAddress() {
  const line1 = document.getElementById("addressLine1")?.value.trim()
  const line2 = document.getElementById("addressLine2")?.value.trim()
  const city = document.getElementById("city")?.value.trim()
  const state = document.getElementById("state")?.value.trim()
  const pincode = document.getElementById("pincodeInput")?.value.trim()
  const type = document.getElementById("addressType")?.value

  if (!line1 || !city || !state || !pincode) {
    showToast("Please fill all required fields", "error")
    return
  }

  if (!/^\d{6}$/.test(pincode)) {
    showToast("Please enter a valid 6-digit pincode", "error")
    return
  }

  if (!pincodes.available.includes(pincode)) {
    showToast("Delivery not available in your area", "error")
    return
  }

  const newAddress = {
    id: Date.now(),
    line1,
    line2,
    city,
    state,
    pincode,
    type,
  }

  try {
    const response = await fetch("/api/user/address", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        id: userDetails.id,
        address: newAddress,
      }),
    })

    if (response.ok) {
      savedAddresses.push(newAddress)
      selectedAddress = newAddress
      localStorage.setItem("selectedAddressId", selectedAddress.id)

      showToast("Address added successfully", "success")
      renderAddressModal()
      renderSelectedAddress()
    } else {
      const error = await response.json().catch(() => ({}))
      showToast(error.detail || "Failed to save address", "error")
    }
  } catch (error) {
    console.error("Error saving address:", error)
    showToast("Error saving address. Please try again.", "error")
  }
}

function selectSavedAddress(index) {
  if (index >= 0 && index < savedAddresses.length) {
    selectedAddress = savedAddresses[index]
    localStorage.setItem("selectedAddressId", selectedAddress.id)
    renderAddressModal()
    renderSelectedAddress()
    showToast("Address selected successfully", "success")
    setTimeout(() => closeAddressModal(), 500)
  }
}

async function deleteAddress(index) {
  if (!confirm("Are you sure you want to delete this address?")) return

  try {
    const address = savedAddresses[index]
    if (!address) return

    const response = await fetch(`/api/user/address/${address.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        address_id: address.id,
        user_id: userDetails.id,
      }),
    })

    if (response.ok) {
      savedAddresses.splice(index, 1)

      if (selectedAddress && selectedAddress.id === address.id) {
        selectedAddress = savedAddresses.length > 0 ? savedAddresses[0] : null
        if (selectedAddress) {
          localStorage.setItem("selectedAddressId", selectedAddress.id)
        } else {
          localStorage.removeItem("selectedAddressId")
        }
      }

      renderAddressModal()
      renderSelectedAddress()
      showToast("Address deleted successfully", "success")
    } else {
      showToast("Failed to delete address", "error")
    }
  } catch (error) {
    console.error("Error deleting address:", error)
    showToast("Error deleting address", "error")
  }
}

// ============================================
// CHECKOUT
// ============================================
async function proceedToCheckout() {
  if (cart.length === 0) {
    showToast("Your cart is empty!", "error")
    return
  }

  if (!selectedAddress) {
    showToast("Please select a delivery address", "error")
    openAddressModal()
    return
  }

  const deliveryDate = document.getElementById("deliveryDate")?.value || localStorage.getItem("selectedDeliveryDate")
  const { total } = calculatePricing()

  try {
    showToast("Processing your order...", "info")
    
    const orderPayload = {
      amount: total,
      items: cart,
      deliveryAddress: selectedAddress,
      deliveryDate: deliveryDate,
    }

    const res = await fetch("/create-order/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(orderPayload),
    })

    const data = await res.json()

    if (!res.ok || !data.order_id) {
      throw new Error(data.detail || "Failed to create order")
    }

    const options = {
      key: data.key,
      amount: Math.round(total * 100),
      currency: "INR",
      name: "Gokhale Bandhu",
      description: "Order Payment",
      order_id: data.order_id,

      handler: async (response) => {
        try {
          const verifyRes = await fetch("/verify-payment/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              order_id: response.razorpay_order_id,
              payment_id: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            }),
          })

          const result = await verifyRes.json()

          if (verifyRes.ok && result.status === "success") {
            showToast("Payment successful! Order placed.", "success")

            cart = []
            localStorage.removeItem("cart")
            localStorage.removeItem("selectedDeliveryDate")

            setTimeout(() => {
              window.location.href = "/orders.html"
            }, 1200)
          } else {
            showToast("Payment verification failed", "error")
          }
        } catch (err) {
          console.error("VERIFY ERROR:", err)
          showToast("Payment verification failed", "error")
        }
      },

      modal: {
        ondismiss: () => {
          showToast("Payment cancelled", "warning")
        },
      },

      prefill: {
        name: userDetails.first_name || "Customer",
        email: userDetails.email || "customer@example.com",
        contact: userDetails.mobile_number || "",
      },

      theme: {
        color: "#711c77",
      },
    }

    const rzp = window.Razorpay(options)
    rzp.open()
  } catch (error) {
    console.error("CHECKOUT ERROR:", error)
    showToast(error.message || "Error processing checkout", "error")
  }
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer")
  const toast = document.createElement("div")
  toast.className = `toast ${type}`

  const iconMap = {
    success: "fa-check-circle",
    error: "fa-times-circle",
    warning: "fa-exclamation-circle",
    info: "fa-info-circle",
  }

  toast.innerHTML = `
    <div class="toast-icon">
      <i class="fas ${iconMap[type] || iconMap.info}"></i>
    </div>
    <div class="toast-message">${message}</div>
  `

  container.appendChild(toast)

  setTimeout(() => {
    toast.classList.add("removing")
    setTimeout(() => {
      toast.remove()
    }, 300)
  }, 3000)
}

// ============================================
// NAVIGATION
// ============================================
function goBack() {
  window.history.back()
}

function toggleMenu() {
  // Add menu functionality if needed
  showToast("Menu coming soon!", "info")
}

// ============================================
// WINDOW RESIZE HANDLER
// ============================================
window.addEventListener('resize', () => {
  if (window.innerWidth >= 768) {
    checkoutExpanded = false
    document.getElementById('checkoutDetails').classList.remove('expanded')
  }
})