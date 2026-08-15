import { StickyNotesView } from "@/features/sticky-notes/views/sticky-notes-view";

// The filter lives in the query string, so the wall is rendered per request and
// can warm the notes the URL actually asks for.
const StickyNotesPage = (props: PageProps<"/sticky-notes">) => {
  return <StickyNotesView searchParams={props.searchParams} />;
};

export default StickyNotesPage;
