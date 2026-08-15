import { createSearchParamsCache, parseAsString } from "nuqs/server";

export const filterSearchParams = {
  type: parseAsString.withDefault(""),
  modified: parseAsString.withDefault(""),
};

export const filterSearchParamsCache =
  createSearchParamsCache(filterSearchParams);
