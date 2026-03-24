export interface BioLink {
  label: string
  url: string
  icon: string
}

export const bio = {
  name: 'Sidhant',
  handle: '@tradingwithsidhant',
  tagline: 'Trading, markets & options',
  avatar: '/avatar.jpg',
  links: [
    { label: 'YouTube', url: 'https://youtube.com/@tradingwithsidhant', icon: 'youtube' },
    { label: 'Instagram', url: 'https://instagram.com/tradingwithsidhant', icon: 'instagram' },
    { label: 'Telegram', url: 'https://t.me/tradingwithsidhant', icon: 'telegram' },
    { label: 'X / Twitter', url: 'https://x.com/tradingwithsidhant', icon: 'twitter' },
    { label: 'Resources', url: '/resources', icon: 'bookmark' },
  ] satisfies BioLink[],
}
