"use client";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { signOut } from "@/lib/auth-client";
import { User } from "better-auth";

export default function DashboardContent({ user }: { user: User }) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut({
        fetchOptions: {
          onSuccess: () => {
            toast.success("Logged out successfully!");
            router.push("/login");
          },
        },
      });
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to logout. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold text-center mb-8">Dashboard</h1>
      <div className="flex items-center gap-4">
        <span className="text-gray-600 dark:text-gray-300">
          Hello{" "}
          <span className="dark:text-gray-100 font-medium">{user.email}</span>
        </span>
        <button
          onClick={handleLogout}
          className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
