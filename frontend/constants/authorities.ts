import type { AuthorityConfig } from "@/types"

export const authorities: AuthorityConfig[] = [
  {
    id: "kdmc",
    name: "KDMC",
    fullName: "Kalyan-Dombivli Municipal Corporation",
    color: "bg-cyan-500",
    icon: "🏛️",
    fields: ["Demand Note No.", "Project Location", "Permit Details", "Applicant Info"],
    processingSteps: ["OCR Text Extraction", "KDMC Format Recognition", "Field Mapping", "Data Validation"],
  },
  {
    id: "mbmc",
    name: "MBMC",
    fullName: "Mira-Bhayandar Municipal Corporation",
    color: "bg-green-500",
    icon: "🏢",
    fields: ["Reference No.", "Work Description", "Cost Estimation", "Timeline"],
    processingSteps: ["Document Analysis", "MBMC Schema Detection", "Content Parsing", "Quality Check"],
  },
  {
    id: "mcgm",
    name: "MCGM",
    fullName: "Municipal Corporation of Greater Mumbai",
    color: "bg-purple-500",
    icon: "🌆",
    fields: ["BMC Ref No.", "Ward Details", "Contractor Info", "Approval Status"],
    processingSteps: ["MCGM Format Detection", "Multi-page Processing", "Data Extraction", "Compliance Check"],
  },
  {
    id: "nmmc",
    name: "NMMC",
    fullName: "Navi Mumbai Municipal Corporation",
    color: "bg-yellow-500",
    icon: "🌊",
    fields: ["NMMC Ref No.", "Sector Details", "Infrastructure Type", "Approval Timeline"],
    processingSteps: ["NMMC Document Recognition", "Sector-wise Processing", "Infrastructure Mapping"],
  },
]
