import { Button } from "@/components/ui/button";

interface ResetPasswordEmailProps {
  url: string;
}

export default function ResetPasswordEmail({ url }: ResetPasswordEmailProps) {
  return (
    <div className="max-w-2xl mx-auto bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-6 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <BeeLogo />
          <h1 className="text-3xl font-bold text-white">Golden Hive</h1>
        </div>
        <p className="text-amber-100 text-lg">Premium Honey Marketplace</p>
      </div>

      {/* Main Content */}
      <div className="px-8 py-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">
          Reset Your Password
        </h2>

        <p className="text-gray-700 mb-6 leading-relaxed">
          Hello from Golden Hive! We received a request to reset your password.
          If you didn&apos;t make this request, you can safely ignore this
          email.
        </p>

        <p className="text-gray-700 mb-8 leading-relaxed">
          To reset your password, click the button below. This link will expire
          in 24 hours for your security.
        </p>

        {/* CTA Button */}
        <div className="text-center mb-8">
          <Button
            asChild
            size="lg"
            className="bg-amber-600 hover:bg-amber-700 text-white px-8 py-3 text-lg font-semibold"
          >
            <a href={url} className="no-underline">
              Reset My Password
            </a>
          </Button>
        </div>

        {/* Alternative Link */}
        <div className="bg-gray-50 p-4 rounded-lg mb-8">
          <p className="text-sm text-gray-600 mb-2">
            If the button doesn&apos;t work, copy and paste this link into your
            browser:
          </p>
          <p className="text-sm text-amber-600 break-all font-mono bg-white p-2 rounded border">
            {url}
          </p>
        </div>

        {/* Security Notice */}
        <div className="border-l-4 border-amber-400 bg-amber-50 p-4 mb-8">
          <h3 className="font-semibold text-amber-800 mb-2">Security Notice</h3>
          <ul className="text-sm text-amber-700 space-y-1">
            <li>• This link expires in 24 hours</li>
            <li>• Never share this link with anyone</li>
            <li>• Golden Hive will never ask for your password via email</li>
          </ul>
        </div>

        {/* Footer */}
        <div className="border-t pt-6">
          <p className="text-gray-600 text-sm mb-2">
            Need help? Contact our support team at{" "}
            <a
              href="mailto:support@goldenhive.com"
              className="text-amber-600 hover:underline"
            >
              support@goldenhive.com
            </a>
          </p>
          <p className="text-gray-500 text-xs">
            This email was sent to you because you requested a password reset
            for your Golden Hive account.
          </p>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="bg-gray-900 px-8 py-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <BeeLogo />
          <span className="text-white font-semibold">Golden Hive</span>
        </div>
        <p className="text-gray-400 text-sm">
          Connecting honey lovers with premium producers worldwide
        </p>
      </div>
    </div>
  );
}

function BeeLogo() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      {/* Bee body stripes */}
      <ellipse cx="24" cy="26" rx="10" ry="14" fill="#F5A623" />
      <rect x="14" y="20" width="20" height="3" rx="1.5" fill="#2C2416" />
      <rect x="14" y="26" width="20" height="3" rx="1.5" fill="#2C2416" />
      <rect x="14" y="32" width="20" height="3" rx="1.5" fill="#2C2416" />

      {/* Wings */}
      <ellipse
        cx="16"
        cy="20"
        rx="8"
        ry="10"
        fill="#FFF9E6"
        opacity="0.8"
        transform="rotate(-25 16 20)"
      />
      <ellipse
        cx="32"
        cy="20"
        rx="8"
        ry="10"
        fill="#FFF9E6"
        opacity="0.8"
        transform="rotate(25 32 20)"
      />

      {/* Head */}
      <circle cx="24" cy="14" r="6" fill="#F5A623" />

      {/* Antennae */}
      <path
        d="M21 11 Q19 8 18 6"
        stroke="#2C2416"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M27 11 Q29 8 30 6"
        stroke="#2C2416"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="18" cy="6" r="1.5" fill="#2C2416" />
      <circle cx="30" cy="6" r="1.5" fill="#2C2416" />

      {/* Eyes */}
      <circle cx="21" cy="14" r="1.5" fill="#2C2416" />
      <circle cx="27" cy="14" r="1.5" fill="#2C2416" />

      {/* Stinger */}
      <path d="M24 40 L24 43 L22 45 L24 43 L26 45 L24 43 Z" fill="#2C2416" />
    </svg>
  );
}
