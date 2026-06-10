import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle, XCircle, ArrowLeft, Loader2 } from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setValidating(false);
        setError('No reset token provided');
        return;
      }

      try {
        const response = await axios.get(`${API}/vendor/reset-password/validate?token=${token}`);
        setTokenValid(true);
        setEmail(response.data.email);
      } catch (err) {
        setError(err.response?.data?.detail || 'Invalid or expired reset token');
      } finally {
        setValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      await axios.post(`${API}/vendor/reset-password`, {
        token,
        new_password: password
      });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (validating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#E07A5F] animate-spin mx-auto mb-4" />
          <p className="text-slate-300">Validating reset token...</p>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Password Reset Successful</h1>
          <p className="text-slate-400 mb-8">
            Your password has been updated successfully. You can now log in with your new password.
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full py-3 px-6 bg-[#E07A5F] hover:bg-[#c96a52] text-white font-semibold rounded-lg transition-colors"
            data-testid="back-to-login-btn"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  // Invalid token state
  if (!tokenValid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Invalid Reset Link</h1>
          <p className="text-slate-400 mb-4">
            {error || 'This password reset link is invalid or has expired.'}
          </p>
          <p className="text-slate-500 text-sm mb-8">
            Please request a new password reset link from the login page.
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full py-3 px-6 bg-[#E07A5F] hover:bg-[#c96a52] text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            data-testid="request-new-link-btn"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Reset password form
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-[#E07A5F] to-[#c96a52] rounded-xl flex items-center justify-center">
              <Lock className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">VIDAI</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Reset Your Password</h1>
          <p className="text-slate-400">
            Enter a new password for <span className="text-[#E07A5F]">{email}</span>
          </p>
        </div>

        {/* Form */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm" data-testid="reset-error">
                {error}
              </div>
            )}

            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#E07A5F] focus:border-transparent pr-12"
                  placeholder="Enter new password"
                  required
                  minLength={6}
                  data-testid="new-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500">Minimum 6 characters</p>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#E07A5F] focus:border-transparent pr-12"
                  placeholder="Confirm new password"
                  required
                  data-testid="confirm-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="mt-1 text-xs text-red-400">Passwords do not match</p>
              )}
              {confirmPassword && password === confirmPassword && password.length >= 6 && (
                <p className="mt-1 text-xs text-emerald-400">Passwords match</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || password.length < 6 || password !== confirmPassword}
              className="w-full py-3 px-6 bg-[#E07A5F] hover:bg-[#c96a52] disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              data-testid="reset-password-submit-btn"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Resetting...
                </>
              ) : (
                'Reset Password'
              )}
            </button>
          </form>

          {/* Back to login */}
          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/')}
              className="text-slate-400 hover:text-white transition-colors text-sm flex items-center justify-center gap-2 mx-auto"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
