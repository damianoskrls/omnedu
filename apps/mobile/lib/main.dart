import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app.dart';
import 'core/notifications/phone_push.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (PhonePushConfig.ready) {
    FirebaseMessaging.onBackgroundMessage(firebaseBackgroundHandler);
  }
  runApp(const ProviderScope(child: OmneduApp()));
}
