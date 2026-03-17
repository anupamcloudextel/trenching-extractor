import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import React from 'react';

const COLORS_BUDGETED = ["#ff9800", "#00bcd4", "#4caf50"]; // Orange, Blue, Green
const COLORS_ACTUAL = ["#ffb74d", "#4dd0e1", "#81c784"]; // Lighter variants for actuals

// Data format:
// [
//   {
//     SiteID: string,
//     budgeted: { RI: number, Material: number, Service: number },
//     actual: { RI: number, Material: number, Service: number }
//   }, ...
// ]

export default function CostBreakdownStackedBar({ data }: { data: any[] }) {
  return (
    <div className="bg-[#232a3a] rounded-2xl shadow-xl p-6 my-8 backdrop-blur-md">
      <h2 className="text-white text-2xl font-bold mb-4">Budget vs Actual Cost Breakdown per Site</h2>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="SiteID" stroke="#cbd5e1" fontSize={14} />
          <YAxis stroke="#cbd5e1" fontSize={14} />
          <Tooltip
            contentStyle={{ background: "#232a3a", border: "1px solid #374151", borderRadius: 12, color: "#fff" }}
            labelStyle={{ color: "#ff9800" }}
            formatter={(value: number) => value.toLocaleString("en-IN")}
          />
          <Legend wrapperStyle={{ color: "#fff" }} />
          {/* Budgeted stacks */}
          <Bar dataKey="budgeted.RI" stackId="budgeted" fill={COLORS_BUDGETED[0]} name="Budgeted RI" />
          <Bar dataKey="budgeted.Material" stackId="budgeted" fill={COLORS_BUDGETED[1]} name="Budgeted Material" />
          <Bar dataKey="budgeted.Service" stackId="budgeted" fill={COLORS_BUDGETED[2]} name="Budgeted Service" />
          {/* Actual stacks */}
          <Bar dataKey="actual.RI" stackId="actual" fill={COLORS_ACTUAL[0]} name="Actual RI" />
          <Bar dataKey="actual.Material" stackId="actual" fill={COLORS_ACTUAL[1]} name="Actual Material" />
          <Bar dataKey="actual.Service" stackId="actual" fill={COLORS_ACTUAL[2]} name="Actual Service" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
} 