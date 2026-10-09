import 'package:flutter/material.dart';

List<String> instructionLines(String? raw) {
  final text = raw?.trim() ?? '';
  if (text.isEmpty) return const [];
  return text
      .split(RegExp(r'\r?\n'))
      .map((line) => line.trim())
      .where((line) => line.isNotEmpty)
      .map((line) => line.replaceFirst(RegExp(r'^[❖•\-\*]+\s*'), ''))
      .where((line) => line.isNotEmpty)
      .toList();
}

bool? busRuns(Object? value) {
  if (value == true || value == 'true') return true;
  if (value == false || value == 'false') return false;
  return null;
}

class EventDayFacts extends StatelessWidget {
  final String? arriveBy;
  final Object? busOperates;
  const EventDayFacts({super.key, this.arriveBy, this.busOperates});

  @override
  Widget build(BuildContext context) {
    final time = arriveBy?.trim() ?? '';
    final bus = busRuns(busOperates);
    if (time.isEmpty && bus == null) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (time.isNotEmpty)
          Text(
            'Το παιδί πρέπει να είναι στο σχολείο το αργότερο έως τις $time.',
            style: const TextStyle(fontSize: 15, height: 1.4, fontWeight: FontWeight.w700, color: Color(0xFF111827)),
          ),
        if (bus != null) ...[
          if (time.isNotEmpty) const SizedBox(height: 6),
          Text(
            bus
                ? 'Το δρομολόγιο του σχολικού θα λειτουργήσει εκείνη την ημέρα.'
                : 'Το δρομολόγιο του σχολικού δεν θα λειτουργήσει εκείνη την ημέρα.',
            style: const TextStyle(fontSize: 15, height: 1.4, color: Color(0xFF374151)),
          ),
        ],
      ],
    );
  }
}

class UsefulInstructions extends StatelessWidget {
  final String? text;
  final Color color;
  const UsefulInstructions({super.key, required this.text, this.color = const Color(0xFF2C2422)});

  @override
  Widget build(BuildContext context) {
    final lines = instructionLines(text);
    if (lines.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Χρήσιμες οδηγίες', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: Color(0xFF77328D))),
        const SizedBox(height: 8),
        for (final line in lines)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('❖', style: TextStyle(color: Color(0xFFE95926), fontSize: 14, height: 1.4)),
                const SizedBox(width: 8),
                Expanded(child: Text(line, style: TextStyle(fontSize: 15, height: 1.4, color: color))),
              ],
            ),
          ),
      ],
    );
  }
}
