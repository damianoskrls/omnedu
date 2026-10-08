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

class ChildMention {
  final String name;
  final String? photoUrl;
  const ChildMention(this.name, this.photoUrl);

  static ChildMention? fromMap(Map<dynamic, dynamic>? child) {
    if (child == null) return null;
    final name = child['fullName']?.toString().trim() ?? '';
    if (name.isEmpty) return null;
    final photo = child['avatarUrl']?.toString();
    return ChildMention(name, photo == null || photo.trim().isEmpty ? null : photo);
  }
}

class ChildMentions extends StatelessWidget {
  final List<ChildMention> people;
  const ChildMentions({super.key, required this.people});

  @override
  Widget build(BuildContext context) {
    final shown = people.where((person) => person.name.trim().isNotEmpty).toList();
    if (shown.isEmpty) return const SizedBox.shrink();
    return Wrap(
      spacing: 8,
      runSpacing: 6,
      children: [
        for (final person in shown)
          Container(
            padding: const EdgeInsets.fromLTRB(4, 4, 10, 4),
            decoration: BoxDecoration(
              color: const Color(0xFFF6F3FA),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                PersonFace(
                  name: person.name,
                  photoUrl: person.photoUrl,
                  size: 22,
                  radius: 11,
                  fontSize: 11,
                  background: const Color(0xFF77328D),
                  foreground: Colors.white,
                ),
                const SizedBox(width: 6),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 150),
                  child: Text(
                    person.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF2C2422)),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
