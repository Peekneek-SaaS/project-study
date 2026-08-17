import type { Metadata } from "next";

import { MainView } from "@/features/main/views/main-view";

export const metadata: Metadata = { title: "Drive" };

// The filters live in the query string, so the drive is rendered per request
// and can warm the listing the URL actually asks for.
const MainPage = (props: PageProps<"/main">) => {
  return <MainView searchParams={props.searchParams} />;
};

export default MainPage;
