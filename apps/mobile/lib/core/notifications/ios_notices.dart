import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import '../api/api_client.dart';

const _channel = MethodChannel('com.omnedu.omnedu/notices');

/// Gives iOS a copy of the session so a notice can still appear after the app
/// leaves the screen, until a remote push arrives.
Future<void> publishIosNoticeSession({
  required String access,
  required String refresh,
  required String schoolId,
  required String role,
}) async {
  if (kIsWeb || !Platform.isIOS || access.isEmpty || refresh.isEmpty || schoolId.isEmpty) return;
  try {
    await _channel.invokeMethod('session', {
      'access': access,
      'refresh': refresh,
      'schoolId': schoolId,
      'role': role,
      'api': productionApiUrl,
    });
  } catch (_) {}
}

Future<void> clearIosNoticeSession() async {
  if (kIsWeb || !Platform.isIOS) return;
  try {
    await _channel.invokeMethod('clear');
  } catch (_) {}
}

Future<void> checkIosNotices() async {
  if (kIsWeb || !Platform.isIOS) return;
  try {
    await _channel.invokeMethod('check');
  } catch (_) {}
}

/// Asks iOS to (re)register for APNs so FCM tokens work when the app is closed.
Future<void> registerIosRemoteNotifications() async {
  if (kIsWeb || !Platform.isIOS) return;
  try {
    await _channel.invokeMethod('registerPush');
  } catch (_) {}
}

/// After Firebase.initializeApp, flush any APNs token held by AppDelegate into FIRMessaging.
Future<void> flushIosApnsTokenToFirebase() async {
  if (kIsWeb || !Platform.isIOS) return;
  try {
    await _channel.invokeMethod('flushApnsToken');
  } catch (_) {}
}
