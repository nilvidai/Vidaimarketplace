import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CurrencyContext = createContext(null);

export const CurrencyProvider = ({ children }) => {
  const [currency, setCurrency] = useState('INR');
  const [currencySymbol, setCurrencySymbol] = useState('₹');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurrencySettings();
  }, []);

  const fetchCurrencySettings = async () => {
    try {
      const response = await axios.get(`${API}/public/settings`);
      setCurrency(response.data.currency || 'INR');
      setCurrencySymbol(response.data.currency_symbol || '₹');
    } catch (error) {
      console.error('Failed to fetch currency settings:', error);
      // Keep defaults
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    if (price === null || price === undefined) return `${currencySymbol}0.00`;
    const numPrice = typeof price === 'number' ? price : parseFloat(price) || 0;
    return `${currencySymbol}${numPrice.toFixed(2)}`;
  };

  const refreshCurrency = () => {
    fetchCurrencySettings();
  };

  return (
    <CurrencyContext.Provider value={{ 
      currency, 
      currencySymbol, 
      formatPrice, 
      loading,
      refreshCurrency 
    }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    // Return defaults if not in provider
    return {
      currency: 'INR',
      currencySymbol: '₹',
      formatPrice: (price) => `₹${(price || 0).toFixed(2)}`,
      loading: false,
      refreshCurrency: () => {}
    };
  }
  return context;
};
