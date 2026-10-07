import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';

final diaryFeedProvider = FutureProvider.family<List<dynamic>, String>(
  (ref, schoolId) async {
    final dio = ref.read(dioProvider);
    final resp = await dio.get('/schools/$schoolId/daily-reports/feed');
    final data = resp.data;
    return data is List ? data : [];
  },
);

class DiaryFeedScreen extends ConsumerWidget {
  final String schoolId;
  final String parentId;
  const DiaryFeedScreen({super.key, required this.schoolId, required this.parentId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final feedAsync = ref.watch(diaryFeedProvider(schoolId));

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: Colors.white,
        title: const Text('Ημερολόγιο', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
      body: feedAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Σφάλμα: $e')),
        data: (reports) => reports.isEmpty
            ? Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.book_outlined, size: 64, color: Colors.grey[300]),
                    const SizedBox(height: 16),
                    const Text('Δεν υπάρχουν καταχωρήσεις ακόμα',
                        style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 15)),
                  ],
                ),
              )
            : RefreshIndicator(
                onRefresh: () => ref.refresh(diaryFeedProvider(schoolId).future),
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemCount: reports.length,
                  itemBuilder: (_, i) => _ReportCard(report: reports[i]),
                ),
              ),
      ),
    );
  }
}

class _ReportCard extends StatelessWidget {
  final Map<String, dynamic> report;
  const _ReportCard({required this.report});

  static const _moodEmojis = {
    'χαρούμενος': '😊', 'happy': '😊', 'ήρεμος': '😌', 'calm': '😌',
    'κουρασμένος': '😴', 'tired': '😴', 'λυπημένος': '😢', 'sad': '😢',
    'αγχωμένος': '😟', 'anxious': '😟',
  };

  static const _mealLabels = {
    'good': 'Έφαγε', 'partial': 'Μερικώς', 'refused': 'Αρνήθηκε',
    'all': 'Όλο', 'most': 'Σχεδόν', 'half': 'Μισό', 'little': 'Λίγο', 'none': 'Τίποτα',
  };

  @override
  Widget build(BuildContext context) {
    final student = report['student'] as Map<String, dynamic>?;
    final name = student?['fullName'] as String? ?? 'Παιδί';
    final mood = report['mood'] as String?;
    final lunch = report['mealLunch'] as String?;
    final breakfast = report['mealBreakfast'] as String?;
    final notes = report['notes'] as String?;
    final dateStr = report['reportDate'] as String?;
    final nap = report['napDurationMinutes'] as int?;
    final bathroom = report['bathroomCount'] as int?;

    String dateLabel = '';
    if (dateStr != null) {
      try {
        final d = DateTime.parse(dateStr);
        const days = ['Δευ', 'Τρι', 'Τετ', 'Πεμ', 'Παρ', 'Σαβ', 'Κυρ'];
        dateLabel = '${days[d.weekday - 1]}, ${d.day}/${d.month}/${d.year}';
      } catch (_) {}
    }

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 6, offset: const Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 20,
                  backgroundColor: const Color(0xFFEEF2FF),
                  child: Text(
                    name.isNotEmpty ? name[0].toUpperCase() : '?',
                    style: const TextStyle(color: Color(0xFF77328D), fontWeight: FontWeight.bold),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                      if (dateLabel.isNotEmpty)
                        Text(dateLabel, style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12)),
                    ],
                  ),
                ),
                if (mood != null)
                  Text(_moodEmojis[mood] ?? '😐', style: const TextStyle(fontSize: 26)),
              ],
            ),
          ),
          if (breakfast != null || lunch != null || nap != null || bathroom != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  if (breakfast != null)
                    _InfoChip(
                      icon: Icons.wb_sunny_outlined,
                      label: 'Πρωινό: ${_mealLabels[breakfast] ?? breakfast}',
                      color: const Color(0xFFF59E0B),
                    ),
                  if (lunch != null)
                    _InfoChip(
                      icon: Icons.restaurant_outlined,
                      label: 'Μεσημεριανό: ${_mealLabels[lunch] ?? lunch}',
                      color: const Color(0xFF10B981),
                    ),
                  if (nap != null && nap > 0)
                    _InfoChip(icon: Icons.bedtime_outlined, label: 'Ύπνος: ${nap}λ', color: const Color(0xFF6366F1)),
                  if (bathroom != null)
                    _InfoChip(icon: Icons.wc, label: 'WC: ×$bathroom', color: const Color(0xFF14B8A6)),
                ],
              ),
            ),
          if (notes != null && notes.isNotEmpty) ...[
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFF9FAFB),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.format_quote, size: 16, color: Color(0xFF9CA3AF)),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(notes, style: const TextStyle(color: Color(0xFF374151), fontSize: 13)),
                    ),
                  ],
                ),
              ),
            ),
          ],
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  const _InfoChip({required this.icon, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 4),
          Text(label, style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}
