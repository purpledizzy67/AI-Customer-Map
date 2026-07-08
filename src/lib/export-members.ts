import type { CommunityMember } from "@/types";

export function membersToCsv(members: CommunityMember[]): string {
  const headers = [
    "Username",
    "Display Name",
    "Platform",
    "Status",
    "Activity",
    "Role",
    "Apollo Name",
    "Title",
    "Email",
    "LinkedIn",
    "Company",
    "Company Domain",
    "Location",
    "Source",
    "Fetched At",
    "Enriched At",
  ];

  const rows = members.map((m) => {
    const apollo = m.apolloData;
    const location = [apollo?.city, apollo?.state, apollo?.country]
      .filter(Boolean)
      .join(", ");

    return [
      m.username,
      m.displayName ?? "",
      m.platform,
      m.status ?? "",
      m.activity ?? "",
      m.role ?? "",
      apollo?.name ?? "",
      apollo?.title ?? "",
      apollo?.email ?? "",
      apollo?.linkedinUrl ?? "",
      apollo?.organizationName ?? "",
      apollo?.organizationDomain ?? "",
      location,
      m.source,
      m.fetchedAt,
      m.enrichedAt ?? "",
    ];
  });

  const escape = (val: string) => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  return [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
}

export function downloadMembersCsv(
  members: CommunityMember[],
  communityName: string
): void {
  const csv = membersToCsv(members);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${communityName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-members.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
