export interface AuthorityConfig {
  id: string
  name: string
  fullName: string
  color: string
  icon: string
  fields: string[]
  processingSteps: string[]
}

export interface ExtractedData {
  id: string
  authority: string
  demandNoteNumber: string
  municipality: string
  projectLocation: string
  trenchingType: string
  permitNumber: string
  applicantName: string
  contactInfo: string
  workDescription: string
  estimatedCost: string
  dueDate: string
  status: string
  confidence: number
  extractedAt: string
}

export interface User {
  name: string
  email: string
  avatar?: string
}

export interface Analytics {
  totalProcessed: number
  avgProcessingTime: number
  activeAuthorities: number
}
