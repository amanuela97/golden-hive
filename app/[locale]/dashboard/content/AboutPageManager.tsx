"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getAboutData,
  updateAboutPageContent,
  upsertAboutSectionContent,
  deleteAboutSectionContent,
  AboutData,
} from "../../actions/site-content";
import toast from "react-hot-toast";
import { ICON_MAP } from "@/lib/icons";

type AboutSection = NonNullable<AboutData>["sections"][number];

export default function AboutPageManager() {
  const [page, setPage] = useState<AboutData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Admin components use "en" as default locale for content management
      const data = await getAboutData("en");
      if (data) {
        setPage(data);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="p-4">Loading about...</p>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>About Page</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={page?.title ?? ""}
            onChange={(e) =>
              setPage({
                title: e.target.value ?? "",
                description: page?.description ?? null,
                metadata: page?.metadata ?? null,
                sections: page?.sections ?? [],
              })
            }
            placeholder="Title"
          />
          <Textarea
            value={page?.description ?? ""}
            onChange={(e) =>
              setPage({
                title: page?.title ?? "",
                description: e.target.value ?? "",
                metadata: page?.metadata ?? null,
                sections: page?.sections ?? [],
              })
            }
            placeholder="Description"
          />
          <Button
            onClick={async () => {
              try {
                await updateAboutPageContent({
                  title: page?.title ?? "",
                  description: page?.description ?? "",
                });
                toast.success("About page saved");
              } catch (e) {
                toast.error(
                  "Failed to save about page: " + (e as Error)?.message
                );
                console.error(
                  "Failed to save about page: ",
                  (e as Error)?.message
                );
              }
            }}
          >
            Save Page
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sections</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(page?.sections ?? []).map((s: AboutSection) => (
            <div key={s.id} className="border rounded p-4 space-y-3">
              <div className="grid md:grid-cols-4 gap-2">
                <Input
                  value={s.type}
                  onChange={(e) => patchSec(s.id, { type: e.target.value })}
                  placeholder="Type (hero/mission/values/etc)"
                />
                <Input
                  value={s.title ?? ""}
                  onChange={(e) => patchSec(s.id, { title: e.target.value })}
                  placeholder="Title"
                />
                <Input
                  value={s.subtitle ?? ""}
                  onChange={(e) => patchSec(s.id, { subtitle: e.target.value })}
                  placeholder="Subtitle"
                />
              </div>
              <Textarea
                value={s.content ?? ""}
                onChange={(e) => patchSec(s.id, { content: e.target.value })}
                placeholder="Content"
              />
              <div className="grid md:grid-cols-3 gap-2">
                <div className="flex flex-col gap-2">
                  <Input
                    value={s.imageUrl ?? ""}
                    readOnly
                    placeholder="Image URL (set by upload)"
                  />
                  <p className="text-xs text-muted-foreground">
                    Upload an image to replace the current one.
                  </p>
                </div>
                <div className="flex items-center gap-2 md:col-span-2">
                  <input
                    type="file"
                    accept="image/*"
                    id={`about-image-${s.id}`}
                    className="block h-10 px-3 py-2 rounded border bg-background text-foreground file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                  />
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        const input = document.getElementById(
                          `about-image-${s.id}`
                        ) as HTMLInputElement;
                        const file = input.files?.[0];
                        if (!file) return;
                        const formData = new FormData();
                        formData.append("file", file);
                        formData.append("sectionId", String(s.id));
                        const { uploadAboutSectionImage } = await import(
                          "../../actions/site-content"
                        );
                        const res = await uploadAboutSectionImage(formData);
                        if (res.success) {
                          patchSec(s.id, { imageUrl: res.url });
                          toast.success("Image uploaded");
                        } else {
                          toast.error(res.error || "Failed to upload image");
                        }
                      } catch (e) {
                        toast.error(
                          "Failed to upload image: " + (e as Error)?.message
                        );
                        console.error(
                          "Failed to upload image: ",
                          (e as Error)?.message
                        );
                      }
                    }}
                  >
                    Upload
                  </Button>
                </div>
                <Input
                  type="number"
                  value={s.order ?? 0}
                  onChange={(e) =>
                    patchSec(s.id, { order: Number(e.target.value) })
                  }
                  placeholder="Order"
                />
                <Input
                  value={s.isVisible ? "true" : "false"}
                  onChange={(e) =>
                    patchSec(s.id, { isVisible: e.target.value === "true" })
                  }
                  placeholder="Visible (true/false)"
                />
                <span className="text-xs text-muted-foreground">
                  This section will be hidden from the public if set to false.
                </span>
              </div>

              {/* Structured editors per section type */}
              {(() => {
                const extra = (s.extraData as Record<string, string>) || {};

                if (s.type === "values") {
                  const iconOptions = Object.keys(ICON_MAP);
                  return (
                    <div className="space-y-4">
                      <h4 className="font-medium">Values Cards</h4>
                      {[1, 2, 3].map((idx) => (
                        <div key={idx} className="grid md:grid-cols-3 gap-2">
                          <Input
                            value={extra[`card${idx}Title`] ?? ""}
                            onChange={(e) =>
                              patchSec(s.id, {
                                extraData: {
                                  ...extra,
                                  [`card${idx}Title`]: e.target.value,
                                },
                              })
                            }
                            placeholder={`Card ${idx} Title`}
                          />
                          <Input
                            value={extra[`card${idx}Text`] ?? ""}
                            onChange={(e) =>
                              patchSec(s.id, {
                                extraData: {
                                  ...extra,
                                  [`card${idx}Text`]: e.target.value,
                                },
                              })
                            }
                            placeholder={`Card ${idx} Text`}
                          />
                          <select
                            className="border rounded h-10 px-2"
                            value={extra[`card${idx}Icon`] ?? ""}
                            onChange={(e) =>
                              patchSec(s.id, {
                                extraData: {
                                  ...extra,
                                  [`card${idx}Icon`]: e.target.value,
                                },
                              })
                            }
                          >
                            <option value="">Icon</option>
                            {iconOptions.map((name) => (
                              <option key={name} value={name}>
                                {name}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  );
                }

                if (s.type === "process") {
                  return (
                    <div className="space-y-4">
                      <h4 className="font-medium">Process Steps</h4>
                      {[1, 2, 3, 4].map((idx) => (
                        <div key={idx} className="grid md:grid-cols-2 gap-2">
                          <Input
                            value={extra[`step${idx}Title`] ?? ""}
                            onChange={(e) =>
                              patchSec(s.id, {
                                extraData: {
                                  ...extra,
                                  [`step${idx}Title`]: e.target.value,
                                },
                              })
                            }
                            placeholder={`Step ${idx} Title`}
                          />
                          <Input
                            value={extra[`step${idx}Text`] ?? ""}
                            onChange={(e) =>
                              patchSec(s.id, {
                                extraData: {
                                  ...extra,
                                  [`step${idx}Text`]: e.target.value,
                                },
                              })
                            }
                            placeholder={`Step ${idx} Text`}
                          />
                        </div>
                      ))}
                    </div>
                  );
                }

                if (s.type === "benefits") {
                  return (
                    <div className="space-y-4">
                      <h4 className="font-medium">Benefits List (6)</h4>
                      {[1, 2, 3, 4, 5, 6].map((idx) => (
                        <div key={idx} className="grid md:grid-cols-2 gap-2">
                          <Input
                            value={extra[`b${idx}Title`] ?? ""}
                            onChange={(e) =>
                              patchSec(s.id, {
                                extraData: {
                                  ...extra,
                                  [`b${idx}Title`]: e.target.value,
                                },
                              })
                            }
                            placeholder={`Benefit ${idx} Title`}
                          />
                          <Input
                            value={extra[`b${idx}Text`] ?? ""}
                            onChange={(e) =>
                              patchSec(s.id, {
                                extraData: {
                                  ...extra,
                                  [`b${idx}Text`]: e.target.value,
                                },
                              })
                            }
                            placeholder={`Benefit ${idx} Text`}
                          />
                        </div>
                      ))}
                    </div>
                  );
                }

                if (s.type === "cta") {
                  return (
                    <div className="grid md:grid-cols-2 gap-2">
                      <Input
                        value={extra["primaryText"] ?? ""}
                        onChange={(e) =>
                          patchSec(s.id, {
                            extraData: {
                              ...extra,
                              primaryText: e.target.value,
                            },
                          })
                        }
                        placeholder="Primary Button Text"
                      />
                      <Input
                        value={extra["primaryHref"] ?? ""}
                        onChange={(e) =>
                          patchSec(s.id, {
                            extraData: {
                              ...extra,
                              primaryHref: e.target.value,
                            },
                          })
                        }
                        placeholder="Primary Button Link (/route or URL)"
                      />
                      <Input
                        value={extra["secondaryText"] ?? ""}
                        onChange={(e) =>
                          patchSec(s.id, {
                            extraData: {
                              ...extra,
                              secondaryText: e.target.value,
                            },
                          })
                        }
                        placeholder="Secondary Button Text"
                      />
                      <Input
                        value={extra["secondaryHref"] ?? ""}
                        onChange={(e) =>
                          patchSec(s.id, {
                            extraData: {
                              ...extra,
                              secondaryHref: e.target.value,
                            },
                          })
                        }
                        placeholder="Secondary Button Link (/route or URL)"
                      />
                    </div>
                  );
                }

                // hero / mission generic fields above are sufficient
                return null;
              })()}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await upsertAboutSectionContent({
                        id: s.id,
                        type: s.type,
                        title: s.title,
                        subtitle: s.subtitle,
                        content: s.content,
                        imageUrl: s.imageUrl,
                        extraData:
                          (s.extraData as Record<string, string>) ?? null,
                        order: s.order,
                        isVisible: s.isVisible,
                      });
                      toast.success("Section saved");
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
                  Save
                </Button>
                <Button
                  variant="destructive"
                  onClick={async () => {
                    try {
                      await deleteAboutSectionContent(s.id);
                      await reload();
                      toast.success("Section deleted");
                    } catch (e) {
                      toast.error(
                        "Failed to delete section: " + (e as Error)?.message
                      );
                      console.error(
                        "Failed to delete section: ",
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

          <div className="border rounded p-4 space-y-3">
            <div className="grid md:grid-cols-3 gap-2">
              <select
                id="new-type"
                className="border rounded h-10 px-2"
                defaultValue="hero"
              >
                <option value="hero">Hero</option>
                <option value="mission">Mission</option>
                <option value="values">Values</option>
                <option value="process">Process</option>
                <option value="benefits">Benefits</option>
                <option value="cta">CTA</option>
              </select>
              <Input placeholder="Title" id="new-title" />
              <Input placeholder="Subtitle" id="new-subtitle" />
            </div>
            <Textarea placeholder="Content" id="new-content" />
            <div className="grid md:grid-cols-3 gap-2">
              <Input placeholder="Image URL" id="new-image" />
              <Input
                placeholder="Order"
                id="new-order"
                type="number"
                defaultValue={0}
              />
              <Input
                placeholder="Visible (true/false)"
                id="new-visible"
                defaultValue="true"
              />
            </div>
            <Button
              onClick={async () => {
                try {
                  const type = (
                    document.getElementById("new-type") as HTMLInputElement
                  ).value;
                  const title = (
                    document.getElementById("new-title") as HTMLInputElement
                  ).value;
                  const subtitle = (
                    document.getElementById("new-subtitle") as HTMLInputElement
                  ).value;
                  const content = (
                    document.getElementById(
                      "new-content"
                    ) as HTMLTextAreaElement
                  ).value;
                  const imageUrl = (
                    document.getElementById("new-image") as HTMLInputElement
                  ).value;
                  const order = Number(
                    (document.getElementById("new-order") as HTMLInputElement)
                      .value || 0
                  );
                  const isVisible =
                    ((
                      document.getElementById("new-visible") as HTMLInputElement
                    ).value || "true") === "true";
                  if (!type) return;
                  await upsertAboutSectionContent({
                    type,
                    title,
                    subtitle,
                    content,
                    imageUrl,
                    order,
                    isVisible,
                  });
                  await reload();
                  toast.success("Section added");
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

  function patchSec(id: number, patch: Partial<AboutSection>) {
    setPage((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === id ? { ...s, ...patch } : s
        ),
      };
    });
  }
  async function reload() {
    const data = await getAboutData();
    setPage(data);
  }
}
