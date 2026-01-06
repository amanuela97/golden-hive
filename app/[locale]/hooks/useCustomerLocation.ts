"use client";

import { useState, useEffect } from "react";

export function useCustomerLocation() {
  const [country, setCountry] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check localStorage first
    const savedCountry = localStorage.getItem("customerCountry");
    if (savedCountry) {
      setCountry(savedCountry);
      setLoading(false);
      return;
    }

    // Fetch geolocation
    fetch("/api/geolocation")
      .then((res) => {
        if (!res.ok) {
          // If response is not ok, still try to parse JSON for error details
          return res.json().then((data) => {
            throw new Error(data.error || `HTTP ${res.status}`);
          });
        }
        return res.json();
      })
      .then((data) => {
        if (data.country) {
          setCountry(data.country);
          localStorage.setItem("customerCountry", data.country);
          console.log("Customer country detected:", data.country);
        } else {
          console.log(
            "No country code in geolocation response (this is normal for localhost/private IPs)"
          );
          console.log(
            "💡 To test shipping availability locally, set your country manually:"
          );
          console.log(
            '   localStorage.setItem("customerCountry", "FI"); // or "DE", "US", etc.'
          );
          console.log("   Then refresh the page.");
        }
      })
      .catch((error) => {
        // Fallback: don't filter, show all products
        console.warn(
          "Could not determine customer location:",
          error.message || error
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const updateCountry = (newCountry: string | null) => {
    if (newCountry) {
      setCountry(newCountry);
      localStorage.setItem("customerCountry", newCountry);
    } else {
      setCountry(null);
      localStorage.removeItem("customerCountry");
    }
  };

  return { country, loading, setCountry: updateCountry };
}
