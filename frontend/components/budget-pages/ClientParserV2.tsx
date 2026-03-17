"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Database, FileText, CheckCircle, XCircle, AlertCircle, Search, Sparkles, Mail } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import GenerateEmailDraftModal from "@/components/email/GenerateEmailDraftModal"
import { FiMail } from "react-icons/fi"

interface Authority {
  id: string
  name: string
  fullName: string
}

interface ParsedData {
  non_refundable?: Record<string, any>
  sd?: Record<string, any>
}

export default function ClientParserV2() {
  const [dnNumber, setDnNumber] = useState('')
  const [selectedAuthority, setSelectedAuthority] = useState('')
  const [authorities, setAuthorities] = useState<Authority[]>([])
  const [dnNumbers, setDnNumbers] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [dnExists, setDnExists] = useState<boolean | null>(null)
  const [parsedData, setParsedData] = useState<ParsedData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openDnDropdown, setOpenDnDropdown] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const { toast } = useToast()

  // Fetch available authorities and DN numbers on component mount
  useEffect(() => {
    fetchAuthorities()
    fetchDnNumbers()
  }, [])

  const fetchAuthorities = async () => {
    try {
      console.log('Fetching authorities from:', process.env.NEXT_PUBLIC_BACKEND_URL + '/api/client-parser-v2/authorities')
      const response = await fetch(process.env.NEXT_PUBLIC_BACKEND_URL + '/api/client-parser-v2/authorities')
      console.log('Response status:', response.status)
      
      if (response.ok) {
        const data = await response.json()
        console.log('Authorities data:', data)
        const authList = data.authorities.map((auth: string) => ({
          id: auth.toLowerCase(),
          name: auth,
          fullName: getAuthorityFullName(auth)
        }))
        setAuthorities(authList)
      } else {
        console.error('Failed to fetch authorities, status:', response.status)
        // Fallback to hardcoded authorities if API fails
        const fallbackAuthorities = [
          { id: 'mcgm', name: 'MCGM', fullName: 'Municipal Corporation of Greater Mumbai' },
          { id: 'nmmc', name: 'NMMC', fullName: 'Navi Mumbai Municipal Corporation' },
          { id: 'mbmc', name: 'MBMC', fullName: 'Mira-Bhayandar Municipal Corporation' },
          { id: 'kdmc', name: 'KDMC', fullName: 'Kalyan Dombivli Municipal Corporation' },
          { id: 'midc', name: 'MIDC', fullName: 'Maharashtra Industrial Development Corporation' }
        ]
        setAuthorities(fallbackAuthorities)
      }
    } catch (error) {
      console.error('Error fetching authorities:', error)
      // Fallback to hardcoded authorities if API fails
      const fallbackAuthorities = [
        { id: 'mcgm', name: 'MCGM', fullName: 'Municipal Corporation of Greater Mumbai' },
        { id: 'nmmc', name: 'NMMC', fullName: 'Navi Mumbai Municipal Corporation' },
        { id: 'mbmc', name: 'MBMC', fullName: 'Mira-Bhayandar Municipal Corporation' },
        { id: 'kdmc', name: 'KDMC', fullName: 'Kalyan Dombivli Municipal Corporation' },
        { id: 'midc', name: 'MIDC', fullName: 'Maharashtra Industrial Development Corporation' }
      ]
      setAuthorities(fallbackAuthorities)
    }
  }

  const fetchDnNumbers = async () => {
    try {
      console.log('Fetching DN numbers from:', process.env.NEXT_PUBLIC_BACKEND_URL + '/api/client-parser-v2/dn-numbers')
      const response = await fetch(process.env.NEXT_PUBLIC_BACKEND_URL + '/api/client-parser-v2/dn-numbers')
      console.log('Response status:', response.status)
      
      if (response.ok) {
        const data = await response.json()
        console.log('DN numbers data:', data)
        setDnNumbers(data.dn_numbers || [])
      } else {
        console.error('Failed to fetch DN numbers, status:', response.status)
        setDnNumbers([])
      }
    } catch (error) {
      console.error('Error fetching DN numbers:', error)
      setDnNumbers([])
    }
  }

  const getAuthorityFullName = (auth: string): string => {
    const fullNames: Record<string, string> = {
      'MCGM': 'Municipal Corporation of Greater Mumbai',
      'NMMC': 'Navi Mumbai Municipal Corporation',
      'MBMC': 'Mira-Bhayandar Municipal Corporation',
      'KDMC': 'Kalyan Dombivli Municipal Corporation',
      'MIDC': 'Maharashtra Industrial Development Corporation'
    }
    return fullNames[auth] || auth
  }

  const validateDnNumber = async () => {
    if (!dnNumber.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a DN number",
        variant: "destructive"
      })
      return
    }

    setIsValidating(true)
    setError(null)
    setDnExists(null)

    try {
      const formData = new FormData()
      formData.append('dn_number', dnNumber.trim())

      const response = await fetch(process.env.NEXT_PUBLIC_BACKEND_URL + '/api/client-parser-v2/validate-dn', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        setDnExists(data.exists)
        
        if (data.exists) {
          toast({
            title: "DN Number Valid",
            description: "DN number found in database",
            variant: "default"
          })
        } else {
          toast({
            title: "DN Number Not Found",
            description: "DN number not found in database. You can still proceed with hardcoded values.",
            variant: "destructive"
          })
        }
      } else {
        throw new Error('Failed to validate DN number')
      }
    } catch (error) {
      setError('Failed to validate DN number')
      toast({
        title: "Validation Error",
        description: "Failed to validate DN number",
        variant: "destructive"
      })
    } finally {
      setIsValidating(false)
    }
  }

  const parseData = async () => {
    if (!dnNumber.trim() || !selectedAuthority) {
      toast({
        title: "Missing Information",
        description: "Please enter both DN number and select an authority",
        variant: "destructive"
      })
      return
    }

    setIsLoading(true)
    setError(null)
    setParsedData(null)

    try {
      const formData = new FormData()
      formData.append('dn_number', dnNumber.trim())
      formData.append('authority', selectedAuthority)
      formData.append('output_type', 'both')

      const response = await fetch(process.env.NEXT_PUBLIC_BACKEND_URL + '/api/client-parser-v2/unified', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        setParsedData(data)
        toast({
          title: "Parsing Complete",
          description: "Data parsed successfully using database queries and hardcoded values",
          variant: "default"
        })
      } else {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to parse data')
      }
    } catch (error: any) {
      setError(error.message || 'Failed to parse data')
      toast({
        title: "Parsing Error",
        description: error.message || "Failed to parse data",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const exportToExcel = async (type?: 'non_refundable' | 'sd' | 'both') => {
    if (!parsedData) return

    // Use the exact same approach as AuthorityUploadCard
    const downloadExcelFromBackend = async (rows: any[], type: 'non_refundable' | 'sd') => {
      if (!rows || rows.length === 0) {
        toast({
          title: "No Data",
          description: "No data to download.",
          variant: "destructive"
        })
        return
      }
      
      const endpoint = type === 'non_refundable'
        ? process.env.NEXT_PUBLIC_BACKEND_URL + '/api/excel/non_refundable'
        : process.env.NEXT_PUBLIC_BACKEND_URL + '/api/excel/sd'
        
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows }),
        })
        
        if (!response.ok) {
          const err = await response.text()
          toast({
            title: "Export Failed",
            description: 'Failed to generate Excel: ' + err,
            variant: "destructive"
          })
          return
        }
        
        const blob = await response.blob()
        
        // Try to get filename from Content-Disposition
        let filename = 'output.xlsx'
        const disposition = response.headers.get('Content-Disposition') || response.headers.get('content-disposition')
        if (disposition) {
          const match = disposition.match(/filename="?([^";]+)"?/)
          if (match) filename = match[1]
        }
        
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        a.remove()
        window.URL.revokeObjectURL(url)
        
        toast({
          title: "Export Complete",
          description: `${type === 'non_refundable' ? 'Non-Refundable' : 'SD'} data exported to Excel successfully`,
          variant: "default"
        })
      } catch (err) {
        toast({
          title: "Export Failed",
          description: 'Failed to download Excel: ' + err,
          variant: "destructive"
        })
      }
    }

    // Call the backend API for proper formatting
    if (type === 'non_refundable' || type === 'both') {
      if (parsedData.non_refundable) {
        await downloadExcelFromBackend([parsedData.non_refundable], 'non_refundable')
      }
    }

    if (type === 'sd' || type === 'both') {
      if (parsedData.sd) {
        await downloadExcelFromBackend([parsedData.sd], 'sd')
      }
    }
  }

  return (
    <div className="space-y-6 px-6 py-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-[#232f47] rounded-lg">
          <Database className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Client Parser V2</h1>
          <p className="text-gray-400">Database-driven parsing without PDF uploads</p>
        </div>
        <Badge variant="secondary" className="ml-auto">
          <Database className="h-4 w-4 mr-1" />
          No PDF Required
        </Badge>
      </div>

      {/* Main Input Section */}
      <Card className="bg-[#1d2636] border-[#232f47] shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-white flex items-center gap-2 text-xl">
            <FileText className="h-6 w-6 text-blue-400" />
            Parse by DN Number
          </CardTitle>
          <CardDescription className="text-gray-400 text-sm leading-relaxed">
            Enter a DN number and select an authority to generate non-refundable and SD outputs using database queries and hardcoded values.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* DN Number Dropdown */}
          <div className="space-y-2">
            <Label htmlFor="dn-number" className="text-white">Demand Note Number</Label>
            <div className="flex gap-2">
              <Popover open={openDnDropdown} onOpenChange={setOpenDnDropdown}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openDnDropdown}
                    className="w-full justify-between bg-[#232f47] border-[#232f47] text-white hover:bg-[#232f47]/80 focus:ring-2 focus:ring-blue-500"
                  >
                    {dnNumber || "Select DN number..."}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-[400px] p-0 bg-[#1d2636] border-[#232f47] shadow-xl" 
                  align="start"
                  side="bottom"
                  sideOffset={4}
                >
                  <Command className="bg-[#1d2636]">
                    <CommandInput 
                      placeholder="Search DN numbers..." 
                      className="text-white border-b border-[#232f47] bg-[#1d2636] focus:ring-0"
                    />
                    <CommandList className="max-h-[200px]">
                      <CommandEmpty className="text-gray-400 py-4">No DN number found.</CommandEmpty>
                      <CommandGroup>
                        {dnNumbers.slice(0, 50).map((dn) => (
                          <CommandItem
                            key={dn}
                            value={dn}
                            onSelect={(currentValue) => {
                              setDnNumber(currentValue === dnNumber ? "" : currentValue)
                              setOpenDnDropdown(false)
                            }}
                            className="text-white hover:bg-[#232f47] cursor-pointer data-[selected=true]:bg-[#232f47] data-[selected=true]:text-white"
                          >
                            {dn}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Button
                onClick={validateDnNumber}
                disabled={isValidating || !dnNumber.trim()}
                variant="outline"
                className="border-[#232f47] text-white hover:bg-[#232f47] focus:ring-2 focus:ring-blue-500"
              >
                {isValidating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="text-sm">Validate</span>
                )}
              </Button>
            </div>
            
            {/* DN Validation Status */}
            {dnExists !== null && (
              <Alert className={`mt-2 ${dnExists ? 'bg-green-900/20 border-green-500' : 'bg-yellow-900/20 border-yellow-500'}`}>
                <AlertCircle className={`h-4 w-4 ${dnExists ? 'text-green-400' : 'text-yellow-400'}`} />
                <AlertDescription className={dnExists ? 'text-green-400' : 'text-yellow-400'}>
                  {dnExists 
                    ? 'DN number found in database - will use database values' 
                    : 'DN number not found - will use hardcoded values only'
                  }
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Authority Selection */}
          <div className="space-y-2">
            <Label htmlFor="authority" className="text-white">Authority</Label>
            <Select value={selectedAuthority} onValueChange={setSelectedAuthority}>
              <SelectTrigger className="bg-[#232f47] border-[#232f47] text-white focus:ring-2 focus:ring-blue-500">
                <SelectValue placeholder="Select an authority" />
              </SelectTrigger>
              <SelectContent className="bg-[#1d2636] border-[#232f47] shadow-xl">
                {authorities.map((auth) => (
                  <SelectItem 
                    key={auth.id} 
                    value={auth.id} 
                    className="text-white hover:bg-[#232f47] focus:bg-[#232f47] focus:text-white data-[selected=true]:bg-[#232f47] data-[selected=true]:text-white"
                  >
                    {auth.name} - {auth.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Parse Button */}
          <Button
            onClick={parseData}
            disabled={isLoading || !dnNumber.trim() || !selectedAuthority}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 text-base shadow-lg transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#1d2636]"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                Parsing Data...
              </>
            ) : (
              <>
                <Database className="h-5 w-5 mr-3" />
                Parse Data
              </>
            )}
          </Button>

          {/* Error Display */}
          {error && (
            <Alert className="bg-red-900/20 border-red-500">
              <XCircle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-400">{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Results Section */}
      {parsedData && (
        <div className="space-y-6">
            {/* Non-Refundable Data */}
            {parsedData.non_refundable && (
              <div>
                <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                  <Database className="h-6 w-6 text-blue-400" />
                  Non-Refundable Output
                </h3>
                <div className="bg-[#232f47] rounded-lg p-4 border border-[#232f47] shadow-inner">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-[#1d2636]">
                        <tr>
                          <th className="text-left p-2 text-white font-semibold border-b border-[#232f47]">Field Name</th>
                          <th className="text-left p-2 text-white font-semibold border-b border-[#232f47]">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(parsedData.non_refundable).map(([key, value], index) => (
                          <tr key={index} className="hover:bg-[#1d2636]/50 border-b border-[#232f47]/30">
                            <td className="p-2 text-gray-300 font-medium align-top w-1/2">
                              {key}
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={value || ""}
                                onChange={(e) => {
                                  const updatedData = { ...parsedData.non_refundable };
                                  updatedData[key] = e.target.value;
                                  setParsedData({
                                    ...parsedData,
                                    non_refundable: updatedData
                                  });
                                }}
                                className="w-full bg-[#1d2636] border border-[#232f47] rounded px-2 py-1 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Enter value..."
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="mt-3 flex justify-start">
                  <Button
                    onClick={() => exportToExcel('non_refundable')}
                    className="h-9 bg-white hover:bg-gray-100 text-[#1d2636] font-inter font-semibold tracking-tight text-[13px] rounded-md border border-[#232f47] flex items-center gap-2 shadow-sm px-4 transition-colors"
                  >
                    <Sparkles className="text-black text-sm" />
                    Download Non-Refundable Excel
                  </Button>
                </div>
              </div>
            )}

            {/* SD Data */}
            {parsedData.sd && (
              <div>
                <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                  <FileText className="h-6 w-6 text-green-400" />
                  SD Output
                </h3>
                <div className="bg-[#232f47] rounded-lg p-4 border border-[#232f47] shadow-inner">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-[#1d2636]">
                        <tr>
                          <th className="text-left p-2 text-white font-semibold border-b border-[#232f47]">Field Name</th>
                          <th className="text-left p-2 text-white font-semibold border-b border-[#232f47]">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(parsedData.sd).map(([key, value], index) => (
                          <tr key={index} className="hover:bg-[#1d2636]/50 border-b border-[#232f47]/30">
                            <td className="p-2 text-gray-300 font-medium align-top w-1/2">
                              {key}
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={value || ""}
                                onChange={(e) => {
                                  const updatedData = { ...parsedData.sd };
                                  updatedData[key] = e.target.value;
                                  setParsedData({
                                    ...parsedData,
                                    sd: updatedData
                                  });
                                }}
                                className="w-full bg-[#1d2636] border border-[#232f47] rounded px-2 py-1 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Enter value..."
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="mt-3 flex justify-start">
                  <Button
                    onClick={() => exportToExcel('sd')}
                    className="h-9 bg-white hover:bg-gray-100 text-[#1d2636] font-inter font-semibold tracking-tight text-[13px] rounded-md border border-[#232f47] flex items-center gap-2 shadow-sm px-4 transition-colors"
                  >
                    <Sparkles className="text-black text-sm" />
                    Download SD Excel
                  </Button>
                </div>
              </div>
            )}

            {/* Summary Table */}
            {parsedData.non_refundable && (
              <div>
                <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                  <Database className="h-6 w-6 text-purple-400" />
                  Summary Table
                </h3>
                <div className="bg-[#232f47] rounded-lg p-4 border border-[#232f47] shadow-inner">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[#1d2636]">
                        <tr>
                          <th className="text-left p-2 text-white font-semibold border-b border-[#232f47]">Demand Note Reference number</th>
                          <th className="text-left p-2 text-white font-semibold border-b border-[#232f47]">Section Length (Mtr.)</th>
                          <th className="text-left p-2 text-white font-semibold border-b border-[#232f47]">EXECUTION PARTNER NAME</th>
                          <th className="text-left p-2 text-white font-semibold border-b border-[#232f47]">Route Name(As per CWIP)</th>
                          <th className="text-left p-2 text-white font-semibold border-b border-[#232f47]">Section Name for ROW(As per CWIP)</th>
                          <th className="text-left p-2 text-white font-semibold border-b border-[#232f47]">Project Name</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="hover:bg-[#1d2636]/50 border-b border-[#232f47]/30">
                          <td className="p-2 text-white">
                            {parsedData.non_refundable["Demand Note Reference number"] || ""}
                          </td>
                          <td className="p-2 text-white">
                            {parsedData.non_refundable["Section Length (Mtr.)"] || ""}
                          </td>
                          <td className="p-2 text-white">
                            {parsedData.non_refundable["EXECUTION PARTNER NAME"] || ""}
                          </td>
                          <td className="p-2 text-white">
                            {parsedData.non_refundable["Route Name(As per CWIP)"] || ""}
                          </td>
                          <td className="p-2 text-white">
                            {parsedData.non_refundable["Section Name for ROW(As per CWIP)"] || ""}
                          </td>
                          <td className="p-2 text-white">
                            {parsedData.non_refundable["project_name"] || ""}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="mt-3 flex justify-start">
                  <Button
                    className="h-9 bg-white hover:bg-gray-100 text-[#1d2636] font-inter font-semibold tracking-tight text-[13px] rounded-md border border-[#232f47] flex items-center gap-2 shadow-sm px-4 transition-colors"
                    onClick={() => setShowEmailModal(true)}
                  >
                    <FiMail className="text-black text-sm" />
                    Generate Email Draft
                  </Button>
                </div>
              </div>
            )}

            {/* Email Draft Modal */}
            <GenerateEmailDraftModal
              open={showEmailModal}
              onClose={() => setShowEmailModal(false)}
              defaultSubject={(() => {
                if (!parsedData?.non_refundable) return "";
                return `Request Payment for Demand Note: ${parsedData.non_refundable["Demand Note Reference number"] || ""}`;
              })()}
              defaultBody={(() => {
                if (!parsedData?.non_refundable) return "";
                return `Hello, I hope you're doing well. I'm writing to request payment for Demand Note: ${parsedData.non_refundable["Demand Note Reference number"] || ""} from ${selectedAuthority.toUpperCase()}.`;
              })()}
                            summaryRow={parsedData?.non_refundable || {}}
            />
        </div>
      )}


    </div>
  )
} 