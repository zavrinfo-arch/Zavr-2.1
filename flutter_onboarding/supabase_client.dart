import 'package:supabase_flutter/supabase_flutter.dart';

class SupabaseConfig {
  static const String url = 'https://ivdkaccijoeitkrkmrkk.supabase.co';
  
  // Using the publishable key provided by user
  static const String anonKey = 'sb_publishable_BrAX0f6hk_oyaKkbCJH_jA_lzU3pONQ';

  static Future<void> initialize() async {
    await Supabase.initialize(
      url: url,
      anonKey: anonKey,
    );
  }

  static SupabaseClient get client => Supabase.instance.client;
}
