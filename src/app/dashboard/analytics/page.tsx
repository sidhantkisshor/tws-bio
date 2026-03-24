import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function AnalyticsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Analytics</h1>
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Analytics dashboard coming soon.</p>
        </CardContent>
      </Card>
    </div>
  )
}
