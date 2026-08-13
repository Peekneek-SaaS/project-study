import { Button } from "@/components/ui/button";
import { UserButton } from "@clerk/nextjs";
import { PlusIcon } from "lucide-react";

const Page = () => {
  return (
    <div>
      <Button>
        <PlusIcon className="size-3" />
        Hello
      </Button>
      <UserButton />
    </div>
  );
};

export default Page;
