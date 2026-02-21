import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Building2, Package, Filter, ShoppingCart,
  Image as ImageIcon, Plus
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminMarketplace = () => {
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('vendors');
  
  const navigate = useNavigate();
  const { user, getToken } = useAuth();
  const { addToCart, getCartCount } = useCart();

  const authHeaders = { headers: { Authorization: `Bearer ${getToken()}` } };

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/admin');
      return;
    }
    fetchVendors();
    fetchCategories();
  }, [user, navigate]);

  const fetchVendors = async () => {
    try {
      const res = await axios.get(`${API}/admin/marketplace/vendors`, authHeaders);
      setVendors(res.data);
    } catch (err) {
      console.error('Failed to fetch vendors:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await axios.get(`${API}/admin/marketplace/categories`, authHeaders);
      setCategories(res.data);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  };

  const fetchProducts = async (vendorId = null, category = null) => {
    setLoading(true);
    try {
      let url = `${API}/admin/marketplace/products`;
      const params = new URLSearchParams();
      if (vendorId) params.append('vendor_id', vendorId);
      if (category) params.append('category', category);
      if (params.toString()) url += `?${params.toString()}`;
      
      const res = await axios.get(url, authHeaders);
      setProducts(res.data);
      setView('products');
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectVendor = (vendor) => {
    setSelectedVendor(vendor);
    setSelectedCategory('');
    fetchProducts(vendor.id);
  };

  const handleCategoryFilter = (category) => {
    setSelectedCategory(category);
    fetchProducts(selectedVendor?.id, category || null);
  };

  const goBack = () => {
    if (view === 'products') {
      setView('vendors');
      setSelectedVendor(null);
      setSelectedCategory('');
      setProducts([]);
    } else {
      navigate('/admin/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="glass-header sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={goBack}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                data-testid="back-btn"
              >
                <ArrowLeft className="w-5 h-5 text-slate-700" />
              </button>
              <div>
                <span className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
                  VIDAI
                </span>
                <span className="text-xs bg-[#E07A5F] text-white px-2 py-0.5 rounded-full font-medium ml-2">
                  Admin View
                </span>
              </div>
            </div>

            <div className="text-sm text-slate-500">
              Viewing marketplace as Admin (read-only)
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="spinner"></div>
          </div>
        ) : view === 'vendors' ? (
          <div>
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
                All Vendors
              </h1>
              <p className="text-slate-500 mt-1">Browse all vendors and their approved products</p>
            </div>

            {vendors.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-100 p-16 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No vendors yet</h3>
                <p className="text-slate-500">Create vendors in the admin dashboard</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {vendors.map(vendor => (
                  <div
                    key={vendor.id}
                    onClick={() => selectVendor(vendor)}
                    className="vendor-card"
                    data-testid={`admin-vendor-card-${vendor.id}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-slate-100 to-slate-50 rounded-xl flex items-center justify-center">
                        <Building2 className="w-7 h-7 text-[#E07A5F]" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-900 text-lg">{vendor.company_name}</h3>
                        <p className="text-sm text-slate-500 mt-1">{vendor.name}</p>
                        <p className="text-sm text-slate-400">{vendor.email}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
                  {selectedVendor?.company_name || 'All Products'}
                </h1>
                <p className="text-slate-500 mt-1">
                  {products.length} approved product{products.length !== 1 ? 's' : ''}
                </p>
              </div>
              
              {/* Category Filter */}
              {categories.length > 0 && (
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-500" />
                  <select
                    value={selectedCategory}
                    onChange={(e) => handleCategoryFilter(e.target.value)}
                    className="form-input py-2 px-3 text-sm"
                    data-testid="category-filter"
                  >
                    <option value="">All Categories</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {products.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-100 p-16 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No approved products</h3>
                <p className="text-slate-500">Products will appear here once approved</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {products.map(product => (
                  <div key={product.id} className="product-card">
                    <div className="product-image flex items-center justify-center">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-12 h-12 text-slate-300" />
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-[#E07A5F] font-medium">{product.category}</span>
                        <span className="text-xs text-slate-400">{product.vendor_name}</span>
                      </div>
                      <h3 className="font-semibold text-slate-900 mb-1">{product.name}</h3>
                      <p className="text-sm text-slate-500 mb-3 line-clamp-2">{product.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="price-tag text-xl">${product.price?.toFixed(2)}</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          product.stock_quantity > 0 ? 'badge-success' : 'badge-error'
                        }`}>
                          {product.stock_quantity > 0 ? `${product.stock_quantity} in stock` : 'Out of stock'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminMarketplace;
