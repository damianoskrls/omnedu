import 'package:flutter/material.dart';

import '../../../core/utils/greek_grammar.dart';

/// Design tokens for the parent home experience.
abstract final class ParentHomeTokens {
  static const primary = Color(0xFF783B96);
  static const deep = Color(0xFF45245B);
  static const lilac = Color(0xFFF0E8F7);
  static const peach = Color(0xFFFFF0E7);
  static const mint = Color(0xFFEAF6EF);
  static const butter = Color(0xFFFFF6D8);
  static const background = Color(0xFFF8F7FB);
  static const surface = Color(0xFFFFFFFF);
  static const text = Color(0xFF252333);
  static const textSecondary = Color(0xFF696577);
  static const border = Color(0xFFE8E4F0);
  static const danger = Color(0xFFC2410C);
  static const success = Color(0xFF047857);

  static const radiusCard = 18.0;
  static const radiusChip = 14.0;
  static const pagePadding = 16.0;
  static const sectionGap = 20.0;

  static const greetingStyle = TextStyle(
    fontSize: 26,
    fontWeight: FontWeight.w700,
    height: 1.2,
    color: text,
    letterSpacing: -0.3,
  );

  static const sectionTitleStyle = TextStyle(
    fontSize: 18,
    fontWeight: FontWeight.w700,
    height: 1.25,
    color: text,
  );

  static const bodyStyle = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w400,
    height: 1.45,
    color: text,
  );

  static const captionStyle = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w500,
    height: 1.35,
    color: textSecondary,
  );

  static List<BoxShadow> get softShadow => [
        BoxShadow(
          color: deep.withValues(alpha: 0.06),
          blurRadius: 16,
          offset: const Offset(0, 6),
        ),
      ];

  static String greetingForHour(int hour, String firstName) {
    final spoken = firstName.trim().isEmpty ? '' : ', ${greekVocative(firstName.trim())}';
    if (hour >= 5 && hour < 12) return 'Καλημέρα$spoken';
    if (hour >= 12 && hour < 17) return 'Καλό απόγευμα$spoken';
    if (hour >= 17 && hour < 22) return 'Καλησπέρα$spoken';
    return 'Καλό βράδυ$spoken';
  }

  static String greetingSubtitle({required int childCount}) {
    if (childCount <= 1) return 'Η ημέρα του παιδιού σας, με μια ματιά';
    return 'Η ημέρα των παιδιών σας, με μια ματιά';
  }

  static const monthsGenitive = [
    '',
    'Ιανουαρίου',
    'Φεβρουαρίου',
    'Μαρτίου',
    'Απριλίου',
    'Μαΐου',
    'Ιουνίου',
    'Ιουλίου',
    'Αυγούστου',
    'Σεπτεμβρίου',
    'Οκτωβρίου',
    'Νοεμβρίου',
    'Δεκεμβρίου',
  ];

  static const monthsShort = [
    '',
    'Ιαν',
    'Φεβ',
    'Μαρ',
    'Απρ',
    'Μαΐ',
    'Ιουν',
    'Ιουλ',
    'Αυγ',
    'Σεπ',
    'Οκτ',
    'Νοε',
    'Δεκ',
  ];

  static String formatDayMonthTime(DateTime dt) {
    final h = dt.hour.toString().padLeft(2, '0');
    final m = dt.minute.toString().padLeft(2, '0');
    return '${dt.day} ${monthsGenitive[dt.month]} · $h:$m';
  }

  static String formatDayMonth(DateTime dt) {
    return '${dt.day} ${monthsGenitive[dt.month]}';
  }
}
