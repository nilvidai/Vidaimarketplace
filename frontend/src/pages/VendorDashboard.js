import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Package, ShoppingBag, LogOut, Plus, Edit2, Trash2, 
  X, Image as ImageIcon, DollarSign, Boxes, Truck, ArrowLeft, Home, MessageCircle, Send
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const VendorDashboard = () => {
  const [activeTab, setActiveTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [inventory, setInventory] = useState({ items: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [toast, setToast] = useState(null);
  
  const { user, logout, getToken } = useAuth();
  const navigate = useNavigate();

  const authHeaders = { headers: { Authorization: `Bearer ${getToken()}` } };

  useEffect(() => {
    if (!user || user.role !== 'vendor') {
      navigate('/');
      return;
    }
    fetchData();
  }, [user, navigate]);

  const fetchData = async () => {
    try {
      const [productsRes, ordersRes] = await Promise.all([
        axios.get(`${API}/vendor/products`, authHeaders),
        axios.get(`${API}/vendor/orders`, authHeaders)
      ]);
      setProducts(productsRes.data);
      setOrders(ordersRes.data);
    } catch (err) {
      showToast('Failed to fetch data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchInventory = async () => {
    try {
      const res = await axios.get(`${API}/vendor/inventory`, authHeaders);
      setInventory(res.data);
    } catch (err) {
      showToast('Failed to fetch inventory', 'error');
    }
  };

  const fetchTickets = async () => {
    try {
      const res = await axios.get(`${API}/vendor/tickets`, authHeaders);
      setTickets(res.data);
    } catch (err) {
      showToast('Failed to fetch tickets', 'error');
    }
  };

  const handleTicketReply = async () => {
    if (!replyMessage.trim() || !selectedTicket) return;
    
    try {
      await axios.post(`${API}/vendor/tickets/${selectedTicket.id}/reply`, {
        message: replyMessage
      }, authHeaders);
      
      showToast('Reply sent');
      setReplyMessage('');
      
      // Refresh tickets
      const res = await axios.get(`${API}/vendor/tickets`, authHeaders);
      setTickets(res.data);
      const updated = res.data.find(t => t.id === selectedTicket.id);
      if (updated) setSelectedTicket(updated);
    } catch (err) {
      showToast('Failed to send reply', 'error');
    }
  };

  const updateTicketStatus = async (ticketId, status) => {
    try {
      await axios.put(`${API}/vendor/tickets/${ticketId}/status?status=${status}`, {}, authHeaders);
      showToast('Status updated');
      fetchTickets();
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status });
      }
    } catch (err) {
      showToast('Failed to update status', 'error');
    }
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (tabId === 'inventory') {
      fetchInventory();
    } else if (tabId === 'tickets') {
      fetchTickets();
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const deleteProduct = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await axios.delete(`${API}/vendor/products/${id}`, authHeaders);
      setProducts(products.filter(p => p.id !== id));
      showToast('Product deleted successfully');
    } catch (err) {
      showToast('Failed to delete product', 'error');
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      await axios.put(`${API}/vendor/orders/${orderId}/status?status=${status}`, {}, authHeaders);
      setOrders(orders.map(o => o.id === orderId ? { ...o, status } : o));
      showToast('Order status updated');
    } catch (err) {
      showToast('Failed to update status', 'error');
    }
  };

  const tabs = [
    { id: 'products', label: 'Products', icon: Package, count: products.length },
    { id: 'orders', label: 'Orders', icon: ShoppingBag, count: orders.length },
    { id: 'tickets', label: 'Tickets', icon: MessageCircle, count: tickets.length },
    { id: 'inventory', label: 'Inventory', icon: Boxes }
  ];

  const categories = ['Consumables', 'Equipment', 'Genetic Testing', 'Cryopreservation', 'Media & Solutions'];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <div className="w-64 dashboard-sidebar p-6 flex flex-col">
        <div className="mb-6 flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            data-testid="back-btn"
            title="Go Back"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            data-testid="home-btn"
            title="Home"
          >
            <Home className="w-4 h-4 text-white" />
          </button>
        </div>
        <div className="mb-10">
          <span className="text-2xl font-bold text-white" style={{ fontFamily: 'Manrope' }}>
            VIDAI
          </span>
          <span className="text-xs bg-[#2A9D8F] text-white px-2 py-0.5 rounded-full font-medium ml-2">
            Vendor
          </span>
        </div>

        <div className="mb-8 pb-6 border-b border-white/10">
          <div className="text-white font-medium">{user?.company_name}</div>
          <div className="text-slate-400 text-sm">{user?.name}</div>
        </div>

        <nav className="flex-1 space-y-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left sidebar-link ${
                activeTab === tab.id ? 'active' : 'text-slate-300'
              }`}
              data-testid={`vendor-tab-${tab.id}`}
            >
              <tab.icon className="w-5 h-5" />
              <span className="font-medium">{tab.label}</span>
              {tab.count !== undefined && (
                <span className="ml-auto text-xs bg-white/20 px-2 py-0.5 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white transition-colors"
          data-testid="vendor-logout-btn"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="spinner"></div>
          </div>
        ) : (
          <>
            {activeTab === 'products' && (
              <ProductsTab 
                products={products}
                categories={categories}
                onAdd={() => {
                  setEditingProduct(null);
                  setShowProductModal(true);
                }}
                onEdit={(product) => {
                  setEditingProduct(product);
                  setShowProductModal(true);
                }}
                onDelete={deleteProduct}
              />
            )}
            {activeTab === 'orders' && (
              <OrdersTab 
                orders={orders}
                onUpdateStatus={updateOrderStatus}
                onUpdateShipping={(updatedOrder) => {
                  setOrders(orders.map(o => o.id === updatedOrder.id ? updatedOrder : o));
                  showToast('Shipping details updated');
                }}
                authHeaders={authHeaders}
              />
            )}
            {activeTab === 'inventory' && (
              <VendorInventoryTab inventory={inventory} />
            )}
            {activeTab === 'tickets' && (
              <VendorTicketsTab 
                tickets={tickets}
                selectedTicket={selectedTicket}
                setSelectedTicket={setSelectedTicket}
                replyMessage={replyMessage}
                setReplyMessage={setReplyMessage}
                onReply={handleTicketReply}
                onStatusUpdate={updateTicketStatus}
              />
            )}
          </>
        )}
      </div>

      {/* Product Modal */}
      <ProductModal 
        isOpen={showProductModal}
        onClose={() => {
          setShowProductModal(false);
          setEditingProduct(null);
        }}
        product={editingProduct}
        categories={categories}
        onSuccess={(product, isEdit) => {
          if (isEdit) {
            setProducts(products.map(p => p.id === product.id ? product : p));
            showToast('Product updated successfully');
          } else {
            setProducts([...products, product]);
            showToast('Product created successfully');
          }
        }}
        authHeaders={authHeaders}
      />

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type === 'error' ? 'bg-red-600' : 'bg-slate-900'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
};

const ProductsTab = ({ products, categories, onAdd, onEdit, onDelete }) => (
  <div>
    <div className="flex justify-between items-center mb-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
          Products
        </h1>
        <p className="text-slate-500 mt-1">Manage your product catalog</p>
      </div>
      <button
        onClick={onAdd}
        className="btn-primary px-4 py-2 rounded-lg font-medium flex items-center gap-2"
        data-testid="add-product-btn"
      >
        <Plus className="w-4 h-4" />
        Add Product
      </button>
    </div>

    {products.length === 0 ? (
      <div className="bg-white rounded-xl border border-slate-100 p-16 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Package className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">No products yet</h3>
        <p className="text-slate-500 mb-6">Start by adding your first product to the catalog</p>
        <button
          onClick={onAdd}
          className="btn-primary px-6 py-2 rounded-lg font-medium"
        >
          Add Your First Product
        </button>
      </div>
    ) : (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {products.map(product => (
          <div key={product.id} className="product-card relative">
            {/* Approval Status Badge */}
            <div className="absolute top-3 right-3 z-10">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                product.is_approved 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                {product.is_approved ? 'Approved' : 'Pending Approval'}
              </span>
            </div>
            <div className="product-image flex items-center justify-center">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-12 h-12 text-slate-300" />
              )}
            </div>
            <div className="p-4">
              <div className="text-xs text-[#E07A5F] font-medium mb-1">{product.category}</div>
              <h3 className="font-semibold text-slate-900 mb-1 truncate">{product.name}</h3>
              <p className="text-sm text-slate-500 mb-3 line-clamp-2">{product.description}</p>
              <div className="flex items-center justify-between">
                <span className="price-tag text-lg">${product.price?.toFixed(2)}</span>
                <span className="text-xs text-slate-500">Stock: {product.stock_quantity}</span>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => onEdit(product)}
                  className="flex-1 btn-secondary py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1"
                  data-testid={`edit-product-${product.id}`}
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => onDelete(product.id)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  data-testid={`delete-product-${product.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const OrdersTab = ({ orders, onUpdateStatus, onUpdateShipping, authHeaders }) => {
  const [showShippingModal, setShowShippingModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const statusOptions = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

  const getStatusClass = (status) => {
    const classes = {
      pending: 'status-pending',
      confirmed: 'status-confirmed',
      processing: 'status-processing',
      shipped: 'status-shipped',
      delivered: 'status-delivered',
      cancelled: 'status-cancelled'
    };
    return classes[status] || 'status-pending';
  };

  const handleShippingClick = (order) => {
    setSelectedOrder(order);
    setShowShippingModal(true);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
          Orders
        </h1>
        <p className="text-slate-500 mt-1">View and manage clinic orders</p>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-16 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShoppingBag className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No orders yet</h3>
          <p className="text-slate-500">Orders from clinics will appear here</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => (
            <div key={order.id} className="bg-white rounded-xl border border-slate-100 p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="text-sm text-slate-500">Order #{order.id.slice(0, 8)}</div>
                  <div className="text-lg font-semibold text-slate-900 mt-1">
                    ${order.total_amount.toFixed(2)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusClass(order.status)}`}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </span>
                  <select
                    value={order.status}
                    onChange={(e) => onUpdateStatus(order.id, e.target.value)}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:border-[#E07A5F] focus:ring-1 focus:ring-[#E07A5F]"
                    data-testid={`order-status-${order.id}`}
                  >
                    {statusOptions.map(status => (
                      <option key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <div className="text-sm font-medium text-slate-700 mb-2">Items:</div>
                <div className="space-y-2">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-slate-600">{item.name} x {item.quantity}</span>
                      <span className="text-slate-900">${item.subtotal.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 mt-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-slate-500 mb-1">Shipping Address</div>
                    <div className="text-slate-900">
                      {order.shipping_address}<br />
                      {order.city}, {order.state} {order.zip_code}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 mb-1">Payment Status</div>
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                      order.payment_status === 'paid' ? 'badge-success' : 'badge-warning'
                    }`}>
                      {order.payment_status.charAt(0).toUpperCase() + order.payment_status.slice(1)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Shipping/Tracking Section */}
              <div className="border-t border-slate-100 pt-4 mt-4">
                {order.tracking_number ? (
                  <div className="bg-green-50 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-green-600" />
                        <span className="font-medium text-green-800">Tracking Info</span>
                      </div>
                      <button
                        onClick={() => handleShippingClick(order)}
                        className="text-sm text-green-600 hover:text-green-700"
                        data-testid={`edit-shipping-${order.id}`}
                      >
                        Edit
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-2 text-sm">
                      <div>
                        <div className="text-green-600">Carrier</div>
                        <div className="font-medium">{order.carrier || '-'}</div>
                      </div>
                      <div>
                        <div className="text-green-600">Tracking #</div>
                        <div className="font-medium">{order.tracking_number}</div>
                      </div>
                      <div>
                        <div className="text-green-600">Est. Delivery</div>
                        <div className="font-medium">{order.estimated_delivery || '-'}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => handleShippingClick(order)}
                    className="w-full btn-secondary py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                    data-testid={`add-shipping-${order.id}`}
                  >
                    <Truck className="w-4 h-4" />
                    Add Shipping Details
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Shipping Modal */}
      <ShippingModal
        isOpen={showShippingModal}
        onClose={() => {
          setShowShippingModal(false);
          setSelectedOrder(null);
        }}
        order={selectedOrder}
        onSuccess={onUpdateShipping}
        authHeaders={authHeaders}
      />
    </div>
  );
};

const ShippingModal = ({ isOpen, onClose, order, onSuccess, authHeaders }) => {
  const [formData, setFormData] = useState({
    tracking_number: '',
    carrier: '',
    estimated_delivery: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (order) {
      setFormData({
        tracking_number: order.tracking_number || '',
        carrier: order.carrier || '',
        estimated_delivery: order.estimated_delivery || ''
      });
    }
  }, [order]);

  if (!isOpen || !order) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.put(
        `${API}/vendor/orders/${order.id}/shipping`,
        formData,
        authHeaders
      );
      onSuccess(res.data);
      onClose();
    } catch (err) {
      alert('Failed to update shipping details');
    } finally {
      setLoading(false);
    }
  };

  const carriers = ['FedEx', 'UPS', 'USPS', 'DHL', 'Other'];

  return (
    <div className="modal-backdrop modal-overlay" onClick={onClose}>
      <div className="modal-box modal-content max-w-md" onClick={e => e.stopPropagation()}>
        <div className="modal-header flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Shipping Details</h2>
            <p className="text-slate-500 text-sm">Order #{order.id.slice(0, 8)}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label className="form-label">Carrier</label>
            <select
              value={formData.carrier}
              onChange={(e) => setFormData({...formData, carrier: e.target.value})}
              className="form-input"
              data-testid="shipping-carrier-input"
            >
              <option value="">Select carrier...</option>
              {carriers.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Tracking Number</label>
            <input
              type="text"
              value={formData.tracking_number}
              onChange={(e) => setFormData({...formData, tracking_number: e.target.value})}
              className="form-input"
              placeholder="e.g., 1Z999AA10123456784"
              data-testid="shipping-tracking-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Estimated Delivery Date</label>
            <input
              type="date"
              value={formData.estimated_delivery}
              onChange={(e) => setFormData({...formData, estimated_delivery: e.target.value})}
              className="form-input"
              data-testid="shipping-delivery-input"
            />
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn-secondary py-2.5 rounded-lg font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 btn-primary py-2.5 rounded-lg font-medium"
              data-testid="shipping-submit-btn"
            >
              {loading ? 'Saving...' : 'Save Details'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const VendorInventoryTab = ({ inventory }) => {
  const { items, summary } = inventory;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
          Inventory
        </h1>
        <p className="text-slate-500 mt-1">Track your product stock and earnings</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-slate-100 p-6">
          <div className="text-sm text-slate-500 mb-1">Total Products</div>
          <div className="text-3xl font-bold text-slate-900">{summary.total_products || 0}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-6">
          <div className="text-sm text-slate-500 mb-1">Total Stock Units</div>
          <div className="text-3xl font-bold text-slate-900">{summary.total_stock_units || 0}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-6">
          <div className="text-sm text-slate-500 mb-1">Stock Value</div>
          <div className="text-3xl font-bold text-slate-900">${summary.total_stock_value?.toFixed(2) || '0.00'}</div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
          <div className="text-sm opacity-90 mb-1">Your Potential Earnings</div>
          <div className="text-3xl font-bold">${summary.total_vendor_earnings?.toFixed(2) || '0.00'}</div>
        </div>
      </div>

      {/* Commission Info */}
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <DollarSign className="w-5 h-5 text-orange-600 mt-0.5" />
          <div>
            <div className="font-medium text-orange-900">Commission Breakdown</div>
            <div className="text-sm text-orange-700 mt-1">
              VIDAI takes a commission on each sale. The rates shown below are set by admin during product approval.
              Your earnings = Product Price - VIDAI Commission.
            </div>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Status</th>
              <th>Commission</th>
              <th>You Receive</th>
              <th>Potential Earnings</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan="8" className="text-center py-12 text-slate-500">
                  No inventory data. Add products to see inventory.
                </td>
              </tr>
            ) : (
              items.map(item => (
                <tr key={item.product_id} className="table-row-hover">
                  <td className="font-medium text-slate-900">{item.product_name}</td>
                  <td className="text-slate-500">{item.sku}</td>
                  <td className="price-tag">${item.price?.toFixed(2)}</td>
                  <td>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      item.stock_quantity > 10 ? 'badge-success' : 
                      item.stock_quantity > 0 ? 'badge-warning' : 'badge-error'
                    }`}>
                      {item.stock_quantity} units
                    </span>
                  </td>
                  <td>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      item.is_approved ? 'badge-success' : 'badge-warning'
                    }`}>
                      {item.is_approved ? 'Approved' : 'Pending'}
                    </span>
                  </td>
                  <td className="text-slate-500">{item.commission_rate}%</td>
                  <td className="text-green-600 font-medium">${item.vendor_amount?.toFixed(2)}</td>
                  <td className="font-medium text-slate-900">${item.potential_earnings?.toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ProductModal = ({ isOpen, onClose, product, categories, onSuccess, authHeaders }) => {
  const [formData, setFormData] = useState({
    name: '', description: '', price: '', category: categories[0], 
    sku: '', stock_quantity: '', image_url: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        description: product.description,
        price: product.price.toString(),
        category: product.category,
        sku: product.sku,
        stock_quantity: product.stock_quantity.toString(),
        image_url: product.image_url || ''
      });
    } else {
      setFormData({
        name: '', description: '', price: '', category: categories[0], 
        sku: '', stock_quantity: '', image_url: ''
      });
    }
  }, [product, categories]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const submitData = {
      ...formData,
      price: parseFloat(formData.price),
      stock_quantity: parseInt(formData.stock_quantity) || 0,
      image_url: formData.image_url || null
    };

    try {
      let res;
      if (product) {
        res = await axios.put(`${API}/vendor/products/${product.id}`, submitData, authHeaders);
        onSuccess(res.data, true);
      } else {
        res = await axios.post(`${API}/vendor/products`, submitData, authHeaders);
        onSuccess(res.data, false);
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop modal-overlay" onClick={onClose}>
      <div className="modal-box modal-content max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-900">
            {product ? 'Edit Product' : 'Add New Product'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Product Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="form-input"
              placeholder="e.g., Embryo Culture Media"
              required
              data-testid="product-name-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description *</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="form-input min-h-[100px]"
              placeholder="Describe your product..."
              required
              data-testid="product-description-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Price (USD) *</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: e.target.value})}
                  className="form-input pl-9"
                  placeholder="0.00"
                  required
                  data-testid="product-price-input"
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Category *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                className="form-input"
                data-testid="product-category-input"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">SKU *</label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({...formData, sku: e.target.value})}
                className="form-input"
                placeholder="e.g., ECM-001"
                required
                data-testid="product-sku-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Stock Quantity</label>
              <input
                type="number"
                min="0"
                value={formData.stock_quantity}
                onChange={(e) => setFormData({...formData, stock_quantity: e.target.value})}
                className="form-input"
                placeholder="0"
                data-testid="product-stock-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Image URL</label>
            <input
              type="url"
              value={formData.image_url}
              onChange={(e) => setFormData({...formData, image_url: e.target.value})}
              className="form-input"
              placeholder="https://example.com/image.jpg"
              data-testid="product-image-input"
            />
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn-secondary py-2.5 rounded-lg font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 btn-primary py-2.5 rounded-lg font-medium"
              data-testid="product-submit-btn"
            >
              {loading ? 'Saving...' : (product ? 'Update Product' : 'Create Product')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const VendorTicketsTab = ({ tickets, selectedTicket, setSelectedTicket, replyMessage, setReplyMessage, onReply, onStatusUpdate }) => {
  const getStatusClass = (status) => {
    const classes = {
      open: 'bg-yellow-100 text-yellow-700',
      in_progress: 'bg-blue-100 text-blue-700',
      resolved: 'bg-green-100 text-green-700',
      closed: 'bg-slate-100 text-slate-700'
    };
    return classes[status] || 'bg-slate-100 text-slate-700';
  };

  const getPriorityClass = (priority) => {
    const classes = {
      low: 'bg-slate-100 text-slate-600',
      medium: 'bg-yellow-100 text-yellow-700',
      high: 'bg-red-100 text-red-700'
    };
    return classes[priority] || 'bg-slate-100 text-slate-600';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  if (selectedTicket) {
    return (
      <div>
        <button
          onClick={() => setSelectedTicket(null)}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Tickets
        </button>

        <div className="bg-white rounded-xl border border-slate-100 p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
                {selectedTicket.subject}
              </h1>
              <p className="text-slate-500 mt-1">
                From: {selectedTicket.clinic_name} • Order #{selectedTicket.order_id?.slice(0, 8)}
              </p>
            </div>
            <div className="flex gap-2 items-center">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityClass(selectedTicket.priority)}`}>
                {selectedTicket.priority}
              </span>
              <select
                value={selectedTicket.status}
                onChange={(e) => onStatusUpdate(selectedTicket.id, e.target.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium border-0 cursor-pointer ${getStatusClass(selectedTicket.status)}`}
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>

          {/* Messages */}
          <div className="space-y-4 mb-6 max-h-[400px] overflow-y-auto">
            {selectedTicket.messages?.map((msg, idx) => (
              <div 
                key={msg.id || idx}
                className={`p-4 rounded-xl ${
                  msg.sender_type === 'vendor' 
                    ? 'bg-teal-50 ml-8' 
                    : msg.sender_type === 'admin'
                    ? 'bg-purple-50'
                    : 'bg-slate-50 mr-8'
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-slate-900">{msg.sender_name}</span>
                  <span className="text-xs text-slate-500">{formatDate(msg.created_at)}</span>
                </div>
                <p className="text-slate-700">{msg.message}</p>
              </div>
            ))}
          </div>

          {/* Reply Box */}
          {selectedTicket.status !== 'closed' && (
            <div className="border-t border-slate-100 pt-4">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Type your reply..."
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  onKeyPress={(e) => e.key === 'Enter' && onReply()}
                />
                <button
                  onClick={onReply}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Send
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
            Support Tickets
          </h1>
          <p className="text-slate-500 mt-1">Manage customer support requests</p>
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-16 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No tickets yet</h3>
          <p className="text-slate-500">You'll see customer support requests here</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tickets.map(ticket => (
            <div 
              key={ticket.id}
              onClick={() => setSelectedTicket(ticket)}
              className="bg-white rounded-xl border border-slate-100 p-4 hover:shadow-lg cursor-pointer transition-all"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900">{ticket.subject}</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    From: {ticket.clinic_name} • Order #{ticket.order_id?.slice(0, 8)}
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    {ticket.messages?.length || 0} messages • Last updated {formatDate(ticket.updated_at)}
                  </p>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusClass(ticket.status)}`}>
                    {ticket.status.replace('_', ' ')}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs ${getPriorityClass(ticket.priority)}`}>
                    {ticket.priority}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VendorDashboard;
