"use client";

import { useState, useEffect } from "react";

// Fallback rates (USD as base) - updated approximate rates
// These will be used if API fetch fails
const fallbackRates: Record<string, number> = {
  USD: 1,
  EUR: 0.92, // 1 USD = 0.92 EUR
  GBP: 0.79, // 1 USD = 0.79 GBP
  NPR: 133.0, // 1 USD = 133 NPR
  INR: 83.0, // 1 USD = 83 INR
  CNY: 7.2, // 1 USD = 7.2 CNY
};

export function useCurrencyConversion() {
  const [rates, setRates] = useState<Record<string, number>>(fallbackRates);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch current exchange rates from a free API
    const fetchRates = async () => {
      try {
        // Using exchangerate-api.com (free, no API key needed for basic usage)
        const response = await fetch(
          "https://api.exchangerate-api.com/v4/latest/USD"
        );
        
        if (response.ok) {
          const data = await response.json();
          // Convert the API response to our format
          const convertedRates: Record<string, number> = {
            USD: 1,
          };
          
          // Map common currencies
          const currencyMap: Record<string, string> = {
            EUR: "EUR",
            GBP: "GBP",
            NPR: "NPR",
            INR: "INR",
            CNY: "CNY",
            USD: "USD",
          };
          
          for (const [key, apiKey] of Object.entries(currencyMap)) {
            if (data.rates[apiKey]) {
              convertedRates[key] = data.rates[apiKey];
            } else {
              // Fallback to hardcoded rate if not available
              convertedRates[key] = fallbackRates[key] || 1;
            }
          }
          
          setRates(convertedRates);
        } else {
          // Use fallback rates if API fails
          setRates(fallbackRates);
        }
      } catch (error) {
        console.error("Failed to fetch exchange rates, using fallback:", error);
        // Use fallback rates on error
        setRates(fallbackRates);
      } finally {
        setLoading(false);
      }
    };

    fetchRates();
    
    // Refresh rates every hour
    const interval = setInterval(fetchRates, 60 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const convertCurrency = (
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): number => {
    if (fromCurrency === toCurrency) {
      return amount;
    }

    // Convert to USD first (base currency)
    const fromRate = rates[fromCurrency] || 1;
    const toRate = rates[toCurrency] || 1;

    // If fromCurrency is USD, just multiply by toRate
    if (fromCurrency === "USD") {
      return amount * toRate;
    }

    // If toCurrency is USD, divide by fromRate
    if (toCurrency === "USD") {
      return amount / fromRate;
    }

    // Convert fromCurrency -> USD -> toCurrency
    const amountInUSD = amount / fromRate;
    return amountInUSD * toRate;
  };

  return { rates, convertCurrency, loading };
}

