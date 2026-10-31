import { redirect } from "next/navigation";

/** The gaps view now lives in the staff area. */
export default async function StaffGapsPage({ params }: PageProps<"/[locale]/staff/gaps">) {
  const { locale } = await params;
  redirect(`/${locale}/staff`);
}
