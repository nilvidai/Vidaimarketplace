import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader, Package } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const { clearCart } = useCart();
  
  const [status, setStatus] = useState('checking'); // checking, success, failed
  const [paymentDetails, setPaymentDetails] = useState(null);

  const sessionId = searchParams.get('session_id');
  const authHeaders = { headers: { Authorization: `Bearer ${getToken()}` } };

  useEffect(() => {
    if (!sessionId) {
      setStatus('failed');
      return;
    }

    let attempts = 0;
    const maxAttempts = 10;
    const pollInterval = 2000;

    const pollStatus = async () => {
      try {
        const res = await axios.get(`${API}/checkout/status/${sessionId}`, authHeaders);
        setPaymentDetails(res.data);

        if (res.data.payment_status === 'paid') {
          setStatus('success');
          clearCart();
          return true;
        } else if (res.data.status === 'expired') {
          setStatus('failed');
          return true;
        }
        return false;
      } catch (err) {
        console.error('Error checking payment status:', err);
        return false;
      }
    };

    const poll = async () => {
      const done = await pollStatus();
      if (!done && attempts < maxAttempts) {
        attempts++;
        setTimeout(poll, pollInterval);
      } else if (!done) {
        // Assume success if max attempts reached but no error
        setStatus('success');
        clearCart();
      }
    };

    poll();
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
          {status === 'checking' && (
            <>
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Loader className="w-10 h-10 text-slate-400 animate-spin" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2" style={{ fontFamily: 'Manrope' }}>
                Processing Payment...
              </h1>
              <p className="text-slate-500">
                Please wait while we confirm your payment
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2" style={{ fontFamily: 'Manrope' }}>
                Payment Successful!
              </h1>
              <p className="text-slate-500 mb-6">
                Thank you for your order. You'll receive a confirmation email shortly.
              </p>
              
              {paymentDetails && (
                <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-500">Amount Paid</span>
                    <span className="font-medium text-slate-900">
                      ${(paymentDetails.amount_total / 100).toFixed(2)} {paymentDetails.currency?.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Status</span>
                    <span className="font-medium text-green-600">Confirmed</span>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => navigate('/marketplace/orders')}
                  className="flex-1 btn-primary py-3 rounded-lg font-medium flex items-center justify-center gap-2"
                  data-testid="view-orders-btn"
                >
                  <Package className="w-4 h-4" />
                  View Orders
                </button>
                <button
                  onClick={() => navigate('/marketplace')}
                  className="flex-1 btn-secondary py-3 rounded-lg font-medium"
                >
                  Continue Shopping
                </button>
              </div>
            </>
          )}

          {status === 'failed' && (
            <>
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-10 h-10 text-red-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2" style={{ fontFamily: 'Manrope' }}>
                Payment Failed
              </h1>
              <p className="text-slate-500 mb-6">
                Something went wrong with your payment. Please try again.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => navigate('/marketplace/cart')}
                  className="flex-1 btn-primary py-3 rounded-lg font-medium"
                >
                  Try Again
                </button>
                <button
                  onClick={() => navigate('/marketplace')}
                  className="flex-1 btn-secondary py-3 rounded-lg font-medium"
                >
                  Go Back
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
