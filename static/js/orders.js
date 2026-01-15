// ============================================

class OrdersManager {
  constructor() {
    this.orders = []
    this.currentFilter = 'all'
    this.userDetails = {}
    this.selectedOrderForCancel = null
    this.searchQuery = ''
    this.init()
  }

  async init() {
    try {
      await this.loadUserDetails()
      await this.fetchOrders()
      this.renderOrders()
      this.setupEventListeners()
    } catch (error) {
      console.error('Initialization error:', error)
      showToast('Failed to load orders', 'error')
    }
  }

  async loadUserDetails() {
    try {
      const user = JSON.parse(localStorage.getItem('user'))
      if (user && user.id) {
        this.userDetails = user
      } else {
        showToast('Please login to view orders', 'error')
        setTimeout(() => {
          window.location.href = '/login'
        }, 2000)
      }
    } catch (error) {
      console.error('Error loading user details:', error)
    }
  }

  async fetchOrders() {
    try {
      const response = await fetch(`/api/orders?user_id=${this.userDetails.id}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        },
      })

      if (response.ok) {
        const result = await response.json()
        this.orders = Array.isArray(result.data) ? result.data : []
        this.orders = this.orders.map(order => this.transformOrder(order))
        this.orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      } else {
        throw new Error(`API failed with status: ${response.status}`)
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
      showToast('Failed to load orders', 'error')
      this.orders = []
    }
  }

  transformOrder(backendOrder) {
    return {
      id: backendOrder.id,
      razorpay_order_id: backendOrder.razorpay_order_id || `ORD${backendOrder.id}`,
      user_id: backendOrder.user_id,
      total_amount: parseFloat(backendOrder.total_amount),
    payment_status: backendOrder.payment_status || 'Paid', // ✅ FIX
      order_status: backendOrder.order_status,
      created_at: backendOrder.created_at,
      updated_at: backendOrder.updated_at,
      address: backendOrder.address || {
        line1: 'Address not available',
        city: 'N/A',
        state: 'N/A',
        pincode: '000000',
        type: 'home',
      },
      items: backendOrder.items || [],
      notes: backendOrder.notes || '',
      estimatedTime: this.getEstimatedTime(backendOrder.order_status),
      progress: this.getProgressPercentage(backendOrder.order_status),
    }
  }

  getEstimatedTime(status) {
    const times = {
      placed: 'Processing order...',
      confirmed: 'Preparing your order',
      inprocess: 'Being prepared',
      dispatched: 'Out for delivery',
      delivered: 'Delivered',
      completed: 'Completed',
      cancelled: 'Cancelled',
      rejected: 'Rejected',
    }
    return times[status] || ''
  }

  getProgressPercentage(status) {
    const progress = {
      placed: 20,
      confirmed: 40,
      inprocess: 60,
      dispatched: 80,
      delivered: 100,
      completed: 100,
      cancelled: 0,
      rejected: 0,
    }
    return progress[status] || 0
  }

  getFilteredOrders() {
    let filtered = this.orders

    // Apply status filter
    if (this.currentFilter !== 'all') {
      if (this.currentFilter === 'current') {
        filtered = filtered.filter(order =>
          !['delivered', 'completed', 'cancelled', 'rejected'].includes(order.order_status)
        )
      } else if (this.currentFilter === 'delivered') {
        filtered = filtered.filter(order =>
          ['delivered', 'completed'].includes(order.order_status)
        )
      } else if (this.currentFilter === 'cancelled') {
        filtered = filtered.filter(order =>
          ['cancelled', 'rejected'].includes(order.order_status)
        )
      }
    }

    // Apply search filter
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase()
      filtered = filtered.filter(order =>
        order.razorpay_order_id.toLowerCase().includes(query) ||
        order.items.some(item => item.name.toLowerCase().includes(query))
      )
    }

    return filtered
  }

  renderOrders() {
    const container = document.getElementById('ordersContainer')
    const emptyState = document.getElementById('emptyState')
    const filteredOrders = this.getFilteredOrders()

    if (filteredOrders.length === 0) {
      container.style.display = 'none'
      emptyState.style.display = 'block'
    } else {
      container.style.display = 'flex'
      emptyState.style.display = 'none'

      container.innerHTML = filteredOrders.map((order, index) =>
        this.renderOrderCard(order, index)
      ).join('')
    }
  }

  renderOrderCard(order, index) {
    const formattedDate = this.formatDate(new Date(order.created_at))
    const isActive = !['delivered', 'completed', 'cancelled', 'rejected'].includes(order.order_status)
    const canCancel = ['placed', 'confirmed'].includes(order.order_status)
    const itemsToShow = order.items.slice(0, 4)
    const remainingItems = order.items.length - 4

    return `
      <div class=\"order-card\" style=\"animation-delay: ${index * 0.1}s\" onclick=\"openOrderModal('${order.id}')\">
        <!-- Card Header -->
        <div class=\"order-card-header\">
          <div class=\"order-id-section\">
            <div class=\"order-id\">
              <i class=\"fas fa-receipt\"></i>
              #${order.razorpay_order_id}
            </div>
            <div class=\"order-date\">
              <i class=\"fas fa-calendar\"></i>
              ${formattedDate}
            </div>
          </div>
          <div class=\"order-status-badge ${order.order_status}\">
            <i class=\"fas fa-${this.getStatusIcon(order.order_status)}\"></i>
            ${this.getStatusText(order.order_status)}
          </div>
        </div>

        <!-- Progress Bar (only for active orders) -->
        ${isActive && order.order_status !== 'placed' ? `
          <div class=\"order-progress\">
            <div class=\"progress-bar-container\">
              <div class=\"progress-bar-fill\" style=\"width: ${order.progress}%\"></div>
            </div>
            <div class=\"progress-steps\">
              ${this.renderProgressSteps(order.order_status)}
            </div>
          </div>
        ` : ''}

        <!-- Order Content -->
        <div class=\"order-content\">
          <div class=\"order-items-preview\">
            ${itemsToShow.map(item => `
              <div class=\"item-thumbnail\">
                ${item.image
                  ? `<img src=\"${item.image}\" alt=\"${item.name}\" loading=\"lazy\">`
                  : `<span style=\"font-size: 24px;\">${item.icon || '🍪'}</span>`
                }
              </div>
            `).join('')}
            ${remainingItems > 0 ? `
              <div class=\"item-thumbnail more\">
                +${remainingItems}
              </div>
            ` : ''}
          </div>

          <div class=\"order-summary\">
            <span class=\"summary-text\">
              ${order.items.length} item${order.items.length > 1 ? 's' : ''} •
              ${order.items.reduce((sum, item) => sum + item.quantity, 0)} qty
            </span>
            <span class=\"order-total\">₹${order.total_amount.toFixed(2)}</span>
          </div>
        </div>

        <!-- Order Actions -->
        <div class=\"order-actions\" onclick=\"event.stopPropagation()\">
          <button class=\"action-btn action-btn-primary\" onclick=\"openOrderModal('${order.id}')\">
            <i class=\"fas fa-eye\"></i>
            <span>View Details</span>
          </button>
          ${canCancel ? `
            <button class=\"action-btn action-btn-danger\" onclick=\"openCancelModal('${order.id}')\">
              <i class=\"fas fa-times\"></i>
              <span>Cancel</span>
            </button>
          ` : ''}
          ${order.order_status === 'delivered' ? `
            <button class=\"action-btn action-btn-secondary\" onclick=\"reorderItems('${order.id}')\">
              <i class=\"fas fa-redo\"></i>
              <span>Reorder</span>
            </button>
          ` : ''}
        </div>
      </div>
    `
  }

  renderProgressSteps(status) {
    const steps = [
      { id: 'placed', icon: 'clock', label: 'Placed' },
      { id: 'confirmed', icon: 'check', label: 'Confirmed' },
      { id: 'inprocess', icon: 'cog', label: 'Preparing' },
      { id: 'dispatched', icon: 'truck', label: 'Dispatched' },
      { id: 'delivered', icon: 'box', label: 'Delivered' }
    ]

    const currentIndex = steps.findIndex(step => step.id === status)

    return steps.map((step, index) => {
      const isActive = index === currentIndex
      const isCompleted = index < currentIndex

      return `
        <div class=\"progress-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}\">
          <div class=\"step-icon\">
            <i class=\"fas fa-${step.icon}\"></i>
          </div>
          <div class=\"step-label\">${step.label}</div>
        </div>
      `
    }).join('')
  }

  getStatusIcon(status) {
    const icons = {
      placed: 'clock',
      confirmed: 'check',
      inprocess: 'cog',
      dispatched: 'truck',
      delivered: 'box',
      completed: 'check-double',
      cancelled: 'times-circle',
      rejected: 'ban',
    }
    return icons[status] || 'circle'
  }

  getStatusText(status) {
    return status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')
  }

  formatDate(date) {
    const now = new Date()
    const diffTime = Math.abs(now - date)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 1) {
      return 'Today, ' + date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
    } else if (diffDays === 2) {
      return 'Yesterday, ' + date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
    } else if (diffDays <= 7) {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
      })
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    }
  }

  setupEventListeners() {
    // Close modals on overlay click
    document.getElementById('orderModal').addEventListener('click', (e) => {
      if (e.target.id === 'orderModal' || e.target.classList.contains('modal-overlay')) {
        closeOrderModal()
      }
    })

    document.getElementById('cancelModal').addEventListener('click', (e) => {
      if (e.target.id === 'cancelModal' || e.target.classList.contains('modal-overlay')) {
        closeCancelModal()
      }
    })
  }

  getOrderById(orderId) {
    return this.orders.find(order => order.id == orderId)
  }
}

// ============================================
// GLOBAL INSTANCE
// ============================================
let ordersManager

// ============================================
// FILTER FUNCTIONS
// ============================================
function filterOrders(filter) {
  ordersManager.currentFilter = filter

  // Update active pill
  document.querySelectorAll('.pill').forEach(pill => {
    pill.classList.remove('active')
  })
  document.querySelector(`.pill[data-filter=\"${filter}\"]`).classList.add('active')

  ordersManager.renderOrders()
}

// ============================================
// SEARCH FUNCTIONS
// ============================================
function toggleSearch() {
  const searchBar = document.getElementById('searchBar')
  searchBar.classList.toggle('active')

  if (searchBar.classList.contains('active')) {
    document.getElementById('searchInput').focus()
  } else {
    clearSearch()
  }
}

function handleSearch() {
  const searchInput = document.getElementById('searchInput')
  const clearBtn = document.querySelector('.clear-search')

  ordersManager.searchQuery = searchInput.value.trim()

  if (ordersManager.searchQuery) {
    clearBtn.style.display = 'flex'
  } else {
    clearBtn.style.display = 'none'
  }

  ordersManager.renderOrders()
}

function clearSearch() {
  document.getElementById('searchInput').value = ''
  document.querySelector('.clear-search').style.display = 'none'
  ordersManager.searchQuery = ''
  ordersManager.renderOrders()
}

// ============================================
// FILTER TOGGLE (MOBILE)
// ============================================
function toggleFilter() {
  showToast('Use pills below to filter orders', 'info')
}

// ============================================
// ORDER DETAILS MODAL
// ============================================
function openOrderModal(orderId) {
  const order = ordersManager.getOrderById(orderId)
  if (!order) return

  const modal = document.getElementById('orderModal')
  const modalBody = document.getElementById('orderModalBody')

  const orderDate = new Date(order.created_at).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const updatedDate = new Date(order.updated_at).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  modalBody.innerHTML = `
    <!-- Download PDF Button -->
    <div style=\"margin-bottom: 20px;\">
      <button class=\"action-btn action-btn-primary\" onclick=\"downloadOrderPDF('${order.id}')\" style=\"width: 100%; justify-content: center;\">
        <i class=\"fas fa-file-pdf\"></i>
        <span>Download Invoice (PDF)</span>
      </button>
    </div>

    <!-- Order Info Section -->
    <div class=\"detail-section\">
      <h4><i class=\"fas fa-info-circle\"></i> Order Information</h4>
      <div class=\"detail-row\">
        <span class=\"detail-label\">Order ID</span>
        <span class=\"detail-value\">#${order.razorpay_order_id}</span>
      </div>
      <div class=\"detail-row\">
        <span class=\"detail-label\">Order Date</span>
        <span class=\"detail-value\">${orderDate}</span>
      </div>
      <div class=\"detail-row\">
        <span class=\"detail-label\">Last Updated</span>
        <span class=\"detail-value\">${updatedDate}</span>
      </div>
      <div class=\"detail-row\">
        <span class=\"detail-label\">Order Status</span>
        <span class=\"detail-value\">
          <span class=\"order-status-badge ${order.order_status}\">
            <i class=\"fas fa-${ordersManager.getStatusIcon(order.order_status)}\"></i>
            ${ordersManager.getStatusText(order.order_status)}
          </span>
        </span>
      </div>
      <div class=\"detail-row\">
        <span class=\"detail-label\">Payment Status</span>
       <span class="detail-value" style="color: ${
  order.payment_status === 'paid' ? 'var(--success)' : 'var(--warning)'
}; font-weight: 700;">
${(order.payment_status || 'PENDING').toUpperCase()}
</span>

      </div>
      ${order.estimatedTime ? `
        <div class=\"detail-row\">
          <span class=\"detail-label\">Status Message</span>
          <span class=\"detail-value\">${order.estimatedTime}</span>
        </div>
      ` : ''}
    </div>

    <!-- Customer Details Section -->
    <div class=\"detail-section\">
      <h4><i class=\"fas fa-user\"></i> Customer Details</h4>
      <div class=\"detail-row\">
        <span class=\"detail-label\">Name</span>
        <span class=\"detail-value\">${ordersManager.userDetails.first_name || ordersManager.userDetails.name || 'N/A'}</span>
      </div>
      <div class=\"detail-row\">
        <span class=\"detail-label\">Email</span>
        <span class=\"detail-value\">${ordersManager.userDetails.email || 'N/A'}</span>
      </div>
      ${ordersManager.userDetails.mobile_number ? `
        <div class=\"detail-row\">
          <span class=\"detail-label\">Phone</span>
          <span class=\"detail-value\">${ordersManager.userDetails.mobile_number}</span>
        </div>
      ` : ''}
    </div>

    <!-- Delivery Address Section -->
    <div class=\"detail-section\">
      <h4><i class=\"fas fa-map-marker-alt\"></i> Delivery Address</h4>
      <div class=\"address-box\">
        <div style=\"display: flex; align-items: center; gap: 8px; margin-bottom: 8px;\">
          <span class=\"order-status-badge ${order.address.type || 'home'}\" style=\"font-size: 11px; padding: 4px 10px;\">
            <i class=\"fas fa-${order.address.type === 'home' ? 'home' : order.address.type === 'office' ? 'building' : 'map-marker-alt'}\"></i>
            ${(order.address.type || 'home').toUpperCase()}
          </span>
        </div>
        <div style=\"line-height: 1.8;\">
          ${order.address.line1}<br>
          ${order.address.line2 ? order.address.line2 + '<br>' : ''}
          ${order.address.city}, ${order.address.state}<br>
          <strong>PIN:</strong> ${order.address.pincode}
        </div>
      </div>
    </div>

    <!-- Items Section -->
    <div class=\"detail-section\">
      <h4><i class=\"fas fa-box\"></i> Order Items (${order.items.length})</h4>
      <div class=\"order-items-list\">
        ${order.items.map((item, index) => `
          <div class=\"order-item-detail\">
            <div style=\"display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--text-muted); margin-bottom: 8px;\">
              <span>#${index + 1}</span>
            </div>
            <div style=\"display: flex; gap: 12px; width: 100%;\">
              <div class=\"item-detail-image\">
                ${item.image
                  ? `<img src=\"${item.image}\" alt=\"${item.name}\" loading=\"lazy\">`
                  : `<span style=\"font-size: 32px;\">${item.icon || '🍪'}</span>`
                }
              </div>
              <div class=\"item-detail-info\">
                <div class=\"item-detail-name\">${item.name}</div>
                <div class=\"item-detail-meta\">
                  ${item.variant ? `Variant: ${item.variant}<br>` : ''}
                  Unit Price: ₹${item.price.toFixed(2)}<br>
                  Quantity: ${item.quantity}
                </div>
              </div>
              <div class=\"item-detail-price\">
                ₹${(item.price * item.quantity).toFixed(2)}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
      <div style=\"margin-top: 12px; padding: 12px; background: rgba(113, 28, 119, 0.05); border-radius: 8px;\">
        <div style=\"display: flex; justify-content: space-between; font-size: 14px; color: var(--text-secondary);\">
          <span>Total Items:</span>
          <span style=\"font-weight: 600; color: var(--text-primary);\">${order.items.length}</span>
        </div>
        <div style=\"display: flex; justify-content: space-between; font-size: 14px; color: var(--text-secondary); margin-top: 4px;\">
          <span>Total Quantity:</span>
          <span style=\"font-weight: 600; color: var(--text-primary);\">${order.items.reduce((sum, item) => sum + item.quantity, 0)}</span>
        </div>
      </div>
    </div>

    <!-- Price Breakdown Section -->
    <div class=\"detail-section\">
      <h4><i class=\"fas fa-receipt\"></i> Price Breakdown</h4>
      ${renderPriceBreakdown(order)}
    </div>

    ${order.notes ? `
      <div class=\"detail-section\">
        <h4><i class=\"fas fa-sticky-note\"></i> Order Notes</h4>
        <div class=\"address-box\">
          ${order.notes}
        </div>
      </div>
    ` : ''}
  `

  modal.classList.add('active')
}

function renderPriceBreakdown(order) {
  const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const shipping = subtotal >= 500 ? 0 : 50
  const discount = order.items.reduce((sum, item) => sum + (item.price * 0.17 * item.quantity), 0)

  return `
    <div class=\"detail-row\">
      <span class=\"detail-label\">Subtotal</span>
      <span class=\"detail-value\">₹${subtotal.toFixed(2)}</span>
    </div>
    <div class=\"detail-row\">
      <span class=\"detail-label\">Delivery Fee</span>
      <span class=\"detail-value\">${shipping === 0 ? 'FREE' : '₹' + shipping.toFixed(2)}</span>
    </div>
    <div class=\"detail-row\" style=\"color: var(--success);\">
      <span class=\"detail-label\">Discount</span>
      <span class=\"detail-value\">-₹${discount.toFixed(2)}</span>
    </div>
    <div class=\"detail-row\" style=\"border-top: 2px solid var(--border-color); padding-top: 12px; margin-top: 8px; font-size: 18px; font-weight: 700;\">
      <span class=\"detail-label\">Total Amount</span>
      <span class=\"detail-value\" style=\"color: var(--success);\">₹${order.total_amount.toFixed(2)}</span>
    </div>
  `
}

function closeOrderModal() {
  document.getElementById('orderModal').classList.remove('active')
}

// ============================================
// PDF DOWNLOAD FUNCTION
// ============================================
function downloadOrderPDF(orderId) {
  const order = ordersManager.getOrderById(orderId)
  if (!order) {
    showToast('Order not found', 'error')
    return
  }

  try {
    showToast('Generating PDF...', 'info')
    
    // Initialize jsPDF
    const { jsPDF } = window.jspdf
    const doc = new jsPDF()

    // Define colors
    const primaryColor = [113, 28, 119]
    const textColor = [30, 41, 59]
    const lightGray = [226, 232, 240]

    let yPos = 20

    // Header - Company Name
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
    doc.rect(0, 0, 210, 35, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(24)
    doc.setFont('helvetica', 'bold')
    doc.text('Gokhale Bandhu', 105, 15, { align: 'center' })
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('Tax Invoice / Order Confirmation', 105, 25, { align: 'center' })

    yPos = 45
    doc.setTextColor(textColor[0], textColor[1], textColor[2])

    // Order Information Box
    doc.setFillColor(lightGray[0], lightGray[1], lightGray[2])
    doc.roundedRect(15, yPos, 180, 30, 2, 2, 'F')
    
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Order Details', 20, yPos + 8)
    
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const orderDate = new Date(order.created_at).toLocaleDateString('en-IN', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
    
    doc.text(`Order ID: #${order.razorpay_order_id}`, 20, yPos + 16)
    doc.text(`Order Date: ${orderDate}`, 20, yPos + 22)
doc.text(
  `Payment: ${(order.payment_status || 'PENDING').toUpperCase()}`,
  120,
  yPos + 16
)
    doc.text(`Status: ${ordersManager.getStatusText(order.order_status)}`, 120, yPos + 22)

    yPos += 40

    // Customer & Delivery Address
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Customer Details', 15, yPos)
    doc.text('Delivery Address', 110, yPos)
    
    yPos += 6
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    
    const customerName = ordersManager.userDetails.first_name || ordersManager.userDetails.name || 'N/A'
    const customerEmail = ordersManager.userDetails.email || 'N/A'
    const customerPhone = ordersManager.userDetails.mobile_number || 'N/A'
    
    doc.text(customerName, 15, yPos)
    doc.text(customerEmail, 15, yPos + 5)
    doc.text(customerPhone, 15, yPos + 10)

    // Delivery Address
    const address = order.address
    const addressLines = [
      address.line1,
      address.line2,
      `${address.city}, ${address.state}`,
      `PIN: ${address.pincode}`
    ].filter(line => line && line.trim())

    addressLines.forEach((line, index) => {
      doc.text(line, 110, yPos + (index * 5))
    })

    yPos += 30

    // Items Table Header
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
    doc.rect(15, yPos, 180, 10, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('#', 20, yPos + 7)
    doc.text('Item Name', 30, yPos + 7)
    doc.text('Qty', 120, yPos + 7)
    doc.text('Price', 145, yPos + 7)
    doc.text('Total', 175, yPos + 7)

    yPos += 10
    doc.setTextColor(textColor[0], textColor[1], textColor[2])
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)

    // Items
    order.items.forEach((item, index) => {
      if (yPos > 260) {
        doc.addPage()
        yPos = 20
      }

      const itemTotal = item.price * item.quantity
      
      // Alternate row background
      if (index % 2 === 0) {
        doc.setFillColor(248, 249, 250)
        doc.rect(15, yPos, 180, 8, 'F')
      }

      doc.text(`${index + 1}`, 20, yPos + 6)
      const itemName = item.name.length > 35 ? item.name.substring(0, 35) + '...' : item.name
      doc.text(itemName, 30, yPos + 6)
      doc.text(`${item.quantity}`, 120, yPos + 6)
      doc.text(`₹${item.price.toFixed(2)}`, 145, yPos + 6)
      doc.text(`₹${itemTotal.toFixed(2)}`, 175, yPos + 6)

      yPos += 8
    })

    yPos += 5

    // Price Breakdown
    const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    const shipping = subtotal >= 500 ? 0 : 50
    const discount = order.items.reduce((sum, item) => sum + (item.price * 0.17 * item.quantity), 0)

    doc.setFont('helvetica', 'normal')
    doc.text('Subtotal:', 145, yPos)
    doc.text(`₹${subtotal.toFixed(2)}`, 175, yPos)
    
    yPos += 6
    doc.text('Delivery Fee:', 145, yPos)
    doc.text(shipping === 0 ? 'FREE' : `₹${shipping.toFixed(2)}`, 175, yPos)
    
    yPos += 6
    doc.setTextColor(16, 185, 129)
    doc.text('Discount (17%):', 145, yPos)
    doc.text(`-₹${discount.toFixed(2)}`, 175, yPos)

    yPos += 8
    doc.setDrawColor(lightGray[0], lightGray[1], lightGray[2])
    doc.line(145, yPos, 190, yPos)

    yPos += 7
    doc.setTextColor(textColor[0], textColor[1], textColor[2])
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Total Amount:', 145, yPos)
    doc.setTextColor(16, 185, 129)
    doc.text(`₹${order.total_amount.toFixed(2)}`, 175, yPos)

    // Footer
    doc.setTextColor(textColor[0], textColor[1], textColor[2])
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    const footerY = 280
    doc.text('Thank you for shopping with Gokhale Bandhu!', 105, footerY, { align: 'center' })
    doc.text('For any queries, please contact us at support@gokhalebandhu.com', 105, footerY + 4, { align: 'center' })

    // Save PDF
    doc.save(`Gokhale_Bandhu_Invoice_${order.razorpay_order_id}.pdf`)
    showToast('Invoice downloaded successfully!', 'success')

  } catch (error) {
    console.error('Error generating PDF:', error)
    showToast('Failed to generate PDF. Please try again.', 'error')
  }
}

// ============================================
// CANCEL ORDER MODAL
// ============================================
function openCancelModal(orderId) {
  const order = ordersManager.getOrderById(orderId)
  if (!order) return

  if (!['placed', 'confirmed'].includes(order.order_status)) {
    showToast('Only orders with \"placed\" or \"confirmed\" status can be cancelled', 'error')
    return
  }

  ordersManager.selectedOrderForCancel = orderId
  document.getElementById('cancelReason').value = ''
  document.getElementById('cancelModal').classList.add('active')
}

function closeCancelModal() {
  document.getElementById('cancelModal').classList.remove('active')
  ordersManager.selectedOrderForCancel = null
}

async function confirmCancelOrder() {
  const orderId = ordersManager.selectedOrderForCancel
  if (!orderId) {
    showToast('No order selected for cancellation', 'error')
    return
  }

  const reason = document.getElementById('cancelReason').value
  if (!reason) {
    showToast('Please select a reason for cancellation', 'error')
    return
  }

  try {
    showToast('Cancelling order...', 'info')

    const response = await fetch(`/cancel-order/${orderId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
      },
      credentials: 'include',
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.detail || 'Failed to cancel order')
    }

    const result = await response.json()
    showToast(result.message || 'Order cancelled successfully!', 'success')

    // Update local order state
    const order = ordersManager.getOrderById(orderId)
    if (order) {
      order.order_status = 'cancelled'
      order.updated_at = new Date().toISOString()
      order.estimatedTime = 'Cancelled'
      order.progress = 0
    }

    closeCancelModal()
    ordersManager.renderOrders()
  } catch (error) {
    console.error('Error cancelling order:', error)
    showToast(error.message || 'Failed to cancel order', 'error')
  }
}

// ============================================
// REORDER FUNCTION
// ============================================
function reorderItems(orderId) {
  const order = ordersManager.getOrderById(orderId)
  if (!order) {
    showToast('Order not found', 'error')
    return
  }

  const cartItems = order.items.map(item => ({
    id: item.id,
    name: item.name,
    variant: item.variant,
    price: item.price,
    quantity: item.quantity,
    image: item.image,
  }))

  localStorage.setItem('reorderItems', JSON.stringify(cartItems))
  showToast('Items added to cart! Redirecting...', 'success')

  setTimeout(() => {
    window.location.href = '/products'
  }, 1500)
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer')
  const toast = document.createElement('div')
  toast.className = `toast ${type}`

  const iconMap = {
    success: 'fa-check-circle',
    error: 'fa-times-circle',
    warning: 'fa-exclamation-circle',
    info: 'fa-info-circle',
  }

  toast.innerHTML = `
    <div class=\"toast-icon\">
      <i class=\"fas ${iconMap[type] || iconMap.info}\"></i>
    </div>
    <div class=\"toast-message\">${message}</div>
  `

  container.appendChild(toast)

  setTimeout(() => {
    toast.classList.add('removing')
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

// ============================================
// INITIALIZE APP
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  ordersManager = new OrdersManager()
})
window.openOrderModal = openOrderModal
window.openCancelModal = openCancelModal
window.closeOrderModal = closeOrderModal
window.confirmCancelOrder = confirmCancelOrder
window.reorderItems = reorderItems
window.downloadOrderPDF = downloadOrderPDF
