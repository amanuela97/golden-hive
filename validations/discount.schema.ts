import { z } from "zod";

/**
 * Helpers
 */
const positiveMoney = z.number().positive();
const positiveInt = z.number().int().positive();
const isoDateString = z.iso.datetime({ offset: true }).or(z.iso.datetime()); // allow both with/without TZ
const optionalIsoDate = isoDateString.nullable().optional();

const DiscountValueTypeSchema = z.enum(["fixed", "percentage"]);
/**
 * Targets (no collections yet)
 */
const DiscountTargetsSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("all_products"),
  }),
  z.object({
    type: z.literal("listing_ids"),
    listingIds: z
      .array(z.string().min(1))
      .min(1, "Select at least one product"),
  }),
]);

/**
 * Minimum purchase requirements
 */
const MinimumRequirementSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("none"),
  }),
  z.object({
    type: z.literal("amount"),
    amount: positiveMoney, // € value
  }),
  z.object({
    type: z.literal("quantity"),
    quantity: positiveInt, // item count
  }),
]);

/**
 * Eligibility (no segments yet)
 */
const EligibilitySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("all"),
  }),
  z.object({
    type: z.literal("specific"),
    customerIds: z
      .array(z.string().min(1))
      .min(1, "Select at least one customer"),
  }),
]);

/**
 * Create: Amount off products
 */
export const CreateAmountOffProductsDiscountSchema = z
  .object({
    type: z.literal("amount_off_products"),

    name: z.string().min(2).max(120),
    code: z
      .string()
      .trim()
      .min(2)
      .max(50)
      .regex(/^[A-Za-z0-9_-]+$/, "Use letters/numbers, dash or underscore only")
      .nullable()
      .optional(),

    valueType: DiscountValueTypeSchema,
    value: z.number().finite().positive(), // validated further below
    currency: z.string().length(3).optional(), // server can default

    targets: DiscountTargetsSchema,

    minimumRequirement: MinimumRequirementSchema.default({ type: "none" }),
    eligibility: EligibilitySchema.default({ type: "all" }),

    startsAt: optionalIsoDate,
    endsAt: optionalIsoDate,

    usageLimit: z.number().int().positive().nullable().optional(),
    isActive: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    // percentage bounds
    if (data.valueType === "percentage") {
      if (data.value <= 0 || data.value > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["value"],
          message: "Percentage must be between 0 and 100",
        });
      }
    }

    // fixed amount must be > 0 (already), but you may require currency
    if (data.valueType === "fixed") {
      // optional: enforce currency presence
      // if (!data.currency) ...
    }

    // dates
    const starts = data.startsAt ? new Date(data.startsAt) : null;
    const ends = data.endsAt ? new Date(data.endsAt) : null;
    if (starts && ends && ends < starts) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsAt"],
        message: "End date must be after start date",
      });
    }

    // code: treat empty string as null at API boundary (optional)
    if (data.code != null && data.code.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["code"],
        message: "Code cannot be empty",
      });
    }
  });

export type CreateAmountOffProductsDiscountInput = z.infer<
  typeof CreateAmountOffProductsDiscountSchema
>;

/**
 * Update schema
 * - Partial, but still must validate cross-field constraints if present.
 */
export const UpdateDiscountSchema =
  CreateAmountOffProductsDiscountSchema.partial()
    .extend({
      // For update you may omit `type` (but keeping it is ok)
      type: z.literal("amount_off_products").optional(),
    })
    .superRefine((data, ctx) => {
      // If both provided, validate dates
      const starts = data.startsAt ? new Date(data.startsAt) : null;
      const ends = data.endsAt ? new Date(data.endsAt) : null;
      if (starts && ends && ends < starts) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endsAt"],
          message: "End date must be after start date",
        });
      }

      // If valueType present, validate value bounds when value also present
      if (data.valueType === "percentage" && typeof data.value === "number") {
        if (data.value <= 0 || data.value > 100) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["value"],
            message: "Percentage must be between 0 and 100",
          });
        }
      }
    });

export type UpdateDiscountInput = z.infer<typeof UpdateDiscountSchema>;

/**
 * Toggle active
 */
export const ToggleDiscountSchema = z.object({
  isActive: z.boolean(),
});
export type ToggleDiscountInput = z.infer<typeof ToggleDiscountSchema>;

/**
 * List query validation (optional but recommended)
 */
export const ListDiscountsQuerySchema = z.object({
  status: z
    .enum(["active", "scheduled", "expired", "disabled", "all"])
    .optional(),
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
});
export type ListDiscountsQuery = z.infer<typeof ListDiscountsQuerySchema>;
