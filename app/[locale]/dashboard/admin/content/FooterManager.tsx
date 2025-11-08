"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getFooterData,
  upsertFooterSection,
  deleteFooterSection,
  upsertFooterItem,
  deleteFooterItem,
  FooterData,
} from "../../../actions/site-content";
import { ICON_MAP } from "@/lib/icons";
import toast from "react-hot-toast";

type FooterSection = FooterData[number];
type FooterItem = FooterSection["items"][number];

export default function FooterManager() {
  const [sections, setSections] = useState<FooterData>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Admin components use "en" as default locale for content management
      const data = await getFooterData("en");
      setSections(data ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="p-4">Loading footer...</p>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Footer Sections</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {sections.map((s: FooterSection) => (
            <div key={s.id} className="border rounded p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  value={s.title}
                  onChange={(e) =>
                    updateLocalSection(s.id, { title: e.target.value })
                  }
                  placeholder="Section title"
                />
                <Input
                  type="number"
                  value={s.order ?? 0}
                  onChange={(e) =>
                    updateLocalSection(s.id, { order: Number(e.target.value) })
                  }
                  placeholder="Order"
                  className="w-32"
                />
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await upsertFooterSection({
                        id: s.id,
                        title: s.title,
                        order: s.order,
                      });
                      toast.success("Section saved successfully");
                    } catch (e) {
                      toast.error(
                        "Failed to save section: " + (e as Error)?.message
                      );
                      console.error(
                        "Failed to save section: ",
                        (e as Error)?.message
                      );
                    }
                  }}
                >
                  Save Section
                </Button>
                <Button
                  variant="destructive"
                  onClick={async () => {
                    await deleteFooterSection(s.id);
                    await reload();
                  }}
                >
                  Delete Section
                </Button>
              </div>

              <div className="space-y-3">
                {s.items.map((it: FooterItem) => (
                  <div
                    key={it.id}
                    className="grid md:grid-cols-6 gap-2 items-center"
                  >
                    <Input
                      value={it.text ?? ""}
                      onChange={(e) =>
                        updateLocalItem(s.id, it.id, { text: e.target.value })
                      }
                      placeholder="Text"
                    />
                    <Input
                      value={it.href ?? ""}
                      onChange={(e) =>
                        updateLocalItem(s.id, it.id, { href: e.target.value })
                      }
                      placeholder="Href"
                    />
                    <div className="flex items-center gap-2">
                      <select
                        className="border rounded h-10 px-2"
                        value={(it.icon as string) ?? ""}
                        onChange={(e) =>
                          updateLocalItem(s.id, it.id, { icon: e.target.value })
                        }
                      >
                        <option value="">No icon</option>
                        {Object.keys(ICON_MAP).map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                      <div className="w-6 h-6">
                        {(() => {
                          const PreviewIcon = it.icon
                            ? ICON_MAP[it.icon as keyof typeof ICON_MAP]
                            : undefined;
                          return PreviewIcon ? (
                            <span className="inline-flex items-center">
                              <PreviewIcon className="w-5 h-5" />
                            </span>
                          ) : null;
                        })()}
                      </div>
                    </div>
                    <Textarea
                      value={(it.listItems ?? []).join(", ")}
                      onChange={(e) =>
                        updateLocalItem(s.id, it.id, {
                          listItems: e.target.value
                            .split(",")
                            .map((v) => v.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="List items (comma-separated)"
                    />
                    <Input
                      type="number"
                      value={it.order ?? 0}
                      onChange={(e) =>
                        updateLocalItem(s.id, it.id, {
                          order: Number(e.target.value),
                        })
                      }
                      placeholder="Order"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={async () => {
                          try {
                            await upsertFooterItem({
                              id: it.id,
                              sectionId: s.id,
                              text: it.text,
                              href: it.href,
                              icon: it.icon,
                              listItems: it.listItems,
                              order: it.order,
                            });
                            toast.success("Item saved successfully");
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
                            await deleteFooterItem(it.id);
                            await reload();
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

                <div className="grid md:grid-cols-6 gap-2 items-center">
                  <Input placeholder="Text" id={`new-text-${s.id}`} />
                  <Input placeholder="Href" id={`new-href-${s.id}`} />
                  <select
                    className="border rounded h-10 px-2"
                    id={`new-icon-${s.id}`}
                  >
                    <option value="">No icon</option>
                    {Object.keys(ICON_MAP).map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <Textarea
                    placeholder="List items (comma-separated)"
                    id={`new-list-${s.id}`}
                  />
                  <Input
                    type="number"
                    placeholder="Order"
                    defaultValue={0}
                    id={`new-order-${s.id}`}
                  />
                  <Button
                    onClick={async () => {
                      try {
                        const text = (
                          document.getElementById(
                            `new-text-${s.id}`
                          ) as HTMLInputElement
                        ).value;
                        const href = (
                          document.getElementById(
                            `new-href-${s.id}`
                          ) as HTMLInputElement
                        ).value;
                        const icon = (
                          document.getElementById(
                            `new-icon-${s.id}`
                          ) as HTMLInputElement
                        ).value;
                        const listRaw = (
                          document.getElementById(
                            `new-list-${s.id}`
                          ) as HTMLTextAreaElement
                        ).value;
                        const order = Number(
                          (
                            document.getElementById(
                              `new-order-${s.id}`
                            ) as HTMLInputElement
                          ).value || 0
                        );
                        await upsertFooterItem({
                          sectionId: s.id,
                          text,
                          href,
                          icon,
                          listItems: listRaw
                            ? listRaw.split(",").map((v) => v.trim())
                            : [],
                          order,
                        });
                        await reload();
                        toast.success("Item added successfully");
                      } catch (e) {
                        toast.error(
                          "Failed to add item: " + (e as Error)?.message
                        );
                      }
                    }}
                  >
                    Add Item
                  </Button>
                </div>
              </div>
            </div>
          ))}

          <div className="flex items-center gap-2">
            <Input placeholder="New section title" id="new-section-title" />
            <Input
              placeholder="Order"
              id="new-section-order"
              type="number"
              defaultValue={0}
              className="w-32"
            />
            <Button
              onClick={async () => {
                try {
                  const title = (
                    document.getElementById(
                      "new-section-title"
                    ) as HTMLInputElement
                  ).value;
                  const order = Number(
                    (
                      document.getElementById(
                        "new-section-order"
                      ) as HTMLInputElement
                    ).value || 0
                  );
                  if (!title) return;
                  await upsertFooterSection({ title, order });
                  await reload();
                  (
                    document.getElementById(
                      "new-section-title"
                    ) as HTMLInputElement
                  ).value = "";
                  toast.success("Section added successfully");
                } catch (e) {
                  toast.error(
                    "Failed to add section: " + (e as Error)?.message
                  );
                  console.error(
                    "Failed to add section: ",
                    (e as Error)?.message
                  );
                }
              }}
            >
              Add Section
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  function updateLocalSection(id: number, patch: Partial<FooterSection>) {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  }
  function updateLocalItem(
    sectionId: number,
    itemId: number,
    patch: Partial<FooterItem>
  ) {
    setSections((prev) =>
      prev.map((s) =>
        s.id !== sectionId
          ? s
          : {
              ...s,
              items: s.items.map((it: FooterItem) =>
                it.id === itemId ? { ...it, ...patch } : it
              ),
            }
      )
    );
  }
  async function reload() {
    const data = await getFooterData();
    setSections(data);
  }
}
