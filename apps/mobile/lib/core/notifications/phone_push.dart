import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/widgets.dart';

/// Public Firebase app values. Closed-app notifications stay off until these
/// match the school's Firebase Android app.
class PhonePushConfig {
  static const projectId = 'omnedu';
  static const apiKey = 'AIzaSyDvo-iDhEqne6Eo5DPZO1AjbjggSzhkzCw';
  static const appId = '1:668958037429:android:57a1f64fb0a64b698335fc';
  static const messagingSenderId = '668958037429';

  static bool get ready =>
      projectId.isNotEmpty && apiKey.isNotEmpty && appId.isNotEmpty && messagingSenderId.isNotEmpty;

  static const options = FirebaseOptions(
    apiKey: apiKey,
    appId: appId,
    messagingSenderId: messagingSenderId,
    projectId: projectId,
    storageBucket: 'omnedu.firebasestorage.app',
  );
}

@pragma('vm:entry-point')
Future<void> firebaseBackgroundHandler(RemoteMessage message) async {
  if (!PhonePushConfig.ready) return;
  if (Firebase.apps.isEmpty) {
    await Firebase.initializeApp(options: PhonePushConfig.options);
  }
}

/// Registers this phone with Firebase so a message, bulletin, payment or
/// admin notice can appear even when the app is closed.
Future<void> startPhonePush({
  required Future<void> Function(String token) onToken,
  required void Function(Map<String, dynamic> data) onOpened,
}) async {
  if (!PhonePushConfig.ready) return;
  if (Firebase.apps.isEmpty) {
    await Firebase.initializeApp(options: PhonePushConfig.options);
  }
  FirebaseMessaging.onBackgroundMessage(firebaseBackgroundHandler);
  await FirebaseMessaging.instance.requestPermission(alert: true, badge: true, sound: true);
  FirebaseMessaging.onMessageOpenedApp.listen((message) => onOpened(message.data));
  final initial = await FirebaseMessaging.instance.getInitialMessage();
  if (initial != null) {
    WidgetsBinding.instance.addPostFrameCallback((_) => onOpened(initial.data));
  }
  final token = await FirebaseMessaging.instance.getToken();
  if (token != null && token.isNotEmpty) await onToken(token);
  FirebaseMessaging.instance.onTokenRefresh.listen(onToken);
}
