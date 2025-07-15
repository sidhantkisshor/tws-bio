import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function OverviewPage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }

  // Redirect to main dashboard
  redirect('/dashboard');
}