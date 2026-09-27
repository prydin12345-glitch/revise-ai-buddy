/** Course identity is independent of display names and of any country's tiers.
 * Registration still requires a reviewed course adapter; these fields alone
 * never authorise a new qualification or an AI-created preset. */
export interface CurriculumIdentity {
  country: string;
  jurisdiction?: string;
  qualification: string;
  subject: string;
}
