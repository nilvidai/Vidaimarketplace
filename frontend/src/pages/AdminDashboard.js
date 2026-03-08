import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Building2, Link2, LogOut, Plus, Trash2, 
  CheckCircle, XCircle, ChevronRight, Package, ShoppingBag,
  Check, X, Image as ImageIcon, BarChart3, Boxes, DollarSign,
  ClipboardList, Truck, Eye, MessageSquare, Settings, Mail, ArrowLeft, Home, Clock
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboardStats, setDashboardStats] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [pendingProducts, setPendingProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [commissionReport, setCommissionReport] = useState(null);
  const [orders, setOrders] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketReplyMessage, setTicketReplyMessage] = useState('');
  const [enquiries, setEnquiries] = useState([]);
  const [adminSettings, setAdminSettings] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedEnquiry, setSelectedEnquiry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showClinicModal, setShowClinicModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showEnquiryModal, setShowEnquiryModal] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [toast, setToast] = useState(null);
  
  const { user, logout, getToken } = useAuth();
  const navigate = useNavigate();

  const authHeaders = { headers: { Authorization: `Bearer ${getToken()}` } };

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/admin');
      return;
    }
    fetchData();
    fetchDashboardStats();
  }, [user, navigate]);

  const fetchDashboardStats = async () => {
    try {
      const res = await axios.get(`${API}/admin/dashboard/stats`, authHeaders);
      setDashboardStats(res.data);
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
    }
  };

  const fetchData = async () => {
    try {
      const [vendorsRes, clinicsRes, productsRes] = await Promise.all([
        axios.get(`${API}/admin/vendors`, authHeaders),
        axios.get(`${API}/admin/clinics`, authHeaders),
        axios.get(`${API}/admin/products/pending`, authHeaders)
      ]);
      setVendors(vendorsRes.data);
      setClinics(clinicsRes.data);
      setPendingProducts(productsRes.data);
    } catch (err) {
      showToast('Failed to fetch data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchInventory = async () => {
    try {
      const res = await axios.get(`${API}/admin/inventory`, authHeaders);
      setInventory(res.data);
    } catch (err) {
      showToast('Failed to fetch inventory', 'error');
    }
  };

  const fetchCommissionReport = async () => {
    try {
      const res = await axios.get(`${API}/admin/reports/commissions`, authHeaders);
      setCommissionReport(res.data);
    } catch (err) {
      showToast('Failed to fetch report', 'error');
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await axios.get(`${API}/admin/orders`, authHeaders);
      setOrders(res.data);
    } catch (err) {
      showToast('Failed to fetch orders', 'error');
    }
  };

  const fetchEnquiries = async () => {
    try {
      const res = await axios.get(`${API}/admin/enquiries`, authHeaders);
      setEnquiries(res.data);
    } catch (err) {
      showToast('Failed to fetch enquiries', 'error');
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await axios.get(`${API}/admin/settings`, authHeaders);
      setAdminSettings(res.data);
    } catch (err) {
      console.error('Failed to fetch settings');
    }
  };

  const fetchTickets = async () => {
    try {
      const res = await axios.get(`${API}/admin/tickets`, authHeaders);
      setTickets(res.data);
    } catch (err) {
      console.error('Failed to fetch tickets');
    }
  };

  const handleTicketReply = async () => {
    if (!ticketReplyMessage.trim() || !selectedTicket) return;
    
    try {
      await axios.post(`${API}/admin/tickets/${selectedTicket.id}/reply`, {
        message: ticketReplyMessage
      }, authHeaders);
      
      showToast('Reply sent');
      setTicketReplyMessage('');
      
      // Refresh tickets
      const res = await axios.get(`${API}/admin/tickets`, authHeaders);
      setTickets(res.data);
      const updated = res.data.find(t => t.id === selectedTicket.id);
      if (updated) setSelectedTicket(updated);
    } catch (err) {
      showToast('Failed to send reply', 'error');
    }
  };

  const updateTicketStatus = async (ticketId, status) => {
    try {
      await axios.put(`${API}/admin/tickets/${ticketId}/status?status=${status}`, {}, authHeaders);
      showToast('Status updated');
      fetchTickets();
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status });
      }
    } catch (err) {
      showToast('Failed to update status', 'error');
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

  const deleteVendor = async (id) => {
    if (!window.confirm('Are you sure you want to delete this vendor?')) return;
    try {
      await axios.delete(`${API}/admin/vendors/${id}`, authHeaders);
      setVendors(vendors.filter(v => v.id !== id));
      showToast('Vendor deleted successfully');
    } catch (err) {
      showToast('Failed to delete vendor', 'error');
    }
  };

  const deleteClinic = async (id) => {
    if (!window.confirm('Are you sure you want to delete this clinic?')) return;
    try {
      await axios.delete(`${API}/admin/clinics/${id}`, authHeaders);
      setClinics(clinics.filter(c => c.id !== id));
      showToast('Clinic deleted successfully');
    } catch (err) {
      showToast('Failed to delete clinic', 'error');
    }
  };

  const handleApproveClick = (product) => {
    setSelectedProduct(product);
    setShowApprovalModal(true);
  };

  const handleViewEnquiry = (enquiry) => {
    setSelectedEnquiry(enquiry);
    setShowEnquiryModal(true);
  };

  const updateEnquiryStatus = async (enquiryId, status) => {
    try {
      await axios.put(`${API}/admin/enquiries/${enquiryId}/status?status=${status}`, {}, authHeaders);
      setEnquiries(enquiries.map(e => e.id === enquiryId ? {...e, status} : e));
      showToast('Enquiry status updated');
    } catch (err) {
      showToast('Failed to update status', 'error');
    }
  };

  const deleteEnquiry = async (id) => {
    if (!window.confirm('Delete this enquiry?')) return;
    try {
      await axios.delete(`${API}/admin/enquiries/${id}`, authHeaders);
      setEnquiries(enquiries.filter(e => e.id !== id));
      showToast('Enquiry deleted');
    } catch (err) {
      showToast('Failed to delete enquiry', 'error');
    }
  };

  const handleViewOrder = (order) => {
    setSelectedOrder(order);
    setShowOrderModal(true);
  };

  const approveProductWithCommission = async (productId, approved, commissionRate) => {
    try {
      await axios.post(`${API}/admin/products/approve`, { 
        product_id: productId, 
        approved,
        commission_rate: commissionRate 
      }, authHeaders);
      setPendingProducts(pendingProducts.filter(p => p.id !== productId));
      showToast(`Product ${approved ? 'approved' : 'rejected'} successfully`);
      setShowApprovalModal(false);
      setSelectedProduct(null);
    } catch (err) {
      showToast('Failed to update product', 'error');
    }
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (tabId === 'overview') {
      fetchDashboardStats();
    } else if (tabId === 'inventory') {
      fetchInventory();
    } else if (tabId === 'reports') {
      fetchCommissionReport();
    } else if (tabId === 'orders') {
      fetchOrders();
    } else if (tabId === 'tickets') {
      fetchTickets();
    } else if (tabId === 'enquiries') {
      fetchEnquiries();
    } else if (tabId === 'settings') {
      fetchSettings();
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'vendors', label: 'Vendors', icon: Users, count: vendors.length },
    { id: 'clinics', label: 'Clinics', icon: Building2, count: clinics.length },
    { id: 'approvals', label: 'Approvals', icon: CheckCircle, count: pendingProducts.length },
    { id: 'orders', label: 'Orders', icon: ClipboardList },
    { id: 'tickets', label: 'Tickets', icon: MessageSquare },
    { id: 'enquiries', label: 'Enquiries', icon: Mail },
    { id: 'inventory', label: 'Inventory', icon: Boxes },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'assignments', label: 'Assignments', icon: Link2 },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

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
          <span className="text-xs bg-[#E07A5F] text-white px-2 py-0.5 rounded-full font-medium ml-2">
            Admin
          </span>
        </div>

        <nav className="flex-1 space-y-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left sidebar-link ${
                activeTab === tab.id ? 'active' : 'text-slate-300'
              }`}
              data-testid={`tab-${tab.id}`}
            >
              <tab.icon className="w-5 h-5" />
              <span className="font-medium">{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                  tab.id === 'products' ? 'bg-orange-500 text-white' : 'bg-white/20'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
          
          <hr className="border-white/10 my-4" />
          
          <button
            onClick={() => navigate('/admin/marketplace')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left sidebar-link text-slate-300 hover:text-white"
            data-testid="admin-marketplace-link"
          >
            <ShoppingBag className="w-5 h-5" />
            <span className="font-medium">Marketplace</span>
          </button>
        </nav>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white transition-colors"
          data-testid="admin-logout-btn"
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
            {activeTab === 'overview' && dashboardStats && (
              <div className="space-y-8">
                <div>
                  <h1 className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
                    Admin Dashboard
                  </h1>
                  <p className="text-slate-500 mt-1">Welcome back! Here's your marketplace overview.</p>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white rounded-xl border border-slate-100 p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <DollarSign className="w-6 h-6 text-blue-600" />
                      </div>
                      <span className="text-xs text-green-500 font-medium">Revenue</span>
                    </div>
                    <div className="text-3xl font-bold text-slate-900">${dashboardStats.summary.total_revenue.toLocaleString()}</div>
                    <div className="text-sm text-slate-500 mt-1">Total Revenue</div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-100 p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                        <ShoppingBag className="w-6 h-6 text-green-600" />
                      </div>
                      <span className="text-xs text-slate-400">Orders</span>
                    </div>
                    <div className="text-3xl font-bold text-slate-900">{dashboardStats.summary.total_orders}</div>
                    <div className="text-sm text-slate-500 mt-1">Total Orders</div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-100 p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                        <Users className="w-6 h-6 text-purple-600" />
                      </div>
                      <span className="text-xs text-slate-400">Active</span>
                    </div>
                    <div className="text-3xl font-bold text-slate-900">{dashboardStats.summary.total_vendors}</div>
                    <div className="text-sm text-slate-500 mt-1">Vendors</div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-100 p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-orange-600" />
                      </div>
                      <span className="text-xs text-slate-400">Active</span>
                    </div>
                    <div className="text-3xl font-bold text-slate-900">{dashboardStats.summary.total_clinics}</div>
                    <div className="text-sm text-slate-500 mt-1">Clinics</div>
                  </div>
                </div>

                {/* Second Row Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-gradient-to-r from-[#E07A5F] to-[#c4644d] rounded-xl p-6 text-white">
                    <div className="flex items-center justify-between mb-4">
                      <DollarSign className="w-8 h-8 opacity-80" />
                      <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Commission</span>
                    </div>
                    <div className="text-3xl font-bold">${dashboardStats.summary.total_commission.toLocaleString()}</div>
                    <div className="text-sm opacity-80 mt-1">Total Earned</div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-100 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <Package className="w-8 h-8 text-teal-500" />
                      <span className="text-xs text-slate-400">Products</span>
                    </div>
                    <div className="text-3xl font-bold text-slate-900">{dashboardStats.summary.total_products}</div>
                    <div className="text-sm text-slate-500 mt-1">Approved Products</div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-100 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <CheckCircle className="w-8 h-8 text-yellow-500" />
                      {dashboardStats.summary.pending_approvals > 0 && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">Pending</span>
                      )}
                    </div>
                    <div className="text-3xl font-bold text-slate-900">{dashboardStats.summary.pending_approvals}</div>
                    <div className="text-sm text-slate-500 mt-1">Pending Approvals</div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-100 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <MessageSquare className="w-8 h-8 text-indigo-500" />
                      {dashboardStats.summary.new_enquiries > 0 && (
                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">New</span>
                      )}
                    </div>
                    <div className="text-3xl font-bold text-slate-900">{dashboardStats.summary.new_enquiries}</div>
                    <div className="text-sm text-slate-500 mt-1">New Enquiries</div>
                  </div>
                </div>

                {/* Orders & Top Vendors */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Recent Orders */}
                  <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                      <h2 className="text-lg font-semibold text-slate-900">Recent Orders</h2>
                      <button 
                        onClick={() => setActiveTab('orders')}
                        className="text-[#E07A5F] hover:text-[#c4644d] text-sm font-medium flex items-center gap-1"
                      >
                        View All <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {dashboardStats.recent_orders.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">No orders yet</div>
                      ) : (
                        dashboardStats.recent_orders.map(order => (
                          <div key={order.id} className="p-4 hover:bg-slate-50">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium text-slate-900">#{order.id.slice(0, 8)}</div>
                                <div className="text-sm text-slate-500">{order.clinic_name}</div>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold text-slate-900">${order.total_amount.toFixed(2)}</div>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                                  order.status === 'shipped' ? 'bg-blue-100 text-blue-700' :
                                  'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {order.status}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Top Vendors */}
                  <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                      <h2 className="text-lg font-semibold text-slate-900">Top Vendors</h2>
                      <button 
                        onClick={() => setActiveTab('vendors')}
                        className="text-[#E07A5F] hover:text-[#c4644d] text-sm font-medium flex items-center gap-1"
                      >
                        View All <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {dashboardStats.top_vendors.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">No sales data yet</div>
                      ) : (
                        dashboardStats.top_vendors.map((vendor, idx) => (
                          <div key={vendor.vendor_id} className="p-4 hover:bg-slate-50 flex items-center gap-4">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                              idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                              idx === 1 ? 'bg-slate-200 text-slate-600' :
                              idx === 2 ? 'bg-orange-100 text-orange-700' :
                              'bg-slate-100 text-slate-500'
                            }`}>
                              {idx + 1}
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-slate-900">{vendor.vendor_name}</div>
                              <div className="text-sm text-slate-500">{vendor.order_count} orders</div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-slate-900">${vendor.total_sales.toLocaleString()}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Order Status Summary */}
                <div className="bg-white rounded-xl border border-slate-100 p-6">
                  <h2 className="text-lg font-semibold text-slate-900 mb-6">Order Status Summary</h2>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-yellow-50 rounded-lg p-4 text-center">
                      <Clock className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-yellow-700">{dashboardStats.summary.pending_orders}</div>
                      <div className="text-sm text-yellow-600">Pending</div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4 text-center">
                      <Truck className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-blue-700">{dashboardStats.summary.shipped_orders}</div>
                      <div className="text-sm text-blue-600">Shipped</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-green-700">{dashboardStats.summary.delivered_orders}</div>
                      <div className="text-sm text-green-600">Delivered</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4 text-center">
                      <ShoppingBag className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-slate-700">{dashboardStats.summary.total_orders}</div>
                      <div className="text-sm text-slate-600">Total</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'vendors' && (
              <VendorsTab 
                vendors={vendors} 
                onDelete={deleteVendor}
                onAdd={() => setShowVendorModal(true)}
              />
            )}
            {activeTab === 'clinics' && (
              <ClinicsTab 
                clinics={clinics} 
                onDelete={deleteClinic}
                onAdd={() => setShowClinicModal(true)}
              />
            )}
            {activeTab === 'approvals' && (
              <ProductsApprovalTab 
                products={pendingProducts}
                onApprove={handleApproveClick}
              />
            )}
            {activeTab === 'orders' && (
              <AdminOrdersTab 
                orders={orders}
                onViewOrder={handleViewOrder}
              />
            )}
            {activeTab === 'inventory' && (
              <InventoryTab inventory={inventory} vendors={vendors} />
            )}
            {activeTab === 'reports' && (
              <ReportsTab report={commissionReport} />
            )}
            {activeTab === 'assignments' && (
              <AssignmentsTab 
                clinics={clinics}
                vendors={vendors}
                onAssign={(clinic) => {
                  setSelectedClinic(clinic);
                  setShowAssignModal(true);
                }}
                authHeaders={authHeaders}
                showToast={showToast}
              />
            )}
            {activeTab === 'enquiries' && (
              <EnquiriesTab 
                enquiries={enquiries}
                onView={handleViewEnquiry}
                onUpdateStatus={updateEnquiryStatus}
                onDelete={deleteEnquiry}
              />
            )}
            {activeTab === 'tickets' && (
              <AdminTicketsTab 
                tickets={tickets}
                selectedTicket={selectedTicket}
                setSelectedTicket={setSelectedTicket}
                replyMessage={ticketReplyMessage}
                setReplyMessage={setTicketReplyMessage}
                onReply={handleTicketReply}
                onStatusUpdate={updateTicketStatus}
              />
            )}
            {activeTab === 'settings' && (
              <SettingsTab 
                settings={adminSettings}
                authHeaders={authHeaders}
                showToast={showToast}
                onUpdate={setAdminSettings}
              />
            )}
          </>
        )}
      </div>

      {/* Modals */}
      <VendorModal 
        isOpen={showVendorModal}
        onClose={() => setShowVendorModal(false)}
        onSuccess={(vendor) => {
          setVendors([...vendors, vendor]);
          showToast('Vendor created successfully');
        }}
        authHeaders={authHeaders}
      />

      <ClinicModal 
        isOpen={showClinicModal}
        onClose={() => setShowClinicModal(false)}
        onSuccess={(clinic) => {
          setClinics([...clinics, clinic]);
          showToast('Clinic created successfully');
        }}
        authHeaders={authHeaders}
      />

      <AssignModal 
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        clinic={selectedClinic}
        vendors={vendors}
        onSuccess={() => {
          showToast('Vendors assigned successfully');
          fetchData();
        }}
        authHeaders={authHeaders}
      />

      <ApprovalModal 
        isOpen={showApprovalModal}
        onClose={() => {
          setShowApprovalModal(false);
          setSelectedProduct(null);
        }}
        product={selectedProduct}
        onApprove={approveProductWithCommission}
      />

      <OrderDetailModal 
        isOpen={showOrderModal}
        onClose={() => {
          setShowOrderModal(false);
          setSelectedOrder(null);
        }}
        order={selectedOrder}
      />

      <EnquiryDetailModal 
        isOpen={showEnquiryModal}
        onClose={() => {
          setShowEnquiryModal(false);
          setSelectedEnquiry(null);
        }}
        enquiry={selectedEnquiry}
        onUpdateStatus={updateEnquiryStatus}
        authHeaders={authHeaders}
        showToast={showToast}
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

const VendorsTab = ({ vendors, onDelete, onAdd }) => (
  <div>
    <div className="flex justify-between items-center mb-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
          Vendors
        </h1>
        <p className="text-slate-500 mt-1">Manage vendor accounts</p>
      </div>
      <button
        onClick={onAdd}
        className="btn-primary px-4 py-2 rounded-lg font-medium flex items-center gap-2"
        data-testid="add-vendor-btn"
      >
        <Plus className="w-4 h-4" />
        Add Vendor
      </button>
    </div>

    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Company</th>
            <th>Contact</th>
            <th>Email</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {vendors.length === 0 ? (
            <tr>
              <td colSpan="5" className="text-center py-12 text-slate-500">
                No vendors yet. Click "Add Vendor" to create one.
              </td>
            </tr>
          ) : (
            vendors.map(vendor => (
              <tr key={vendor.id} className="table-row-hover">
                <td className="font-medium text-slate-900">{vendor.company_name}</td>
                <td>{vendor.name}</td>
                <td className="text-slate-500">{vendor.email}</td>
                <td>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                    vendor.is_active ? 'badge-success' : 'badge-error'
                  }`}>
                    {vendor.is_active ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {vendor.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <button
                    onClick={() => onDelete(vendor.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    data-testid={`delete-vendor-${vendor.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
);

const ClinicsTab = ({ clinics, onDelete, onAdd }) => (
  <div>
    <div className="flex justify-between items-center mb-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
          Clinics
        </h1>
        <p className="text-slate-500 mt-1">Manage clinic accounts</p>
      </div>
      <button
        onClick={onAdd}
        className="btn-primary px-4 py-2 rounded-lg font-medium flex items-center gap-2"
        data-testid="add-clinic-btn"
      >
        <Plus className="w-4 h-4" />
        Add Clinic
      </button>
    </div>

    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Clinic Name</th>
            <th>Contact</th>
            <th>Email</th>
            <th>Location</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {clinics.length === 0 ? (
            <tr>
              <td colSpan="6" className="text-center py-12 text-slate-500">
                No clinics yet. Click "Add Clinic" to create one.
              </td>
            </tr>
          ) : (
            clinics.map(clinic => (
              <tr key={clinic.id} className="table-row-hover">
                <td className="font-medium text-slate-900">{clinic.clinic_name}</td>
                <td>{clinic.name}</td>
                <td className="text-slate-500">{clinic.email}</td>
                <td className="text-slate-500">{clinic.city}, {clinic.state}</td>
                <td>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                    clinic.is_active ? 'badge-success' : 'badge-error'
                  }`}>
                    {clinic.is_active ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {clinic.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <button
                    onClick={() => onDelete(clinic.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    data-testid={`delete-clinic-${clinic.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
);

const ProductsApprovalTab = ({ products, onApprove }) => (
  <div>
    <div className="mb-8">
      <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
        Product Approvals
      </h1>
      <p className="text-slate-500 mt-1">Review and approve vendor products with commission</p>
    </div>

    {products.length === 0 ? (
      <div className="bg-white rounded-xl border border-slate-100 p-16 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">All caught up!</h3>
        <p className="text-slate-500">No products pending approval</p>
      </div>
    ) : (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map(product => (
          <div key={product.id} className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            <div className="h-40 bg-slate-100 flex items-center justify-center">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-12 h-12 text-slate-300" />
              )}
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[#E07A5F] font-medium">{product.category}</span>
                <span className="text-xs text-slate-500">by {product.vendor_name}</span>
              </div>
              <h3 className="font-semibold text-slate-900 mb-1">{product.name}</h3>
              <p className="text-sm text-slate-500 mb-3 line-clamp-2">{product.description}</p>
              <div className="flex items-center justify-between mb-4">
                <span className="price-tag text-lg">${product.price?.toFixed(2)}</span>
                <span className="text-xs text-slate-500">SKU: {product.sku}</span>
              </div>
              <button
                onClick={() => onApprove(product)}
                className="w-full bg-[#E07A5F] hover:bg-[#D0694E] text-white py-2 rounded-lg font-medium flex items-center justify-center gap-1 transition-colors"
                data-testid={`review-product-${product.id}`}
              >
                <DollarSign className="w-4 h-4" />
                Review & Set Commission
              </button>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const InventoryTab = ({ inventory, vendors }) => {
  const [filterVendor, setFilterVendor] = useState('');
  
  const filteredInventory = filterVendor 
    ? inventory.filter(item => item.vendor_id === filterVendor)
    : inventory;

  const totalStock = filteredInventory.reduce((sum, item) => sum + item.stock_quantity, 0);
  const totalValue = filteredInventory.reduce((sum, item) => sum + (item.price * item.stock_quantity), 0);

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
            Inventory Management
          </h1>
          <p className="text-slate-500 mt-1">View all products and stock levels</p>
        </div>
        <select
          value={filterVendor}
          onChange={(e) => setFilterVendor(e.target.value)}
          className="form-input py-2 px-3"
          data-testid="inventory-vendor-filter"
        >
          <option value="">All Vendors</option>
          {vendors.map(v => (
            <option key={v.id} value={v.id}>{v.company_name}</option>
          ))}
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-slate-100 p-6">
          <div className="text-sm text-slate-500 mb-1">Total Products</div>
          <div className="text-3xl font-bold text-slate-900">{filteredInventory.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-6">
          <div className="text-sm text-slate-500 mb-1">Total Stock Units</div>
          <div className="text-3xl font-bold text-slate-900">{totalStock}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-6">
          <div className="text-sm text-slate-500 mb-1">Total Stock Value</div>
          <div className="text-3xl font-bold text-[#E07A5F]">${totalValue.toFixed(2)}</div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Vendor</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Status</th>
              <th>Commission</th>
              <th>Vendor Gets</th>
            </tr>
          </thead>
          <tbody>
            {filteredInventory.length === 0 ? (
              <tr>
                <td colSpan="8" className="text-center py-12 text-slate-500">
                  No inventory data
                </td>
              </tr>
            ) : (
              filteredInventory.map(item => (
                <tr key={item.product_id} className="table-row-hover">
                  <td className="font-medium text-slate-900">{item.product_name}</td>
                  <td className="text-slate-500">{item.sku}</td>
                  <td className="text-slate-500">{item.vendor_name}</td>
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ReportsTab = ({ report }) => {
  if (!report) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
          Commission Reports
        </h1>
        <p className="text-slate-500 mt-1">VIDAI earnings and vendor payouts</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-slate-100 p-6">
          <div className="text-sm text-slate-500 mb-1">Total Products</div>
          <div className="text-3xl font-bold text-slate-900">{report.total_products}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-6">
          <div className="text-sm text-slate-500 mb-1">Total Product Value</div>
          <div className="text-3xl font-bold text-slate-900">${report.total_product_value?.toFixed(2)}</div>
        </div>
        <div className="bg-gradient-to-br from-[#E07A5F] to-[#D0694E] rounded-xl p-6 text-white">
          <div className="text-sm opacity-90 mb-1">VIDAI Commission</div>
          <div className="text-3xl font-bold">${report.total_vidai_commission?.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-6">
          <div className="text-sm text-slate-500 mb-1">Vendor Earnings</div>
          <div className="text-3xl font-bold text-green-600">${report.total_vendor_amount?.toFixed(2)}</div>
        </div>
      </div>

      {/* By Vendor Breakdown */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Commission by Vendor</h2>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Products</th>
              <th>Total Stock</th>
              <th>Stock Value</th>
              <th>VIDAI Commission</th>
              <th>Vendor Amount</th>
            </tr>
          </thead>
          <tbody>
            {report.by_vendor?.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-12 text-slate-500">
                  No commission data yet
                </td>
              </tr>
            ) : (
              report.by_vendor?.map(vendor => (
                <tr key={vendor.vendor_id} className="table-row-hover">
                  <td className="font-medium text-slate-900">{vendor.vendor_name}</td>
                  <td>{vendor.product_count}</td>
                  <td>{vendor.total_stock} units</td>
                  <td>${vendor.total_value?.toFixed(2)}</td>
                  <td className="text-[#E07A5F] font-medium">${vendor.vidai_commission?.toFixed(2)}</td>
                  <td className="text-green-600 font-medium">${vendor.vendor_amount?.toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const AssignmentsTab = ({ clinics, vendors, onAssign, authHeaders, showToast }) => {
  const [assignments, setAssignments] = useState({});

  useEffect(() => {
    const fetchAssignments = async () => {
      const assignmentData = {};
      for (const clinic of clinics) {
        try {
          const res = await axios.get(
            `${API}/admin/clinic/${clinic.id}/assignments`, 
            authHeaders
          );
          assignmentData[clinic.id] = res.data.assigned_vendors || [];
        } catch (err) {
          assignmentData[clinic.id] = [];
        }
      }
      setAssignments(assignmentData);
    };
    if (clinics.length > 0) {
      fetchAssignments();
    }
  }, [clinics]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
          Vendor Assignments
        </h1>
        <p className="text-slate-500 mt-1">Assign vendors to clinics</p>
      </div>

      <div className="space-y-4">
        {clinics.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-500">
            No clinics available. Create clinics first to assign vendors.
          </div>
        ) : (
          clinics.map(clinic => {
            const assignedVendors = assignments[clinic.id] || [];
            const assignedVendorNames = assignedVendors
              .map(id => vendors.find(v => v.id === id)?.company_name)
              .filter(Boolean);

            return (
              <div
                key={clinic.id}
                className="bg-white rounded-xl border border-slate-100 p-6 flex items-center justify-between card-hover cursor-pointer"
                onClick={() => onAssign(clinic)}
                data-testid={`assign-clinic-${clinic.id}`}
              >
                <div>
                  <h3 className="font-semibold text-slate-900">{clinic.clinic_name}</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {assignedVendorNames.length > 0 
                      ? `Assigned: ${assignedVendorNames.join(', ')}`
                      : 'No vendors assigned'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-500">
                    {assignedVendors.length} vendor(s)
                  </span>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

const VendorModal = ({ isOpen, onClose, onSuccess, authHeaders }) => {
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', company_name: '', phone: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await axios.post(`${API}/admin/vendors`, formData, authHeaders);
      onSuccess(res.data);
      onClose();
      setFormData({ name: '', email: '', password: '', company_name: '', phone: '' });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create vendor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop modal-overlay" onClick={onClose}>
      <div className="modal-box modal-content max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="text-xl font-bold text-slate-900">Add New Vendor</h2>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Company Name *</label>
              <input
                type="text"
                value={formData.company_name}
                onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                className="form-input"
                required
                data-testid="vendor-company-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Contact Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="form-input"
                required
                data-testid="vendor-name-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Email *</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="form-input"
              required
              data-testid="vendor-email-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Password *</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="form-input"
                required
                data-testid="vendor-password-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="form-input"
                data-testid="vendor-phone-input"
              />
            </div>
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
              data-testid="vendor-submit-btn"
            >
              {loading ? 'Creating...' : 'Create Vendor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ClinicModal = ({ isOpen, onClose, onSuccess, authHeaders }) => {
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', clinic_name: '', phone: '',
    billing_address: '', shipping_address: '', city: '', state: '', zip_code: '', country: 'USA'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sameAddress, setSameAddress] = useState(true);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const submitData = {
      ...formData,
      shipping_address: sameAddress ? formData.billing_address : formData.shipping_address
    };

    try {
      const res = await axios.post(`${API}/admin/clinics`, submitData, authHeaders);
      onSuccess(res.data);
      onClose();
      setFormData({
        name: '', email: '', password: '', clinic_name: '', phone: '',
        billing_address: '', shipping_address: '', city: '', state: '', zip_code: '', country: 'USA'
      });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create clinic');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop modal-overlay" onClick={onClose}>
      <div className="modal-box modal-content max-w-2xl" onClick={e => e.stopPropagation()}>
        <div className="modal-header sticky top-0 bg-white z-10 border-b border-slate-100 pb-4">
          <h2 className="text-xl font-bold text-slate-900">Add New Clinic</h2>
        </div>
        <form onSubmit={handleSubmit} className="modal-body pt-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Clinic Name *</label>
              <input
                type="text"
                value={formData.clinic_name}
                onChange={(e) => setFormData({...formData, clinic_name: e.target.value})}
                className="form-input"
                required
                data-testid="clinic-name-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Contact Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="form-input"
                required
                data-testid="clinic-contact-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="form-input"
                required
                data-testid="clinic-email-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password *</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="form-input"
                required
                data-testid="clinic-password-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Phone</label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              className="form-input"
              data-testid="clinic-phone-input"
            />
          </div>

          <hr className="my-6 border-slate-200" />

          <h3 className="font-semibold text-slate-900 mb-4">Address Information</h3>

          <div className="form-group">
            <label className="form-label">Billing Address *</label>
            <input
              type="text"
              value={formData.billing_address}
              onChange={(e) => setFormData({...formData, billing_address: e.target.value})}
              className="form-input"
              required
              data-testid="clinic-billing-input"
            />
          </div>

          <div className="form-group">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sameAddress}
                onChange={(e) => setSameAddress(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300"
              />
              <span className="text-sm text-slate-600">Shipping address same as billing</span>
            </label>
          </div>

          {!sameAddress && (
            <div className="form-group">
              <label className="form-label">Shipping Address *</label>
              <input
                type="text"
                value={formData.shipping_address}
                onChange={(e) => setFormData({...formData, shipping_address: e.target.value})}
                className="form-input"
                required
                data-testid="clinic-shipping-input"
              />
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="form-group">
              <label className="form-label">City *</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({...formData, city: e.target.value})}
                className="form-input"
                required
                data-testid="clinic-city-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">State *</label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => setFormData({...formData, state: e.target.value})}
                className="form-input"
                required
                data-testid="clinic-state-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">ZIP Code *</label>
              <input
                type="text"
                value={formData.zip_code}
                onChange={(e) => setFormData({...formData, zip_code: e.target.value})}
                className="form-input"
                required
                data-testid="clinic-zip-input"
              />
            </div>
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
              data-testid="clinic-submit-btn"
            >
              {loading ? 'Creating...' : 'Create Clinic'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AssignModal = ({ isOpen, onClose, clinic, vendors, onSuccess, authHeaders }) => {
  const [selectedVendors, setSelectedVendors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchingAssignments, setFetchingAssignments] = useState(true);

  useEffect(() => {
    const fetchCurrentAssignments = async () => {
      if (!clinic) return;
      setFetchingAssignments(true);
      try {
        const res = await axios.get(`${API}/admin/clinic/${clinic.id}/assignments`, authHeaders);
        setSelectedVendors(res.data.assigned_vendors || []);
      } catch (err) {
        setSelectedVendors([]);
      } finally {
        setFetchingAssignments(false);
      }
    };
    if (isOpen && clinic) {
      fetchCurrentAssignments();
    }
  }, [isOpen, clinic]);

  if (!isOpen || !clinic) return null;

  const toggleVendor = (vendorId) => {
    setSelectedVendors(prev =>
      prev.includes(vendorId)
        ? prev.filter(id => id !== vendorId)
        : [...prev, vendorId]
    );
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/admin/assign-vendors`, {
        clinic_id: clinic.id,
        vendor_ids: selectedVendors
      }, authHeaders);
      onSuccess();
      onClose();
    } catch (err) {
      alert('Failed to assign vendors');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop modal-overlay" onClick={onClose}>
      <div className="modal-box modal-content max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="text-xl font-bold text-slate-900">Assign Vendors to {clinic.clinic_name}</h2>
          <p className="text-slate-500 text-sm mt-1">Select vendors that this clinic can purchase from</p>
        </div>
        <div className="modal-body">
          {fetchingAssignments ? (
            <div className="flex justify-center py-8">
              <div className="spinner"></div>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {vendors.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No vendors available</p>
              ) : (
                vendors.map(vendor => (
                  <label
                    key={vendor.id}
                    className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                      selectedVendors.includes(vendor.id)
                        ? 'border-[#E07A5F] bg-orange-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedVendors.includes(vendor.id)}
                      onChange={() => toggleVendor(vendor.id)}
                      className="w-5 h-5 rounded border-slate-300 text-[#E07A5F] focus:ring-[#E07A5F]"
                    />
                    <div>
                      <div className="font-medium text-slate-900">{vendor.company_name}</div>
                      <div className="text-sm text-slate-500">{vendor.email}</div>
                    </div>
                  </label>
                ))
              )}
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn-secondary py-2.5 rounded-lg font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 btn-primary py-2.5 rounded-lg font-medium"
              data-testid="assign-submit-btn"
            >
              {loading ? 'Saving...' : 'Save Assignments'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ApprovalModal = ({ isOpen, onClose, product, onApprove }) => {
  const [commissionRate, setCommissionRate] = useState(10);
  const [loading, setLoading] = useState(false);

  if (!isOpen || !product) return null;

  const price = product.price || 0;
  const commissionAmount = (price * commissionRate / 100).toFixed(2);
  const vendorAmount = (price - commissionAmount).toFixed(2);

  const handleApprove = async () => {
    setLoading(true);
    await onApprove(product.id, true, commissionRate);
    setLoading(false);
  };

  const handleReject = async () => {
    setLoading(true);
    await onApprove(product.id, false, 0);
    setLoading(false);
  };

  return (
    <div className="modal-backdrop modal-overlay" onClick={onClose}>
      <div className="modal-box modal-content max-w-md" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="text-xl font-bold text-slate-900">Product Approval</h2>
          <p className="text-slate-500 text-sm mt-1">Set commission before approving</p>
        </div>
        
        <div className="modal-body">
          {/* Product Info */}
          <div className="bg-slate-50 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-slate-300" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">{product.name}</h3>
                <p className="text-sm text-slate-500">{product.vendor_name}</p>
                <p className="text-lg font-bold text-[#E07A5F] mt-1">${price.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Commission Setting */}
          <div className="form-group">
            <label className="form-label">VIDAI Commission Rate (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={commissionRate}
              onChange={(e) => setCommissionRate(parseFloat(e.target.value) || 0)}
              className="form-input"
              data-testid="commission-rate-input"
            />
          </div>

          {/* Commission Breakdown */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-600">Product Price</span>
              <span className="font-medium">${price.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">VIDAI Commission ({commissionRate}%)</span>
              <span className="font-medium text-[#E07A5F]">${commissionAmount}</span>
            </div>
            <hr className="border-slate-200" />
            <div className="flex justify-between">
              <span className="font-semibold text-slate-900">Vendor Receives</span>
              <span className="font-bold text-green-600">${vendorAmount}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={handleReject}
              disabled={loading}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-1 transition-colors"
              data-testid="reject-btn"
            >
              <X className="w-4 h-4" />
              Reject
            </button>
            <button
              onClick={handleApprove}
              disabled={loading}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-1 transition-colors"
              data-testid="approve-btn"
            >
              <Check className="w-4 h-4" />
              Approve
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const AdminOrdersTab = ({ orders, onViewOrder }) => {
  const [filterStatus, setFilterStatus] = useState('');
  
  const filteredOrders = filterStatus 
    ? orders.filter(order => order.status === filterStatus)
    : orders;

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

  const totalOrders = filteredOrders.length;
  const paidOrders = filteredOrders.filter(o => o.payment_status === 'paid').length;
  const totalRevenue = filteredOrders.filter(o => o.payment_status === 'paid').reduce((sum, o) => sum + o.total_amount, 0);

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
            Order Management
          </h1>
          <p className="text-slate-500 mt-1">Track all clinic orders</p>
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="form-input py-2 px-3"
          data-testid="orders-status-filter"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="processing">Processing</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-slate-100 p-6">
          <div className="text-sm text-slate-500 mb-1">Total Orders</div>
          <div className="text-3xl font-bold text-slate-900">{totalOrders}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-6">
          <div className="text-sm text-slate-500 mb-1">Paid Orders</div>
          <div className="text-3xl font-bold text-green-600">{paidOrders}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-6">
          <div className="text-sm text-slate-500 mb-1">Total Revenue</div>
          <div className="text-3xl font-bold text-[#E07A5F]">${totalRevenue.toFixed(2)}</div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Clinic</th>
              <th>Vendor</th>
              <th>Amount</th>
              <th>Payment</th>
              <th>Status</th>
              <th>Tracking</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan="8" className="text-center py-12 text-slate-500">
                  No orders found
                </td>
              </tr>
            ) : (
              filteredOrders.map(order => (
                <tr key={order.id} className="table-row-hover">
                  <td className="font-medium text-slate-900">#{order.id.slice(0, 8)}</td>
                  <td>{order.clinic_name}</td>
                  <td>{order.vendor_name}</td>
                  <td className="price-tag">${order.total_amount?.toFixed(2)}</td>
                  <td>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      order.payment_status === 'paid' ? 'badge-success' : 'badge-warning'
                    }`}>
                      {order.payment_status?.charAt(0).toUpperCase() + order.payment_status?.slice(1)}
                    </span>
                  </td>
                  <td>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusClass(order.status)}`}>
                      {order.status?.charAt(0).toUpperCase() + order.status?.slice(1)}
                    </span>
                  </td>
                  <td>
                    {order.tracking_number ? (
                      <div className="text-sm">
                        <div className="font-medium">{order.carrier || 'Unknown'}</div>
                        <div className="text-slate-500">{order.tracking_number}</div>
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td>
                    <button
                      onClick={() => onViewOrder(order)}
                      className="p-2 text-[#E07A5F] hover:bg-orange-50 rounded-lg transition-colors"
                      data-testid={`view-order-${order.id}`}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const OrderDetailModal = ({ isOpen, onClose, order }) => {
  if (!isOpen || !order) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="modal-backdrop modal-overlay" onClick={onClose}>
      <div className="modal-box modal-content max-w-2xl" onClick={e => e.stopPropagation()}>
        <div className="modal-header flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Order Details</h2>
            <p className="text-slate-500 text-sm">#{order.id.slice(0, 8)}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        
        <div className="modal-body space-y-6">
          {/* Status Row */}
          <div className="flex gap-4">
            <div className="flex-1 bg-slate-50 rounded-xl p-4">
              <div className="text-sm text-slate-500 mb-1">Order Status</div>
              <div className="font-semibold text-slate-900 capitalize">{order.status}</div>
            </div>
            <div className="flex-1 bg-slate-50 rounded-xl p-4">
              <div className="text-sm text-slate-500 mb-1">Payment Status</div>
              <div className={`font-semibold ${order.payment_status === 'paid' ? 'text-green-600' : 'text-yellow-600'}`}>
                {order.payment_status?.charAt(0).toUpperCase() + order.payment_status?.slice(1)}
              </div>
            </div>
            <div className="flex-1 bg-slate-50 rounded-xl p-4">
              <div className="text-sm text-slate-500 mb-1">Total Amount</div>
              <div className="font-semibold text-[#E07A5F]">${order.total_amount?.toFixed(2)}</div>
            </div>
          </div>

          {/* Parties */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-slate-700 mb-2">Clinic</div>
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="font-semibold text-slate-900">{order.clinic_name}</div>
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-700 mb-2">Vendor</div>
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="font-semibold text-slate-900">{order.vendor_name}</div>
              </div>
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="text-sm font-medium text-slate-700 mb-2">Order Items</div>
            <div className="bg-slate-50 rounded-xl p-4 space-y-2">
              {order.items?.map((item, idx) => (
                <div key={idx} className="flex justify-between">
                  <span className="text-slate-600">{item.name} x {item.quantity}</span>
                  <span className="font-medium text-slate-900">${item.subtotal?.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Shipping */}
          <div>
            <div className="text-sm font-medium text-slate-700 mb-2">Shipping Address</div>
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="text-slate-900">
                {order.shipping_address}<br />
                {order.city}, {order.state} {order.zip_code}<br />
                {order.country}
              </div>
            </div>
          </div>

          {/* Tracking Info */}
          {order.tracking_number && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-green-800 font-medium mb-2">
                <Truck className="w-4 h-4" />
                Tracking Information
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-green-600">Carrier</div>
                  <div className="font-medium text-green-900">{order.carrier || '-'}</div>
                </div>
                <div>
                  <div className="text-green-600">Tracking #</div>
                  <div className="font-medium text-green-900">{order.tracking_number}</div>
                </div>
                <div>
                  <div className="text-green-600">Est. Delivery</div>
                  <div className="font-medium text-green-900">{order.estimated_delivery || '-'}</div>
                </div>
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-slate-500">Created</div>
              <div className="font-medium">{formatDate(order.created_at)}</div>
            </div>
            {order.shipped_at && (
              <div>
                <div className="text-slate-500">Shipped</div>
                <div className="font-medium">{formatDate(order.shipped_at)}</div>
              </div>
            )}
            {order.delivered_at && (
              <div>
                <div className="text-slate-500">Delivered</div>
                <div className="font-medium">{formatDate(order.delivered_at)}</div>
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="w-full btn-secondary py-2.5 rounded-lg font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const EnquiriesTab = ({ enquiries, onView, onUpdateStatus, onDelete }) => {
  const [filterStatus, setFilterStatus] = useState('');
  
  const filteredEnquiries = filterStatus 
    ? enquiries.filter(e => e.status === filterStatus)
    : enquiries;

  const getStatusClass = (status) => {
    const classes = {
      new: 'bg-blue-100 text-blue-700',
      contacted: 'bg-yellow-100 text-yellow-700',
      converted: 'bg-green-100 text-green-700',
      closed: 'bg-slate-100 text-slate-700'
    };
    return classes[status] || 'bg-slate-100 text-slate-700';
  };

  const getTypeLabel = (type) => {
    const labels = {
      general: 'General',
      demo: 'Demo Request',
      pricing: 'Pricing',
      partnership: 'Partnership'
    };
    return labels[type] || type;
  };

  const newCount = enquiries.filter(e => e.status === 'new').length;

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
            Contact Enquiries
          </h1>
          <p className="text-slate-500 mt-1">Manage sales enquiries and leads</p>
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="form-input py-2 px-3"
          data-testid="enquiries-status-filter"
        >
          <option value="">All Statuses</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="converted">Converted</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-slate-100 p-6">
          <div className="text-sm text-slate-500 mb-1">Total Enquiries</div>
          <div className="text-3xl font-bold text-slate-900">{enquiries.length}</div>
        </div>
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
          <div className="text-sm text-blue-600 mb-1">New</div>
          <div className="text-3xl font-bold text-blue-700">{newCount}</div>
        </div>
        <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-6">
          <div className="text-sm text-yellow-600 mb-1">Contacted</div>
          <div className="text-3xl font-bold text-yellow-700">
            {enquiries.filter(e => e.status === 'contacted').length}
          </div>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-6">
          <div className="text-sm text-green-600 mb-1">Converted</div>
          <div className="text-3xl font-bold text-green-700">
            {enquiries.filter(e => e.status === 'converted').length}
          </div>
        </div>
      </div>

      {/* Enquiries Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Name</th>
              <th>Email</th>
              <th>Company</th>
              <th>Type</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEnquiries.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center py-12 text-slate-500">
                  No enquiries found
                </td>
              </tr>
            ) : (
              filteredEnquiries.map(enquiry => (
                <tr key={enquiry.id} className="table-row-hover">
                  <td className="text-slate-500">
                    {new Date(enquiry.created_at).toLocaleDateString()}
                  </td>
                  <td className="font-medium text-slate-900">{enquiry.name}</td>
                  <td>{enquiry.email}</td>
                  <td>{enquiry.company || '-'}</td>
                  <td>
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                      {getTypeLabel(enquiry.enquiry_type)}
                    </span>
                  </td>
                  <td>
                    <select
                      value={enquiry.status}
                      onChange={(e) => onUpdateStatus(enquiry.id, e.target.value)}
                      className={`text-xs font-medium rounded-full px-2 py-1 border-0 cursor-pointer ${getStatusClass(enquiry.status)}`}
                      data-testid={`enquiry-status-${enquiry.id}`}
                    >
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="converted">Converted</option>
                      <option value="closed">Closed</option>
                    </select>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        onClick={() => onView(enquiry)}
                        className="p-2 text-[#E07A5F] hover:bg-orange-50 rounded-lg transition-colors"
                        data-testid={`view-enquiry-${enquiry.id}`}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(enquiry.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        data-testid={`delete-enquiry-${enquiry.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const SettingsTab = ({ settings, authHeaders, showToast, onUpdate }) => {
  const [formData, setFormData] = useState({
    contact_email: settings?.contact_email || '',
    company_name: settings?.company_name || 'VIDAI',
    notify_on_enquiry: settings?.notify_on_enquiry ?? true
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData({
        contact_email: settings.contact_email || '',
        company_name: settings.company_name || 'VIDAI',
        notify_on_enquiry: settings.notify_on_enquiry ?? true
      });
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/admin/settings`, formData, authHeaders);
      onUpdate(formData);
      showToast('Settings saved successfully');
    } catch (err) {
      showToast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
          Settings
        </h1>
        <p className="text-slate-500 mt-1">Configure admin settings and notifications</p>
      </div>

      <div className="max-w-2xl">
        <div className="bg-white rounded-xl border border-slate-100 p-6">
          <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Mail className="w-5 h-5 text-slate-500" />
            Contact & Notifications
          </h2>

          <div className="space-y-6">
            <div className="form-group">
              <label className="form-label">Company Name</label>
              <input
                type="text"
                value={formData.company_name}
                onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                className="form-input"
                placeholder="VIDAI"
                data-testid="settings-company-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Contact Email</label>
              <input
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData({...formData, contact_email: e.target.value})}
                className="form-input"
                placeholder="sales@vidai.com"
                data-testid="settings-email-input"
              />
              <p className="text-xs text-slate-500 mt-1">
                Enquiry notifications will be sent to this email
              </p>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="notify_on_enquiry"
                checked={formData.notify_on_enquiry}
                onChange={(e) => setFormData({...formData, notify_on_enquiry: e.target.checked})}
                className="w-5 h-5 rounded border-slate-300 text-[#E07A5F] focus:ring-[#E07A5F]"
                data-testid="settings-notify-checkbox"
              />
              <label htmlFor="notify_on_enquiry" className="text-slate-700">
                Send email notification on new enquiries
              </label>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary px-6 py-2.5 rounded-lg font-medium"
              data-testid="settings-save-btn"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const EnquiryDetailModal = ({ isOpen, onClose, enquiry, onUpdateStatus, authHeaders, showToast }) => {
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (enquiry) {
      setNotes(enquiry.notes || '');
    }
  }, [enquiry]);

  if (!isOpen || !enquiry) return null;

  const saveNotes = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/admin/enquiries/${enquiry.id}/notes?notes=${encodeURIComponent(notes)}`, {}, authHeaders);
      showToast('Notes saved');
    } catch (err) {
      showToast('Failed to save notes', 'error');
    } finally {
      setSaving(false);
    }
  };

  const getTypeLabel = (type) => {
    const labels = {
      general: 'General Inquiry',
      demo: 'Demo Request',
      pricing: 'Pricing Information',
      partnership: 'Partnership Opportunity'
    };
    return labels[type] || type;
  };

  return (
    <div className="modal-backdrop modal-overlay" onClick={onClose}>
      <div className="modal-box modal-content max-w-2xl" onClick={e => e.stopPropagation()}>
        <div className="modal-header flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Enquiry Details</h2>
            <p className="text-slate-500 text-sm">{getTypeLabel(enquiry.enquiry_type)}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        
        <div className="modal-body space-y-6">
          {/* Contact Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="text-sm text-slate-500 mb-1">Name</div>
              <div className="font-semibold text-slate-900">{enquiry.name}</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="text-sm text-slate-500 mb-1">Email</div>
              <div className="font-semibold text-slate-900">{enquiry.email}</div>
            </div>
            {enquiry.company && (
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="text-sm text-slate-500 mb-1">Company</div>
                <div className="font-semibold text-slate-900">{enquiry.company}</div>
              </div>
            )}
            {enquiry.phone && (
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="text-sm text-slate-500 mb-1">Phone</div>
                <div className="font-semibold text-slate-900">{enquiry.phone}</div>
              </div>
            )}
          </div>

          {/* Message */}
          <div>
            <div className="text-sm font-medium text-slate-700 mb-2">Message</div>
            <div className="bg-slate-50 rounded-xl p-4 text-slate-700 whitespace-pre-wrap">
              {enquiry.message}
            </div>
          </div>

          {/* Status */}
          <div>
            <div className="text-sm font-medium text-slate-700 mb-2">Status</div>
            <select
              value={enquiry.status}
              onChange={(e) => onUpdateStatus(enquiry.id, e.target.value)}
              className="form-input w-full"
              data-testid="enquiry-detail-status"
            >
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="converted">Converted</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <div className="text-sm font-medium text-slate-700 mb-2">Internal Notes</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="form-input min-h-[100px]"
              placeholder="Add notes about this enquiry..."
              data-testid="enquiry-notes-input"
            />
            <button
              onClick={saveNotes}
              disabled={saving}
              className="mt-2 btn-secondary px-4 py-2 rounded-lg text-sm"
            >
              {saving ? 'Saving...' : 'Save Notes'}
            </button>
          </div>

          {/* Timestamps */}
          <div className="flex justify-between text-sm text-slate-500">
            <div>Created: {new Date(enquiry.created_at).toLocaleString()}</div>
            {enquiry.updated_at && (
              <div>Updated: {new Date(enquiry.updated_at).toLocaleString()}</div>
            )}
          </div>

          <button
            onClick={onClose}
            className="w-full btn-secondary py-2.5 rounded-lg font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const AdminTicketsTab = ({ tickets, selectedTicket, setSelectedTicket, replyMessage, setReplyMessage, onReply, onStatusUpdate }) => {
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
          <ChevronRight className="w-4 h-4 rotate-180" />
          Back to All Tickets
        </button>

        <div className="bg-white rounded-xl border border-slate-100 p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
                {selectedTicket.subject}
              </h1>
              <p className="text-slate-500 mt-1">
                Clinic: {selectedTicket.clinic_name} • Vendor: {selectedTicket.vendor_name} • Order #{selectedTicket.order_id?.slice(0, 8)}
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
                  msg.sender_type === 'admin' 
                    ? 'bg-purple-50 ml-8' 
                    : msg.sender_type === 'vendor'
                    ? 'bg-teal-50'
                    : 'bg-slate-50 mr-8'
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-slate-900">
                    {msg.sender_name}
                    <span className="ml-2 text-xs text-slate-400">({msg.sender_type})</span>
                  </span>
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
                  placeholder="Type admin reply..."
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  onKeyPress={(e) => e.key === 'Enter' && onReply()}
                />
                <button
                  onClick={onReply}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
                >
                  <Mail className="w-4 h-4" />
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
            All Support Tickets
          </h1>
          <p className="text-slate-500 mt-1">View and manage all customer support requests</p>
        </div>
        <div className="flex gap-2">
          <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm">
            {tickets.filter(t => t.status === 'open').length} Open
          </span>
          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
            {tickets.filter(t => t.status === 'in_progress').length} In Progress
          </span>
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-16 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No tickets yet</h3>
          <p className="text-slate-500">Support tickets will appear here</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Subject</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Clinic</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Vendor</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Priority</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Messages</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.map(ticket => (
                <tr 
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  className="hover:bg-slate-50 cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{ticket.subject}</div>
                    <div className="text-xs text-slate-500">Order #{ticket.order_id?.slice(0, 8)}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{ticket.clinic_name}</td>
                  <td className="px-4 py-3 text-slate-600">{ticket.vendor_name}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs ${getPriorityClass(ticket.priority)}`}>
                      {ticket.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusClass(ticket.status)}`}>
                      {ticket.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-slate-600">{ticket.messages?.length || 0}</td>
                  <td className="px-4 py-3 text-right text-xs text-slate-500">{formatDate(ticket.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
