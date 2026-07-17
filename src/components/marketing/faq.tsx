"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQS = [
  {
    q: "Do I need an account?",
    a: "No. Start an interview, answer it, read the result — signed out, the whole way through. The URL of your session is how you get back to it, so keep the tab or the link. Signing in adds a history of everything you've taken, a review of every question you've got wrong across all your sessions, and analytics on how you're tracking.",
  },
  {
    q: "Is it free?",
    a: "Yes, and there is nothing to pay for. No card, no trial, no tiers, no usage meter.",
  },
  {
    q: "What topics work?",
    a: 'Anything a model can write questions about: React hooks, cell biology, Roman history, system design, music theory. Narrow beats broad — "React useEffect dependencies" produces sharper questions than "programming". The one thing it will not do is run code, so there are no coding challenges — you\'ll be asked about code, not asked to write and execute it.',
  },
  {
    q: "How is a short answer graded?",
    a: "The model compares your answer to the expected one and awards partial credit against the key points, then writes a line explaining what was there and what was missing. Multiple choice and true/false never go near a model — they're checked against the answer key on our server, instantly. Grading a short answer is a judgement, and judgements can be wrong; the feedback and the expected answer are both shown so you can see the reasoning and disagree with it.",
  },
  {
    q: "Can I share my result?",
    a: "Yes. A graded session can be turned into a share link, which anyone holding it can open — no account needed on their end. It shows the questions, your answers and the feedback, but not your name or email. Only share it if you're happy for those answers to be read.",
  },
  {
    q: "How long does it take to start?",
    a: "Seconds. Questions stream in as they're written, so the first one is on screen and answerable while the rest are still being generated.",
  },
];

export function Faq() {
  return (
    <Accordion type="single" collapsible className="border-t">
      {FAQS.map((faq) => (
        <AccordionItem key={faq.q} value={faq.q} className="border-b">
          <AccordionTrigger className="py-5 text-left font-display text-lg font-normal tracking-tight hover:no-underline">
            {faq.q}
          </AccordionTrigger>
          <AccordionContent className="max-w-[68ch] pb-5 text-sm leading-relaxed text-muted-foreground">
            {faq.a}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
