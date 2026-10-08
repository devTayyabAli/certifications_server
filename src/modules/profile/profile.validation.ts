import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  // No defaults: a field left out of the request keeps its saved value
  role: z.string().trim().max(100).optional(),
  organization: z.string().trim().max(100).optional(),
  socialLink: z.string().trim().max(250).optional(),
  bio: z.string().trim().max(1000).optional(),
  photoUrl: z
    .string()
    // ~2 MB of base64 — the client resizes avatars well below this
    .max(2_800_000, "Profile photo is too large. Please use an image under 5 MB.")
    .refine(
      (value) =>
        value === "" ||
        /^data:image\/(png|jpe?g|webp);base64,/.test(value) ||
        /^https?:\/\//.test(value) ||
        value.startsWith("/"),
      "Profile photo must be a JPG, PNG or WebP image."
    )
    .nullable()
    .optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
