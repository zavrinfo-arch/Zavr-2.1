import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'onboarding_service.dart';
import 'dashboard_screen.dart';
import 'avatar_selection_screen.dart';
import 'supabase_client.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  final _onboardingService = OnboardingService();

  @override
  void initState() {
    super.initState();
    _checkStatus();
  }

  Future<void> _checkStatus() async {
    try {
      // 1. Auth Check
      final session = SupabaseConfig.client.auth.currentSession;
      if (session == null) {
        _navigate('/avatar-selection');
        return;
      }

      // 2. Local Flag Check
      final isLocalDone = await _onboardingService.isLocalComplete();

      // 3. Database Check
      final profile = await SupabaseConfig.client
          .from('user_profiles')
          .select()
          .eq('id', session.user.id)
          .maybeSingle();

      if (isLocalDone && profile != null) {
        _navigate('/dashboard');
      } else {
        _navigate('/avatar-selection');
      }
    } catch (e) {
      debugPrint("SplashScreen Error: $e");
      _navigate('/avatar-selection');
    }
  }

  void _navigate(String route) {
    if (!mounted) return;
    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute(
        builder: (_) => route == '/dashboard' ? const DashboardScreen() : const AvatarSelectionScreen(),
      ),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: CircularProgressIndicator(color: Color(0xFFFF6B6B)),
      ),
    );
  }
}
