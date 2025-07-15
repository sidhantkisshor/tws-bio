import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import LinkInterstitialClient from '@/app/link/[shortCode]/client'

type Props = {
  params: Promise<{ shortCode: string }>
}

export default async function LinkPage({ params }: Props) {
  const supabase = await createClient()
  const { shortCode } = await params

  const { data: link } = await supabase
    .from('links')
    .select('original_url, ios_deep_link, android_deep_link, fallback_url, title, description')
    .eq('short_code', shortCode)
    .single()

  if (!link) {
    notFound()
  }

  // We only show this page for deeplinks. Regular links are handled by the route handler.
  if (!link.ios_deep_link && !link.android_deep_link) {
    notFound();
  }

  return <LinkInterstitialClient link={link} />
} 