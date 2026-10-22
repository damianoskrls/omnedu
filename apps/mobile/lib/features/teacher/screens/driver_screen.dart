import 'package:flutter/material.dart';

import '../../driver/driver_dashboard_screen.dart';
export '../../driver/driver_dashboard_screen.dart' show DriverMessagesScreen;

class DriverScreen extends StatelessWidget {
  final String schoolId;
  const DriverScreen({super.key, required this.schoolId});

  @override
  Widget build(BuildContext context) => DriverDashboardScreen(schoolId: schoolId);
}
