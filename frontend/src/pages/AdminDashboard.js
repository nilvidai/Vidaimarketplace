import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Building2, Link2, LogOut, Plus, Trash2, 
  CheckCircle, XCircle, ChevronRight 
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('vendors');
  const [vendors, setVendors] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showClinicModal, setShowClinicModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState(null);
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
      const [vendorsRes, clinicsRes] = await Promise.all([
        axios.get(`${API}/admin/vendors`, authHeaders),
        axios.get(`${API}/admin/clinics`, authHeaders)
      ]);
      setVendors(vendorsRes.data);
      setClinics(clinicsRes.data);
    } catch (err) {
      showToast('Failed to fetch data', 'error');
    } finally {
      setLoading(false);
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

  const tabs = [
    { id: 'vendors', label: 'Vendors', icon: Building2, count: vendors.length },
    { id: 'clinics', label: 'Clinics', icon: Users, count: clinics.length },
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
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left sidebar-link ${
                activeTab === tab.id ? 'active' : 'text-slate-300'
              }`}
              data-testid={`tab-${tab.id}`}
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

export default AdminDashboard;
