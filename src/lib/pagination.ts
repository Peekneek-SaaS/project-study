import z from "zod";

/**
 * What every scrolling list in the app is cut into.
 *
 * One definition rather than a number per router, because the size is a
 * property of the *interaction* and not of the data: a page has to be more than
 * fills a screen, so the sentinel at the bottom is genuinely below the fold and
 * the first scroll does not immediately ask for more, and small enough that the
 * first paint is not the whole account. Thirty rows clears the tallest of these
 * lists (the drive's table) on a desktop screen with room to spare.
 */
export const PAGE_SIZE = 30;

/**
 * The ceiling a caller may ask for.
 *
 * Kept because not every reader of these procedures is an infinite list — the
 * search palette wants as much as it can get in one go, and this is what
 * "as much as it can get" means. Beyond it, a row is findable by its own URL
 * rather than by the palette.
 */
export const MAX_PAGE_SIZE = 100;

/**
 * The two inputs every paginated procedure takes.
 *
 * Spread into a procedure's own `z.object` rather than wrapped around it, so
 * each list keeps its own filters beside these and the whole input stays one
 * flat object — which is also what lets the query key drop `cursor` and leave
 * the filters behind as the identity of the list. See `getQueryKeyInternal` in
 * `@trpc/tanstack-react-query`: an infinite key is the input *minus* the
 * cursor, which is exactly right — page two of a filtered list belongs to the
 * same list as page one.
 *
 * `cursor` is `nullish` rather than optional because both spellings arrive in
 * practice: TanStack sends `undefined` for the first page, and an explicitly
 * null `initialCursor` is the other way of saying the same thing.
 */
export const cursorInput = {
  limit: z.number().int().min(1).max(MAX_PAGE_SIZE).default(PAGE_SIZE),
  cursor: z.string().nullish(),
};

/**
 * Turns `limit + 1` rows into a page and the cursor after it.
 *
 * The extra row is the whole trick, and it is why every caller of this asks the
 * database for one more than it means to return: whether there is a next page
 * is otherwise a second `count` query per page, and a count over a list someone
 * is actively scrolling is the expensive half of the request.
 *
 * The cursor is the last *kept* row's id — not the extra one — because that is
 * the row the next page continues after. Every list that uses this orders by
 * `id` as its final tiebreak, which is what makes "after this id" a single
 * point in the ordering rather than a place two rows could both claim.
 */
export function toPage<T extends { id: string }>(rows: T[], limit: number) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  return {
    items,
    // Null rather than absent, so the client's `getNextPageParam` has one shape
    // to read and the end of a list is stated rather than inferred.
    nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
  };
}

/**
 * The Prisma clause that starts a page after a cursor.
 *
 * `skip: 1` is not optional and is the classic way to get this wrong: Prisma's
 * `cursor` is *inclusive*, so without it every page after the first repeats the
 * row the previous page ended on.
 */
export function cursorClause(cursor: string | null | undefined): {
  cursor: { id: string } | undefined;
  skip: number | undefined;
} {
  // Both keys are always present, set to `undefined` on a first page rather
  // than omitted. A union of `{}` and `{ cursor, skip }` is the natural way to
  // write this and the wrong one: spread into a `findMany`, it makes the whole
  // argument a union of two shapes, and Prisma's overloads cannot resolve
  // against that. Prisma treats an explicit `undefined` as absent, so this is
  // the same query with a type the compiler can follow.
  return cursor
    ? { cursor: { id: cursor }, skip: 1 }
    : { cursor: undefined, skip: undefined };
}

/**
 * The `getNextPageParam` every infinite list in the app passes.
 *
 * `undefined` rather than the `null` the server sent, because that is what
 * TanStack reads as "there is no next page" — a null page param is a param, and
 * it would leave `hasNextPage` true against a list that has ended, which is a
 * sentinel that spins forever at the bottom of a finished list.
 *
 * Typed on `nextCursor` alone rather than on a `{ items }` page, because one of
 * these lists is not a list of one thing: the drive returns `{ folders,
 * documents, nextCursor }`, and the cursor is the only part every paginated
 * procedure here agrees on.
 */
export function nextCursorOf(lastPage: {
  nextCursor: string | null;
}): string | undefined {
  return lastPage.nextCursor ?? undefined;
}

/**
 * The options object every infinite list is built with, server and client.
 *
 * Shared rather than written out at each call site, because the server prefetch
 * and the client hook have to agree *exactly*: they are two descriptions of one
 * cache entry, and a difference between them is not a type error — it is a
 * hydrated page the client cannot match, so the list quietly refetches its
 * first page on mount and the prefetch buys nothing.
 *
 * `initialCursor: null` is stated rather than left to default to `undefined`
 * for the same reason. The two behave identically at the database, but they are
 * different values in the dehydrated `pageParams`, and stating it means the two
 * sides cannot drift into disagreeing about which one the first page was.
 */
export const infiniteOptions = {
  getNextPageParam: nextCursorOf,
  initialCursor: null,
};
