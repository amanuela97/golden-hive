import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Get IP from request
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded
      ? forwarded.split(",")[0].trim()
      : (request as unknown as { ip: string })?.ip || "";

    // Handle localhost/development - return null gracefully
    if (!ip || ip === "::1" || ip === "127.0.0.1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
      console.log("Local/private IP detected, skipping geolocation:", ip);
      return NextResponse.json({
        country: null,
        countryName: null,
        city: null,
      });
    }

    // Use a free IP geolocation service (you can replace with a paid service for better accuracy)
    // Option 1: ipapi.co (free tier: 1000 requests/day)
    const response = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: {
        "User-Agent": "GoldenHive/1.0",
      },
    });

    if (!response.ok) {
      console.warn(`Geolocation service returned ${response.status} for IP: ${ip}`);
      // Return null instead of error to allow fallback
      return NextResponse.json({
        country: null,
        countryName: null,
        city: null,
      });
    }

    const data = await response.json();

    // Check for API errors
    if (data.error) {
      console.warn("Geolocation API error:", data.error, "for IP:", ip);
      // Return null instead of error to allow fallback
      return NextResponse.json({
        country: null,
        countryName: null,
        city: null,
      });
    }

    // Return successful response
    return NextResponse.json({
      country: data.country_code || null,
      countryName: data.country_name || null,
      city: data.city || null,
    });
  } catch (error) {
    console.error("Geolocation error:", error);
    // Return null instead of error to allow fallback
    return NextResponse.json({
      country: null,
      countryName: null,
      city: null,
    });
  }
}
