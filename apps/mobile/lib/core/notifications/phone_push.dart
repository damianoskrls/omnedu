import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

/// Public Firebase app values. The iPhone uses its own Firebase app id.
/// Until that id is filled in, the iPhone app still runs and the closed-app
/// push stays off.
class PhonePushConfig {
  static const projectId = 'omnedu';
  static const apiKey = 'AIzaSyDvo-iDhEqne6Eo5DPZO1AjbjggSzhkzCw';
  static const appId = '1:668958037429:android:57a1f64fb0a64b698335fc';
  static const iosAppId = '';
  static const messagingSenderId = '668958037429';

  static bool get _ios => !kIsWeb && Platform.isIOS;

  static bool get ready {
    if (projectId.isEmpty || apiKey.isEmpty || messagingSenderId.isEmpty) return false;
    if (_ios) return iosAppId.isNotEmpty;
    return appId.isNotEmpty;
  }

  static FirebaseOptions get options => FirebaseOptions(
    apiKey: apiKey,
    appId: _ios ? iosAppId : appId,
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

bool _phonePushListening = false;
Future<void> Function(String token)? _phonePushToken;
void Function(Map<String, dynamic> data)? _phonePushOpened;
void Function(String title, String body)? _phonePushForeground;

/// Registers this phone with Firebase so a message, bulletin, payment or
/// admin notice can appear even when the app is closed.
Future<void> startPhonePush({
  required Future<void> Function(String token) onToken,
  required void Function(Map<String, dynamic> data) onOpened,
  required void Function(String title, String body) onForeground,
}) async {
  if (!PhonePushConfig.ready) return;
  _phonePushToken = onToken;
  _phonePushOpened = onOpened;
  _phonePushForeground = onForeground;
  if (Firebase.apps.isEmpty) {
    await Firebase.initializeApp(options: PhonePushConfig.options);
  }
  if (_phonePushListening) {
    final token = await FirebaseMessaging.instance.getToken();
    if (token != null && token.isNotEmpty) await onToken(token);
    return;
  }
  _phonePushListening = true;
  FirebaseMessaging.onBackgroundMessage(firebaseBackgroundHandler);
  await FirebaseMessaging.instance.requestPermission(alert: true, badge: true, sound: true);
  FirebaseMessaging.onMessage.listen((message) {
    final title = message.notification?.title ?? message.data['title']?.toString() ?? 'Ονειροχώρα';
    final body = message.notification?.body ?? message.data['body']?.toString() ?? '';
    if (title.isEmpty && body.isEmpty) return;
    _phonePushForeground?.call(title, body);
  });
  FirebaseMessaging.onMessageOpenedApp.listen((message) => _phonePushOpened?.call(message.data));
  final initial = await FirebaseMessaging.instance.getInitialMessage();
  if (initial != null) {
    WidgetsBinding.instance.addPostFrameCallback((_) => onOpened(initial.data));
  }
  final token = await FirebaseMessaging.instance.getToken();
  if (token != null && token.isNotEmpty) await onToken(token);
  FirebaseMessaging.instance.onTokenRefresh.listen((token) {
    final deliver = _phonePushToken;
    if (deliver != null) deliver(token);
  });
}
