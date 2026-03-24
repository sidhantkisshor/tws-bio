import { Card, CardContent } from '@/components/ui/card'
import type { ReactNode } from 'react'

interface StatCardProps {
  title: string
  value: string | number
  icon?: ReactNode
}

export function StatCard({ title, value, icon }: StatCardProps) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold font-mono text-foreground mt-1">{value}</p>
          </div>
          {icon && <div className="text-primary">{icon}</div>}
        </div>
      </CardContent>
    </Card>
  )
}
