/**
 * A todo's title: the one line it is known by.
 *
 * The length lives here rather than in the router, because three places have to
 * agree on it — the two fields that type a title, and the procedure that
 * rejects one — and a limit enforced at 500 in one of them and 512 in another
 * is a save that fails after the editor has already closed.
 */
export const MAX_TODO_TITLE = 500;
