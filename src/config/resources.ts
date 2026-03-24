export interface ResourceItem {
  title: string
  url: string
  description?: string
}

export interface ResourceCategory {
  category: string
  items: ResourceItem[]
}

export const resources: ResourceCategory[] = [
  {
    category: 'Brokers',
    items: [
      { title: 'Zerodha', url: 'https://zerodha.com', description: 'Primary broker for equities & F&O' },
    ],
  },
  {
    category: 'Charting & Analysis',
    items: [
      { title: 'TradingView', url: 'https://tradingview.com', description: 'Charts and technical analysis' },
    ],
  },
  {
    category: 'Learning',
    items: [
      { title: 'Varsity by Zerodha', url: 'https://zerodha.com/varsity', description: 'Free trading education' },
    ],
  },
]
