import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ force_dashboard?: string }>;
}) {
  const params = await searchParams;

  if (params.force_dashboard !== '1') {
    const cookieStore = await cookies();
    const onboardingComplete = cookieStore.get('onboarding_complete')?.value;

    if (onboardingComplete !== 'true') {
      // Last resort: check Supabase directly in case cookie is missing
      const supabase = createServerComponentClient({ cookies });
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', user.id)
          .single();

        if (profile?.onboarding_completed) {
          // DB says done but cookie is missing — proceed and let client fix cookie
          console.log('[dashboard] DB says done, cookie missing — allowing entry');
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