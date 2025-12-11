"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JsonEditor } from "json-edit-react";
import {
  getTranslationByLang,
  saveTranslation,
  translateToLanguage,
  translateModifiedKeys,
} from "../../actions/translations";
import toast from "react-hot-toast";
import { Loader2, Save, Languages, RefreshCw, Upload } from "lucide-react";
import { type TranslationData } from "@/db/schema";

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "fi", name: "Finnish" },
  { code: "ne", name: "Nepali" },
] as const;

const CACHE_KEY = "translation_cache_english_data";

// Helper function to find all modified keys between two objects (client-side)
function findModifiedKeys(
  oldObj: TranslationData,
  newObj: TranslationData,
  prefix: string = ""
): string[] {
  const modifiedKeys: string[] = [];
  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

  for (const key of allKeys) {
    const currentPath = prefix ? `${prefix}.${key}` : key;
    const oldValue = oldObj[key];
    const newValue = newObj[key];

    if (typeof newValue === "string" && typeof oldValue === "string") {
      // Both are strings - compare directly
      if (oldValue !== newValue) {
        modifiedKeys.push(currentPath);
      }
    } else if (
      typeof newValue === "object" &&
      newValue !== null &&
      !Array.isArray(newValue) &&
      typeof oldValue === "object" &&
      oldValue !== null &&
      !Array.isArray(oldValue)
    ) {
      // Both are objects - recurse
      modifiedKeys.push(
        ...findModifiedKeys(
          oldValue as TranslationData,
          newValue as TranslationData,
          currentPath
        )
      );
    } else if (oldValue !== newValue) {
      // Different types or one is missing - consider modified
      if (typeof newValue === "string") {
        modifiedKeys.push(currentPath);
      } else if (
        typeof newValue === "object" &&
        newValue !== null &&
        !Array.isArray(newValue)
      ) {
        // New nested object - get all string paths within it
        const nestedKeys = getAllStringPaths(
          newValue as TranslationData,
          currentPath
        );
        modifiedKeys.push(...nestedKeys);
      }
    }
  }

  return modifiedKeys;
}

// Helper function to get all string value paths in an object
function getAllStringPaths(
  obj: TranslationData,
  prefix: string = ""
): string[] {
  const paths: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      paths.push(currentPath);
    } else if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value)
    ) {
      paths.push(...getAllStringPaths(value as TranslationData, currentPath));
    }
  }
  return paths;
}

export default function TranslationsPage() {
  const [selectedLang, setSelectedLang] = useState<"en" | "fi" | "ne">("en");
  const [jsonData, setJsonData] = useState<TranslationData>({});
  // Track the last saved state of the current language (for save tracking)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [previousJsonData, setPreviousJsonData] = useState<TranslationData>({});
  // Track the last English data that was successfully translated (baseline for comparison)
  // This is separate from previousJsonData because we need to compare against the last translated state,
  // not the last saved state, to detect newly added/modified keys
  const lastTranslatedEnglishDataRef = useRef<TranslationData>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Save English data to localStorage cache
  const setCachedEnglishData = (data: TranslationData) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error("Error saving cache to localStorage:", error);
    }
  };

  const loadTranslation = async () => {
    setIsLoading(true);
    try {
      const data = await getTranslationByLang(selectedLang);
      if (data) {
        setJsonData(data);
        // Only update previousJsonData for the current language (for save tracking)
        setPreviousJsonData(data);
        // When loading English, also update the translation baseline
        if (selectedLang === "en") {
          setCachedEnglishData(data);
          // Initialize the translation baseline if it's empty
          if (Object.keys(lastTranslatedEnglishDataRef.current).length === 0) {
            lastTranslatedEnglishDataRef.current = data;
          }
        }
      } else {
        // If no data exists, start with empty object
        setJsonData({});
        setPreviousJsonData({});
        if (selectedLang === "en") {
          setCachedEnglishData({});
          if (Object.keys(lastTranslatedEnglishDataRef.current).length === 0) {
            lastTranslatedEnglishDataRef.current = {};
          }
        }
      }
    } catch (error) {
      console.error("Error loading translation:", error);
      toast.error("Failed to load translation");
      setJsonData({});
      setPreviousJsonData({});
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await saveTranslation(selectedLang, jsonData);
      if (result.success) {
        // Update previous state after successful save
        setPreviousJsonData(jsonData);
        // Update cache and translation baseline if saving English data
        if (selectedLang === "en") {
          setCachedEnglishData(jsonData);
          // Don't update translation baseline on save - only update it after successful translation
          // This allows us to detect changes between saves and translations
        }
        toast.success("Translation saved successfully");
      } else {
        toast.error(result.error || "Failed to save translation");
      }
    } catch (error) {
      console.error("Error saving translation:", error);
      toast.error("Failed to save translation");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTranslate = async (targetLang: "fi" | "ne") => {
    if (selectedLang !== "en") {
      toast.error("Please select English (en) to translate to other languages");
      return;
    }

    // Compare current English data with the last translated English baseline
    // This ensures we only translate newly added/modified keys
    const modifiedKeys = findModifiedKeys(
      lastTranslatedEnglishDataRef.current,
      jsonData
    );

    // If no keys were modified, check if translation already exists
    if (modifiedKeys.length === 0) {
      try {
        const existingTranslation = await getTranslationByLang(targetLang);
        if (existingTranslation) {
          setSelectedLang(targetLang);
          setJsonData(existingTranslation);
          setPreviousJsonData(existingTranslation);
          toast.success(
            `Translation to ${targetLang.toUpperCase()} loaded (no changes detected)`
          );
          return;
        }
      } catch (error) {
        console.error("Error checking existing translation:", error);
        // Continue with translation if check fails
      }
    }

    setIsTranslating(true);
    try {
      let result;

      // If there are modified keys, translate only those
      if (modifiedKeys.length > 0) {
        console.log(
          `Translating ${modifiedKeys.length} modified key(s):`,
          modifiedKeys
        );
        result = await translateModifiedKeys(targetLang, modifiedKeys);

        if (result.success && result.data) {
          // Merge with existing translation
          const existingTranslation = await getTranslationByLang(targetLang);

          // Deep merge nested objects
          const deepMerge = (
            target: TranslationData,
            source: TranslationData
          ): TranslationData => {
            const output = { ...target };
            for (const key in source) {
              if (
                source[key] &&
                typeof source[key] === "object" &&
                !Array.isArray(source[key]) &&
                target[key] &&
                typeof target[key] === "object" &&
                !Array.isArray(target[key])
              ) {
                output[key] = deepMerge(
                  target[key] as TranslationData,
                  source[key] as TranslationData
                ) as string | Record<string, string | Record<string, string>>;
              } else {
                output[key] = source[key];
              }
            }
            return output;
          };

          const finalData = existingTranslation
            ? deepMerge(existingTranslation, result.data)
            : result.data;

          // Save the merged translated data
          const saveResult = await saveTranslation(targetLang, finalData);
          if (saveResult.success) {
            // Update the translation baseline to current English data after successful translation
            lastTranslatedEnglishDataRef.current = jsonData;
            setSelectedLang(targetLang);
            setJsonData(finalData);
            setPreviousJsonData(finalData);
            toast.success(
              `Translated ${modifiedKeys.length} modified key(s) to ${targetLang.toUpperCase()} and saved`
            );
          } else {
            toast.error(
              `Translation completed but failed to save: ${saveResult.error || "Unknown error"}`
            );
            setSelectedLang(targetLang);
            setJsonData(finalData);
            setPreviousJsonData(finalData);
          }
        } else {
          toast.error(result.error || "Failed to translate modified keys");
        }
      } else {
        // No modified keys, do full translation (first time translation)
        result = await translateToLanguage(targetLang);
        if (result.success && result.data) {
          const saveResult = await saveTranslation(targetLang, result.data);
          if (saveResult.success) {
            // Update the translation baseline to current English data after successful translation
            lastTranslatedEnglishDataRef.current = jsonData;
            setSelectedLang(targetLang);
            setJsonData(result.data);
            setPreviousJsonData(result.data);
            toast.success(
              `Translation to ${targetLang.toUpperCase()} completed and saved`
            );
          } else {
            toast.error(
              `Translation completed but failed to save: ${saveResult.error || "Unknown error"}`
            );
            setSelectedLang(targetLang);
            setJsonData(result.data);
            setPreviousJsonData(result.data);
          }
        } else {
          toast.error(result.error || "Failed to translate");
        }
      }
    } catch (error) {
      console.error("Error translating:", error);
      toast.error("Failed to translate");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleImportJson = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith(".json")) {
      toast.error("Please select a valid JSON file");
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);

        // Validate that it's an object (not array or primitive)
        if (
          typeof parsed !== "object" ||
          parsed === null ||
          Array.isArray(parsed)
        ) {
          toast.error("Invalid JSON structure. Expected an object.");
          return;
        }

        // Set the imported data
        const importedData = parsed as TranslationData;
        setJsonData(importedData);
        setPreviousJsonData(importedData); // Track imported state
        // Update cache if importing English data
        if (selectedLang === "en") {
          setCachedEnglishData(importedData);
        }
        toast.success("JSON file imported successfully");
      } catch (error) {
        console.error("Error parsing JSON:", error);
        toast.error(
          `Failed to parse JSON: ${error instanceof Error ? error.message : "Invalid JSON format"}`
        );
      }
    };

    reader.onerror = () => {
      toast.error("Failed to read file");
    };

    reader.readAsText(file);

    // Reset file input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Load translation data when language changes
  useEffect(() => {
    loadTranslation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLang]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">Translation Management</CardTitle>
            <div className="flex items-center gap-2">
              {selectedLang === "en" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTranslate("fi")}
                    disabled={isTranslating}
                  >
                    {isTranslating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Languages className="h-4 w-4 mr-2" />
                    )}
                    Translate to FI
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTranslate("ne")}
                    disabled={isTranslating}
                  >
                    {isTranslating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Languages className="h-4 w-4 mr-2" />
                    )}
                    Translate to NE
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" onClick={handleImportJson}>
                <Upload className="h-4 w-4 mr-2" />
                Import JSON
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={loadTranslation}
                disabled={isLoading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reload
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <label className="text-sm font-medium mb-2 block">
              Select Language
            </label>
            <Select
              value={selectedLang}
              onValueChange={(value) =>
                setSelectedLang(value as "en" | "fi" | "ne")
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-lg p-4 bg-background">
            <JsonEditor
              data={jsonData}
              onUpdate={(
                updatedData:
                  | TranslationData
                  | { path: string[]; newData: TranslationData }
                  | unknown
              ) => {
                // json-edit-react may return data in different formats
                // Handle both direct data and wrapped format ({ path, newData })
                let actualData: TranslationData;

                if (
                  updatedData &&
                  typeof updatedData === "object" &&
                  !Array.isArray(updatedData)
                ) {
                  // Check if it's the wrapped format with path and newData
                  if ("newData" in updatedData && updatedData.newData) {
                    actualData = updatedData.newData as TranslationData;
                  } else if (
                    "path" in updatedData &&
                    Array.isArray(updatedData.path)
                  ) {
                    // If path exists but no newData, it might be a partial update
                    // In this case, use the current jsonData as base
                    actualData = jsonData;
                  } else {
                    // Direct data format - check if it's already the correct structure
                    const data = updatedData as Record<string, unknown>;
                    if (
                      data &&
                      typeof data === "object" &&
                      !Array.isArray(data) &&
                      !("path" in data)
                    ) {
                      actualData = data as TranslationData;
                    } else {
                      // Fallback to current data if format is unexpected
                      actualData = jsonData;
                    }
                  }
                } else {
                  // Fallback to current data if update format is unexpected
                  actualData = jsonData;
                }

                // Validate that it's a proper object (not array or null)
                if (
                  actualData &&
                  typeof actualData === "object" &&
                  !Array.isArray(actualData)
                ) {
                  // Note: We don't update previousJsonData here - it's only updated on save
                  // This allows us to track what changed between the last save and now
                  setJsonData(actualData);
                }
              }}
            />
          </div>

          <div className="mt-4 text-sm text-muted-foreground">
            <p>
              <strong>Note:</strong> Edit the JSON structure above. When you
              save, the translation will be stored in the database and used
              across the application.
            </p>
            {selectedLang === "en" && (
              <p className="mt-2">
                <strong>Tip:</strong> Use the &quot;Translate to FI&quot; or
                &quot;Translate to NE&quot; buttons to automatically translate
                the English content to other languages. You can then edit the
                translations before saving.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
