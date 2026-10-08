import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import '../api/api_client.dart';

const _channel = MethodChannel('com.omnedu.omnedu/notices');

/// Gives iOS a copy of the session so it can show a notice after the app
/// leaves the screen. A free Apple team cannot sign remote push.
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
