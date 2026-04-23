import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter/foundation.dart';

class OnboardingService {
  static const String _onboardingKey = "onboarding_completed";
  static const String _avatarKey = "selected_avatar";

  // Persistent Avatar Selection
  Future<void> saveAvatar(String path) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_avatarKey, path);
    debugPrint("OnboardingService: Avatar saved - $path");
  }

  Future<String?> getSavedAvatar() async {
    final prefs = await SharedPreferences.getInstance();
    final avatar = prefs.getString(_avatarKey);
    debugPrint("OnboardingService: Retrieved saved avatar - $avatar");
    return avatar;
  }

  // Final Onboarding State
  Future<void> markComplete() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_onboardingKey, true);
    debugPrint("OnboardingService: Onboarding marked as COMPLETE in Prefs");
  }

  Future<bool> isLocalComplete() async {
    final prefs = await SharedPreferences.getInstance();
    final isComplete = prefs.getBool(_onboardingKey) ?? false;
    debugPrint("OnboardingService: Local onboarding status checked - $isComplete");
    return isComplete;
  }
  
  Future<void> clearAll() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
  }
}
