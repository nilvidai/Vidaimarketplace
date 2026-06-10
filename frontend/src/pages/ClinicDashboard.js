import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Home, Package, ShoppingCart, Bell, Tag, TrendingUp, ArrowRight, 
  Truck, CheckCircle, Clock, Gift, Percent, ChevronRight, RefreshCw,
  DollarSign, BarChart3, Users, ShoppingBag, ExternalLink, X, ArrowLeft,
  MessageCircle, Send, AlertCircle
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ClinicDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [summary, setSummary] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [offers, setOffers] = useState([]);
  const [pricingTrends, setPricingTrends] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketOrder, setTicketOrder] = useState(null);
  const [ticketForm, setTicketForm] = useState({ subject: '', message: '', priority: 'medium' });
  const [replyMessage, setReplyMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [toast, setToast] = useState(null);
  
  const navigate = useNavigate();
  const { user, getToken, logout } = useAuth();
  const { formatPrice } = useCurrency();

  const authHeaders = { headers: { Authorization: `Bearer ${getToken()}` } };

  useEffect(() => {
    if (!user || user.role !== 'clinic') {
      navigate('/');
      return;
    }
    fetchDashboardData();
  }, [user, navigate]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [summaryRes, notifRes, offersRes, pricingRes] = await Promise.all([
        axios.get(`${API}/clinic/dashboard/summary`, authHeaders),
        axios.get(`${API}/clinic/dashboard/notifications`, authHeaders),
        axios.get(`${API}/clinic/dashboard/offers`, authHeaders),
        axios.get(`${API}/clinic/dashboard/pricing-trends`, authHeaders)
      ]);
      
      setSummary(summaryRes.data);
      setNotifications(notifRes.data);
      setOffers(offersRes.data);
      setPricingTrends(pricingRes.data);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTickets = async () => {
    try {
      const res = await axios.get(`${API}/tickets`, authHeaders);
      setTickets(res.data);
    } catch (err) {
      console.error('Failed to fetch tickets:', err);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await axios.get(`${API}/clinic/orders`, authHeaders);
      setOrders(res.data);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    }
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (tabId === 'tickets') {
      fetchTickets();
      fetchOrders();
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const openTicketModal = (order) => {
    setTicketOrder(order);
    setTicketForm({ subject: '', message: '', priority: 'medium' });
    setShowTicketModal(true);
  };

  const handleCreateTicket = async () => {
    if (!ticketForm.subject || !ticketForm.message) {
      showToast('Please fill in all fields', 'error');
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
      fetchTickets();
    } catch (err) {
      showToast('Failed to create ticket', 'error');
    }
  };

  const handleTicketReply = async () => {
    if (!replyMessage.trim() || !selectedTicket) return;

    try {
      await axios.post(`${API}/tickets/${selectedTicket.id}/reply`, {
        message: replyMessage
      }, authHeaders);
      
      setReplyMessage('');
      fetchTickets();
      // Update selected ticket
      const updated = tickets.find(t => t.id === selectedTicket.id);
      if (updated) setSelectedTicket(updated);
      showToast('Reply sent');
    } catch (err) {
      showToast('Failed to send reply', 'error');
    }
  };

  const getStatusIcon = (status) => {
    const icons = {
      pending: <Clock className="w-4 h-4 text-yellow-500" />,
      confirmed: <CheckCircle className="w-4 h-4 text-blue-500" />,
      processing: <Package className="w-4 h-4 text-purple-500" />,
      shipped: <Truck className="w-4 h-4 text-indigo-500" />,
      delivered: <CheckCircle className="w-4 h-4 text-green-500" />
    };
    return icons[status] || <Clock className="w-4 h-4 text-gray-400" />;
  };

  const getNotificationIcon = (type) => {
    const icons = {
      order_shipped: <Truck className="w-5 h-5 text-indigo-500" />,
      order_delivered: <CheckCircle className="w-5 h-5 text-green-500" />,
      new_product: <Package className="w-5 h-5 text-blue-500" />,
      offer: <Tag className="w-5 h-5 text-rose-500" />
    };
    return icons[type] || <Bell className="w-5 h-5 text-gray-500" />;
  };

  const getOfferIcon = (icon) => {
    const icons = {
      percent: <Percent className="w-6 h-6" />,
      truck: <Truck className="w-6 h-6" />,
      gift: <Gift className="w-6 h-6" />,
      tag: <Tag className="w-6 h-6" />
    };
    return icons[icon] || <Tag className="w-6 h-6" />;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'orders', label: 'My Orders', icon: ShoppingBag },
    { id: 'tickets', label: 'Support Tickets', icon: MessageCircle, badge: tickets.filter(t => t.status === 'open').length },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: notifications.length },
    { id: 'offers', label: 'Offers', icon: Tag, badge: offers.length },
    { id: 'pricing', label: 'Pricing Trends', icon: TrendingUp }
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="glass-header sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
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
                Clinic
              </span>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/marketplace')}
                className="btn-secondary px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2"
                data-testid="go-to-marketplace"
              >
                <ShoppingCart className="w-4 h-4" />
                Marketplace
              </button>
              <button
                onClick={() => navigate('/marketplace/orders')}
                className="text-slate-600 hover:text-slate-900 font-medium text-sm"
                data-testid="view-orders"
              >
                My Orders
              </button>
              <button
                onClick={() => { logout(); navigate('/'); }}
                className="text-slate-500 hover:text-slate-700 text-sm"
                data-testid="logout-btn"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
            Welcome back, {user?.clinic_name || user?.name}!
          </h1>
          <p className="text-slate-500 mt-1">
            Manage your orders, view special offers, and track pricing trends
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-[#E07A5F] text-white shadow-lg'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
              data-testid={`tab-${tab.id}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.badge > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-[#E07A5F]/10 text-[#E07A5F]'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="spinner"></div>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && summary && (
              <div className="space-y-8">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div 
                    onClick={() => navigate('/marketplace/orders')}
                    className="bg-white rounded-xl border border-slate-100 p-6 hover:shadow-lg transition-all cursor-pointer hover:border-blue-200"
                    data-testid="stat-total-orders"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <ShoppingBag className="w-6 h-6 text-blue-600" />
                      </div>
                      <span className="text-xs text-slate-400">Total</span>
                    </div>
                    <div className="text-3xl font-bold text-slate-900">{summary.total_orders}</div>
                    <div className="text-sm text-slate-500 mt-1">Total Orders</div>
                  </div>

                  <div 
                    onClick={() => navigate('/marketplace/orders')}
                    className="bg-white rounded-xl border border-slate-100 p-6 hover:shadow-lg transition-all cursor-pointer hover:border-yellow-200"
                    data-testid="stat-pending-orders"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                        <Clock className="w-6 h-6 text-yellow-600" />
                      </div>
                      <span className="text-xs text-slate-400">Active</span>
                    </div>
                    <div className="text-3xl font-bold text-slate-900">{summary.pending_orders}</div>
                    <div className="text-sm text-slate-500 mt-1">Pending Orders</div>
                  </div>

                  <div 
                    onClick={() => navigate('/marketplace/orders')}
                    className="bg-white rounded-xl border border-slate-100 p-6 hover:shadow-lg transition-all cursor-pointer hover:border-indigo-200"
                    data-testid="stat-shipped-orders"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                        <Truck className="w-6 h-6 text-indigo-600" />
                      </div>
                      <span className="text-xs text-slate-400">In Transit</span>
                    </div>
                    <div className="text-3xl font-bold text-slate-900">{summary.shipped_orders}</div>
                    <div className="text-sm text-slate-500 mt-1">Shipped Orders</div>
                  </div>

                  <div 
                    onClick={() => navigate('/marketplace/orders')}
                    className="bg-white rounded-xl border border-slate-100 p-6 hover:shadow-lg transition-all cursor-pointer hover:border-green-200"
                    data-testid="stat-total-spent"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                        <DollarSign className="w-6 h-6 text-green-600" />
                      </div>
                      <span className="text-xs text-slate-400">Lifetime</span>
                    </div>
                    <div className="text-3xl font-bold text-slate-900">{formatPrice(summary.total_spent)}</div>
                    <div className="text-sm text-slate-500 mt-1">Total Spent</div>
                  </div>
                </div>

                {/* Recent Orders */}
                <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-slate-900">Recent Orders</h2>
                    <button
                      onClick={() => navigate('/marketplace/orders')}
                      className="text-[#E07A5F] hover:text-[#c4644d] text-sm font-medium flex items-center gap-1"
                    >
                      View All
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {summary.recent_orders.length === 0 ? (
                    <div className="p-12 text-center">
                      <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500">No orders yet</p>
                      <button
                        onClick={() => navigate('/marketplace')}
                        className="btn-primary px-4 py-2 rounded-lg text-sm mt-4"
                      >
                        Browse Products
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {summary.recent_orders.map(order => (
                        <div 
                          key={order.id}
                          className="p-4 hover:bg-slate-50 transition-colors cursor-pointer"
                          onClick={() => navigate('/marketplace/orders')}
                          data-testid={`recent-order-${order.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              {getStatusIcon(order.status)}
                              <div>
                                <div className="font-medium text-slate-900">
                                  Order #{order.id.slice(0, 8)}
                                </div>
                                <div className="text-sm text-slate-500">
                                  {order.vendor_name} • {formatDate(order.created_at)}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-slate-900">
                                {formatPrice(order.total_amount)}
                              </div>
                              <div className={`text-xs px-2 py-0.5 rounded-full inline-block ${
                                order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                                order.status === 'shipped' ? 'bg-indigo-100 text-indigo-700' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>
                                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    onClick={() => navigate('/marketplace')}
                    className="bg-gradient-to-r from-[#E07A5F] to-[#c4644d] text-white p-6 rounded-xl hover:shadow-lg transition-all flex items-center justify-between"
                    data-testid="quick-browse"
                  >
                    <div>
                      <div className="font-semibold text-lg">Browse Products</div>
                      <div className="text-white/80 text-sm">Explore IVF equipment</div>
                    </div>
                    <ArrowRight className="w-6 h-6" />
                  </button>
                  
                  <button
                    onClick={() => setActiveTab('offers')}
                    className="bg-white border border-slate-200 p-6 rounded-xl hover:shadow-lg transition-all flex items-center justify-between"
                    data-testid="quick-offers"
                  >
                    <div className="text-left">
                      <div className="font-semibold text-lg text-slate-900">View Offers</div>
                      <div className="text-slate-500 text-sm">{offers.length} active deals</div>
                    </div>
                    <Tag className="w-6 h-6 text-[#E07A5F]" />
                  </button>
                  
                  <button
                    onClick={() => setActiveTab('pricing')}
                    className="bg-white border border-slate-200 p-6 rounded-xl hover:shadow-lg transition-all flex items-center justify-between"
                    data-testid="quick-pricing"
                  >
                    <div className="text-left">
                      <div className="font-semibold text-lg text-slate-900">Compare Prices</div>
                      <div className="text-slate-500 text-sm">From {pricingTrends?.total_vendors || 0} vendors</div>
                    </div>
                    <TrendingUp className="w-6 h-6 text-[#E07A5F]" />
                  </button>
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-slate-900">Notifications</h2>
                  <button
                    onClick={fetchDashboardData}
                    className="text-slate-500 hover:text-slate-700 p-2 rounded-lg hover:bg-slate-100"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                
                {notifications.length === 0 ? (
                  <div className="p-12 text-center">
                    <Bell className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">No new notifications</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {notifications.map(notif => (
                      <div 
                        key={notif.id}
                        className="p-4 hover:bg-slate-50 transition-colors"
                        data-testid={`notification-${notif.id}`}
                      >
                        <div className="flex gap-4">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                            {getNotificationIcon(notif.type)}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-slate-900">{notif.title}</div>
                            <div className="text-sm text-slate-500 mt-1">{notif.message}</div>
                            <div className="text-xs text-slate-400 mt-2">{formatDate(notif.created_at)}</div>
                          </div>
                          {notif.order_id && (
                            <button
                              onClick={() => navigate('/marketplace/orders')}
                              className="text-[#E07A5F] hover:text-[#c4644d] text-sm font-medium"
                            >
                              View
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Offers Tab */}
            {activeTab === 'offers' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {offers.map(offer => (
                    <div 
                      key={offer.id}
                      className="bg-white rounded-xl border border-slate-100 p-6 hover:shadow-lg transition-all cursor-pointer"
                      onClick={() => setSelectedOffer(offer)}
                      data-testid={`offer-${offer.id}`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                        offer.type === 'bulk_discount' ? 'bg-purple-100 text-purple-600' :
                        offer.type === 'free_shipping' ? 'bg-blue-100 text-blue-600' :
                        offer.type === 'vendor_promo' ? 'bg-rose-100 text-rose-600' :
                        'bg-green-100 text-green-600'
                      }`}>
                        {getOfferIcon(offer.icon)}
                      </div>
                      <h3 className="font-semibold text-lg text-slate-900 mb-2">{offer.title}</h3>
                      <p className="text-slate-500 text-sm mb-4">{offer.description}</p>
                      
                      {offer.code && (
                        <div className="bg-slate-100 rounded-lg px-3 py-2 flex items-center justify-between">
                          <span className="font-mono font-bold text-slate-800">{offer.code}</span>
                          <button 
                            className="text-[#E07A5F] text-sm font-medium"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(offer.code);
                            }}
                          >
                            Copy
                          </button>
                        </div>
                      )}
                      
                      <div className="text-xs text-slate-400 mt-4">
                        Expires: {new Date(offer.expiry_date).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>

                {offers.length === 0 && (
                  <div className="bg-white rounded-xl border border-slate-100 p-12 text-center">
                    <Tag className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">No active offers at the moment</p>
                  </div>
                )}
              </div>
            )}

            {/* Pricing Trends Tab */}
            {activeTab === 'pricing' && pricingTrends && (
              <div className="space-y-8">
                {/* Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white rounded-xl border border-slate-100 p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <Package className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-slate-900">{pricingTrends.total_products}</div>
                        <div className="text-sm text-slate-500">Products Available</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-xl border border-slate-100 p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                        <Users className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-slate-900">{pricingTrends.total_vendors}</div>
                        <div className="text-sm text-slate-500">Active Vendors</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-xl border border-slate-100 p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                        <BarChart3 className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-slate-900">{pricingTrends.by_category.length}</div>
                        <div className="text-sm text-slate-500">Categories</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Vendor Comparison */}
                <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                  <div className="p-6 border-b border-slate-100">
                    <h2 className="text-lg font-semibold text-slate-900">Vendor Price Comparison</h2>
                    <p className="text-sm text-slate-500 mt-1">Compare average prices across your assigned vendors</p>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Vendor</th>
                          <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Products</th>
                          <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Avg Price</th>
                          <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Min</th>
                          <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Max</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {pricingTrends.by_vendor.map(vendor => (
                          <tr key={vendor.vendor_id} className="hover:bg-slate-50">
                            <td className="px-6 py-4">
                              <div className="font-medium text-slate-900">{vendor.vendor_name}</div>
                            </td>
                            <td className="px-6 py-4 text-center text-slate-600">{vendor.total_products}</td>
                            <td className="px-6 py-4 text-center">
                              <span className="font-semibold text-slate-900">{formatPrice(vendor.avg_price)}</span>
                            </td>
                            <td className="px-6 py-4 text-center text-green-600">{formatPrice(vendor.min_price)}</td>
                            <td className="px-6 py-4 text-center text-slate-600">{formatPrice(vendor.max_price)}</td>
                            <td className="px-6 py-4 text-right">
                              <button 
                                onClick={() => navigate('/marketplace')}
                                className="text-[#E07A5F] hover:text-[#c4644d] text-sm font-medium"
                              >
                                View Products
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Category Breakdown */}
                <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                  <div className="p-6 border-b border-slate-100">
                    <h2 className="text-lg font-semibold text-slate-900">Price Trends by Category</h2>
                    <p className="text-sm text-slate-500 mt-1">Find the best deals across product categories</p>
                  </div>
                  
                  <div className="divide-y divide-slate-100">
                    {pricingTrends.by_category.map(cat => (
                      <div key={cat.category} className="p-6 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="font-semibold text-slate-900">{cat.category}</h3>
                            <p className="text-sm text-slate-500">{cat.product_count} products</p>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-slate-500">Best price from</div>
                            <div className="font-medium text-green-600">{cat.cheapest_vendor}</div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-slate-50 rounded-lg p-3 text-center">
                            <div className="text-xs text-slate-500 mb-1">Min</div>
                            <div className="font-semibold text-green-600">{formatPrice(cat.min_price)}</div>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-3 text-center">
                            <div className="text-xs text-slate-500 mb-1">Average</div>
                            <div className="font-semibold text-slate-900">{formatPrice(cat.avg_price)}</div>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-3 text-center">
                            <div className="text-xs text-slate-500 mb-1">Max</div>
                            <div className="font-semibold text-slate-600">{formatPrice(cat.max_price)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Orders Tab */}
            {activeTab === 'orders' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">My Orders</h2>
                    <p className="text-slate-500 text-sm mt-1">View and manage your orders</p>
                  </div>
                  <button
                    onClick={() => navigate('/marketplace')}
                    className="btn-primary px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Go to Marketplace
                  </button>
                </div>

                {orders.length === 0 ? (
                  <div className="bg-white rounded-xl border border-slate-100 p-16 text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <ShoppingBag className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">No orders yet</h3>
                    <p className="text-slate-500 mb-6">Start shopping to place your first order</p>
                    <button
                      onClick={() => navigate('/marketplace')}
                      className="btn-primary px-6 py-2.5 rounded-lg font-medium inline-flex items-center gap-2"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      Browse Marketplace
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map(order => (
                      <div key={order.id} className="bg-white rounded-xl border border-slate-100 p-6 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-sm text-slate-500">Order #{order.id?.slice(0, 8)}</div>
                            <div className="text-lg font-semibold text-slate-900 mt-1">
                              {formatPrice(order.total_amount)}
                            </div>
                            <div className="text-sm text-slate-500 mt-1">
                              {order.items?.length} item(s) • {order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A'}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                              order.status === 'shipped' ? 'bg-blue-100 text-blue-700' :
                              order.status === 'confirmed' ? 'bg-indigo-100 text-indigo-700' :
                              'bg-yellow-100 text-yellow-700'
                            }`}>
                              {order.status?.charAt(0).toUpperCase() + order.status?.slice(1)}
                            </span>
                            <button
                              onClick={() => openTicketModal(order)}
                              className="text-sm text-[#E07A5F] hover:bg-[#E07A5F]/10 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                              data-testid={`raise-ticket-${order.id}`}
                            >
                              <MessageCircle className="w-4 h-4" />
                              Raise Ticket
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Support Tickets Tab */}
            {activeTab === 'tickets' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">Support Tickets</h2>
                    <p className="text-slate-500 text-sm mt-1">View and manage your support requests</p>
                  </div>
                  {orders.length > 0 && (
                    <button
                      onClick={() => handleTabChange('orders')}
                      className="btn-secondary px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Create New Ticket
                    </button>
                  )}
                </div>

                {tickets.length === 0 ? (
                  <div className="bg-white rounded-xl border border-slate-100 p-16 text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <MessageCircle className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">No support tickets</h3>
                    <p className="text-slate-500 mb-6">You can raise a support ticket from your orders</p>
                    <button
                      onClick={() => handleTabChange('orders')}
                      className="btn-primary px-6 py-2.5 rounded-lg font-medium inline-flex items-center gap-2"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      View My Orders
                    </button>
                  </div>
                ) : selectedTicket ? (
                  /* Ticket Detail View */
                  <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                    <div className="p-6 border-b border-slate-100">
                      <button
                        onClick={() => setSelectedTicket(null)}
                        className="text-slate-500 hover:text-slate-700 text-sm mb-4 flex items-center gap-1"
                      >
                        ← Back to tickets
                      </button>
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-xl font-semibold text-slate-900">{selectedTicket.subject}</h3>
                          <p className="text-sm text-slate-500 mt-1">
                            Ticket #{selectedTicket.id?.slice(0, 8)} • Order #{selectedTicket.order_id?.slice(0, 8)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            selectedTicket.status === 'open' ? 'bg-yellow-100 text-yellow-700' :
                            selectedTicket.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                            selectedTicket.status === 'resolved' ? 'bg-green-100 text-green-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {selectedTicket.status?.replace('_', ' ')}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            selectedTicket.priority === 'high' ? 'bg-red-100 text-red-700' :
                            selectedTicket.priority === 'medium' ? 'bg-orange-100 text-orange-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {selectedTicket.priority}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Messages */}
                    <div className="p-6 max-h-96 overflow-y-auto space-y-4">
                      {selectedTicket.messages?.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'clinic' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] rounded-xl p-4 ${
                            msg.role === 'clinic' ? 'bg-[#E07A5F] text-white' : 'bg-slate-100 text-slate-900'
                          }`}>
                            <p className="text-sm">{msg.content}</p>
                            <p className={`text-xs mt-2 ${msg.role === 'clinic' ? 'text-white/70' : 'text-slate-500'}`}>
                              {msg.role === 'clinic' ? 'You' : msg.role === 'vendor' ? 'Vendor' : 'Admin'} • {new Date(msg.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Reply Input */}
                    {selectedTicket.status !== 'closed' && (
                      <div className="p-6 border-t border-slate-100 bg-slate-50">
                        <div className="flex gap-3">
                          <input
                            type="text"
                            value={replyMessage}
                            onChange={(e) => setReplyMessage(e.target.value)}
                            placeholder="Type your reply..."
                            className="form-input flex-1"
                            onKeyPress={(e) => e.key === 'Enter' && handleTicketReply()}
                          />
                          <button
                            onClick={handleTicketReply}
                            disabled={!replyMessage.trim()}
                            className="btn-primary px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
                          >
                            <Send className="w-4 h-4" />
                            Send
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Tickets List */
                  <div className="space-y-4">
                    {tickets.map(ticket => (
                      <div 
                        key={ticket.id}
                        onClick={() => setSelectedTicket(ticket)}
                        className="bg-white rounded-xl border border-slate-100 p-6 hover:shadow-md transition-shadow cursor-pointer"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold text-slate-900">{ticket.subject}</h3>
                            <p className="text-sm text-slate-500 mt-1">
                              Order #{ticket.order_id?.slice(0, 8)} • {ticket.messages?.length || 0} messages
                            </p>
                            <p className="text-xs text-slate-400 mt-2">
                              Last updated: {ticket.updated_at ? new Date(ticket.updated_at).toLocaleString() : 'N/A'}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              ticket.status === 'open' ? 'bg-yellow-100 text-yellow-700' :
                              ticket.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                              ticket.status === 'resolved' ? 'bg-green-100 text-green-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {ticket.status?.replace('_', ' ')}
                            </span>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              ticket.priority === 'high' ? 'bg-red-100 text-red-700' :
                              ticket.priority === 'medium' ? 'bg-orange-100 text-orange-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {ticket.priority}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Ticket Creation Modal */}
      {showTicketModal && ticketOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowTicketModal(false)}>
          <div className="bg-white rounded-xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-slate-900">Raise Support Ticket</h2>
                <button onClick={() => setShowTicketModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="text-sm text-slate-500">Order</div>
                <div className="font-medium text-slate-900">
                  #{ticketOrder.id?.slice(0, 8)} - {formatPrice(ticketOrder.total_amount)}
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">Subject *</label>
                <input
                  type="text"
                  value={ticketForm.subject}
                  onChange={(e) => setTicketForm(prev => ({ ...prev, subject: e.target.value }))}
                  className="form-input"
                  placeholder="Brief description of your issue"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select
                  value={ticketForm.priority}
                  onChange={(e) => setTicketForm(prev => ({ ...prev, priority: e.target.value }))}
                  className="form-input"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Message *</label>
                <textarea
                  value={ticketForm.message}
                  onChange={(e) => setTicketForm(prev => ({ ...prev, message: e.target.value }))}
                  className="form-input"
                  rows={4}
                  placeholder="Describe your issue in detail..."
                />
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-100 flex gap-3 justify-end">
              <button
                onClick={() => setShowTicketModal(false)}
                className="btn-secondary px-4 py-2 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTicket}
                disabled={!ticketForm.subject || !ticketForm.message}
                className="btn-primary px-6 py-2 rounded-lg disabled:opacity-50"
              >
                Create Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
          toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'
        } text-white`}>
          {toast.message}
        </div>
      )}

      {/* Offer Detail Modal */}
      {selectedOffer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedOffer(null)}>
          <div className="bg-white rounded-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                selectedOffer.type === 'bulk_discount' ? 'bg-purple-100 text-purple-600' :
                selectedOffer.type === 'free_shipping' ? 'bg-blue-100 text-blue-600' :
                selectedOffer.type === 'vendor_promo' ? 'bg-rose-100 text-rose-600' :
                'bg-green-100 text-green-600'
              }`}>
                {getOfferIcon(selectedOffer.icon)}
              </div>
              <button onClick={() => setSelectedOffer(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <h2 className="text-xl font-bold text-slate-900 mb-2">{selectedOffer.title}</h2>
            <p className="text-slate-600 mb-6">{selectedOffer.description}</p>
            
            {selectedOffer.code && (
              <div className="bg-slate-100 rounded-xl p-4 mb-6">
                <div className="text-xs text-slate-500 mb-2">Use code at checkout:</div>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xl text-slate-900">{selectedOffer.code}</span>
                  <button 
                    className="btn-primary px-4 py-2 rounded-lg text-sm"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedOffer.code);
                    }}
                  >
                    Copy Code
                  </button>
                </div>
              </div>
            )}
            
            {selectedOffer.min_order_amount && (
              <div className="text-sm text-slate-500 mb-4">
                Minimum order: {formatPrice(selectedOffer.min_order_amount)}
              </div>
            )}
            
            <div className="text-xs text-slate-400 mb-6">
              Valid until: {new Date(selectedOffer.expiry_date).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              })}
            </div>
            
            <button
              onClick={() => {
                setSelectedOffer(null);
                navigate('/marketplace');
              }}
              className="w-full btn-primary py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
            >
              Shop Now
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClinicDashboard;
