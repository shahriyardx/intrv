"use client";

import { FilePdfIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

/**
 * "Save as PDF" — there is no server-side PDF here. The browser's own
 * print-to-PDF is the export path, so this just opens window.print(); the
 * @media print block in globals.css is what makes the sheet look like a
 * document rather than a screenshot of a dark web page.
 */
export function PdfButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      className="no-print"
      onClick={() => window.print()}
    >
      <FilePdfIcon className="size-4" />
      Save as PDF
    </Button>
  );
}
