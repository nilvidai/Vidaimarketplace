import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, MapPin, CreditCard, Check, 
  Image as ImageIcon, AlertCircle, Home
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Checkout = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, getToken } = useAuth();
  const { cart, selectedVendor, getCartTotal, clearCart } = useCart();
  
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState('');
  const [useSameAddress, setUseSameAddress] = useState(true);
  const [existingOrder, setExistingOrder] = useState(null);
  
  const [shippingAddress, setShippingAddress] = useState({
    address: user?.shipping_address || '',
    city: user?.city || '',
    state: user?.state || '',
    zip_code: user?.zip_code || '',
    country: user?.country || 'USA'
  });

  const authHeaders = { headers: { Authorization: `Bearer ${getToken()}` } };

  // Check for existing order_id in URL (returning from cancelled Stripe payment)
  useEffect(() => {
    const orderId = searchParams.get('order_id');
    if (orderId) {
      fetchExistingOrder(orderId);
    } else {
      setPageLoading(false);
    }
  }, [searchParams]);

  const fetchExistingOrder = async (orderId) => {
    try {
      const res = await axios.get(`${API}/clinic/orders/${orderId}`, authHeaders);
      setExistingOrder(res.data);
    } catch (err) {
      setError('Order not found. Please try placing a new order.');
    } finally {
      setPageLoading(false);
    }
  };

  if (!user || user.role !== 'clinic') {
    navigate('/');
    return null;
  }

  // If no cart items AND no existing order, redirect to cart
  if (!pageLoading && cart.length === 0 && !existingOrder) {
    navigate('/marketplace/cart');
    return null;
  }

  const handleCheckout = async () => {
    setLoading(true);
    setError('');

    try {
      let orderId;

      if (existingOrder) {
        // Use existing order
        orderId = existingOrder.id;
      } else {
        // Create new order
        const orderData = {
          items: cart.map(item => ({
            product_id: item.product.id,
            quantity: item.quantity
          })),
          billing_address: user.billing_address,
          shipping_address: useSameAddress ? user.billing_address : shippingAddress.address,
          city: useSameAddress ? user.city : shippingAddress.city,
          state: useSameAddress ? user.state : shippingAddress.state,
          zip_code: useSameAddress ? user.zip_code : shippingAddress.zip_code,
          country: useSameAddress ? user.country : shippingAddress.country
        };

        const orderRes = await axios.post(`${API}/clinic/orders`, orderData, authHeaders);
        orderId = orderRes.data.id;
      }

      // Create Stripe checkout session
      const checkoutRes = await axios.post(`${API}/checkout/create-session`, {
        order_id: orderId,
        origin_url: window.location.origin
      }, authHeaders);

      // Redirect to Stripe
      window.location.href = checkoutRes.data.checkout_url;
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create order');
      setLoading(false);
    }
  };

  // Calculate totals from either cart or existing order
  const orderItems = existingOrder ? existingOrder.items : cart.map(item => ({
    name: item.product.name,
    quantity: item.quantity,
    price: item.product.price,
    subtotal: item.product.price * item.quantity,
    image_url: item.product.image_url,
    product_id: item.product.id
  }));

  const orderTotal = existingOrder ? existingOrder.total_amount : getCartTotal();
  const vendorName = existingOrder ? existingOrder.vendor_name : selectedVendor?.company_name;

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="glass-header sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              data-testid="back-btn"
              title="Go Back"
            >
              <ArrowLeft className="w-5 h-5 text-slate-700" />
            </button>
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              data-testid="home-btn"
              title="Home"
            >
              <Home className="w-5 h-5 text-slate-700" />
            </button>
            <h1 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
              Checkout
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-600">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Addresses */}
          <div className="lg:col-span-3 space-y-6">
            {/* Billing Address */}
            <div className="bg-white rounded-xl border border-slate-100 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900">Billing Address</h2>
                  <p className="text-sm text-slate-500">From your clinic registration</p>
                </div>
              </div>
              
              <div className="address-card selected">
                <p className="font-medium text-slate-900">{user?.clinic_name}</p>
                <p className="text-slate-600 mt-1">{user?.billing_address}</p>
                <p className="text-slate-600">{user?.city}, {user?.state} {user?.zip_code}</p>
                <p className="text-slate-600">{user?.country}</p>
              </div>
            </div>

            {/* Shipping Address */}
            <div className="bg-white rounded-xl border border-slate-100 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-slate-600" />
                </div>
                <h2 className="font-semibold text-slate-900">Shipping Address</h2>
              </div>

              <label className="flex items-center gap-3 cursor-pointer mb-4">
                <input
                  type="checkbox"
                  checked={useSameAddress}
                  onChange={(e) => setUseSameAddress(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-300 text-[#E07A5F] focus:ring-[#E07A5F]"
                />
                <span className="text-slate-700">Same as billing address</span>
              </label>

              {useSameAddress ? (
                <div className="address-card selected">
                  <p className="font-medium text-slate-900">{user?.clinic_name}</p>
                  <p className="text-slate-600 mt-1">{user?.billing_address}</p>
                  <p className="text-slate-600">{user?.city}, {user?.state} {user?.zip_code}</p>
                  <p className="text-slate-600">{user?.country}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="form-group mb-0">
                    <label className="form-label">Street Address</label>
                    <input
                      type="text"
                      value={shippingAddress.address}
                      onChange={(e) => setShippingAddress({...shippingAddress, address: e.target.value})}
                      className="form-input"
                      required
                      data-testid="shipping-address-input"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="form-group mb-0">
                      <label className="form-label">City</label>
                      <input
                        type="text"
                        value={shippingAddress.city}
                        onChange={(e) => setShippingAddress({...shippingAddress, city: e.target.value})}
                        className="form-input"
                        required
                      />
                    </div>
                    <div className="form-group mb-0">
                      <label className="form-label">State</label>
                      <input
                        type="text"
                        value={shippingAddress.state}
                        onChange={(e) => setShippingAddress({...shippingAddress, state: e.target.value})}
                        className="form-input"
                        required
                      />
                    </div>
                    <div className="form-group mb-0">
                      <label className="form-label">ZIP Code</label>
                      <input
                        type="text"
                        value={shippingAddress.zip_code}
                        onChange={(e) => setShippingAddress({...shippingAddress, zip_code: e.target.value})}
                        className="form-input"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Payment Method */}
            <div className="bg-white rounded-xl border border-slate-100 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900">Payment Method</h2>
                  <p className="text-sm text-slate-500">Secure payment via Stripe</p>
                </div>
              </div>
              
              <div className="address-card selected flex items-center gap-3">
                <Check className="w-5 h-5 text-[#2A9D8F]" />
                <div>
                  <p className="font-medium text-slate-900">Credit / Debit Card</p>
                  <p className="text-sm text-slate-500">You'll be redirected to Stripe's secure checkout</p>
                </div>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-slate-100 p-6 sticky top-24">
              <h2 className="font-semibold text-slate-900 mb-4">Order Summary</h2>
              
              {existingOrder && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-amber-800">
                    Resuming payment for existing order #{existingOrder.id.slice(0, 8)}
                  </p>
                </div>
              )}
              
              {vendorName && (
                <div className="text-sm text-slate-500 mb-4">
                  Vendor: <span className="text-slate-900 font-medium">{vendorName}</span>
                </div>
              )}

              <div className="space-y-3 mb-6 max-h-64 overflow-y-auto">
                {orderItems.map((item, idx) => (
                  <div key={item.product_id || idx} className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      {item.image_url ? (
                        <img 
                          src={item.image_url} 
                          alt={item.name}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-slate-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{item.name}</p>
                      <p className="text-xs text-slate-500">Qty: {item.quantity}</p>
                    </div>
                    <p className="text-sm font-medium text-slate-900">
                      ${(item.subtotal || item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>

              <hr className="border-slate-200 mb-4" />

              <div className="space-y-2 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="text-slate-900">${orderTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Shipping</span>
                  <span className="text-slate-900">Free</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Tax</span>
                  <span className="text-slate-900">Included</span>
                </div>
              </div>

              <hr className="border-slate-200 mb-4" />

              <div className="flex justify-between mb-6">
                <span className="font-semibold text-slate-900">Total</span>
                <span className="font-bold text-2xl text-[#E07A5F]">
                  ${orderTotal.toFixed(2)}
                </span>
              </div>

              <button
                onClick={handleCheckout}
                disabled={loading}
                className="w-full btn-primary py-3.5 rounded-lg font-semibold flex items-center justify-center gap-2"
                data-testid="place-order-btn"
              >
                {loading ? (
                  <>
                    <div className="spinner"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5" />
                    Pay ${orderTotal.toFixed(2)}
                  </>
                )}
              </button>

              <p className="text-xs text-slate-500 text-center mt-4">
                By placing this order, you agree to our terms and conditions
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Checkout;
