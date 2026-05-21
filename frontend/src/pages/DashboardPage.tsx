import { Shield, AlertTriangle, Map, Users, TrendingUp, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STAT_CARDS = [
  { title: "Total Field Reports", value: "124", change: "+12 this week", icon: Shield, color: "text-primary" },
  { title: "Active Rangers", value: "8", change: "2 on patrol now", icon: Users, color: "text-primary" },
  { title: "Patrol Coverage", value: "73%", change: "+5% vs last week", icon: Map, color: "text-spot-green" },
  { title: "Open Incidents", value: "12", change: "3 high severity", icon: AlertTriangle, color: "text-spot-orange" },
];

const RECENT_REPORTS = [
  { id: "RPT-041", ranger: "ranger1", type: "Incident", severity: "High", location: "Zone A-3", time: "2h ago" },
  { id: "RPT-040", ranger: "ranger2", type: "Sighting", severity: null, location: "Zone B-1", time: "4h ago" },
  { id: "RPT-039", ranger: "ranger1", type: "Incident", severity: "Medium", location: "Zone C-2", time: "6h ago" },
  { id: "RPT-038", ranger: "ranger3", type: "Sighting", severity: null, location: "Zone A-1", time: "8h ago" },
  { id: "RPT-037", ranger: "ranger2", type: "Incident", severity: "Low", location: "Zone D-4", time: "1d ago" },
];

const RISK_ZONES = [
  { zone: "Zone A-3", risk: 87, level: "Critical" },
  { zone: "Zone C-2", risk: 64, level: "High" },
  { zone: "Zone B-4", risk: 51, level: "Medium" },
  { zone: "Zone D-1", risk: 38, level: "Medium" },
  { zone: "Zone A-1", risk: 22, level: "Low" },
];

const REPORT_TRENDS = [
  { day: "Mon", count: 8 },
  { day: "Tue", count: 14 },
  { day: "Wed", count: 11 },
  { day: "Thu", count: 19 },
  { day: "Fri", count: 16 },
  { day: "Sat", count: 9 },
  { day: "Sun", count: 12 },
];

const MODEL_METRICS = [
  { label: "Precision", value: 78 },
  { label: "Recall", value: 71 },
  { label: "F1 Score", value: 74 },
  { label: "AUC-ROC", value: 82 },
];

function severityBadge(severity: string | null) {
  if (!severity) return <Badge variant="outline">Sighting</Badge>;
  if (severity === "High") return <Badge className="bg-spot-red/10 text-spot-red border-spot-red/20">{severity}</Badge>;
  if (severity === "Medium") return <Badge className="bg-spot-orange/10 text-spot-orange border-spot-orange/20">{severity}</Badge>;
  return <Badge className="bg-spot-green/10 text-spot-green border-spot-green/20">{severity}</Badge>;
}

function riskColor(level: string) {
  if (level === "Critical") return "bg-spot-red";
  if (level === "High") return "bg-spot-orange";
  if (level === "Medium") return "bg-amber-400";
  return "bg-spot-green";
}

const maxTrend = Math.max(...REPORT_TRENDS.map((d) => d.count));

export default function DashboardPage() {
  return (
    <div className="max-w-7xl mx-auto p-6 md:p-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-primary">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Here's what's happening on the reserve.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {STAT_CARDS.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} strokeWidth={2} />
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${card.color}`}>{card.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{card.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Field Reports */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-primary flex items-center gap-2">
              <Activity className="h-4 w-4" strokeWidth={2} />
              Recent Field Reports
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Ranger</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {RECENT_REPORTS.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{r.id}</TableCell>
                    <TableCell className="font-medium">{r.ranger}</TableCell>
                    <TableCell>{severityBadge(r.severity)}</TableCell>
                    <TableCell className="text-sm">{r.location}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.time}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Risk Zone Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-primary flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" strokeWidth={2} />
              Risk Zone Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {RISK_ZONES.map((z) => (
              <div key={z.zone}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{z.zone}</span>
                  <span className={`text-xs font-semibold ${z.level === "Critical" ? "text-spot-red" : z.level === "High" ? "text-spot-orange" : z.level === "Medium" ? "text-amber-500" : "text-spot-green"}`}>
                    {z.level}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${riskColor(z.level)}`}
                    style={{ width: `${z.risk}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Report Trends */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-primary flex items-center gap-2">
              <TrendingUp className="h-4 w-4" strokeWidth={2} />
              Report Trends (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-32">
              {REPORT_TRENDS.map((d) => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-muted-foreground">{d.count}</span>
                  <div
                    className="w-full rounded-t bg-primary/70"
                    style={{ height: `${(d.count / maxTrend) * 96}px` }}
                  />
                  <span className="text-xs text-muted-foreground">{d.day}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Model Performance */}
        <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold text-primary flex items-center gap-2">
                <Activity className="h-4 w-4" strokeWidth={2} />
                Model Performance
                <Badge variant="outline" className="ml-auto text-xs font-normal">Indicative only</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {MODEL_METRICS.map((m) => (
                <div key={m.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">{m.label}</span>
                    <span className="font-medium">{m.value}%</span>
                  </div>
                  <Progress value={m.value} className="h-2" />
                </div>
              ))}
              <p className="text-xs text-muted-foreground pt-1">
                Metrics are computed on the last validated dataset upload. Do not interpret these as guarantees of field accuracy.
              </p>
            </CardContent>
          </Card>
      </div>
    </div>
  );
}
