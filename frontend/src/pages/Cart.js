import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Plus, Minus, Trash2, ShoppingBag, 
  Image as ImageIcon, ArrowRight, Home
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

const Cart = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cart, selectedVendor, updateQuantity, removeFromCart, getCartTotal, clearCart } = useCart();

  if (!user || user.role !== 'clinic') {
    navigate('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="glass-header sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-4">
            <button
              onClick={() => navigate('/marketplace')}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              data-testid="back-to-marketplace"
            >
              <ArrowLeft className="w-5 h-5 text-slate-700" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
                Shopping Cart
              </h1>
              {selectedVendor && (
                <p className="text-sm text-slate-500">
                  Ordering from {selectedVendor.company_name}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {cart.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 p-16 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Your cart is empty</h3>
            <p className="text-slate-500 mb-6">Add some products from the marketplace</p>
            <button
              onClick={() => navigate('/marketplace')}
              className="btn-primary px-6 py-2 rounded-lg font-medium"
            >
              Browse Products
            </button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                  <h2 className="font-semibold text-slate-900">
                    Cart Items ({cart.length})
                  </h2>
                  <button
                    onClick={clearCart}
                    className="text-sm text-red-500 hover:text-red-600"
                    data-testid="clear-cart-btn"
                  >
                    Clear All
                  </button>
                </div>

                <div className="divide-y divide-slate-100">
                  {cart.map(item => (
                    <div key={item.product.id} className="cart-item">
                      <div className="w-20 h-20 bg-slate-100 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                        {item.product.image_url ? (
                          <img 
                            src={item.product.image_url} 
                            alt={item.product.name}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <ImageIcon className="w-8 h-8 text-slate-300" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-slate-900 truncate">{item.product.name}</h3>
                        <p className="text-sm text-slate-500">{item.product.category}</p>
                        <p className="price-tag mt-1">${item.product.price.toFixed(2)}</p>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="qty-selector">
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                            className="qty-btn"
                            data-testid={`decrease-qty-${item.product.id}`}
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                            className="qty-btn"
                            data-testid={`increase-qty-${item.product.id}`}
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="text-right">
                          <p className="font-semibold text-slate-900">
                            ${(item.product.price * item.quantity).toFixed(2)}
                          </p>
                        </div>

                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          data-testid={`remove-item-${item.product.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl border border-slate-100 p-6 sticky top-24">
                <h2 className="font-semibold text-slate-900 mb-4">Order Summary</h2>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Subtotal</span>
                    <span className="text-slate-900">${getCartTotal().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Shipping</span>
                    <span className="text-slate-900">Calculated at checkout</span>
                  </div>
                  <hr className="border-slate-200" />
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-900">Total</span>
                    <span className="font-bold text-xl text-[#E07A5F]">
                      ${getCartTotal().toFixed(2)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => navigate('/marketplace/checkout')}
                  className="w-full btn-primary py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
                  data-testid="proceed-checkout-btn"
                >
                  Proceed to Checkout
                  <ArrowRight className="w-5 h-5" />
                </button>

                <button
                  onClick={() => navigate('/marketplace')}
                  className="w-full btn-secondary py-3 rounded-lg font-medium mt-3"
                >
                  Continue Shopping
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Cart;
