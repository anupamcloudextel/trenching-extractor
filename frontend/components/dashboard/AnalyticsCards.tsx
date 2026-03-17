import { Card, CardContent } from "@/components/ui/card"
import { Activity, Database, Zap } from "lucide-react"
import type { Analytics } from "@/types"

interface AnalyticsCardsProps {
  analytics: Analytics
}

export function AnalyticsCards({ analytics }: AnalyticsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="bg-[#232a3a] border border-slate-700 shadow-lg text-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm font-medium">Total Processed</p>
              <p className="text-3xl font-extrabold text-white mt-1">
                {analytics.totalProcessed.toLocaleString()}
                <span className="block h-1 w-8 bg-orange-500 rounded-full mt-1" />
              </p>
            </div>
            <div className="p-3 bg-orange-900/20 rounded-xl">
              <Database className="h-6 w-6 text-orange-400" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#232a3a] border border-slate-700 shadow-lg text-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm font-medium">Avg Processing</p>
              <p className="text-3xl font-extrabold text-white mt-1">
                {analytics.avgProcessingTime}s
                <span className="block h-1 w-8 bg-orange-500 rounded-full mt-1" />
              </p>
            </div>
            <div className="p-3 bg-orange-900/20 rounded-xl">
              <Zap className="h-6 w-6 text-orange-400" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#232a3a] border border-slate-700 shadow-lg text-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm font-medium">Active Authorities</p>
              <p className="text-3xl font-extrabold text-white mt-1">
                {analytics.activeAuthorities}
                <span className="block h-1 w-8 bg-orange-500 rounded-full mt-1" />
              </p>
            </div>
            <div className="p-3 bg-orange-900/20 rounded-xl">
              <Activity className="h-6 w-6 text-orange-400" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
