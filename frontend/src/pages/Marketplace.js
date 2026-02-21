import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ShoppingCart, LogOut, Building2, ArrowLeft, Plus, Minus, 
  Trash2, Package, ChevronRight, Image as ImageIcon, Filter,
  ShoppingBag, History, ClipboardList, Truck, Eye
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Marketplace = () => {
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('vendors'); // vendors, products, purchases, orders
  const [toast, setToast] = useState(null);
  
  const { user, logout, getToken } = useAuth();
  const { cart, selectedVendor, setSelectedVendor, addToCart, getCartCount } = useCart();
  const navigate = useNavigate();

  const authHeaders = { headers: { Authorization: `Bearer ${getToken()}` } };

  useEffect(() => {
    if (!user || user.role !== 'clinic') {
      navigate('/');
      return;
    }
    fetchVendors();
    fetchCategories();
  }, [user, navigate]);

  const fetchVendors = async () => {
    try {
      const res = await axios.get(`${API}/clinic/assigned-vendors`, authHeaders);
      setVendors(res.data);
    } catch (err) {
      showToast('Failed to fetch vendors', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await axios.get(`${API}/clinic/categories`, authHeaders);
      setCategories(res.data);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  };

  const fetchProducts = async (vendorId, category = null) => {
    setLoading(true);
    try {
      let url = `${API}/clinic/vendors/${vendorId}/products`;
      if (category) url += `?category=${encodeURIComponent(category)}`;
      const res = await axios.get(url, authHeaders);
      setProducts(res.data);
      setView('products');
    } catch (err) {
      showToast('Failed to fetch products', 'error');
    } finally {
      setLoading(false);
    }
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

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const selectVendor = (vendor) => {
    if (selectedVendor && selectedVendor.id !== vendor.id && cart.length > 0) {
      if (!window.confirm('Selecting a different vendor will clear your cart. Continue?')) {
        return;
      }
    }
    setSelectedVendor(vendor);
    setSelectedCategory('');
    fetchProducts(vendor.id);
  };

  const handleCategoryFilter = (category) => {
    setSelectedCategory(category);
    if (selectedVendor) {
      fetchProducts(selectedVendor.id, category || null);
    }
  };

  const handleAddToCart = (product) => {
    addToCart(product);
    showToast(`${product.name} added to cart`);
  };

  const goBack = () => {
    if (view === 'purchases') {
      setView('vendors');
    } else {
      setView('vendors');
      setProducts([]);
      setSelectedCategory('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="glass-header sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
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
                onClick={fetchPurchases}
                className={`p-2 hover:bg-slate-100 rounded-lg transition-colors ${view === 'purchases' ? 'bg-slate-100' : ''}`}
                data-testid="purchases-btn"
                title="My Purchases"
              >
                <History className="w-6 h-6 text-slate-700" />
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
                onClick={() => navigate('/marketplace/orders')}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                data-testid="orders-btn"
                title="Order History"
              >
                <Package className="w-6 h-6 text-slate-700" />
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="spinner"></div>
          </div>
        ) : view === 'vendors' ? (
          <VendorsList vendors={vendors} onSelect={selectVendor} />
        ) : view === 'purchases' ? (
          <PurchasesList purchases={purchases} onBack={goBack} />
        ) : (
          <ProductsList 
            products={products} 
            vendor={selectedVendor}
            categories={categories}
            selectedCategory={selectedCategory}
            onCategoryChange={handleCategoryFilter}
            onBack={goBack}
            onAddToCart={handleAddToCart}
          />
        )}
      </main>

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type === 'error' ? 'bg-red-600' : 'bg-slate-900'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
};

const VendorsList = ({ vendors, onSelect }) => (
  <div>
    <div className="mb-8">
      <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
        Your Assigned Vendors
      </h1>
      <p className="text-slate-500 mt-1">Select a vendor to browse their products</p>
    </div>

    {vendors.length === 0 ? (
      <div className="bg-white rounded-xl border border-slate-100 p-16 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Building2 className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">No vendors assigned</h3>
        <p className="text-slate-500">Contact your administrator to assign vendors to your clinic</p>
      </div>
    ) : (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {vendors.map(vendor => (
          <div
            key={vendor.id}
            onClick={() => onSelect(vendor)}
            className="vendor-card"
            data-testid={`vendor-card-${vendor.id}`}
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
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const PurchasesList = ({ purchases, onBack }) => {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={onBack}
          className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
          data-testid="back-from-purchases"
        >
          <ArrowLeft className="w-5 h-5 text-slate-700" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
            My Purchases
          </h1>
          <p className="text-slate-500 mt-1">Products you've purchased</p>
        </div>
      </div>

      {purchases.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-16 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShoppingBag className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No purchases yet</h3>
          <p className="text-slate-500">Products from paid orders will appear here</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Vendor</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Order Date</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((purchase, idx) => (
                <tr key={idx} className="table-row-hover">
                  <td className="font-medium text-slate-900">{purchase.product_name}</td>
                  <td className="text-slate-500">{purchase.vendor_name}</td>
                  <td>{purchase.quantity}</td>
                  <td className="price-tag">${purchase.subtotal?.toFixed(2)}</td>
                  <td className="text-slate-500">{formatDate(purchase.order_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const ProductsList = ({ products, vendor, categories, selectedCategory, onCategoryChange, onBack, onAddToCart }) => (
  <div>
    <div className="flex items-center justify-between mb-8">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
          data-testid="back-to-vendors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-700" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
            {vendor?.company_name}
          </h1>
          <p className="text-slate-500 mt-1">Browse available products</p>
        </div>
      </div>
      
      {/* Category Filter */}
      {categories && categories.length > 0 && (
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <select
            value={selectedCategory || ''}
            onChange={(e) => onCategoryChange(e.target.value)}
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
        <h3 className="text-lg font-semibold text-slate-900 mb-2">No products available</h3>
        <p className="text-slate-500">This vendor hasn't added any products yet</p>
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
              <div className="text-xs text-[#E07A5F] font-medium mb-1">{product.category}</div>
              <h3 className="font-semibold text-slate-900 mb-1">{product.name}</h3>
              <p className="text-sm text-slate-500 mb-3 line-clamp-2">{product.description}</p>
              <div className="flex items-center justify-between mb-4">
                <span className="price-tag text-xl">${product.price.toFixed(2)}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  product.stock_quantity > 0 ? 'badge-success' : 'badge-error'
                }`}>
                  {product.stock_quantity > 0 ? `${product.stock_quantity} in stock` : 'Out of stock'}
                </span>
              </div>
              <button
                onClick={() => onAddToCart(product)}
                disabled={product.stock_quantity === 0}
                className="w-full btn-primary py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid={`add-to-cart-${product.id}`}
              >
                <Plus className="w-4 h-4" />
                Add to Cart
              </button>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default Marketplace;
