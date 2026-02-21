import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Building2, Link2, LogOut, Plus, Trash2, 
  CheckCircle, XCircle, ChevronRight, Package, ShoppingBag,
  Check, X, Image as ImageIcon, BarChart3, Boxes, DollarSign,
  ClipboardList, Truck, Eye
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('vendors');
  const [vendors, setVendors] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [pendingProducts, setPendingProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [commissionReport, setCommissionReport] = useState(null);
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showClinicModal, setShowClinicModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
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
  }, [user, navigate]);

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
    if (tabId === 'inventory') {
      fetchInventory();
    } else if (tabId === 'reports') {
      fetchCommissionReport();
    }
  };

  const tabs = [
    { id: 'vendors', label: 'Vendors', icon: Building2, count: vendors.length },
    { id: 'clinics', label: 'Clinics', icon: Users, count: clinics.length },
    { id: 'products', label: 'Approvals', icon: Package, count: pendingProducts.length },
    { id: 'inventory', label: 'Inventory', icon: Boxes },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'assignments', label: 'Assignments', icon: Link2 }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <div className="w-64 dashboard-sidebar p-6 flex flex-col">
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
            {activeTab === 'products' && (
              <ProductsApprovalTab 
                products={pendingProducts}
                onApprove={handleApproveClick}
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

export default AdminDashboard;
