import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/widgets/person_face.dart';
import 'day_history.dart';

class ChildDetailScreen extends ConsumerWidget {
  final Map<String, dynamic> child;

  const ChildDetailScreen({super.key, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user!;
    final schoolId = user.schoolId ?? '';
    final name = child['fullName'] as String? ?? '';
    final photo = child['avatarUrl'] as String?;
    final firstName = name.split(' ').first;
    final enrollments = child['enrollments'] as List<dynamic>? ?? [];
    final className = enrollments.isNotEmpty
        ? (enrollments.first['class']?['name'] as String? ?? '')
        : '';

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: const Color(0xFFF6F3FA),
        body: CustomScrollView(
          slivers: [
            SliverAppBar(
              expandedHeight: 200,
              pinned: true,
              backgroundColor: dayHistoryColors[0],
              leading: IconButton(
                icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white),
                onPressed: () => Navigator.of(context).pop(),
              ),
              flexibleSpace: FlexibleSpaceBar(
                background: Container(
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      colors: dayHistoryColors,
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                  child: SafeArea(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const SizedBox(height: 40),
                        PersonFace(
                          name: name,
                          photoUrl: photo,
                          size: 80,
                          radius: 26,
                          fontSize: 36,
                          background: Colors.white.withOpacity(0.25),
                          foreground: Colors.white,
                        ),
                        const SizedBox(height: 10),
                        Text(
                          firstName,
                          style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
                        ),
                        if (className.isNotEmpty)
                          Text(className, style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 13)),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: DayHistoryPanel(schoolId: schoolId, child: child),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 40)),
          ],
        ),
      ),
    );
  }
}
