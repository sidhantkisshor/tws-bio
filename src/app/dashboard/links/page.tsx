import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function LinksPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Links</h1>
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Your Links</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Link management coming soon.</p>
        </CardContent>
      </Card>
    </div>
  )
}
