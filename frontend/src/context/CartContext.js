import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);

  useEffect(() => {
    const storedCart = localStorage.getItem('vidai_cart');
    const storedVendor = localStorage.getItem('vidai_selected_vendor');
    if (storedCart) {
      try {
        setCart(JSON.parse(storedCart));
      } catch (e) {
        localStorage.removeItem('vidai_cart');
      }
    }
    if (storedVendor) {
      try {
        setSelectedVendor(JSON.parse(storedVendor));
      } catch (e) {
        localStorage.removeItem('vidai_selected_vendor');
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('vidai_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (selectedVendor) {
      localStorage.setItem('vidai_selected_vendor', JSON.stringify(selectedVendor));
    }
  }, [selectedVendor]);

  const addToCart = (product, vendor = null, quantity = 1) => {
    // Set selected vendor from the product or passed vendor
    if (vendor) {
      setSelectedVendor(vendor);
    } else if (product.vendor_id && product.vendor_name) {
      setSelectedVendor({ id: product.vendor_id, company_name: product.vendor_name });
    }
    
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.product.id === product.id);
      if (existingItem) {
        return prevCart.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prevCart, { product, quantity }];
    });
  };

  const removeFromCart = (productId) => {
    setCart(prevCart => prevCart.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prevCart =>
      prevCart.map(item =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    setCart([]);
    setSelectedVendor(null);
    localStorage.removeItem('vidai_cart');
    localStorage.removeItem('vidai_selected_vendor');
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => {
      const price = item.product?.price || 0;
      const qty = typeof item.quantity === 'number' ? item.quantity : 1;
      return total + (price * qty);
    }, 0);
  };

  const getCartCount = () => {
    return cart.reduce((count, item) => count + item.quantity, 0);
  };

  return (
    <CartContext.Provider value={{
      cart,
      selectedVendor,
      setSelectedVendor,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      getCartTotal,
      getCartCount
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
