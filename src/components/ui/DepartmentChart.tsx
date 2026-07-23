"use client";

import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export interface DeptAnalyticsData {
  name: string;
  hadir: number;
  terlambat?: number;
  totalStaf?: number;
  color: string;
}

interface DepartmentChartProps {
  data: DeptAnalyticsData[];
  height?: number;
}

export function DepartmentChart({ data, height = 256 }: DepartmentChartProps) {
  return (
    <div className="w-full mt-4" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
          <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
          <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
            contentStyle={{ 
              backgroundColor: '#020617', 
              borderColor: '#334155', 
              borderRadius: '12px', 
              fontSize: '12px', 
              color: '#f8fafc',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.7)'
            }}
            itemStyle={{ color: '#fbbf24', fontWeight: 600 }}
            labelStyle={{ color: '#f8fafc', fontWeight: 700, marginBottom: '2px' }}
            formatter={(value: any) => [`${value}% Kehadiran`, 'Kehadiran']}
          />
          <Bar dataKey="hadir" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
