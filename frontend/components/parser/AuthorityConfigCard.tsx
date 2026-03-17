import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import type { AuthorityConfig } from "@/types"

interface AuthorityConfigCardProps {
  authority: AuthorityConfig
}

export function AuthorityConfigCard({ authority }: AuthorityConfigCardProps) {
  return (
    <Card className="border border-gray-800 bg-gray-900">
      <CardHeader>
        <CardTitle className="text-white">Parser Configuration</CardTitle>
        <CardDescription className="text-gray-400">AI model optimized for {authority.name}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label className="text-sm font-medium text-white mb-3 block">Extracted Fields</Label>
          <div className="flex flex-wrap gap-2">
            {authority.fields.map((field, index) => (
              <Badge key={index} variant="outline" className="border-gray-700 text-gray-300 bg-gray-800">
                {field}
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-sm font-medium text-white mb-3 block">Processing Pipeline</Label>
          <div className="space-y-3">
            {authority.processingSteps.map((step, index) => (
              <div key={index} className="flex items-center gap-3 text-sm text-gray-300">
                <div className="w-2 h-2 rounded-full bg-cyan-500" />
                {step}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
