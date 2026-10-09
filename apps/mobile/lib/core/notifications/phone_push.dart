import 'dart:async';
import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

/// Public Firebase app values. Android and iPhone each use their own app id.
class PhonePushConfig {
  static const projectId = 'omnedu';
  static const apiKey = 'AIzaSyDvo-iDhEqne6Eo5DPZO1AjbjggSzhkzCw';
  static const iosApiKey = 'AIzaSyBCCweDqjxJ8RyH8yAxb6SE_4LxYQ06Z9g';
  static const appId = '1:668958037429:android:57a1f64fb0a64b698335fc';
  static const iosAppId = '1:668958037429:ios:0d4ae1cf20b67d2d8335fc';
  static const messagingSenderId = '668958037429';

  static bool get _ios => !kIsWeb && Platform.isIOS;

  static bool get ready {
    if (projectId.isEmpty || apiKey.isEmpty || messagingSenderId.isEmpty) return false;
    if (_ios) return iosAppId.isNotEmpty;
    return appId.isNotEmpty;
  }

  static FirebaseOptions get options => FirebaseOptions(
    apiKey: _ios ? iosApiKey : apiKey,
    appId: _ios ? iosAppId : appId,
    messagingSenderId: messagingSenderId,
    projectId: projectId,
    storageBucket: 'omnedu.firebasestorage.app',
  );
}

Future<void> _ensureFirebase() async {
  if (Firebase.apps.isNotEmpty) return;
  try {
    await Firebase.initializeApp(options: PhonePushConfig.options);
  } catch (_) {
    if (Firebase.apps.isEmpty) rethrow;
  }
}

@pragma('vm:entry-point')
Future<void> firebaseBackgroundHandler(RemoteMessage message) async {
  if (!PhonePushConfig.ready) return;
  await _ensureFirebase();
}

bool _phonePushListening = false;
bool _phoneTokenSent = false;
bool _phoneTokenBusy = false;
Timer? _phoneTokenRetry;
Future<void> Function(String token)? _phonePushToken;
void Function(Map<String, dynamic> data)? _phonePushOpened;
void Function(String title, String body, Map<String, dynamic> data)? _phonePushForeground;

/// Registers this phone with Firebase so a message, bulletin, payment or
/// admin notice can appear even when the app is closed.
Future<void> startPhonePush({
  required Future<void> Function(String token) onToken,
  required void Function(Map<String, dynamic> data) onOpened,
  required void Function(String title, String body, Map<String, dynamic> data) onForeground,
}) async {
  if (!PhonePushConfig.ready) return;
  _phonePushToken = onToken;
  _phonePushOpened = onOpened;
  _phonePushForeground = onForeground;
  await _ensureFirebase();
  if (_phonePushListening) {
    unawaited(_publishPhoneToken(onToken));
    return;
  }
  _phonePushListening = true;
  try {
    await FirebaseMessaging.instance.requestPermission(alert: true, badge: true, sound: true);
    if (Platform.isIOS) {
      await FirebaseMessaging.instance.setForegroundNotificationPresentationOptions(alert: true, badge: true, sound: true);
    }
  } catch (_) {}
  FirebaseMessaging.onMessage.listen((message) {
    if (Platform.isIOS && message.notification != null) return;
    final title = message.notification?.title ?? message.data['title']?.toString() ?? 'Ονειροχώρα';
    final body = message.notification?.body ?? message.data['body']?.toString() ?? '';
    if (title.isEmpty && body.isEmpty) return;
    _phonePushForeground?.call(title, body, Map<String, dynamic>.from(message.data));
  });
  FirebaseMessaging.onMessageOpenedApp.listen((message) => _phonePushOpened?.call(message.data));
  try {
    final initial = await FirebaseMessaging.instance.getInitialMessage();
    if (initial != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => onOpened(initial.data));
    }
  } catch (_) {}
  FirebaseMessaging.instance.onTokenRefresh.listen((token) {
    final deliver = _phonePushToken;
    if (deliver != null && token.isNotEmpty) deliver(token);
  });
  unawaited(_publishPhoneToken(onToken));
}

Future<void> refreshPhonePushToken() async {
  final deliver = _phonePushToken;
  if (deliver == null || !PhonePushConfig.ready) return;
  await _publishPhoneToken(deliver);
}

Future<void> _publishPhoneToken(Future<void> Function(String token) onToken) async {
  if (_phoneTokenBusy) return;
  _phoneTokenBusy = true;
  try {
    if (Platform.isIOS) {
      final settings = await FirebaseMessaging.instance.getNotificationSettings();
      if (settings.authorizationStatus == AuthorizationStatus.notDetermined) {
        await FirebaseMessaging.instance.requestPermission(alert: true, badge: true, sound: true);
      }
      for (var attempt = 0; attempt < 12; attempt++) {
        final apns = await FirebaseMessaging.instance.getAPNSToken();
        if (apns != null && apns.isNotEmpty) break;
        await Future<void>.delayed(const Duration(seconds: 1));
      }
    }
    final token = await FirebaseMessaging.instance.getToken();
    if (token != null && token.isNotEmpty) {
      await onToken(token);
      _phoneTokenSent = true;
      _phoneTokenRetry?.cancel();
      _phoneTokenRetry = null;
    }
  } catch (_) {
  } finally {
    _phoneTokenBusy = false;
  }
  if (_phoneTokenSent || !Platform.isIOS || _phoneTokenRetry != null) return;
  var tries = 0;
  _phoneTokenRetry = Timer.periodic(const Duration(seconds: 8), (_) {
    tries += 1;
    if (_phoneTokenSent || tries > 12) {
      _phoneTokenRetry?.cancel();
      _phoneTokenRetry = null;
      return;
    }
    final deliver = _phonePushToken;
    if (deliver != null) unawaited(_publishPhoneToken(deliver));
  });
}
