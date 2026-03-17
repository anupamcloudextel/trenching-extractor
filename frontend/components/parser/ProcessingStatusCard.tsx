import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Loader2 } from "lucide-react"
import type { AuthorityConfig } from "@/types"

interface ProcessingStatusCardProps {
  authority: AuthorityConfig
  status: string
  progress: number
}

export function ProcessingStatusCard({ authority, status, progress }: ProcessingStatusCardProps) {
  return (
    <Card className="border border-[#232f47] bg-[#181e29]">
      <CardHeader className="pb-2">
        <CardTitle className="text-2xl font-semibold text-white font-inter">
          {authority.name} Municipality DN Extraction
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex justify-between text-sm text-gray-300">
            <span>{status}</span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="w-full h-2 bg-[#232f47]" />
        </div>
      </CardContent>
    </Card>
  )
}
