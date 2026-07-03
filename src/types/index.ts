// Shared domain types re-exported from the generated Prisma client.
// Feature code should import domain types from here, never from
// `@/generated/prisma` directly, so the generated path stays swappable.

export type {
  User,
  Category,
  WardrobeItem,
  Image,
  Tag,
  CustomField,
  CustomFieldValue,
  Outfit,
  OutfitItem,
} from "@/generated/prisma/client";

export {
  Season,
  LaundryStatus,
  CustomFieldType,
} from "@/generated/prisma/enums";
