const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

/** Public URL for an object in the "wardrobe" storage bucket. */
export function imageUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/wardrobe/${path}`;
}
