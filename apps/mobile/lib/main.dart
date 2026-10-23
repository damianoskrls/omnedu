import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'app.dart';
import 'core/notifications/phone_push.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('el', null);
  if (PhonePushConfig.ready) {
    FirebaseMessaging.onBackgroundMessage(firebaseBackgroundHandler);
  }
  runApp(const ProviderScope(child: OmneduApp()));
}
