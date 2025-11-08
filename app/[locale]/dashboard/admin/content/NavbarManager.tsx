"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import toast from "react-hot-toast";
import {
  getNavbarData,
  updateNavbar,
  createNavbarItem,
  updateNavbarItem,
  deleteNavbarItem,
  NavbarData,
} from "../../../actions/site-content";

export default function NavbarManager() {
  const [title, setTitle] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [items, setItems] = useState<NavbarData["items"]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Admin components use "en" as default locale for content management
      const data = await getNavbarData("en");
      if (data) {
        setTitle(data.title);
        setLogoUrl(data.logoUrl);
        setItems(data.items);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="p-4">Loading navbar...</p>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Navbar Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Site title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="grid md:grid-cols-2 gap-2 items-center">
            <Input
              placeholder="Logo URL"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <input type="file" accept="image/*" id="navbar-logo-file" />
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const input = document.getElementById(
                      "navbar-logo-file"
                    ) as HTMLInputElement;
                    const file = input.files?.[0];
                    if (!file) return;
                    const formData = new FormData();
                    formData.append("file", file);
                    const { updateNavbarLogo } = await import(
                      "../../../actions/site-content"
                    );
                    const res = await updateNavbarLogo(formData);
                    if (res.success) {
                      setLogoUrl(res.url);
                      toast.success("Logo updated");
                    } else {
                      toast.error(res.error || "Failed to upload logo");
                    }
                  } catch (e) {
                    toast.error(
                      "Failed to upload logo: " + (e as Error)?.message
                    );
                    console.error(
                      "Failed to upload logo: ",
                      (e as Error)?.message
                    );
                  }
                }}
              >
                Upload Logo
              </Button>
            </div>
          </div>
          <Button
            onClick={async () => {
              try {
                await updateNavbar({ title, logoUrl });
                await refresh();
                toast.success("Navbar saved");
              } catch (e) {
                toast.error("Failed to save navbar: " + (e as Error)?.message);
                console.error("Failed to save navbar: ", (e as Error)?.message);
                console.error("Failed to save navbar: ", e);
              }
            }}
          >
            Save Navbar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Navbar Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center"
            >
              <Input
                value={item.label}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((it) =>
                      it.id === item.id ? { ...it, label: e.target.value } : it
                    )
                  )
                }
                placeholder="Label"
              />
              <Input
                value={item.href}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((it) =>
                      it.id === item.id ? { ...it, href: e.target.value } : it
                    )
                  )
                }
                placeholder="Href"
              />
              <Input
                type="number"
                value={item.order ?? 0}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((it) =>
                      it.id === item.id
                        ? { ...it, order: Number(e.target.value) }
                        : it
                    )
                  )
                }
                placeholder="Order"
              />
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={!!item.requiresAuth}
                  onCheckedChange={(v) =>
                    setItems((prev) =>
                      prev.map((it) =>
                        it.id === item.id ? { ...it, requiresAuth: !!v } : it
                      )
                    )
                  }
                />
                Requires Auth
              </label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await updateNavbarItem(item.id, {
                        label: item.label,
                        href: item.href,
                        order: item.order,
                        requiresAuth: item.requiresAuth,
                        isVisible: item.isVisible ?? true,
                      });
                      toast.success("Item saved");
                    } catch (e) {
                      toast.error(
                        "Failed to save item: " + (e as Error)?.message
                      );
                      console.error(
                        "Failed to save item: ",
                        (e as Error)?.message
                      );
                    }
                  }}
                >
                  Save
                </Button>
                <Button
                  variant="destructive"
                  onClick={async () => {
                    try {
                      await deleteNavbarItem(item.id);
                      await refresh();
                      toast.success("Item deleted");
                    } catch (e) {
                      toast.error(
                        "Failed to delete item: " + (e as Error)?.message
                      );
                      console.error(
                        "Failed to delete item: ",
                        (e as Error)?.message
                      );
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}

          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center">
            <Input placeholder="New label" id="newLabel" />
            <Input placeholder="New href" id="newHref" />
            <Input
              placeholder="Order"
              id="newOrder"
              type="number"
              defaultValue={0}
            />
            <label className="flex items-center gap-2">
              <Checkbox id="newRequiresAuth" /> Requires Auth
            </label>
            <Button
              onClick={async () => {
                try {
                  const label = (
                    document.getElementById("newLabel") as HTMLInputElement
                  ).value;
                  const href = (
                    document.getElementById("newHref") as HTMLInputElement
                  ).value;
                  const order = Number(
                    (document.getElementById("newOrder") as HTMLInputElement)
                      .value || 0
                  );
                  const requiresAuth = (
                    document.getElementById(
                      "newRequiresAuth"
                    ) as HTMLInputElement
                  ).checked;
                  if (!label || !href) return;
                  await createNavbarItem({
                    label,
                    href,
                    order,
                    requiresAuth,
                    isVisible: true,
                  });
                  await refresh();
                  (
                    document.getElementById("newLabel") as HTMLInputElement
                  ).value = "";
                  (
                    document.getElementById("newHref") as HTMLInputElement
                  ).value = "";
                  toast.success("Item added");
                } catch (e) {
                  toast.error("Failed to add item: " + (e as Error)?.message);
                  console.error("Failed to add item: ", (e as Error)?.message);
                }
              }}
            >
              Add Item
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  async function refresh() {
    const data = await getNavbarData();
    if (data) setItems(data.items);
  }
}
