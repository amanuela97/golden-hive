import { Card } from "@/components/ui/card";
import { CheckCircle, Home } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function GoodbyePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <Card className="p-8 text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="w-16 h-16 text-green-500" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Account Deleted Successfully
          </h1>

          <p className="text-gray-600 mb-6">
            Your account has been permanently deleted. We&apos;re sorry to see
            you go, but we respect your decision. If you ever want to return,
            you&apos;re always welcome.
          </p>

          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Thank you for being part of our community.
            </p>

            <Link href="/">
              <Button className="w-full">
                <Home className="w-4 h-4 mr-2" />
                Return to Home
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
