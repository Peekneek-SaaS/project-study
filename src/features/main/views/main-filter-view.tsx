import MainSelectFilter from "@/features/main/components/main-select-filters";

const MainFilterView = () => {
  return (
    <div className="flex items-center gap-2 py-2 ">
      <MainSelectFilter
        placeholder="Type"
        value={"pdf"}
        onValueChange={() => {}}
        values={[
          { label: "PDF", value: "pdf" },
          { label: "Docs", value: "docs" },
          { label: "PowerPoint", value: "ppt" },
        ]}
      />
      <MainSelectFilter
        placeholder="Modified"
        value={"today"}
        onValueChange={() => {}}
        values={[
          { label: "Today", value: "today" },
          { label: "Yesterday", value: "yesterday" },
          { label: "Last Few Days", value: "lastfewdays" },
        ]}
      />
    </div>
  );
};

export default MainFilterView;
