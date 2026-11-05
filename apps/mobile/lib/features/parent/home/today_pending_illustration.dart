import 'dart:math' as math;
import 'package:flutter/material.dart';

/// Animated empty state: teacher hasn't logged today's update yet.
class TodayUpdatePendingCard extends StatelessWidget {
  final String? childName;
  final EdgeInsetsGeometry? margin;

  const TodayUpdatePendingCard({
    super.key,
    this.childName,
    this.margin,
  });

  @override
  Widget build(BuildContext context) {
    final who = (childName ?? '').trim();
    return Container(
      margin: margin ?? const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFE7D4F0)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF77328D).withValues(alpha: 0.08),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        children: [
          const SizedBox(
            height: 148,
            width: double.infinity,
            child: TodayPendingIllustration(),
          ),
          const SizedBox(height: 10),
          Text(
            who.isEmpty
                ? 'Η ενημέρωση σήμερα δεν έχει περαστεί ακόμα'
                : 'Η ενημέρωση για $who δεν έχει περαστεί ακόμα',
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: Color(0xFF2C2422),
              height: 1.25,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Ο/η εκπαιδευτικός θα την καταχωρήσει σύντομα μέσα στην ημέρα.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13,
              height: 1.4,
              color: Color(0xFF6B7280),
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

class TodayPendingIllustration extends StatefulWidget {
  const TodayPendingIllustration({super.key});

  @override
  State<TodayPendingIllustration> createState() => _TodayPendingIllustrationState();
}

class _TodayPendingIllustrationState extends State<TodayPendingIllustration>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 2800))
      ..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        return CustomPaint(
          painter: _TodayPendingPainter(t: _controller.value),
          child: const SizedBox.expand(),
        );
      },
    );
  }
}

class _TodayPendingPainter extends CustomPainter {
  final double t;
  const _TodayPendingPainter({required this.t});

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final cx = w * 0.5;
    final bob = math.sin(t * math.pi) * 4;
    final pulse = 0.85 + (math.sin(t * math.pi * 2) * 0.08);

    // Soft ground wash
    final wash = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [Color(0x00F7F0FB), Color(0x66F3E8F7)],
      ).createShader(Rect.fromLTWH(0, 0, w, h));
    canvas.drawRRect(
      RRect.fromRectAndRadius(Rect.fromLTWH(0, 0, w, h), const Radius.circular(18)),
      wash,
    );

    // Floating clock bubble
    final clockCenter = Offset(cx + w * 0.28, h * 0.28 + bob * 0.4);
    canvas.drawCircle(
      clockCenter,
      18 * pulse,
      Paint()..color = const Color(0xFFFFF7ED),
    );
    canvas.drawCircle(
      clockCenter,
      18 * pulse,
      Paint()
        ..color = const Color(0xFFE95926)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );
    final hand = Paint()
      ..color = const Color(0xFFE95926)
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(clockCenter, clockCenter + Offset(0, -9 * pulse), hand);
    canvas.drawLine(
      clockCenter,
      clockCenter + Offset(math.cos(t * math.pi) * 7, math.sin(t * math.pi) * 4),
      hand,
    );

    // Clipboard floating left
    final board = RRect.fromRectAndRadius(
      Rect.fromCenter(
        center: Offset(cx - w * 0.30, h * 0.36 + bob * 0.25),
        width: 34,
        height: 42,
      ),
      const Radius.circular(8),
    );
    canvas.drawRRect(board, Paint()..color = Colors.white);
    canvas.drawRRect(
      board,
      Paint()
        ..color = const Color(0xFF77328D)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(
          center: Offset(cx - w * 0.30, h * 0.36 + bob * 0.25 - 18),
          width: 14,
          height: 8,
        ),
        const Radius.circular(4),
      ),
      Paint()..color = const Color(0xFFE95926),
    );
    final linePaint = Paint()
      ..color = const Color(0xFFD8C4E6)
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;
    for (var i = 0; i < 3; i++) {
      final y = h * 0.36 + bob * 0.25 - 4 + i * 8.0;
      canvas.drawLine(
        Offset(cx - w * 0.30 - 10, y),
        Offset(cx - w * 0.30 + 10, y),
        linePaint,
      );
    }

    // Teacher body
    final bodyY = h * 0.58 + bob;
    final head = Offset(cx, bodyY - 38);
    canvas.drawCircle(head, 16, Paint()..color = const Color(0xFFFFE0C8));
    canvas.drawCircle(
      head,
      16,
      Paint()
        ..color = const Color(0xFF77328D)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );

    // Hair
    final hair = Path()
      ..moveTo(head.dx - 14, head.dy - 2)
      ..quadraticBezierTo(head.dx - 18, head.dy - 18, head.dx, head.dy - 20)
      ..quadraticBezierTo(head.dx + 18, head.dy - 18, head.dx + 14, head.dy - 2)
      ..quadraticBezierTo(head.dx, head.dy - 8, head.dx - 14, head.dy - 2);
    canvas.drawPath(hair, Paint()..color = const Color(0xFF5B2A6D));

    // Face dots
    canvas.drawCircle(head + const Offset(-5, 1), 1.4, Paint()..color = const Color(0xFF5B2A6D));
    canvas.drawCircle(head + const Offset(5, 1), 1.4, Paint()..color = const Color(0xFF5B2A6D));
    canvas.drawArc(
      Rect.fromCenter(center: head + const Offset(0, 5), width: 8, height: 5),
      0.15,
      math.pi - 0.3,
      false,
      Paint()
        ..color = const Color(0xFF77328D)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.6
        ..strokeCap = StrokeCap.round,
    );

    // Torso
    final torso = Path()
      ..moveTo(cx - 22, bodyY + 34)
      ..quadraticBezierTo(cx - 26, bodyY - 4, cx - 12, bodyY - 18)
      ..lineTo(cx + 12, bodyY - 18)
      ..quadraticBezierTo(cx + 26, bodyY - 4, cx + 22, bodyY + 34)
      ..close();
    canvas.drawPath(
      torso,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF77328D), Color(0xFFE95926)],
        ).createShader(Rect.fromLTWH(cx - 26, bodyY - 20, 52, 56)),
    );

    // Arm holding pen / waiting gesture
    final armPaint = Paint()
      ..color = const Color(0xFFFFE0C8)
      ..strokeWidth = 7
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;
    final armLift = 4 + math.sin(t * math.pi) * 5;
    canvas.drawLine(
      Offset(cx + 14, bodyY - 8),
      Offset(cx + 34, bodyY - 18 - armLift),
      armPaint,
    );
    // Pen
    canvas.drawLine(
      Offset(cx + 34, bodyY - 18 - armLift),
      Offset(cx + 42, bodyY - 28 - armLift),
      Paint()
        ..color = const Color(0xFF2C2422)
        ..strokeWidth = 2.4
        ..strokeCap = StrokeCap.round,
    );

    // Sparkles / pending dots
    final sparkle = Paint()..color = const Color(0xFF77328D).withValues(alpha: 0.35 + t * 0.35);
    for (final p in [
      Offset(cx - 48, h * 0.22 + bob),
      Offset(cx + 52, h * 0.48 - bob),
      Offset(cx - 8, h * 0.18 + bob * 0.5),
    ]) {
      canvas.drawCircle(p, 2.2 + t, sparkle);
    }
  }

  @override
  bool shouldRepaint(covariant _TodayPendingPainter oldDelegate) => oldDelegate.t != t;
}
