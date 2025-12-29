import { Link } from "@/i18n/navigation";
import { Mail, MapPin, Phone } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-neutral-900 text-neutral-300 mt-24">
      <div className="container mx-auto px-4 py-12 lg:py-16">
        <div className="flex  flex-col justify-around items-start gap-8 md:flex-row md:gap-0">
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

          {/* Company Section */}
          <div>
            <h3 className="mb-4 text-lg font-semibold text-white">Company</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  target="_blank"
                  rel="noopener noreferrer"
                  href="/about"
                  className="hover:text-white transition-colors"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  target="_blank"
                  rel="noopener noreferrer"
                  href="/faq"
                  className="hover:text-white transition-colors"
                >
                  FAQ
                </Link>
              </li>
              <li>
                <Link
                  href="/store"
                  className="hover:text-white transition-colors"
                >
                  Store
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-12 border-t border-neutral-800 pt-8 text-center text-sm">
          <p>© {new Date().getFullYear()} Golden Market</p>
        </div>
      </div>
    </footer>
  );
}
