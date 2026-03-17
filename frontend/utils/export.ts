import type { ExtractedData } from "@/types"

export function exportToExcel(data: ExtractedData[]) {
  const csvContent = [
    "Authority,Demand Note Number,Municipality,Project Location,Trenching Type,Permit Number,Applicant Name,Contact Info,Work Description,Estimated Cost,Due Date,Status,Confidence,Extracted At",
    ...data.map(
      (row) =>
        `${row.authority},${row.demandNoteNumber},${row.municipality},${row.projectLocation},${row.trenchingType},${row.permitNumber},${row.applicantName},${row.contactInfo},${row.workDescription},${row.estimatedCost},${row.dueDate},${row.status},${row.confidence.toFixed(1)}%,${row.extractedAt}`,
    ),
  ].join("\n")

  const blob = new Blob([csvContent], { type: "text/csv" })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `cloud-extel-demand-notes-${new Date().toISOString().split("T")[0]}.csv`
  a.click()
  window.URL.revokeObjectURL(url)
}
