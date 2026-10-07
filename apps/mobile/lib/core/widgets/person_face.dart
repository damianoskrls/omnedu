import 'package:flutter/material.dart';
import 'app_image.dart';

/// Photo of a student or teacher, with the first letter when no photo exists.
class PersonFace extends StatelessWidget {
  final String name;
  final String? photoUrl;
  final double size;
  final double radius;
  final Color background;
  final Color foreground;
  final double fontSize;

  const PersonFace({
    super.key,
    required this.name,
    this.photoUrl,
    this.size = 36,
    this.radius = 12,
    this.background = const Color(0xFFEEF2FF),
    this.foreground = const Color(0xFF77328D),
    this.fontSize = 14,
  });

  @override
  Widget build(BuildContext context) {
    final trimmed = name.trim();
    final letter = trimmed.isEmpty ? '?' : trimmed[0].toUpperCase();
    final fallback = Container(
      width: size,
      height: size,
      color: background,
      alignment: Alignment.center,
      child: Text(
        letter,
        style: TextStyle(color: foreground, fontWeight: FontWeight.w800, fontSize: fontSize),
      ),
    );
    final photo = photoUrl?.trim() ?? '';
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: photo.isEmpty
          ? fallback
          : AppImage(
              photo,
              width: size,
              height: size,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => fallback,
            ),
    );
  }
}
