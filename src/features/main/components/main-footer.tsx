import React from "react";
import MainBreadCrumbs from "./main-breadcrumbs";

const MainFooter = () => {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-background p-4">
      <MainBreadCrumbs />
    </div>
  );
};

export default MainFooter;
