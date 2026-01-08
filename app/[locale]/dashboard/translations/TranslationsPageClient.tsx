"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import toast from "react-hot-toast";
import {
  getAllTranslations,
  saveTranslation,
  translateToLanguage,
} from "@/app/[locale]/actions/translations";
import { type TranslationData } from "@/db/schema";
import { Loader2, Save, Languages } from "lucide-react";

const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "fi", name: "Finnish" },
  { code: "ne", name: "Nepali" },
] as const;

export default function TranslationsPageClient() {
  const [translations, setTranslations] = useState<
    Record<string, TranslationData>
  >({});
  const [activeLang, setActiveLang] = useState<string>("en");
  const [jsonText, setJsonText] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    loadTranslations();
  }, []);

  useEffect(() => {
    if (translations[activeLang]) {
      setJsonText(JSON.stringify(translations[activeLang], null, 2));
    } else {
      setJsonText("");
    }
  }, [activeLang, translations]);

  async function loadTranslations() {
    try {
      setLoading(true);
      const data = await getAllTranslations();
      setTranslations(data);
    } catch (error) {
      console.error("Error loading translations:", error);
      toast.error("Failed to load translations");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      let parsed: TranslationData;
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        toast.error("Invalid JSON format");
        return;
      }

      const result = await saveTranslation(activeLang, parsed);
      if (result.success) {
        toast.success("Translation saved successfully");
        await loadTranslations();
      } else {
        toast.error(result.error || "Failed to save translation");
      }
    } catch (error) {
      console.error("Error saving translation:", error);
      toast.error("Failed to save translation");
    } finally {
      setSaving(false);
    }
  }

  async function handleAutoTranslate() {
    if (activeLang === "en") {
      toast.error("Cannot auto-translate English (source language)");
      return;
    }

    try {
      setTranslating(true);
      const result = await translateToLanguage(activeLang);
      if (result.success && result.data) {
        setJsonText(JSON.stringify(result.data, null, 2));
        toast.success("Translation generated successfully");
      } else {
        toast.error(result.error || "Failed to translate");
      }
    } catch (error) {
      console.error("Error translating:", error);
      toast.error("Failed to translate");
    } finally {
      setTranslating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Translation Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage translations for all supported languages
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5" />
            Translations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeLang} onValueChange={setActiveLang}>
            <TabsList className="grid w-full grid-cols-3">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <TabsTrigger key={lang.code} value={lang.code}>
                  {lang.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {SUPPORTED_LANGUAGES.map((lang) => (
              <TabsContent key={lang.code} value={lang.code} className="mt-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`json-${lang.code}`}>
                      {lang.name} Translation JSON
                    </Label>
                    <div className="flex gap-2">
                      {lang.code !== "en" && (
                        <Button
                          variant="outline"
                          onClick={handleAutoTranslate}
                          disabled={translating}
                        >
                          {translating ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Translating...
                            </>
                          ) : (
                            "Auto-translate from English"
                          )}
                        </Button>
                      )}
                      <Button onClick={handleSave} disabled={saving}>
                        {saving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            Save
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    id={`json-${lang.code}`}
                    value={jsonText}
                    onChange={(e) => setJsonText(e.target.value)}
                    className="font-mono text-sm min-h-[500px]"
                    placeholder='{"key": "value", "nested": {"key": "value"}}'
                  />
                  <p className="text-sm text-muted-foreground">
                    Edit the JSON translation data for {lang.name}. Use nested
                    objects for organization (e.g.,{" "}
                    {`{"nav": {"home": "Home"}}`}
                    ).
                  </p>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
