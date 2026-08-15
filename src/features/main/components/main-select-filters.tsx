"use client";

interface MainSelectFilterProps {
  placeholder: string;
  value?: string;
  onValueChange: (value: string) => void;
  values: {
    label: string;
    value: string;
  }[];
}

import { useQueryState } from "nuqs";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MainSelectFilter = ({
  placeholder,
  values,
  value,
  onValueChange,
}: MainSelectFilterProps) => {
  // const [type, setType] = useQueryState("type");
  // value={type || ""} onValueChange={setType}
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {values.map(({ label, value }) => (
            <SelectItem value={value} key={label}>
              <span className="camelcase">{label}</span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
};

export default MainSelectFilter;
