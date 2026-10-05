import 'package:flutter/material.dart';
import '../api/api_client.dart';

/// Drop-in for Image.network that rewrites localhost URLs so they work on
/// physical devices (the API emits http://localhost:3001 but the device
/// needs http://10.0.2.2:3001 or the configured API host).
class AppImage extends StatelessWidget {
  final String? url;
  final double? width;
  final double? height;
  final BoxFit fit;
  final Widget Function(BuildContext, Object, StackTrace?)? errorBuilder;

  const AppImage(
    this.url, {
    super.key,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.errorBuilder,
  });

  @override
  Widget build(BuildContext context) {
    final resolved = fixMediaUrl(url);
    if (resolved.isEmpty) {
      return _placeholder();
    }
    return Image.network(
      resolved,
      width: width,
      height: height,
      fit: fit,
      errorBuilder: errorBuilder ??
          (_, __, ___) => _placeholder(),
    );
  }

  Widget _placeholder() => Container(
        width: width,
        height: height,
        color: const Color(0xFFF3F4F6),
        child: const Center(
          child: Icon(Icons.broken_image_outlined, color: Color(0xFF9CA3AF), size: 20),
        ),
      );
}
