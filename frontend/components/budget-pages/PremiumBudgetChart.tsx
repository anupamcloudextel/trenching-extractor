"use client"
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from "chart.js"
import { Bar } from "react-chartjs-2"

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface SiteData {
  SiteID: string
  budgeted: {
    RI: number
    Material: number
    Service: number
  }
  actual: {
    RI: number
    Material: number
    Service: number
  }
}

export default function PremiumBudgetChart({ siteData }: { siteData: SiteData }) {
  const totalBudget = siteData.budgeted.RI + siteData.budgeted.Material + siteData.budgeted.Service
  const totalActual = siteData.actual.RI + siteData.actual.Material + siteData.actual.Service
  const variance = totalActual - totalBudget
  const variancePercent = ((variance / totalBudget) * 100).toFixed(1)

  const data = {
    labels: ["Budget", "Actual"],
    datasets: [
      {
        label: "RI Cost",
        data: [siteData.budgeted.RI, siteData.actual.RI],
        backgroundColor: ["#60a5fa", "#60a5fa"],
        borderColor: ["#2563eb", "#2563eb"],
        borderWidth: 0,
        borderRadius: {
          topLeft: 0,
          topRight: 0,
          bottomLeft: 6,
          bottomRight: 6,
        },
      },
      {
        label: "Material Cost",
        data: [siteData.budgeted.Material, siteData.actual.Material],
        backgroundColor: ["#2563eb", "#2563eb"],
        borderColor: ["#2563eb", "#2563eb"],
        borderWidth: 0,
        borderRadius: 0,
      },
      {
        label: "Service Cost",
        data: [siteData.budgeted.Service, siteData.actual.Service],
        backgroundColor: ["#1e3a8a", "#1e3a8a"],
        borderColor: ["#1e3a8a", "#1e3a8a"],
        borderWidth: 0,
        borderRadius: {
          topLeft: 6,
          topRight: 6,
          bottomLeft: 0,
          bottomRight: 0,
        },
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index" as const,
      intersect: false,
    },
    scales: {
      x: {
        stacked: true,
        grid: {
          display: false,
        },
        border: {
          display: false,
        },
        ticks: {
          color: "#94a3b8",
          font: {
            size: 14,
            weight: 500,
          },
        },
        barPercentage: 0.5,
        categoryPercentage: 0.8,
      },
      y: {
        stacked: true,
        grid: {
          color: "#334155",
          drawBorder: false,
        },
        border: {
          display: false,
        },
        ticks: {
          color: "#94a3b8",
          font: {
            size: 12,
          },
          callback: (value: any) => "₹" + (value / 1000).toFixed(0) + "K",
        },
      },
    },
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          color: "#cbd5e1",
          font: {
            size: 13,
            weight: 500,
          },
          padding: 20,
          usePointStyle: true,
          pointStyle: "circle",
        },
      },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        titleColor: "#f1f5f9",
        bodyColor: "#cbd5e1",
        borderColor: "#475569",
        borderWidth: 1,
        cornerRadius: 12,
        padding: 12,
        displayColors: true,
        callbacks: {
          label: (context: any) => context.dataset.label + ": ₹" + context.parsed.y.toLocaleString("en-IN"),
        },
      },
    },
  }

  return (
    <div className="bg-gradient-to-br from-slate-800 via-slate-800 to-slate-900 rounded-2xl p-8 shadow-2xl border border-slate-700/50">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Site {siteData.SiteID} - Cost Analysis</h2>
            <p className="text-slate-400">Budget vs Actual Performance</p>
          </div>
          <div className="text-right">
            <div
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                variance >= 0
                  ? "bg-red-500/20 text-red-300 border border-red-500/30"
                  : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
              }`}
            >
              {variance >= 0 ? "+" : ""}₹{Math.abs(variance).toLocaleString("en-IN")}
              ({variancePercent}%)
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="bg-slate-700/50 rounded-xl p-4 border border-slate-600/50">
            <div className="text-slate-400 text-sm font-medium mb-1">Total Budget</div>
            <div className="text-2xl font-bold text-white">₹{totalBudget.toLocaleString("en-IN")}</div>
          </div>
          <div className="bg-slate-700/50 rounded-xl p-4 border border-slate-600/50">
            <div className="text-slate-400 text-sm font-medium mb-1">Total Actual</div>
            <div className="text-2xl font-bold text-white">₹{totalActual.toLocaleString("en-IN")}</div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-96 mb-6">
        <Bar data={data} options={options} />
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-700/50">
        <div className="text-center">
          <div className="w-4 h-4 bg-slate-400 rounded-full mx-auto mb-2"></div>
          <div className="text-slate-400 text-xs font-medium mb-1">RI COST</div>
          <div className="text-white text-sm font-semibold">₹{siteData.actual.RI.toLocaleString("en-IN")}</div>
        </div>
        <div className="text-center">
          <div className="w-4 h-4 bg-sky-300 rounded-full mx-auto mb-2"></div>
          <div className="text-slate-400 text-xs font-medium mb-1">MATERIAL</div>
          <div className="text-white text-sm font-semibold">₹{siteData.actual.Material.toLocaleString("en-IN")}</div>
        </div>
        <div className="text-center">
          <div className="w-4 h-4 bg-green-300 rounded-full mx-auto mb-2"></div>
          <div className="text-slate-400 text-xs font-medium mb-1">SERVICE</div>
          <div className="text-white text-sm font-semibold">₹{siteData.actual.Service.toLocaleString("en-IN")}</div>
        </div>
      </div>

      <div className="bg-[#1a1d2a] rounded-xl border border-slate-700 p-4 mt-6">
        <div className="text-2xl font-bold text-white mb-4">Budget Table</div>
        <div className="overflow-x-auto">
          <table className="min-w-full rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-[#23273a]">
                <th className="px-4 py-3 text-left text-white font-semibold">Site ID</th>
                <th className="px-4 py-3 text-left text-white font-semibold">Surveyed Length</th>
                <th className="px-4 py-3 text-left text-white font-semibold">RI Cost</th>
                <th className="px-4 py-3 text-left text-white font-semibold">Material Cost</th>
                <th className="px-4 py-3 text-left text-white font-semibold">Service Cost</th>
                <th className="px-4 py-3 text-left text-white font-semibold">Total Cost</th>
                <th className="px-4 py-3 text-left text-white font-semibold">Total Cost/Meter</th>
                <th className="px-4 py-3 text-left text-white font-semibold">Existing/New</th>
              </tr>
            </thead>
            <tbody>
              {/* Map your data rows here, example below: */}
              <tr className="bg-[#181b24]">
                <td className="px-4 py-3 text-white">148</td>
                <td className="px-4 py-3 text-white">67.2</td>
                <td className="px-4 py-3 text-white">1003699.2</td>
                <td className="px-4 py-3 text-white">19958.4</td>
                <td className="px-4 py-3 text-white">81312</td>
                <td className="px-4 py-3 text-white">1104969.6</td>
                <td className="px-4 py-3 text-white">16443.00</td>
                <td className="px-4 py-3 text-white">New</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
} 