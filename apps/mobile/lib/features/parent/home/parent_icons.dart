import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'parent_home_tokens.dart';

/// Custom path icons for the parent home (24×24 functional, larger for illustrations).
class ParentIcon extends StatelessWidget {
  final ParentIconData data;
  final double size;
  final Color? color;
  final Color? accent;
  final String? semanticLabel;

  const ParentIcon(
    this.data, {
    super.key,
    this.size = 24,
    this.color,
    this.accent,
    this.semanticLabel,
  });

  @override
  Widget build(BuildContext context) {
    final paint = CustomPaint(
      size: Size.square(size),
      painter: _ParentIconPainter(
        data: data,
        color: color ?? ParentHomeTokens.primary,
        accent: accent ?? ParentHomeTokens.lilac,
      ),
    );
    if (semanticLabel == null) {
      return ExcludeSemantics(child: paint);
    }
    return Semantics(label: semanticLabel, child: paint);
  }
}

enum ParentIconData {
  home,
  activities,
  events,
  billing,
  bell,
  chat,
  sun,
  mood,
  food,
  sleep,
  toilet,
  notes,
  calendar,
  cake,
  gift,
  breakfast,
  snack,
  lunch,
  afternoon,
  emptyToday,
  chevron,
  child,
}

class _ParentIconPainter extends CustomPainter {
  final ParentIconData data;
  final Color color;
  final Color accent;

  _ParentIconPainter({
    required this.data,
    required this.color,
    required this.accent,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 24;
    canvas.save();
    canvas.scale(s, s);
    final stroke = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.85
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final fill = Paint()
      ..color = accent
      ..style = PaintingStyle.fill;
    final solid = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    switch (data) {
      case ParentIconData.home:
        canvas.drawPath(
          Path()
            ..moveTo(4, 11)
            ..lineTo(12, 4)
            ..lineTo(20, 11)
            ..lineTo(20, 20)
            ..lineTo(14.5, 20)
            ..lineTo(14.5, 14.5)
            ..lineTo(9.5, 14.5)
            ..lineTo(9.5, 20)
            ..lineTo(4, 20)
            ..close(),
          stroke,
        );
      case ParentIconData.activities:
        canvas.drawCircle(const Offset(12, 12), 8.2, stroke);
        canvas.drawCircle(const Offset(12, 12), 2.2, stroke);
        canvas.drawLine(const Offset(12, 3.8), const Offset(12, 6.2), stroke);
        canvas.drawLine(const Offset(12, 17.8), const Offset(12, 20.2), stroke);
        canvas.drawLine(const Offset(3.8, 12), const Offset(6.2, 12), stroke);
        canvas.drawLine(const Offset(17.8, 12), const Offset(20.2, 12), stroke);
      case ParentIconData.events:
        canvas.drawRRect(
          RRect.fromRectAndRadius(const Rect.fromLTWH(4, 5.5, 16, 14.5), const Radius.circular(3)),
          stroke,
        );
        canvas.drawLine(const Offset(4, 10), const Offset(20, 10), stroke);
        canvas.drawLine(const Offset(8, 3.5), const Offset(8, 7), stroke);
        canvas.drawLine(const Offset(16, 3.5), const Offset(16, 7), stroke);
        canvas.drawCircle(const Offset(9, 14), 1.1, solid);
        canvas.drawCircle(const Offset(12, 14), 1.1, solid);
        canvas.drawCircle(const Offset(15, 14), 1.1, solid);
      case ParentIconData.billing:
        canvas.drawRRect(
          RRect.fromRectAndRadius(const Rect.fromLTWH(3.5, 6, 17, 12), const Radius.circular(3)),
          stroke,
        );
        canvas.drawLine(const Offset(3.5, 11), const Offset(20.5, 11), stroke);
        canvas.drawCircle(const Offset(16.5, 14.8), 1.4, stroke);
      case ParentIconData.bell:
        canvas.drawPath(
          Path()
            ..moveTo(7, 10.5)
            ..cubicTo(7, 7.2, 9.2, 4.8, 12, 4.8)
            ..cubicTo(14.8, 4.8, 17, 7.2, 17, 10.5)
            ..lineTo(17, 15)
            ..lineTo(19, 17.5)
            ..lineTo(5, 17.5)
            ..lineTo(7, 15)
            ..close(),
          stroke,
        );
        canvas.drawArc(const Rect.fromLTWH(10, 17.5, 4, 3), 0, math.pi, false, stroke);
      case ParentIconData.chat:
        canvas.drawRRect(
          RRect.fromRectAndRadius(const Rect.fromLTWH(3.5, 4.5, 17, 12.5), const Radius.circular(5)),
          stroke,
        );
        canvas.drawPath(
          Path()
            ..moveTo(8, 17)
            ..lineTo(8, 20.5)
            ..lineTo(12.5, 17),
          stroke,
        );
      case ParentIconData.sun:
        canvas.drawCircle(const Offset(12, 12), 4.2, fill);
        canvas.drawCircle(const Offset(12, 12), 4.2, stroke);
        for (var i = 0; i < 8; i++) {
          final a = i * (math.pi / 4);
          canvas.drawLine(
            Offset(12 + 6.2 * math.cos(a), 12 + 6.2 * math.sin(a)),
            Offset(12 + 9.2 * math.cos(a), 12 + 9.2 * math.sin(a)),
            stroke,
          );
        }
      case ParentIconData.mood:
        canvas.drawCircle(const Offset(12, 12), 8, stroke);
        canvas.drawCircle(const Offset(9, 10.5), 1.1, solid);
        canvas.drawCircle(const Offset(15, 10.5), 1.1, solid);
        canvas.drawArc(const Rect.fromLTWH(8, 11.5, 8, 6), 0.2, 2.7, false, stroke);
      case ParentIconData.food:
        canvas.drawLine(const Offset(8, 5), const Offset(8, 19), stroke);
        canvas.drawLine(const Offset(6, 5), const Offset(6, 10), stroke);
        canvas.drawLine(const Offset(10, 5), const Offset(10, 10), stroke);
        canvas.drawLine(const Offset(15, 5), const Offset(15, 19), stroke);
        canvas.drawArc(const Rect.fromLTWH(12.5, 5, 5, 7), -1.2, 2.4, false, stroke);
      case ParentIconData.sleep:
        canvas.drawPath(
          Path()
            ..moveTo(15.5, 6)
            ..cubicTo(11, 6.2, 7.5, 9.8, 7.8, 14.2)
            ..cubicTo(11.8, 12.8, 15.2, 9.5, 15.5, 6)
            ..close(),
          stroke,
        );
        canvas.drawLine(const Offset(16.5, 8.5), const Offset(18.5, 7), stroke);
        canvas.drawLine(const Offset(17, 11), const Offset(19.2, 10.2), stroke);
      case ParentIconData.toilet:
        canvas.drawRRect(
          RRect.fromRectAndRadius(const Rect.fromLTWH(7, 4, 10, 7), const Radius.circular(2)),
          stroke,
        );
        canvas.drawPath(
          Path()
            ..moveTo(8.5, 11)
            ..lineTo(8.5, 15)
            ..cubicTo(8.5, 18, 15.5, 18, 15.5, 15)
            ..lineTo(15.5, 11),
          stroke,
        );
        canvas.drawLine(const Offset(12, 18), const Offset(12, 20), stroke);
      case ParentIconData.notes:
        canvas.drawRRect(
          RRect.fromRectAndRadius(const Rect.fromLTWH(5.5, 3.5, 13, 17), const Radius.circular(2.5)),
          stroke,
        );
        canvas.drawLine(const Offset(9, 9), const Offset(15, 9), stroke);
        canvas.drawLine(const Offset(9, 12.5), const Offset(15, 12.5), stroke);
        canvas.drawLine(const Offset(9, 16), const Offset(13, 16), stroke);
      case ParentIconData.calendar:
        canvas.drawRRect(
          RRect.fromRectAndRadius(const Rect.fromLTWH(4, 5, 16, 15), const Radius.circular(3)),
          stroke,
        );
        canvas.drawLine(const Offset(4, 10), const Offset(20, 10), stroke);
        canvas.drawLine(const Offset(8, 3.2), const Offset(8, 7), stroke);
        canvas.drawLine(const Offset(16, 3.2), const Offset(16, 7), stroke);
      case ParentIconData.cake:
        canvas.drawPath(
          Path()
            ..moveTo(5, 14)
            ..lineTo(5, 20)
            ..lineTo(19, 20)
            ..lineTo(19, 14)
            ..quadraticBezierTo(12, 11.5, 5, 14),
          stroke,
        );
        canvas.drawLine(const Offset(9, 14), const Offset(9, 9), stroke);
        canvas.drawLine(const Offset(12, 14), const Offset(12, 7.5), stroke);
        canvas.drawLine(const Offset(15, 14), const Offset(15, 9), stroke);
        canvas.drawCircle(const Offset(9, 8), 1.1, fill);
        canvas.drawCircle(const Offset(12, 6.5), 1.1, fill);
        canvas.drawCircle(const Offset(15, 8), 1.1, fill);
      case ParentIconData.gift:
        canvas.drawRRect(
          RRect.fromRectAndRadius(const Rect.fromLTWH(5, 10, 14, 10), const Radius.circular(2)),
          stroke,
        );
        canvas.drawLine(const Offset(12, 10), const Offset(12, 20), stroke);
        canvas.drawLine(const Offset(5, 14), const Offset(19, 14), stroke);
        canvas.drawPath(
          Path()
            ..moveTo(12, 10)
            ..cubicTo(9, 6, 6.5, 8.5, 8.5, 10)
            ..cubicTo(10.5, 8.5, 12, 10, 12, 10),
          stroke,
        );
        canvas.drawPath(
          Path()
            ..moveTo(12, 10)
            ..cubicTo(15, 6, 17.5, 8.5, 15.5, 10)
            ..cubicTo(13.5, 8.5, 12, 10, 12, 10),
          stroke,
        );
      case ParentIconData.breakfast:
        canvas.drawOval(const Rect.fromLTWH(5, 9, 14, 10), stroke);
        canvas.drawLine(const Offset(8, 9), const Offset(9.5, 6), stroke);
        canvas.drawLine(const Offset(12, 9), const Offset(12, 5.5), stroke);
        canvas.drawLine(const Offset(16, 9), const Offset(14.5, 6), stroke);
      case ParentIconData.snack:
        canvas.drawPath(
          Path()
            ..moveTo(12, 4)
            ..cubicTo(8, 8, 6.5, 12, 8.5, 16)
            ..cubicTo(10, 19, 14, 19, 15.5, 16)
            ..cubicTo(17.5, 12, 16, 8, 12, 4)
            ..close(),
          stroke,
        );
        canvas.drawLine(const Offset(12, 4), const Offset(12, 7), stroke);
      case ParentIconData.lunch:
        canvas.drawOval(const Rect.fromLTWH(4.5, 8, 15, 11), stroke);
        canvas.drawOval(const Rect.fromLTWH(8, 11, 8, 5), stroke);
        canvas.drawLine(const Offset(7, 7), const Offset(9, 9), stroke);
      case ParentIconData.afternoon:
        canvas.drawPath(
          Path()
            ..moveTo(7, 18)
            ..lineTo(9, 8)
            ..lineTo(12, 12)
            ..lineTo(15, 7)
            ..lineTo(17, 18)
            ..close(),
          stroke,
        );
        canvas.drawLine(const Offset(7, 18), const Offset(17, 18), stroke);
      case ParentIconData.emptyToday:
        canvas.drawCircle(const Offset(12, 12), 8.5, fill);
        canvas.drawCircle(const Offset(12, 12), 8.5, stroke);
        canvas.drawLine(const Offset(12, 8), const Offset(12, 13), stroke);
        canvas.drawCircle(const Offset(12, 16), 0.9, solid);
      case ParentIconData.chevron:
        canvas.drawPath(
          Path()
            ..moveTo(9, 6)
            ..lineTo(15, 12)
            ..lineTo(9, 18),
          stroke,
        );
      case ParentIconData.child:
        canvas.drawCircle(const Offset(12, 8.5), 3.4, stroke);
        canvas.drawPath(
          Path()
            ..moveTo(6.5, 19)
            ..cubicTo(6.5, 14.5, 9, 12.5, 12, 12.5)
            ..cubicTo(15, 12.5, 17.5, 14.5, 17.5, 19),
          stroke,
        );
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _ParentIconPainter oldDelegate) {
    return oldDelegate.data != data || oldDelegate.color != color || oldDelegate.accent != accent;
  }
}
