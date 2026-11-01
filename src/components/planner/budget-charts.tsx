"use client";
/**
 * Budget charts, isolated so recharts (~100 kB gz) loads lazily and never
 * blocks the initial Budget page render. Imported via next/dynamic ssr:false.
 */
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/domain/format";

const CHART_COLORS = ["#9D2C4E", "#A16207", "#1B7A43", "#1D5F8A", "#7C3AED", "#C2313E", "#B45309", "#4D7C0F", "#0E7490", "#9333EA", "#BE185D", "#57534E"];

export default function BudgetCharts({
  pieData,
  categorySpend,
  currency,
}: {
  pieData: { name: string; value: number }[];
  categorySpend: { name: string; budgeted: number; contracted: number }[];
  currency: string;
}) {
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="!pb-0"><CardTitle>Category spending (contracted)</CardTitle></CardHeader>
        <CardContent>
          {pieData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Add expenses to see the breakdown.</p>
          ) : (
            <div className="h-64" role="img" aria-label="Category spending breakdown">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                    {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatMoney(Number(v), currency)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="!pb-0"><CardTitle>Budgeted vs actual by category</CardTitle></CardHeader>
        <CardContent>
          {categorySpend.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Set category budgets to compare.</p>
          ) : (
            <div className="h-64" role="img" aria-label="Budgeted versus actual by category">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categorySpend.filter((c) => c.budgeted > 0 || c.contracted > 0).slice(0, 8)}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} height={50} textAnchor="end" />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v) => formatMoney(Number(v), currency)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="budgeted" name="Budgeted" fill="#D5C8BF" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="contracted" name="Contracted" fill="#9D2C4E" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
