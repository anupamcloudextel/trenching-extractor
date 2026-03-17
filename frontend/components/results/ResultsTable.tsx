"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CheckCircle, Download } from "lucide-react"
import type { ExtractedData, AuthorityConfig } from "@/types"

interface ResultsTableProps {
  data: ExtractedData[]
  authorities: AuthorityConfig[]
  onExport: () => void
}

export function ResultsTable({ data, authorities, onExport }: ResultsTableProps) {
  if (data.length === 0) return null

  return (
    <Card className="shadow-lg border border-gray-800 bg-gray-900">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-3 text-white">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              Extraction Results
            </CardTitle>
            <CardDescription className="text-gray-400 mt-2">
              Successfully processed {data.length} demand notes across all authorities
            </CardDescription>
          </div>
          <Button
            onClick={onExport}
            className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 border-0"
          >
            <Download className="h-4 w-4" />
            Export to Excel
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <Table>
            <TableHeader className="bg-gray-800">
              <TableRow className="border-gray-700">
                <TableHead className="text-gray-300 font-medium">Authority</TableHead>
                <TableHead className="text-gray-300 font-medium">Demand Note #</TableHead>
                <TableHead className="text-gray-300 font-medium">Location</TableHead>
                <TableHead className="text-gray-300 font-medium">Type</TableHead>
                <TableHead className="text-gray-300 font-medium">Applicant</TableHead>
                <TableHead className="text-gray-300 font-medium">Cost</TableHead>
                <TableHead className="text-gray-300 font-medium">Status</TableHead>
                <TableHead className="text-gray-300 font-medium">Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.id} className="border-gray-800 hover:bg-gray-800/50">
                  <TableCell>
                    <Badge className={`${authorities.find((a) => a.name === row.authority)?.color} text-white`}>
                      {row.authority}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium text-white">{row.demandNoteNumber}</TableCell>
                  <TableCell className="text-gray-300">{row.projectLocation}</TableCell>
                  <TableCell className="text-gray-300">{row.trenchingType}</TableCell>
                  <TableCell className="text-gray-300">{row.applicantName}</TableCell>
                  <TableCell className="text-gray-300 font-medium">{row.estimatedCost}</TableCell>
                  <TableCell>
                    <Badge
                      variant={row.status === "Approved" ? "default" : "secondary"}
                      className={row.status === "Approved" ? "bg-green-500 text-white" : "bg-orange-500 text-white"}
                    >
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-16 bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-green-500 to-green-400 h-2 rounded-full"
                          style={{ width: `${row.confidence}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-300">{row.confidence.toFixed(1)}%</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
