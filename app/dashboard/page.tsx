"use client";

import { User } from "better-auth";
import DashboardContent from "../components/dashboardContent";
import { useSession } from "@/lib/auth-client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!session && !isPending) {
      router.push("/login");
    }
  }, [session, router, isPending]);

  if (isPending) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-2xl font-bold">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-2xl font-bold">redirecting to login...</div>
      </div>
    );
  }

  return <DashboardContent user={session?.user as User} />;
}
