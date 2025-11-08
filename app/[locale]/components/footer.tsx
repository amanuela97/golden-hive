import { Link } from "@/i18n/navigation";
import { Mail, MapPin, Phone } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-neutral-900 text-neutral-300 mt-24">
      <div className="container mx-auto px-4 py-12 lg:py-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Office Section */}
          <div>
            <h3 className="mb-4 text-lg font-semibold text-white">Office</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p>Nandan, Kc, Finland</p>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-primary" />
                <a
                  href="tel:+9779845033773"
                  className="hover:text-white transition-colors"
                >
                  (+977) 9845033773
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-primary" />
                <a
                  href="tel:+9779841520033"
                  className="hover:text-white transition-colors"
                >
                  9841520033
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-primary" />
                <a
                  href="mailto:kcnandan090@gmail.com"
                  className="hover:text-white transition-colors"
                >
                  kcnandan090@gmail.com
                </a>
              </div>
            </div>
          </div>

          {/* Payment Section */}
          <div>
            <h3 className="mb-4 text-lg font-semibold text-white">Payment</h3>
            <p className="mb-4 text-sm">Payment options available</p>
            <div className="flex flex-wrap gap-2">
              <div className="rounded bg-white px-2 py-1 text-xs font-semibold text-neutral-900">
                VISA
              </div>
              <div className="rounded bg-white px-2 py-1 text-xs font-semibold text-neutral-900">
                Mastercard
              </div>
              <div className="rounded bg-white px-2 py-1 text-xs font-semibold text-neutral-900">
                PayPal
              </div>
              <div className="rounded bg-white px-2 py-1 text-xs font-semibold text-neutral-900">
                Stripe
              </div>
            </div>
          </div>

          {/* Support Section */}
          <div>
            <h3 className="mb-4 text-lg font-semibold text-white">Support</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/help"
                  className="hover:text-white transition-colors"
                >
                  Help Center
                </Link>
              </li>
              <li>
                <Link
                  href="/covid-response"
                  className="hover:text-white transition-colors"
                >
                  Our Covid 19 Response
                </Link>
              </li>
              <li>
                <Link
                  href="/cancellation"
                  className="hover:text-white transition-colors"
                >
                  Cancellation Options
                </Link>
              </li>
              <li>
                <Link
                  href="/safety"
                  className="hover:text-white transition-colors"
                >
                  Safety Information
                </Link>
              </li>
            </ul>
          </div>

          {/* Company Section */}
          <div>
            <h3 className="mb-4 text-lg font-semibold text-white">Company</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/about"
                  className="hover:text-white transition-colors"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="/faq"
                  className="hover:text-white transition-colors"
                >
                  Doses & FAQ
                </Link>
              </li>
              <li>
                <Link
                  href="/store"
                  className="hover:text-white transition-colors"
                >
                  About Mad Honey Store
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="hover:text-white transition-colors"
                >
                  Contact Us
                </Link>
              </li>
              <li>
                <Link
                  href="/expedition"
                  className="hover:text-white transition-colors"
                >
                  Mad Honey Expedition
                </Link>
              </li>
              <li>
                <Link
                  href="/b2b"
                  className="hover:text-white transition-colors"
                >
                  B2B
                </Link>
              </li>
              <li>
                <Link
                  href="/blogs"
                  className="hover:text-white transition-colors"
                >
                  Blogs
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-12 border-t border-neutral-800 pt-8 text-center text-sm">
          <p>© {new Date().getFullYear()} Golden Hive & Nandan</p>
        </div>
      </div>
    </footer>
  );
}
