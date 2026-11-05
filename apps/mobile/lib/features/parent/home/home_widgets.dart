import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/widgets/person_face.dart';
import '../screens/bulletin_screen.dart';
import '../screens/day_history.dart';
import '../screens/parent_child_pages.dart';
import 'parent_home_tokens.dart';
import 'parent_icons.dart';

final homeSelectedChildIdProvider = StateProvider<String?>((ref) => null);

class HomeFadeIn extends StatefulWidget {
  final Widget child;
  final int delayMs;
  const HomeFadeIn({super.key, required this.child, this.delayMs = 0});

  @override
  State<HomeFadeIn> createState() => _HomeFadeInState();
}

class _HomeFadeInState extends State<HomeFadeIn> with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  late final Animation<double> _opacity;
  late final Animation<Offset> _offset;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 220));
    _opacity = CurvedAnimation(parent: _c, curve: Curves.easeOut);
    _offset = Tween(begin: const Offset(0, 0.04), end: Offset.zero)
        .animate(CurvedAnimation(parent: _c, curve: Curves.easeOutCubic));
    Future<void>.delayed(Duration(milliseconds: widget.delayMs), () {
      if (mounted) {
        final reduce = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
        if (reduce) {
          _c.value = 1;
        } else {
          _c.forward();
        }
      }
    });
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _opacity,
      child: SlideTransition(position: _offset, child: widget.child),
    );
  }
}

class HomeSectionHeader extends StatelessWidget {
  final String title;
  final ParentIconData icon;
  final String? actionLabel;
  final VoidCallback? onAction;
  final Color? tint;

  const HomeSectionHeader({
    super.key,
    required this.title,
    required this.icon,
    this.actionLabel,
    this.onAction,
    this.tint,
  });

  @override
  Widget build(BuildContext context) {
    final color = tint ?? ParentHomeTokens.primary;
    return Padding(
      padding: const EdgeInsets.fromLTRB(ParentHomeTokens.pagePadding, ParentHomeTokens.sectionGap, ParentHomeTokens.pagePadding, 10),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            alignment: Alignment.center,
            child: ParentIcon(icon, size: 18, color: color, accent: color.withValues(alpha: 0.18)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(title, style: ParentHomeTokens.sectionTitleStyle.copyWith(color: ParentHomeTokens.text)),
          ),
          if (actionLabel != null && onAction != null)
            TextButton(
              onPressed: onAction,
              style: TextButton.styleFrom(
                foregroundColor: ParentHomeTokens.primary,
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                minimumSize: const Size(44, 44),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: Text(actionLabel!, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
            ),
        ],
      ),
    );
  }
}

class HomeGreeting extends StatelessWidget {
  final String firstName;
  final int childCount;
  const HomeGreeting({super.key, required this.firstName, required this.childCount});

  @override
  Widget build(BuildContext context) {
    final hour = DateTime.now().hour;
    return Padding(
      padding: const EdgeInsets.fromLTRB(ParentHomeTokens.pagePadding, 8, ParentHomeTokens.pagePadding, 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  ParentHomeTokens.greetingForHour(hour, firstName),
                  style: ParentHomeTokens.greetingStyle,
                ),
                const SizedBox(height: 4),
                Text(
                  ParentHomeTokens.greetingSubtitle(childCount: childCount),
                  style: ParentHomeTokens.captionStyle,
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          const ParentIcon(
            ParentIconData.sun,
            size: 44,
            color: ParentHomeTokens.primary,
            accent: ParentHomeTokens.butter,
          ),
        ],
      ),
    );
  }
}

/// Square child cards: photo on top, name + class below.
class HomeChildSelector extends StatelessWidget {
  final List<Map<String, dynamic>> children;
  final ValueChanged<Map<String, dynamic>> onOpenHub;

  const HomeChildSelector({
    super.key,
    required this.children,
    required this.onOpenHub,
  });

  static String? classNameOf(Map<String, dynamic> child) {
    final enrollments = child['enrollments'] as List? ?? [];
    if (enrollments.isEmpty || enrollments.first is! Map) return null;
    final klass = enrollments.first['class'];
    if (klass is! Map) return null;
    final name = klass['name']?.toString().trim() ?? '';
    return name.isEmpty ? null : name;
  }

  @override
  Widget build(BuildContext context) {
    if (children.isEmpty) return const SizedBox.shrink();
    return SizedBox(
      height: 198,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
        itemCount: children.length,
        separatorBuilder: (_, __) => const SizedBox(width: 12),
        itemBuilder: (context, index) {
          final child = children[index];
          final name = child['fullName']?.toString() ?? '';
          final className = classNameOf(child);
          final gender = (child['gender']?.toString() ?? '').toLowerCase();
          final girl = gender == 'female';
          final accent = girl ? const Color(0xFFDB2777) : const Color(0xFF77328D);
          final wash = girl ? const Color(0xFFFFF1F7) : const Color(0xFFF7F0FB);
          return Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(22),
              onTap: () {
                HapticFeedback.selectionClick();
                onOpenHub(child);
              },
              child: Ink(
                width: 132,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(color: accent.withValues(alpha: 0.18)),
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Colors.white, wash],
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: accent.withValues(alpha: 0.12),
                      blurRadius: 16,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(10, 10, 10, 12),
                  child: Column(
                    children: [
                      Container(
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(18),
                          boxShadow: [
                            BoxShadow(
                              color: accent.withValues(alpha: 0.18),
                              blurRadius: 10,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: PersonFace(
                          name: name,
                          photoUrl: child['avatarUrl']?.toString(),
                          size: 96,
                          radius: 18,
                          fontSize: 32,
                          background: accent,
                          foreground: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 13,
                          height: 1.15,
                          color: Color(0xFF2C2422),
                        ),
                      ),
                      if (className != null) ...[
                        const SizedBox(height: 4),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: accent.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            className,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: accent,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class HomeSurfaceCard extends StatelessWidget {
  final Widget child;
  final Color? color;
  final EdgeInsetsGeometry? margin;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;

  const HomeSurfaceCard({
    super.key,
    required this.child,
    this.color,
    this.margin,
    this.padding,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(ParentHomeTokens.radiusCard);
    final content = Container(
      margin: margin ?? const EdgeInsets.symmetric(horizontal: ParentHomeTokens.pagePadding),
      padding: padding ?? const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color ?? ParentHomeTokens.surface,
        borderRadius: radius,
        border: Border.all(color: ParentHomeTokens.border),
        boxShadow: ParentHomeTokens.softShadow,
      ),
      child: child,
    );
    if (onTap == null) return content;
    return Padding(
      padding: margin ?? const EdgeInsets.symmetric(horizontal: ParentHomeTokens.pagePadding),
      child: Material(
        color: color ?? ParentHomeTokens.surface,
        borderRadius: radius,
        child: InkWell(
          borderRadius: radius,
          onTap: onTap,
          child: Ink(
            decoration: BoxDecoration(
              borderRadius: radius,
              border: Border.all(color: ParentHomeTokens.border),
            ),
            padding: padding ?? const EdgeInsets.all(14),
            child: child,
          ),
        ),
      ),
    );
  }
}

class HomeTodayCard extends ConsumerWidget {
  final String schoolId;
  final Map<String, dynamic> child;
  final bool showChildLabel;

  const HomeTodayCard({
    super.key,
    required this.schoolId,
    required this.child,
    this.showChildLabel = false,
  });

  static const _moodLabels = {
    'χαρούμενος': 'Χαρούμενος',
    'happy': 'Χαρούμενος',
    'ήρεμος': 'Ήρεμος',
    'calm': 'Ήρεμος',
    'κουρασμένος': 'Κουρασμένος',
    'tired': 'Κουρασμένος',
    'λυπημένος': 'Λυπημένος',
    'sad': 'Λυπημένος',
    'αγχωμένος': 'Αγχωμένος',
    'anxious': 'Αγχωμένος',
    'ενθουσιασμένος': 'Ενθουσιασμένος',
  };

  static const _mealLabels = {
    'all': 'Όλο',
    'most': 'Τα πιο πολλά',
    'half': 'Τα μισά',
    'little': 'Λίγο',
    'none': 'Καθόλου',
  };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final studentId = child['id'] as String? ?? '';
    final reportsAsync = ref.watch(childDayReportsProvider((schoolId: schoolId, studentId: studentId)));
    final todayStr = dayHistoryIso(DateTime.now());

    return reportsAsync.when(
      loading: () => const HomeSkeletonCard(height: 96),
      error: (_, __) => HomeSurfaceCard(
        child: Text('Σφάλμα φόρτωσης ενημέρωσης', style: ParentHomeTokens.captionStyle.copyWith(color: ParentHomeTokens.danger)),
      ),
      data: (reports) {
        Map<String, dynamic>? todayReport;
        for (final raw in reports) {
          if (raw is! Map) continue;
          final date = raw['reportDate']?.toString() ?? '';
          if (date.startsWith(todayStr)) {
            todayReport = Map<String, dynamic>.from(raw);
            break;
          }
        }
        if (todayReport == null) {
          return HomeSurfaceCard(
            color: ParentHomeTokens.lilac.withValues(alpha: 0.35),
            child: Row(
              children: [
                const ParentIcon(
                  ParentIconData.emptyToday,
                  size: 40,
                  color: ParentHomeTokens.primary,
                  accent: ParentHomeTokens.lilac,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Δεν έχει καταχωριστεί ακόμη ενημέρωση για σήμερα.',
                    style: ParentHomeTokens.bodyStyle.copyWith(color: ParentHomeTokens.textSecondary, fontSize: 14),
                  ),
                ),
              ],
            ),
          );
        }

        final mood = todayReport['mood']?.toString();
        final notes = (todayReport['notes'] as String?)?.trim();
        final breakfast = _text(todayReport['mealBreakfast']);
        final lunch = _text(todayReport['mealLunch']);
        final snack = _text(todayReport['mealSnack']);
        final nap1 = _number(todayReport['napDurationMinutes']);
        final nap2 = _number(todayReport['nap2DurationMinutes']);
        final bathroom = _number(todayReport['bathroomCount']);
        final diaper = _number(todayReport['diaperChanges']);
        final chips = <Widget>[
          if (mood != null && mood.isNotEmpty)
            _StatusChip(
              icon: ParentIconData.mood,
              label: _moodLabels[mood.toLowerCase()] ?? mood,
              tint: ParentHomeTokens.butter,
            ),
          if (breakfast != null || lunch != null || snack != null)
            _StatusChip(
              icon: ParentIconData.food,
              label: [
                if (breakfast != null) 'Πρωινό: ${_mealLabels[breakfast] ?? breakfast}',
                if (lunch != null) 'Μεσημ.: ${_mealLabels[lunch] ?? lunch}',
              ].where((e) => e.isNotEmpty).join(' · '),
              tint: ParentHomeTokens.peach,
            ),
          if (nap1 > 0 || nap2 > 0)
            _StatusChip(
              icon: ParentIconData.sleep,
              label: [
                if (nap1 > 0) _napLabel(nap1),
                if (nap2 > 0) _napLabel(nap2),
              ].join(' · '),
              tint: ParentHomeTokens.lilac,
            ),
          if (bathroom > 0 || diaper > 0)
            _StatusChip(
              icon: ParentIconData.toilet,
              label: [
                if (bathroom > 0) 'Κακά',
                if (diaper > 0) 'Τσίσα',
              ].join(' · '),
              tint: ParentHomeTokens.mint,
            ),
        ];

        return HomeSurfaceCard(
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => BulletinScreen(
                schoolId: schoolId,
                child: child,
                initialDay: DateTime.tryParse(todayReport!['reportDate']?.toString() ?? ''),
              ),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (showChildLabel) ...[
                Text(
                  child['fullName']?.toString() ?? '',
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: ParentHomeTokens.primary),
                ),
                const SizedBox(height: 8),
              ],
              if (chips.isNotEmpty)
                Wrap(spacing: 8, runSpacing: 8, children: chips)
              else
                Text('Υπάρχει ενημέρωση για σήμερα', style: ParentHomeTokens.captionStyle),
              if (notes != null && notes.isNotEmpty) ...[
                const SizedBox(height: 10),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const ParentIcon(ParentIconData.notes, size: 16, color: ParentHomeTokens.primary),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        notes,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: ParentHomeTokens.bodyStyle.copyWith(fontSize: 14, color: ParentHomeTokens.textSecondary),
                      ),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: 8),
              const Align(
                alignment: Alignment.centerRight,
                child: Text(
                  'Πλήρης ενημέρωση',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: ParentHomeTokens.primary),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  static String? _text(dynamic value) {
    final text = value?.toString().trim() ?? '';
    return text.isEmpty ? null : text;
  }

  static int _number(dynamic value) => value is num ? value.toInt() : 0;

  static String _napLabel(int minutes) {
    if (minutes < 60) return "$minutes'";
    if (minutes == 60) return '1 ώρα';
    if (minutes == 90) return '1½ ώρα';
    return '${minutes ~/ 60} ώρ. ${minutes % 60 > 0 ? "${minutes % 60}'" : ''}'.trim();
  }
}

class _StatusChip extends StatelessWidget {
  final ParentIconData icon;
  final String label;
  final Color tint;
  const _StatusChip({required this.icon, required this.label, required this.tint});

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(maxWidth: 280),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: tint,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          ParentIcon(icon, size: 16, color: ParentHomeTokens.deep, accent: Colors.white.withValues(alpha: 0.5)),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              label,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: ParentHomeTokens.text, height: 1.25),
            ),
          ),
        ],
      ),
    );
  }
}

class HomeMenuCard extends ConsumerWidget {
  final String schoolId;
  const HomeMenuCard({super.key, required this.schoolId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final menuAsync = ref.watch(dayHistoryMenuProvider(schoolId));
    return menuAsync.when(
      loading: () => const HomeSkeletonCard(height: 140),
      error: (_, __) => HomeSurfaceCard(
        child: Text('Δεν υπάρχει καταχωρημένο μενού', style: ParentHomeTokens.captionStyle),
      ),
      data: (menu) {
        if (menu == null) {
          return HomeSurfaceCard(
            child: Text('Δεν υπάρχει καταχωρημένο μενού για σήμερα', style: ParentHomeTokens.captionStyle),
          );
        }
        final rows = <(ParentIconData, String, String)>[
          if (_filled(menu['midMorning'])) (ParentIconData.snack, 'Δεκατιανό', menu['midMorning'].toString()),
          if (_filled(menu['lunch'])) (ParentIconData.lunch, 'Μεσημεριανό', menu['lunch'].toString()),
          if (_filled(menu['afternoon'])) (ParentIconData.afternoon, 'Απογευματινό', menu['afternoon'].toString()),
        ];
        // Keep breakfast if present even though the brief highlights the three main rows.
        if (_filled(menu['breakfast'])) {
          rows.insert(0, (ParentIconData.breakfast, 'Πρωινό', menu['breakfast'].toString()));
        }
        if (rows.isEmpty) {
          return HomeSurfaceCard(
            child: Text('Δεν υπάρχει καταχωρημένο μενού για σήμερα', style: ParentHomeTokens.captionStyle),
          );
        }
        final monthNotes = (menu['monthNotes'] as String?)?.trim() ?? '';
        final dayNotes = (menu['notes'] as String?)?.trim() ?? '';
        final hasNotes = monthNotes.isNotEmpty || dayNotes.isNotEmpty;

        return HomeSurfaceCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              for (var i = 0; i < rows.length; i++) ...[
                if (i > 0) const Divider(height: 1, color: ParentHomeTokens.border),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: ParentHomeTokens.peach.withValues(alpha: 0.7),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        alignment: Alignment.center,
                        child: ParentIcon(rows[i].$1, size: 18, color: ParentHomeTokens.primary),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              rows[i].$2,
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.2,
                                color: ParentHomeTokens.primary,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              rows[i].$3,
                              style: ParentHomeTokens.bodyStyle.copyWith(fontSize: 14, fontWeight: FontWeight.w500),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              if (hasNotes)
                Material(
                  color: ParentHomeTokens.lilac.withValues(alpha: 0.45),
                  borderRadius: const BorderRadius.vertical(bottom: Radius.circular(ParentHomeTokens.radiusCard)),
                  child: InkWell(
                    borderRadius: const BorderRadius.vertical(bottom: Radius.circular(ParentHomeTokens.radiusCard)),
                    onTap: () => _openNotes(context, schoolId, monthNotes, dayNotes),
                    child: const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      child: Row(
                        children: [
                          ParentIcon(ParentIconData.notes, size: 16, color: ParentHomeTokens.primary),
                          SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Σημειώσεις μενού',
                              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: ParentHomeTokens.primary),
                            ),
                          ),
                          ParentIcon(ParentIconData.chevron, size: 16, color: ParentHomeTokens.primary),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  bool _filled(dynamic v) => (v?.toString().trim() ?? '').isNotEmpty;

  void _openNotes(BuildContext context, String schoolId, String monthNotes, String dayNotes) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(color: ParentHomeTokens.border, borderRadius: BorderRadius.circular(99)),
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Σημειώσεις μενού',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: ParentHomeTokens.text),
              ),
              const SizedBox(height: 10),
              Text(
                monthNotes.isNotEmpty ? monthNotes : dayNotes,
                style: ParentHomeTokens.bodyStyle.copyWith(color: ParentHomeTokens.textSecondary),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: FilledButton(
                  onPressed: () {
                    Navigator.pop(ctx);
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => MonthlyMealsScreen(schoolId: schoolId, childName: 'Μαθητής'),
                      ),
                    );
                  },
                  style: FilledButton.styleFrom(
                    backgroundColor: ParentHomeTokens.primary,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  child: const Text('Όλο το διατροφολόγιο του μήνα', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class HomeSkeletonCard extends StatelessWidget {
  final double height;
  const HomeSkeletonCard({super.key, this.height = 88});

  @override
  Widget build(BuildContext context) {
    return HomeSurfaceCard(
      child: SizedBox(
        height: height - 28,
        child: const Center(
          child: SizedBox(
            width: 22,
            height: 22,
            child: CircularProgressIndicator(strokeWidth: 2.2, color: ParentHomeTokens.primary),
          ),
        ),
      ),
    );
  }
}

class HomeMeetingTile extends StatelessWidget {
  final Map<String, dynamic> child;
  final Map<String, dynamic> meeting;
  final VoidCallback onTap;

  const HomeMeetingTile({
    super.key,
    required this.child,
    required this.meeting,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final date = DateTime.tryParse(meeting['meetingDate']?.toString() ?? '');
    final slot = meeting['acceptedSlot']?.toString() ?? '';
    final mention = ChildMention.fromMap(child);
    final daysLeft = date == null
        ? null
        : DateTime(date.year, date.month, date.day)
            .difference(DateTime(DateTime.now().year, DateTime.now().month, DateTime.now().day))
            .inDays;

    return Container(
      margin: const EdgeInsets.fromLTRB(20, 0, 20, 10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE7D4F0)),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFFFFFFF), Color(0xFFF7F0FB)],
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF77328D).withValues(alpha: 0.08),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(18),
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                if (daysLeft != null) ...[
                  _MeetingCountdownBadge(daysLeft: daysLeft),
                  const SizedBox(width: 12),
                ],
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (mention != null) ...[
                        ChildMentions(people: [mention]),
                        const SizedBox(height: 8),
                      ],
                      const Text(
                        'Συνάντηση με εκπαιδευτικό',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF2C2422)),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        [
                          if (date != null) ParentHomeTokens.formatDayMonth(date),
                          if (slot.isNotEmpty) 'στις $slot',
                        ].join(' · '),
                        style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280), fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right_rounded, color: Color(0xFF77328D), size: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _MeetingCountdownBadge extends StatefulWidget {
  final int daysLeft;
  const _MeetingCountdownBadge({required this.daysLeft});

  @override
  State<_MeetingCountdownBadge> createState() => _MeetingCountdownBadgeState();
}

class _MeetingCountdownBadgeState extends State<_MeetingCountdownBadge>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _scale;
  late final Animation<int> _count;

  @override
  void initState() {
    super.initState();
    final target = widget.daysLeft.clamp(0, 99);
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 900));
    _scale = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0.86, end: 1.06), weight: 55),
      TweenSequenceItem(tween: Tween(begin: 1.06, end: 1.0), weight: 45),
    ]).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic));
    _count = IntTween(begin: 0, end: target).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic),
    );
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final label = widget.daysLeft <= 0
        ? 'Σήμερα'
        : widget.daysLeft == 1
            ? 'αύριο'
            : 'ημέρες';
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        return Transform.scale(
          scale: _scale.value,
          child: Container(
            width: 64,
            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 6),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF77328D), Color(0xFFE95926)],
              ),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF77328D).withValues(alpha: 0.28),
                  blurRadius: 12,
                  offset: const Offset(0, 5),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  widget.daysLeft <= 0 ? '!' : '${_count.value}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    height: 1,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  label,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    height: 1.1,
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class HomePartyInviteTile extends StatelessWidget {
  final Map<String, dynamic> invitation;
  final VoidCallback onTap;
  final bool showChildren;

  const HomePartyInviteTile({
    super.key,
    required this.invitation,
    required this.onTap,
    this.showChildren = false,
  });

  @override
  Widget build(BuildContext context) {
    final title = invitation['title']?.toString() ?? 'Πρόσκληση Πάρτυ';
    final eventDate = DateTime.tryParse(invitation['eventDate']?.toString() ?? '');
    final birthday = invitation['birthdayStudent'] is Map
        ? Map<String, dynamic>.from(invitation['birthdayStudent'] as Map)
        : null;
    final gender = (birthday?['gender']?.toString() ?? '').toLowerCase();
    final isGirl = gender == 'female';
    final isBoy = gender == 'male';
    final accent = isGirl
        ? const Color(0xFFDB2777)
        : isBoy
            ? const Color(0xFF2563EB)
            : const Color(0xFFDB2777);
    final wash = isGirl
        ? const Color(0xFFFFF1F7)
        : isBoy
            ? const Color(0xFFEFF6FF)
            : const Color(0xFFFFF1F7);
    final border = isGirl
        ? const Color(0xFFFBCFE8)
        : isBoy
            ? const Color(0xFFBFDBFE)
            : const Color(0xFFFCE7F3);
    final emoji = isBoy ? '🎈' : '🎂';
    final hostName = birthday?['fullName']?.toString().trim() ?? '';
    final mentions = _partyInviteMentions(invitation);

    return Container(
      margin: const EdgeInsets.fromLTRB(20, 0, 20, 10),
      decoration: BoxDecoration(
        color: wash,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: border),
        boxShadow: [
          BoxShadow(
            color: accent.withValues(alpha: 0.12),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(18),
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: border),
                    boxShadow: [
                      BoxShadow(
                        color: accent.withValues(alpha: 0.12),
                        blurRadius: 8,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  alignment: Alignment.center,
                  child: Text(emoji, style: const TextStyle(fontSize: 24)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (hostName.isNotEmpty)
                        Container(
                          margin: const EdgeInsets.only(bottom: 6),
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: accent.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            isBoy ? 'Από τον $hostName' : 'Από την $hostName',
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: accent),
                          ),
                        ),
                      Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF111827)),
                      ),
                      if (eventDate != null) ...[
                        const SizedBox(height: 3),
                        Text(
                          ParentHomeTokens.formatDayMonthTime(eventDate),
                          style: TextStyle(fontSize: 12, color: accent.withValues(alpha: 0.85), fontWeight: FontWeight.w600),
                        ),
                      ],
                      if (showChildren && mentions.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        ChildMentions(people: mentions),
                      ],
                    ],
                  ),
                ),
                Icon(Icons.chevron_right_rounded, size: 20, color: accent),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

List<ChildMention> _partyInviteMentions(Map<String, dynamic> inv) {
  final raw = inv['forMyChildren'];
  if (raw is! List) return const [];
  return raw
      .whereType<Map>()
      .map((row) => ChildMention.fromMap(row))
      .whereType<ChildMention>()
      .toList();
}

class HomeRecentUpdateCard extends StatelessWidget {
  final String schoolId;
  final Map<String, dynamic> child;
  final Map<String, dynamic> report;
  final bool showChildLabel;

  const HomeRecentUpdateCard({
    super.key,
    required this.schoolId,
    required this.child,
    required this.report,
    this.showChildLabel = false,
  });

  @override
  Widget build(BuildContext context) {
    final date = DateTime.tryParse((report['reportDate']?.toString() ?? '').split('T').first);
    final mood = report['mood']?.toString();
    final notes = (report['notes'] as String?)?.trim();
    final media = report['media'];
    final photos = media is List
        ? media
            .whereType<Map>()
            .map((m) => m['url']?.toString() ?? m['fileUrl']?.toString() ?? '')
            .where((u) => u.isNotEmpty)
            .take(3)
            .toList()
        : const <String>[];

    return HomeSurfaceCard(
      margin: const EdgeInsets.fromLTRB(ParentHomeTokens.pagePadding, 0, ParentHomeTokens.pagePadding, 8),
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => BulletinScreen(
            schoolId: schoolId,
            child: child,
            initialDay: date,
          ),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (showChildLabel) ...[
                Expanded(
                  child: Text(
                    child['fullName']?.toString() ?? '',
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: ParentHomeTokens.primary),
                  ),
                ),
              ] else
                const Spacer(),
              Text(
                date != null ? ParentHomeTokens.formatDayMonth(date) : '',
                style: ParentHomeTokens.captionStyle,
              ),
            ],
          ),
          if (mood != null && mood.isNotEmpty) ...[
            const SizedBox(height: 8),
            _StatusChip(
              icon: ParentIconData.mood,
              label: HomeTodayCard._moodLabels[mood.toLowerCase()] ?? mood,
              tint: ParentHomeTokens.butter,
            ),
          ],
          if (notes != null && notes.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              notes,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: ParentHomeTokens.bodyStyle.copyWith(fontSize: 14, color: ParentHomeTokens.textSecondary),
            ),
          ],
          if (photos.isNotEmpty) ...[
            const SizedBox(height: 10),
            SizedBox(
              height: 56,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: photos.length,
                separatorBuilder: (_, __) => const SizedBox(width: 6),
                itemBuilder: (_, i) => ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: Image.network(
                    photos[i],
                    width: 56,
                    height: 56,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      width: 56,
                      height: 56,
                      color: ParentHomeTokens.lilac,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Compact week mood strip — only when ≥3 reports with mood exist.
class HomeWeekMoodStrip extends ConsumerWidget {
  final String schoolId;
  final Map<String, dynamic> child;

  const HomeWeekMoodStrip({super.key, required this.schoolId, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final studentId = child['id'] as String? ?? '';
    final reportsAsync = ref.watch(childDayReportsProvider((schoolId: schoolId, studentId: studentId)));
    return reportsAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (reports) {
        final today = DateTime.now();
        final todayDay = DateTime(today.year, today.month, today.day);
        final weekStart = todayDay.subtract(const Duration(days: 6));
        final byDay = <String, String>{};
        for (final raw in reports) {
          if (raw is! Map) continue;
          final day = reportCalendarDay(raw);
          final mood = raw['mood']?.toString();
          if (day == null || mood == null || mood.isEmpty) continue;
          if (day.isBefore(weekStart) || day.isAfter(todayDay)) continue;
          byDay[dayHistoryIso(day)] = mood;
        }
        if (byDay.length < 3) return const SizedBox.shrink();

        final days = List.generate(7, (i) => weekStart.add(Duration(days: i)));
        const labels = ['Δε', 'Τρ', 'Τε', 'Πε', 'Πα', 'Σα', 'Κυ'];
        return HomeSurfaceCard(
          margin: const EdgeInsets.fromLTRB(ParentHomeTokens.pagePadding, 0, ParentHomeTokens.pagePadding, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Διάθεση εβδομάδας',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: ParentHomeTokens.text),
              ),
              const SizedBox(height: 4),
              Text(
                'Καταγεγραμμένη διάθεση των τελευταίων ημερών',
                style: ParentHomeTokens.captionStyle.copyWith(fontSize: 12),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  for (final day in days)
                    Expanded(
                      child: Column(
                        children: [
                          ParentIcon(
                            ParentIconData.mood,
                            size: 18,
                            color: byDay.containsKey(dayHistoryIso(day))
                                ? ParentHomeTokens.primary
                                : ParentHomeTokens.border,
                            accent: byDay.containsKey(dayHistoryIso(day))
                                ? ParentHomeTokens.butter
                                : ParentHomeTokens.lilac.withValues(alpha: 0.4),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            labels[day.weekday - 1],
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: byDay.containsKey(dayHistoryIso(day))
                                  ? ParentHomeTokens.text
                                  : ParentHomeTokens.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                '${byDay.length} από 7 ημέρες με καταγραφή',
                style: ParentHomeTokens.captionStyle.copyWith(fontSize: 11),
              ),
            ],
          ),
        );
      },
    );
  }
}
