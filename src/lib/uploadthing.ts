"use client";

import { generateReactHelpers } from "@uploadthing/react";

import type { OurFileRouter } from "@/app/api/uploadthing/core";

/**
 * `useUploadThing` gives us the progress events and the `startUpload` trigger,
 * which the prebuilt `<UploadButton />` in `lib/utils.ts` does not expose —
 * we need both to drive our own picker and the progress toast.
 */
export const { useUploadThing } = generateReactHelpers<OurFileRouter>();
