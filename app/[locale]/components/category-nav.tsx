"use client";
import { CategoryNavClient } from "./CategoryNavClient";

export function CategoryNav() {
  return (
    <nav className="border-b bg-muted/30">
      <div className="container mx-auto px-4">
        <CategoryNavClient />
      </div>
    </nav>
  );
}
