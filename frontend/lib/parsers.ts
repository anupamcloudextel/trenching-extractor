// Authority-specific parser configurations
export interface ParserConfig {
  authorityId: string
  modelVersion: string
  confidenceThreshold: number
  fieldMappings: Record<string, string>
  validationRules: ValidationRule[]
}

export interface ValidationRule {
  field: string
  type: "required" | "format" | "range"
  value: any
}

export const parserConfigs: Record<string, ParserConfig> = {
  kdmc: {
    authorityId: "kdmc",
    modelVersion: "v2.1.0",
    confidenceThreshold: 0.85,
    fieldMappings: {
      demand_note_no: "demandNoteNumber",
      project_loc: "projectLocation",
      permit_no: "permitNumber",
    },
    validationRules: [
      { field: "demandNoteNumber", type: "required", value: true },
      { field: "demandNoteNumber", type: "format", value: /^KDMC-\d{4}-\d{3}$/ },
    ],
  },
  mbmc: {
    authorityId: "mbmc",
    modelVersion: "v2.0.3",
    confidenceThreshold: 0.88,
    fieldMappings: {
      ref_no: "demandNoteNumber",
      work_desc: "workDescription",
      cost_est: "estimatedCost",
    },
    validationRules: [
      { field: "demandNoteNumber", type: "required", value: true },
      { field: "estimatedCost", type: "format", value: /^₹[\d,]+$/ },
    ],
  },
  mcgm: {
    authorityId: "mcgm",
    modelVersion: "v2.2.1",
    confidenceThreshold: 0.9,
    fieldMappings: {
      bmc_ref: "demandNoteNumber",
      ward_info: "municipality",
      contractor: "applicantName",
    },
    validationRules: [
      { field: "demandNoteNumber", type: "required", value: true },
      { field: "demandNoteNumber", type: "format", value: /^BMC\/\d{4}\/\d+$/ },
    ],
  },
  "midc-type1": {
    authorityId: "midc-type1",
    modelVersion: "v1.8.2",
    confidenceThreshold: 0.87,
    fieldMappings: {
      plot_no: "projectLocation",
      company_name: "applicantName",
      infra_req: "workDescription",
    },
    validationRules: [
      { field: "projectLocation", type: "required", value: true },
      { field: "projectLocation", type: "format", value: /^PLOT-\d+$/ },
    ],
  },
  "midc-type2": {
    authorityId: "midc-type2",
    modelVersion: "v1.9.0",
    confidenceThreshold: 0.89,
    fieldMappings: {
      dev_code: "demandNoteNumber",
      utility_conn: "workDescription",
      env_clear: "status",
    },
    validationRules: [
      { field: "demandNoteNumber", type: "required", value: true },
      { field: "status", type: "format", value: /^(Approved|Pending|Rejected)$/ },
    ],
  },
  nmmc: {
    authorityId: "nmmc",
    modelVersion: "v2.0.1",
    confidenceThreshold: 0.86,
    fieldMappings: {
      nmmc_ref: "demandNoteNumber",
      sector_det: "projectLocation",
      infra_type: "trenchingType",
    },
    validationRules: [
      { field: "demandNoteNumber", type: "required", value: true },
      { field: "projectLocation", type: "format", value: /^SECTOR-\d+$/ },
    ],
  },
}

export class DocumentParser {
  private config: ParserConfig

  constructor(authorityId: string) {
    this.config = parserConfigs[authorityId]
  }

  async parseDocument(file: File): Promise<any> {
    // In production, this would call your NLP API
    return {
      confidence: Math.random() * 10 + 90,
      extractedFields: {},
      processingTime: Math.random() * 3 + 1,
    }
  }

  validateExtractedData(data: any): boolean {
    return this.config.validationRules.every((rule) => {
      // Implement validation logic
      return true
    })
  }
}
