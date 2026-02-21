import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";

// Pages
import LandingPage from "./pages/LandingPage";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminMarketplace from "./pages/AdminMarketplace";
import VendorDashboard from "./pages/VendorDashboard";
import ClinicDashboard from "./pages/ClinicDashboard";
import Marketplace from "./pages/Marketplace";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import PaymentSuccess from "./pages/PaymentSuccess";
import Orders from "./pages/Orders";

// Protected Route Components
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/" replace />;
  }
  
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/admin" element={<AdminLogin />} />

      {/* Admin Routes */}
      <Route 
        path="/admin/dashboard" 
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/admin/marketplace" 
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminMarketplace />
          </ProtectedRoute>
        } 
      />

      {/* Vendor Routes */}
      <Route 
        path="/vendor/dashboard" 
        element={
          <ProtectedRoute allowedRoles={['vendor']}>
            <VendorDashboard />
          </ProtectedRoute>
        } 
      />

      {/* Clinic/Marketplace Routes */}
      <Route 
        path="/clinic/dashboard" 
        element={
          <ProtectedRoute allowedRoles={['clinic']}>
            <ClinicDashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/marketplace" 
        element={
          <ProtectedRoute allowedRoles={['clinic']}>
            <Marketplace />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/marketplace/cart" 
        element={
          <ProtectedRoute allowedRoles={['clinic']}>
            <Cart />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/marketplace/checkout" 
        element={
          <ProtectedRoute allowedRoles={['clinic']}>
            <Checkout />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/marketplace/payment-success" 
        element={
          <ProtectedRoute allowedRoles={['clinic']}>
            <PaymentSuccess />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/marketplace/orders" 
        element={
          <ProtectedRoute allowedRoles={['clinic']}>
            <Orders />
          </ProtectedRoute>
        } 
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
