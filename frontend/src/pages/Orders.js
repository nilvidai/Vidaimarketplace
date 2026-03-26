import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, ShoppingBag, Home } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const navigate = useNavigate();
  const { user, getToken } = useAuth();
  const { formatPrice } = useCurrency();

  const authHeaders = { headers: { Authorization: `Bearer ${getToken()}` } };

  useEffect(() => {
    if (!user || user.role !== 'clinic') {
      navigate('/');
      return;
    }
    fetchOrders();
  }, [user, navigate]);

  const fetchOrders = async () => {
    try {
      const res = await axios.get(`${API}/clinic/orders`, authHeaders);
      setOrders(res.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  };

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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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
              My Orders
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="spinner"></div>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 p-16 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No orders yet</h3>
            <p className="text-slate-500 mb-6">Start shopping to place your first order</p>
            <button
              onClick={() => navigate('/marketplace')}
              className="btn-primary px-6 py-2 rounded-lg font-medium"
            >
              Browse Products
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map(order => (
              <div 
                key={order.id} 
                className="bg-white rounded-xl border border-slate-100 overflow-hidden"
                data-testid={`order-${order.id}`}
              >
                {/* Order Header */}
                <div className="p-6 border-b border-slate-100">
                  <div className="flex flex-wrap justify-between items-start gap-4">
                    <div>
                      <div className="text-sm text-slate-500 mb-1">
                        Order #{order.id.slice(0, 8)}
                      </div>
                      <div className="text-xs text-slate-400">
                        {formatDate(order.created_at)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusClass(order.status)}`}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        order.payment_status === 'paid' ? 'badge-success' : 'badge-warning'
                      }`}>
                        {order.payment_status === 'paid' ? 'Paid' : 'Pending Payment'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Order Items */}
                <div className="p-6">
                  <div className="space-y-3 mb-4">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                            <Package className="w-5 h-5 text-slate-400" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{item.name}</p>
                            <p className="text-sm text-slate-500">
                              ${item.price.toFixed(2)} × {item.quantity}
                            </p>
                          </div>
                        </div>
                        <p className="font-medium text-slate-900">
                          ${item.subtotal.toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <hr className="border-slate-100 my-4" />

                  <div className="flex justify-between items-center">
                    <div className="text-sm text-slate-500">
                      Shipping to: {order.city}, {order.state}
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-slate-500">Total</div>
                      <div className="text-xl font-bold text-[#E07A5F]">
                        {formatPrice(order.total_amount)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Orders;
