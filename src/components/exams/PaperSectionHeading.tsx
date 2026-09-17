import { gatewaySectionHeading } from '@/lib/biology-paper-display';

export function PaperSectionHeading({context, number, previous}: {context: unknown; number: string; previous?: string}) {
  const heading = gatewaySectionHeading(context, number, previous);
  return heading ? <h2 className="mb-4 border-b pb-2 text-base font-semibold">{heading}</h2> : null;
}
