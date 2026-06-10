import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShoppingCart, LogOut, Plus, Minus, 
  Package, Image as ImageIcon, Search,
  History, ClipboardList, Truck, Eye, ArrowLeft, Home, MessageCircle, Send, X
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useCurrency } from '../context/CurrencyContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Marketplace = () => {
  const [allProducts, setAllProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [orders, setOrders] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('products');
  const [toast, setToast] = useState(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketOrder, setTicketOrder] = useState(null);
  const [ticketForm, setTicketForm] = useState({ subject: '', message: '', priority: 'medium' });
  const [replyMessage, setReplyMessage] = useState('');
  const [gstSettings, setGstSettings] = useState({ gst_enabled: true, show_gst_on_products: true });
  
  const { user, logout, getToken } = useAuth();
  const { addToCart, getCartCount } = useCart();
  const { formatPrice } = useCurrency();
  const navigate = useNavigate();

  const authHeaders = { headers: { Authorization: `Bearer ${getToken()}` } };

  useEffect(() => {
    if (!user || user.role !== 'clinic') {
      navigate('/');
      return;
    }
    fetchAllProducts();
    fetchGstSettings();
  }, [user, navigate]);

  const fetchGstSettings = async () => {
    try {
      const res = await axios.get(`${API}/public/gst-settings`);
      setGstSettings(res.data);
    } catch (err) {
      console.log('Using default GST settings');
    }
  };

  useEffect(() => {
    filterProducts();
  }, [allProducts, selectedCategory, searchQuery]);

  const fetchAllProducts = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/clinic/all-products`, authHeaders);
      setAllProducts(res.data.products || []);
      setCategories(res.data.categories || []);
    } catch (err) {
      showToast('Failed to fetch products', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filterProducts = () => {
    let filtered = [...allProducts];
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(query) || 
        p.description?.toLowerCase().includes(query) ||
        p.sku?.toLowerCase().includes(query)
      );
    }
    
    setFilteredProducts(filtered);
  };

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/clinic/purchases`, authHeaders);
      setPurchases(res.data);
      setView('purchases');
    } catch (err) {
      showToast('Failed to fetch purchases', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/clinic/orders`, authHeaders);
      setOrders(res.data);
      setView('orders');
    } catch (err) {
      showToast('Failed to fetch orders', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/clinic/tickets`, authHeaders);
      setTickets(res.data);
      setView('tickets');
    } catch (err) {
      showToast('Failed to fetch tickets', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!ticketForm.subject || !ticketForm.message) {
      showToast('Please fill all fields', 'error');
      return;
    }
    
    try {
      await axios.post(`${API}/tickets`, {
        order_id: ticketOrder.id,
        subject: ticketForm.subject,
        message: ticketForm.message,
        priority: ticketForm.priority
      }, authHeaders);
      
      showToast('Ticket created successfully');
      setShowTicketModal(false);
      setTicketForm({ subject: '', message: '', priority: 'medium' });
      setTicketOrder(null);
      fetchTickets();
    } catch (err) {
      showToast('Failed to create ticket', 'error');
    }
  };

  const handleTicketReply = async () => {
    if (!replyMessage.trim()) return;
    
    try {
      await axios.post(`${API}/clinic/tickets/${selectedTicket.id}/reply`, {
        message: replyMessage
      }, authHeaders);
      
      showToast('Reply sent');
      setReplyMessage('');
      
      // Refresh ticket
      const res = await axios.get(`${API}/clinic/tickets`, authHeaders);
      setTickets(res.data);
      const updated = res.data.find(t => t.id === selectedTicket.id);
      if (updated) setSelectedTicket(updated);
    } catch (err) {
      showToast('Failed to send reply', 'error');
    }
  };

  const openTicketModal = (order) => {
    setTicketOrder(order);
    setShowTicketModal(true);
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleAddToCart = (product, qty = 1) => {
    const vendor = { id: product.vendor_id, company_name: product.vendor_name };
    addToCart(product, vendor, qty);
    showToast(`${product.name} added to cart`);
  };

  const goBack = () => {
    setView('products');
    setSelectedOrder(null);
  };

  const getCategoryIcon = (category) => {
    const icons = {
      'Culture Media': '🧪',
      'Consumables': '🔬',
      'Equipment': '⚙️',
      'Genetic Testing': '🧬',
      'Cryopreservation': '❄️',
      'Lab Supplies': '🏥'
    };
    return icons[category] || '📦';
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="glass-header sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                data-testid="back-btn"
                title="Go Back"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <button
                onClick={() => navigate('/')}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                data-testid="home-btn"
                title="Home"
              >
                <Home className="w-5 h-5 text-slate-600" />
              </button>
              <span className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
                VIDAI
              </span>
              <span className="text-xs bg-[#E07A5F] text-white px-2 py-0.5 rounded-full font-medium">
                Marketplace
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right mr-4">
                <div className="text-sm font-medium text-slate-900">{user?.clinic_name}</div>
                <div className="text-xs text-slate-500">{user?.name}</div>
              </div>

              <button
                onClick={() => setView('products')}
                className={`p-2 hover:bg-slate-100 rounded-lg transition-colors ${view === 'products' ? 'bg-slate-100' : ''}`}
                data-testid="products-btn"
                title="Browse Products"
              >
                <Package className="w-6 h-6 text-slate-700" />
              </button>

              <button
                onClick={fetchPurchases}
                className={`p-2 hover:bg-slate-100 rounded-lg transition-colors ${view === 'purchases' ? 'bg-slate-100' : ''}`}
                data-testid="purchases-btn"
                title="My Purchases"
              >
                <History className="w-6 h-6 text-slate-700" />
              </button>

              <button
                onClick={fetchOrders}
                className={`p-2 hover:bg-slate-100 rounded-lg transition-colors ${view === 'orders' ? 'bg-slate-100' : ''}`}
                data-testid="track-orders-btn"
                title="Track Orders"
              >
                <ClipboardList className="w-6 h-6 text-slate-700" />
              </button>

              <button
                onClick={fetchTickets}
                className={`p-2 hover:bg-slate-100 rounded-lg transition-colors ${view === 'tickets' ? 'bg-slate-100' : ''}`}
                data-testid="tickets-btn"
                title="Support Tickets"
              >
                <MessageCircle className="w-6 h-6 text-slate-700" />
              </button>
              
              <button
                onClick={() => navigate('/marketplace/cart')}
                className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors"
                data-testid="cart-btn"
              >
                <ShoppingCart className="w-6 h-6 text-slate-700" />
                {getCartCount() > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#E07A5F] text-white text-xs rounded-full flex items-center justify-center font-medium">
                    {getCartCount()}
                  </span>
                )}
              </button>

              <button
                onClick={handleLogout}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                data-testid="marketplace-logout-btn"
              >
                <LogOut className="w-6 h-6 text-slate-700" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="spinner"></div>
        </div>
      ) : view === 'purchases' ? (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <PurchasesList purchases={purchases} onBack={goBack} />
        </main>
      ) : view === 'orders' ? (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <OrdersTrackingView 
            orders={orders} 
            onBack={goBack} 
            selectedOrder={selectedOrder}
            setSelectedOrder={setSelectedOrder}
            onRaiseTicket={openTicketModal}
          />
        </main>
      ) : view === 'tickets' ? (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <TicketsView 
            tickets={tickets}
            onBack={goBack}
            selectedTicket={selectedTicket}
            setSelectedTicket={setSelectedTicket}
            replyMessage={replyMessage}
            setReplyMessage={setReplyMessage}
            onReply={handleTicketReply}
          />
        </main>
      ) : (
        <div className="flex">
          {/* Category Sidebar */}
          <aside className="w-64 bg-white border-r border-slate-200 min-h-[calc(100vh-64px)] p-4 sticky top-16">
            <h2 className="font-semibold text-slate-900 mb-4">Categories</h2>
            <nav className="space-y-1">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  selectedCategory === 'all' 
                    ? 'bg-[#E07A5F] text-white' 
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
                data-testid="category-all"
              >
                <span>📋</span>
                <span className="font-medium">All Products</span>
                <span className="ml-auto text-xs opacity-70">{allProducts.length}</span>
              </button>
              
              {categories.map(category => {
                const count = allProducts.filter(p => p.category === category).length;
                return (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      selectedCategory === category 
                        ? 'bg-[#E07A5F] text-white' 
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                    data-testid={`category-${category}`}
                  >
                    <span>{getCategoryIcon(category)}</span>
                    <span className="font-medium">{category}</span>
                    <span className="ml-auto text-xs opacity-70">{count}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Product Grid */}
          <main className="flex-1 p-6">
            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products..."
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:border-[#E07A5F] focus:ring-1 focus:ring-[#E07A5F]"
                  data-testid="product-search"
                />
              </div>
            </div>

            {/* Results Header */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
                  {selectedCategory === 'all' ? 'All Products' : selectedCategory}
                </h1>
                <p className="text-slate-500 mt-1">
                  {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} found
                </p>
              </div>
            </div>

            {/* Product Grid */}
            {filteredProducts.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-100 p-16 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No products found</h3>
                <p className="text-slate-500">Try adjusting your filters or search query</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map(product => (
                  <ProductCard 
                    key={product.id} 
                    product={product} 
                    onAddToCart={handleAddToCart}
                    formatPrice={formatPrice}
                  />
                ))}
              </div>
            )}
          </main>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type === 'error' ? 'bg-red-600' : 'bg-slate-900'}`}>
          {toast.message}
        </div>
      )}

      {/* Create Ticket Modal */}
      {showTicketModal && ticketOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowTicketModal(false)}>
          <div className="bg-white rounded-xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">Raise Support Ticket</h2>
              <button onClick={() => setShowTicketModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 rounded-lg p-3 mb-4">
              <div className="text-sm text-slate-500">Order</div>
              <div className="font-medium text-slate-900">#{ticketOrder.id?.slice(0, 8)} - {ticketOrder.vendor_name}</div>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                <input
                  type="text"
                  value={ticketForm.subject}
                  onChange={(e) => setTicketForm({...ticketForm, subject: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E07A5F]"
                  placeholder="Brief description of your issue"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                <select
                  value={ticketForm.priority}
                  onChange={(e) => setTicketForm({...ticketForm, priority: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E07A5F]"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
                <textarea
                  value={ticketForm.message}
                  onChange={(e) => setTicketForm({...ticketForm, message: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E07A5F] h-32 resize-none"
                  placeholder="Describe your issue in detail..."
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowTicketModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#E07A5F] text-white rounded-lg hover:bg-[#c4644d]"
                >
                  Create Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const ProductCard = ({ product, onAddToCart, formatPrice }) => {
  const [quantity, setQuantity] = useState(1);
  const [imageError, setImageError] = useState(false);

  const getCategoryGradient = (category) => {
    const gradients = {
      'Culture Media': 'from-purple-100 to-pink-100',
      'Consumables': 'from-blue-100 to-green-100',
      'Equipment': 'from-orange-100 to-yellow-100',
      'Genetic Testing': 'from-teal-100 to-blue-100',
      'Cryopreservation': 'from-cyan-100 to-blue-100',
      'Lab Supplies': 'from-green-100 to-emerald-100'
    };
    return gradients[category] || 'from-slate-100 to-slate-200';
  };

  const handleAddClick = () => {
    onAddToCart(product, quantity);
    setQuantity(1);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden hover:shadow-lg transition-shadow">
      <div className="aspect-square bg-slate-100 relative">
        {product.image_url && !imageError ? (
          <img 
            src={product.image_url} 
            alt={product.name}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${getCategoryGradient(product.category)}`}>
            <div className="text-center">
              <Package className="w-16 h-16 text-slate-400 mx-auto mb-2" />
              <span className="text-sm text-slate-500">{product.category}</span>
            </div>
          </div>
        )}
        {product.stock_quantity <= 5 && product.stock_quantity > 0 && (
          <span className="absolute top-3 right-3 bg-amber-500 text-white text-xs px-2 py-1 rounded-full">
            Low Stock
          </span>
        )}
        {product.stock_quantity === 0 && (
          <span className="absolute top-3 right-3 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
            Out of Stock
          </span>
        )}
      </div>
      
      <div className="p-4">
        <div className="text-xs text-slate-500 mb-1">{product.vendor_name}</div>
        <h3 className="font-semibold text-slate-900 mb-1">{product.name}</h3>
        <p className="text-xs text-slate-500 mb-2 line-clamp-2">{product.description}</p>
        
        <div className="flex items-center justify-between mb-1">
          <span className="text-xl font-bold text-[#E07A5F]">{formatPrice(product.price)}</span>
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">{product.category}</span>
        </div>
        {gstSettings.gst_enabled && gstSettings.show_gst_on_products && (
          <div className="text-xs text-slate-500 mb-3">
            + {product.gst_percentage || 18}% GST
          </div>
        )}
        {(!gstSettings.gst_enabled || !gstSettings.show_gst_on_products) && (
          <div className="mb-3"></div>
        )}

        {product.stock_quantity > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-slate-200 rounded-lg">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="p-2 hover:bg-slate-100"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-10 text-center font-medium">{quantity}</span>
              <button
                onClick={() => setQuantity(Math.min(product.stock_quantity, quantity + 1))}
                className="p-2 hover:bg-slate-100"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={handleAddClick}
              className="flex-1 btn-primary py-2 rounded-lg font-medium flex items-center justify-center gap-2"
              data-testid={`add-to-cart-${product.id}`}
            >
              <ShoppingCart className="w-4 h-4" />
              Add
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const PurchasesList = ({ purchases, onBack }) => (
  <div>
    <div className="flex items-center gap-4 mb-8">
      <button
        onClick={onBack}
        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        data-testid="back-from-purchases"
      >
        <ArrowLeft className="w-5 h-5 text-slate-600" />
      </button>
      <div>
        <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
          My Purchases
        </h1>
        <p className="text-slate-500 mt-1">View your purchase history</p>
      </div>
    </div>

    {purchases.length === 0 ? (
      <div className="bg-white rounded-xl border border-slate-100 p-16 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <History className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">No purchases yet</h3>
        <p className="text-slate-500">Your purchase history will appear here</p>
      </div>
    ) : (
      <div className="space-y-4">
        {purchases.map(purchase => (
          <div key={purchase.id} className="bg-white rounded-xl border border-slate-100 p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="text-sm text-slate-500">Order #{purchase.id?.slice(0, 8)}</div>
                <div className="text-lg font-semibold text-slate-900 mt-1">
                  {formatPrice(purchase.total_amount)}
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                purchase.payment_status === 'paid' ? 'badge-success' : 'badge-warning'
              }`}>
                {purchase.payment_status}
              </span>
            </div>
            <div className="border-t border-slate-100 pt-4">
              {purchase.items?.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm mb-2">
                  <span className="text-slate-600">{item.name} x {item.quantity}</span>
                  <span className="text-slate-900">{formatPrice(item.subtotal)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const OrdersTrackingView = ({ orders, onBack, selectedOrder, setSelectedOrder, onRaiseTicket }) => {
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

  const getStatusStep = (status) => {
    const steps = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
    return steps.indexOf(status);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  if (selectedOrder) {
    const currentStep = getStatusStep(selectedOrder.status);
    const steps = [
      { key: 'pending', label: 'Order Placed' },
      { key: 'confirmed', label: 'Confirmed' },
      { key: 'processing', label: 'Processing' },
      { key: 'shipped', label: 'Shipped' },
      { key: 'delivered', label: 'Delivered' }
    ];

    return (
      <div>
        <button
          onClick={() => setSelectedOrder(null)}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6"
          data-testid="back-to-orders"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Orders
        </button>

        <div className="bg-white rounded-xl border border-slate-100 p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
                Order #{selectedOrder.id.slice(0, 8)}
              </h1>
              <p className="text-slate-500 mt-1">
                Placed on {formatDate(selectedOrder.created_at)}
              </p>
            </div>
            <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${getStatusClass(selectedOrder.status)}`}>
              {selectedOrder.status.charAt(0).toUpperCase() + selectedOrder.status.slice(1)}
            </span>
          </div>

          {selectedOrder.status !== 'cancelled' && (
            <div className="mb-8">
              <div className="flex items-center justify-between relative">
                <div className="absolute top-5 left-0 right-0 h-1 bg-slate-200 -z-10"></div>
                <div 
                  className="absolute top-5 left-0 h-1 bg-[#E07A5F] -z-10 transition-all duration-500"
                  style={{ width: `${(currentStep / 4) * 100}%` }}
                ></div>
                {steps.map((step, idx) => (
                  <div key={step.key} className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${
                      idx <= currentStep 
                        ? 'bg-[#E07A5F] text-white' 
                        : 'bg-slate-200 text-slate-500'
                    }`}>
                      {idx < currentStep ? '✓' : idx + 1}
                    </div>
                    <span className={`text-xs mt-2 ${idx <= currentStep ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedOrder.tracking_number && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 text-green-800 font-medium mb-3">
                <Truck className="w-5 h-5" />
                Tracking Information
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-green-600">Carrier</div>
                  <div className="font-medium text-green-900">{selectedOrder.carrier || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-green-600">Tracking Number</div>
                  <div className="font-medium text-green-900">{selectedOrder.tracking_number}</div>
                </div>
                <div>
                  <div className="text-sm text-green-600">Est. Delivery</div>
                  <div className="font-medium text-green-900">{selectedOrder.estimated_delivery || '-'}</div>
                </div>
              </div>
            </div>
          )}

          <div className="mb-6">
            <h3 className="font-semibold text-slate-900 mb-3">Order Items</h3>
            <div className="bg-slate-50 rounded-xl p-4 space-y-3">
              {selectedOrder.items?.map((item, idx) => (
                <div key={idx} className="flex justify-between">
                  <span className="text-slate-600">{item.name} × {item.quantity}</span>
                  <span className="font-medium text-slate-900">{formatPrice(item.subtotal)}</span>
                </div>
              ))}
              <div className="border-t border-slate-200 pt-3 flex justify-between">
                <span className="font-semibold text-slate-900">Total</span>
                <span className="font-bold text-[#E07A5F]">{formatPrice(selectedOrder.total_amount)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Shipping Address</h3>
              <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-600">
                {selectedOrder.shipping_address}<br />
                {selectedOrder.city}, {selectedOrder.state} {selectedOrder.zip_code}<br />
                {selectedOrder.country}
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Vendor</h3>
              <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-600">
                {selectedOrder.vendor_name || 'Unknown Vendor'}
              </div>
            </div>
          </div>

          {/* Raise Ticket Button */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <button
              onClick={() => onRaiseTicket(selectedOrder)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
              data-testid="raise-ticket-btn"
            >
              <MessageCircle className="w-4 h-4" />
              Raise Support Ticket
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={onBack}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          data-testid="back-from-orders"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
            Track Orders
          </h1>
          <p className="text-slate-500 mt-1">Monitor your order status and deliveries</p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-16 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ClipboardList className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No orders yet</h3>
          <p className="text-slate-500">Your orders will appear here once you make a purchase</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => (
            <div 
              key={order.id} 
              className="bg-white rounded-xl border border-slate-100 p-6 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedOrder(order)}
              data-testid={`order-card-${order.id}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-sm text-slate-500">Order #{order.id.slice(0, 8)}</div>
                  <div className="text-lg font-semibold text-slate-900 mt-1">
                    {formatPrice(order.total_amount)}
                  </div>
                  <div className="text-sm text-slate-500 mt-1">
                    {order.items?.length} item(s) • {formatDate(order.created_at)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusClass(order.status)}`}>
                    {order.status?.charAt(0).toUpperCase() + order.status?.slice(1)}
                  </span>
                  {order.tracking_number && (
                    <div className="flex items-center gap-1 text-green-600 text-sm">
                      <Truck className="w-4 h-4" />
                      <span>Tracking available</span>
                    </div>
                  )}
                  <Eye className="w-5 h-5 text-slate-400" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const TicketsView = ({ tickets, onBack, selectedTicket, setSelectedTicket, replyMessage, setReplyMessage, onReply }) => {
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
                Order #{selectedTicket.order_id?.slice(0, 8)} • {selectedTicket.vendor_name}
              </p>
            </div>
            <div className="flex gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityClass(selectedTicket.priority)}`}>
                {selectedTicket.priority}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusClass(selectedTicket.status)}`}>
                {selectedTicket.status.replace('_', ' ')}
              </span>
            </div>
          </div>

          {/* Messages */}
          <div className="space-y-4 mb-6 max-h-[400px] overflow-y-auto">
            {selectedTicket.messages?.map((msg, idx) => (
              <div 
                key={msg.id || idx}
                className={`p-4 rounded-xl ${
                  msg.sender_type === 'clinic' 
                    ? 'bg-blue-50 ml-8' 
                    : msg.sender_type === 'admin'
                    ? 'bg-purple-50 mr-8'
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
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E07A5F]"
                  onKeyPress={(e) => e.key === 'Enter' && onReply()}
                />
                <button
                  onClick={onReply}
                  className="px-4 py-2 bg-[#E07A5F] text-white rounded-lg hover:bg-[#c4644d] flex items-center gap-2"
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
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={onBack}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
            Support Tickets
          </h1>
          <p className="text-slate-500 mt-1">View and manage your support requests</p>
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-16 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No tickets yet</h3>
          <p className="text-slate-500">You can raise a ticket from your order details</p>
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
                    Order #{ticket.order_id?.slice(0, 8)} • {ticket.vendor_name}
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

export default Marketplace;
