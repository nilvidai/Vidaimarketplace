import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Thermometer, Brain, Truck, Star, Layers, ArrowRight, X, Send, User, Mail, Building2, Phone, MessageSquare, Search, ShoppingCart } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const LoginModal = ({ isOpen, onClose, type, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = type === 'vendor' ? '/vendor/login' : '/clinic/login';
      const response = await axios.post(`${API}${endpoint}`, { email, password });
      
      login(response.data, response.data.token);
      onSuccess(response.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop modal-overlay" onClick={onClose}>
      <div className="modal-box modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              {type === 'vendor' ? 'Vendor Login' : 'Clinic Login'}
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              Enter your credentials to continue
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            data-testid="login-modal-close"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="modal-body">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}
          
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
              placeholder="Enter your email"
              required
              data-testid="login-email-input"
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              placeholder="Enter your password"
              required
              data-testid="login-password-input"
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
            data-testid="login-submit-btn"
          >
            {loading ? (
              <div className="spinner"></div>
            ) : (
              <>
                Sign In
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
          
          <p className="text-center text-sm text-slate-500 mt-4">
            Contact your administrator if you don't have login credentials
          </p>
        </form>
      </div>
    </div>
  );
};

const ContactSalesModal = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    message: '',
    enquiry_type: 'general'
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await axios.post(`${API}/contact`, formData);
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setFormData({
          name: '',
          email: '',
          company: '',
          phone: '',
          message: '',
          enquiry_type: 'general'
        });
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const enquiryTypes = [
    { value: 'general', label: 'General Inquiry' },
    { value: 'demo', label: 'Request a Demo' },
    { value: 'pricing', label: 'Pricing Information' },
    { value: 'partnership', label: 'Partnership Opportunity' }
  ];

  return (
    <div className="modal-backdrop modal-overlay" onClick={onClose}>
      <div className="modal-box modal-content max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Contact Sales</h2>
            <p className="text-slate-500 text-sm mt-1">
              Get in touch with our team
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            data-testid="contact-modal-close"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        
        {success ? (
          <div className="modal-body text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Send className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Thank You!</h3>
            <p className="text-slate-500">We've received your enquiry and will get back to you soon.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="modal-body">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}
            
            <div className="form-group">
              <label className="form-label">Enquiry Type</label>
              <select
                value={formData.enquiry_type}
                onChange={(e) => setFormData({...formData, enquiry_type: e.target.value})}
                className="form-input"
                data-testid="contact-type-select"
              >
                {enquiryTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="form-input pl-10"
                    placeholder="John Doe"
                    required
                    data-testid="contact-name-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Email *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="form-input pl-10"
                    placeholder="john@company.com"
                    required
                    data-testid="contact-email-input"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Company</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({...formData, company: e.target.value})}
                    className="form-input pl-10"
                    placeholder="Acme Inc."
                    data-testid="contact-company-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Phone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="form-input pl-10"
                    placeholder="+1 (555) 123-4567"
                    data-testid="contact-phone-input"
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Message *</label>
              <div className="relative">
                <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                  className="form-input pl-10 min-h-[100px]"
                  placeholder="Tell us about your needs..."
                  required
                  data-testid="contact-message-input"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
              data-testid="contact-submit-btn"
            >
              {loading ? (
                <>
                  <div className="spinner"></div>
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Message
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

const LandingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showVendorLogin, setShowVendorLogin] = useState(false);
  const [showClinicLogin, setShowClinicLogin] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);

  const features = [
    {
      icon: Shield,
      title: 'Complete Compliance',
      description: 'ISO 13485, CE, FDA certified products with full regulatory documentation and traceability'
    },
    {
      icon: Thermometer,
      title: 'Cold Chain Tracking',
      description: 'Temperature-monitored shipping with automatic alerts and compliance documentation'
    },
    {
      icon: Brain,
      title: 'AI-Powered Analytics',
      description: 'Smart demand forecasting and inventory optimization based on cycle schedules'
    },
    {
      icon: Truck,
      title: 'Fast Fulfillment',
      description: 'Average 3-5 day delivery with real-time tracking and guaranteed SLAs'
    },
    {
      icon: Star,
      title: 'Trusted Vendors',
      description: 'Pre-verified suppliers with rating system and quality assurance protocols'
    },
    {
      icon: Layers,
      title: 'Batch Traceability',
      description: 'Complete lot tracking from vendor to patient cycle for full accountability'
    }
  ];

  const handleVendorPortalClick = () => {
    // If already logged in as vendor, go directly to dashboard
    if (user && user.role === 'vendor') {
      navigate('/vendor/dashboard');
    } else {
      setShowVendorLogin(true);
    }
  };

  const handleMarketplaceClick = () => {
    // If already logged in as clinic, go directly to marketplace
    if (user && user.role === 'clinic') {
      navigate('/marketplace');
    } else {
      setShowClinicLogin(true);
    }
  };

  const handleVendorLoginSuccess = (data) => {
    navigate('/vendor/dashboard');
  };

  const handleClinicLoginSuccess = (data) => {
    navigate('/marketplace');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation */}
      <nav className="glass-header sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
                VIDAI
              </span>
              <span className="text-xs bg-[#E07A5F] text-white px-2 py-0.5 rounded-full font-medium">
                Marketplace
              </span>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/admin')}
                className="text-slate-600 hover:text-slate-900 font-medium text-sm"
                data-testid="admin-link"
              >
                Admin
              </button>
              <button
                onClick={handleVendorPortalClick}
                className="btn-secondary px-4 py-2 rounded-lg font-medium text-sm"
                data-testid="vendor-portal-btn"
              >
                Vendor Portal
              </button>
              <button
                onClick={handleMarketplaceClick}
                className="btn-primary px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2"
                data-testid="explore-marketplace-btn"
              >
                Explore Marketplace
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-white min-h-[650px]">
        <div className="absolute inset-0">
          {/* Lab Background Image */}
          <img
            src="https://static.prod-images.emergentagent.com/jobs/b4a2e689-9262-48fb-b101-873481ad5300/images/8734ad7b224dc0998be509306ab783945834b83b4514973881df4d79aad27bca.png"
            alt="Modern IVF Laboratory"
            className="w-full h-full object-cover"
          />
          {/* Gradient Overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/90 to-transparent"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="max-w-xl">
            <span className="text-[#E07A5F] font-semibold text-sm tracking-wide uppercase">
              EMR Integrated Marketplace
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mt-4 leading-tight" style={{ fontFamily: 'Manrope' }}>
              VIDAI Revolutionizing Healthcare with{' '}
              <span className="text-[#E07A5F]">AI-Powered</span> IVF Marketplace
            </h1>
            <p className="text-lg text-slate-600 mt-6 leading-relaxed">
              Seamlessly connect IVF clinics with trusted vendors. Purchase consumables, 
              equipment, and genetic testing kits with complete traceability and compliance.
            </p>

            {/* CTA Buttons */}
            <div className="flex gap-4 mt-8">
              <button
                onClick={handleMarketplaceClick}
                className="btn-primary px-6 py-3 rounded-lg font-semibold flex items-center gap-2"
                data-testid="hero-explore-btn"
              >
                Explore Marketplace
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={handleVendorPortalClick}
                className="btn-secondary px-6 py-3 rounded-lg font-semibold"
                data-testid="hero-vendor-btn"
              >
                Vendor Portal
              </button>
            </div>
          </div>
        </div>

        {/* Device Mockups - Positioned at bottom right */}
        <div className="absolute bottom-0 right-0 lg:right-20 flex items-end z-20">
          {/* Phone Mockup */}
          <div className="relative z-30 -mr-8 mb-4">
            <div className="bg-gray-900 rounded-[28px] p-2 w-[140px] shadow-2xl border-4 border-gray-800">
              <div className="bg-white rounded-[20px] overflow-hidden">
                <div className="bg-gradient-to-r from-teal-500 to-teal-600 p-2 flex items-center gap-1">
                  <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center">
                    <span className="text-teal-600 text-[8px] font-bold">V</span>
                  </div>
                  <span className="text-[8px] font-semibold text-white">Marketplace</span>
                </div>
                <div className="p-2 h-[220px] bg-gray-50">
                  <div className="bg-white rounded p-1.5 mb-1 flex items-center gap-1">
                    <div className="w-6 h-6 bg-gradient-to-br from-blue-400 to-purple-400 rounded"></div>
                    <div>
                      <div className="text-[6px] font-semibold">IVF Equipment</div>
                      <div className="text-[5px] text-gray-500">Premium Quality</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <div className="bg-white rounded p-1">
                      <div className="w-full aspect-square bg-gradient-to-br from-blue-100 to-cyan-100 rounded mb-0.5"></div>
                      <div className="text-[5px] font-medium">Incubator</div>
                      <div className="text-[5px] text-teal-600">$12,500</div>
                    </div>
                    <div className="bg-white rounded p-1">
                      <div className="w-full aspect-square bg-gradient-to-br from-purple-100 to-pink-100 rounded mb-0.5"></div>
                      <div className="text-[5px] font-medium">Microscope</div>
                      <div className="text-[5px] text-teal-600">$8,900</div>
                    </div>
                    <div className="bg-white rounded p-1">
                      <div className="w-full aspect-square bg-gradient-to-br from-orange-100 to-yellow-100 rounded mb-0.5"></div>
                      <div className="text-[5px] font-medium">Centrifuge</div>
                      <div className="text-[5px] text-teal-600">$3,200</div>
                    </div>
                    <div className="bg-white rounded p-1">
                      <div className="w-full aspect-square bg-gradient-to-br from-green-100 to-teal-100 rounded mb-0.5"></div>
                      <div className="text-[5px] font-medium">Test Kits</div>
                      <div className="text-[5px] text-teal-600">$450</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Laptop Mockup */}
          <div className="relative">
            <div className="bg-gray-800 rounded-t-xl p-2 w-[480px] shadow-2xl">
              <div className="flex gap-1.5 mb-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
              <div className="bg-white rounded-lg overflow-hidden">
                {/* Browser Header */}
                <div className="bg-gray-100 p-2 flex items-center gap-2 border-b">
                  <div className="w-6 h-6 bg-gradient-to-r from-teal-500 to-teal-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-[10px] font-bold">V</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-700">Marketplace</span>
                  <div className="flex-1 mx-4">
                    <div className="bg-white border rounded-full px-3 py-1 flex items-center gap-2">
                      <Search className="w-3 h-3 text-gray-400" />
                      <span className="text-[10px] text-gray-400">Search products...</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-5 h-5 bg-gray-200 rounded flex items-center justify-center">
                      <ShoppingCart className="w-3 h-3 text-gray-500" />
                    </div>
                  </div>
                </div>
                
                {/* Marketplace Content */}
                <div className="p-3 h-[260px] bg-gray-50">
                  {/* Category Headers */}
                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div className="text-center">
                      <div className="text-[10px] font-bold text-gray-800">Equipment</div>
                      <div className="text-[8px] text-gray-500">For IVF Clinics</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] font-bold text-gray-800">IVF Consumables</div>
                      <div className="text-[8px] text-gray-500">Embryology Tools</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] font-bold text-gray-800">Genetic Testing</div>
                      <div className="text-[8px] text-gray-500">Diagnostic Kits</div>
                    </div>
                  </div>
                  
                  {/* Product Grid */}
                  <div className="grid grid-cols-3 gap-3">
                    {/* Equipment Column */}
                    <div className="space-y-2">
                      <div className="bg-white rounded-lg p-2 shadow-sm">
                        <div className="w-full aspect-square bg-gradient-to-br from-blue-100 to-cyan-100 rounded mb-1 flex items-center justify-center">
                          <span className="text-2xl">🔬</span>
                        </div>
                        <div className="text-[8px] font-semibold text-gray-800">IVF Incubator</div>
                        <div className="text-[8px] text-teal-600 font-bold">$12,500</div>
                        <button className="w-full bg-teal-500 text-white text-[6px] py-0.5 rounded mt-1">Order Now</button>
                      </div>
                      <div className="bg-white rounded-lg p-2 shadow-sm">
                        <div className="w-full aspect-square bg-gradient-to-br from-orange-100 to-yellow-100 rounded mb-1 flex items-center justify-center">
                          <span className="text-2xl">⚙️</span>
                        </div>
                        <div className="text-[8px] font-semibold text-gray-800">Centrifuge</div>
                        <div className="text-[8px] text-teal-600 font-bold">$3,200</div>
                        <button className="w-full bg-teal-500 text-white text-[6px] py-0.5 rounded mt-1">Order Now</button>
                      </div>
                    </div>
                    
                    {/* Consumables Column */}
                    <div className="space-y-2">
                      <div className="bg-white rounded-lg p-2 shadow-sm">
                        <div className="w-full aspect-square bg-gradient-to-br from-purple-100 to-pink-100 rounded mb-1 flex items-center justify-center">
                          <span className="text-2xl">🧪</span>
                        </div>
                        <div className="text-[8px] font-semibold text-gray-800">Culture Media</div>
                        <div className="text-[8px] text-teal-600 font-bold">$299</div>
                        <button className="w-full bg-teal-500 text-white text-[6px] py-0.5 rounded mt-1">Order Now</button>
                      </div>
                      <div className="bg-white rounded-lg p-2 shadow-sm">
                        <div className="w-full aspect-square bg-gradient-to-br from-pink-100 to-rose-100 rounded mb-1 flex items-center justify-center">
                          <span className="text-2xl">💉</span>
                        </div>
                        <div className="text-[8px] font-semibold text-gray-800">Pipettes</div>
                        <div className="text-[8px] text-teal-600 font-bold">$149</div>
                        <button className="w-full bg-teal-500 text-white text-[6px] py-0.5 rounded mt-1">Order Now</button>
                      </div>
                    </div>
                    
                    {/* Genetic Testing Column */}
                    <div className="space-y-2">
                      <div className="bg-white rounded-lg p-2 shadow-sm">
                        <div className="w-full aspect-square bg-gradient-to-br from-teal-100 to-green-100 rounded mb-1 flex items-center justify-center">
                          <span className="text-2xl">🧬</span>
                        </div>
                        <div className="text-[8px] font-semibold text-gray-800">PGT-A Kit</div>
                        <div className="text-[8px] text-teal-600 font-bold">$850</div>
                        <button className="w-full bg-teal-500 text-white text-[6px] py-0.5 rounded mt-1">Order Now</button>
                      </div>
                      <div className="bg-white rounded-lg p-2 shadow-sm">
                        <div className="w-full aspect-square bg-gradient-to-br from-indigo-100 to-blue-100 rounded mb-1 flex items-center justify-center">
                          <span className="text-2xl">🧫</span>
                        </div>
                        <div className="text-[8px] font-semibold text-gray-800">Genetic Panel</div>
                        <div className="text-[8px] text-teal-600 font-bold">$1,200</div>
                        <button className="w-full bg-teal-500 text-white text-[6px] py-0.5 rounded mt-1">Order Now</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gray-700 h-4 rounded-b-xl"></div>
            <div className="bg-gray-600 h-2 mx-20 rounded-b-xl"></div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
              Why Choose VIDAI Marketplace?
            </h2>
            <p className="text-slate-600 mt-4 text-lg">
              AI-driven marketplace solutions for smarter, faster, and better healthcare procurement
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="feature-card p-8 rounded-2xl border border-transparent hover:border-slate-200 card-hover stagger-item"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="w-14 h-14 bg-[#E07A5F]/10 rounded-xl flex items-center justify-center mb-6">
                  <feature.icon className="w-7 h-7 text-[#E07A5F]" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-3" style={{ fontFamily: 'Manrope' }}>
                  {feature.title}
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white" style={{ fontFamily: 'Manrope' }}>
            Ready to Transform Your IVF Procurement?
          </h2>
          <p className="text-slate-300 mt-4 text-lg">
            Join hundreds of clinics and vendors already using VIDAI Marketplace
          </p>
          <div className="flex justify-center gap-4 mt-10">
            <button
              onClick={handleMarketplaceClick}
              className="btn-primary px-8 py-4 rounded-lg font-semibold text-lg"
              data-testid="cta-start-btn"
            >
              Start Shopping
            </button>
            <button 
              onClick={() => setShowContactModal(true)}
              className="bg-white/10 hover:bg-white/20 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-colors"
              data-testid="contact-sales-btn"
            >
              Contact Sales
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-sm">
              © 2024 VIDAI Marketplace. All rights reserved.
            </span>
            <a
              href="https://app.emergent.sh"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-white text-sm flex items-center gap-2 transition-colors"
            >
              Made with Emergent
            </a>
          </div>
        </div>
      </footer>

      {/* Login Modals */}
      <LoginModal
        isOpen={showVendorLogin}
        onClose={() => setShowVendorLogin(false)}
        type="vendor"
        onSuccess={handleVendorLoginSuccess}
      />
      <LoginModal
        isOpen={showClinicLogin}
        onClose={() => setShowClinicLogin(false)}
        type="clinic"
        onSuccess={handleClinicLoginSuccess}
      />
      <ContactSalesModal
        isOpen={showContactModal}
        onClose={() => setShowContactModal(false)}
      />
    </div>
  );
};

export default LandingPage;
