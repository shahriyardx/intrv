"use client";

import { PlusIcon } from "@phosphor-icons/react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * Lives in the org header, so it needs to know when it would be pointing at the
 * page you are already on — hence a client component for the pathname alone.
 */
export function NewScreenButton() {
  const pathname = usePathname();
  if (pathname === "/org/screens/new") return null;

  return (
    <Button asChild size="sm">
      <Link href={"/org/screens/new" as Route}>
        <PlusIcon className="size-4" />
        New screen
      </Link>
    </Button>
  );
}
