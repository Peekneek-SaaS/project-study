interface LogoProps {
  className?: string;
  href: string;
}

import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";

const Logo = ({ className, href = "/" }: LogoProps) => {
  return (
    <Link className={cn("flex items-center gap-2", className)} href={href}>
      <Image
        src="/site-logo.png"
        alt="Resonance"
        width={24}
        height={24}
        className="rounded-sm"
      />
      <span className="group-data-[collapsible=icon]:hidden font-semibold text-lg tracking-tighter text-foreground">
        StudyAI
      </span>
    </Link>
  );
};

export default Logo;
