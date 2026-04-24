import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ force_dashboard?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();

  if (params.force_dashboard !== '1') {
    const onboardingComplete = cookieStore.get('onboarding_complete')?.value === 'true';

    if (!onboardingComplete) {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: profile, error } = await supabase
          .from('user_profiles')
          .select('onboarding_completed')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          console.error('[dashboard] Profile fetch error:', error);
        }

        if (profile?.onboarding_completed) {
          // DB says done - proceed
          console.log('[dashboard] DB says done, allowing entry');
        } else {
          redirect('/avatar-select');
        }
      } else {
        redirect('/login');
      }
    }
  }

  return <div>Dashboard</div>;
}
