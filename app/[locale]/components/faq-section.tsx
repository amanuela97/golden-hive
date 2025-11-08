"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, HelpCircle } from "lucide-react";
import type { PublicFaqSection, PublicFaqItem } from "../actions/faq";
import { useTranslations } from "next-intl";

interface FaqSectionProps {
  sections: PublicFaqSection[];
}

export function FaqSection({ sections }: FaqSectionProps) {
  const [openSections, setOpenSections] = useState<Set<number>>(new Set());
  const [openItems, setOpenItems] = useState<Set<number>>(new Set());
  const t = useTranslations("faq");

  const toggleSection = (sectionId: number) => {
    const newOpen = new Set(openSections);
    if (newOpen.has(sectionId)) {
      newOpen.delete(sectionId);
    } else {
      newOpen.add(sectionId);
    }
    setOpenSections(newOpen);
  };

  const toggleItem = (itemId: number) => {
    const newOpen = new Set(openItems);
    if (newOpen.has(itemId)) {
      newOpen.delete(itemId);
    } else {
      newOpen.add(itemId);
    }
    setOpenItems(newOpen);
  };

  if (!sections || sections.length === 0) {
    return null;
  }

  return (
    <section className="py-16 md:py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-4">
              <HelpCircle className="w-8 h-8 text-primary mr-3" />
              <h2 className="text-4xl md:text-5xl font-bold text-foreground">
                {t("frequentlyAskedQuestions")}
              </h2>
            </div>
            <p className="text-lg text-muted-foreground">
              {t("findAnswersToCommonQuestions")}
            </p>
          </div>

          {/* FAQ Sections */}
          <div className="space-y-4">
            {sections.map((section) => (
              <div
                key={section.id}
                className="bg-card border border-border rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-muted/50 transition-colors"
                >
                  <h3 className="text-xl font-semibold text-foreground">
                    {section.title}
                  </h3>
                  {openSections.has(section.id) ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
                  )}
                </button>
                {openSections.has(section.id) && (
                  <div className="px-6 pb-4 space-y-3">
                    {section.items.map((item) => (
                      <FaqItem
                        key={item.id}
                        item={item}
                        isOpen={openItems.has(item.id)}
                        onToggle={() => toggleItem(item.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FaqItem({
  item,
  isOpen,
  onToggle,
}: {
  item: PublicFaqItem;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-muted/30 border border-border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-muted/50 transition-colors"
      >
        <span className="font-medium text-foreground pr-4 text-sm">
          {item.question}
        </span>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-3">
          <div className="pt-2 text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
            {item.answer}
          </div>
        </div>
      )}
    </div>
  );
}
