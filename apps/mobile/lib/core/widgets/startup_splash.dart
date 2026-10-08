import 'dart:async';

import 'package:flutter/material.dart';

/// Full-screen Oneirochora logo shown as soon as the app draws, before login.
class StartupSplash extends StatefulWidget {
  final Widget child;
  const StartupSplash({super.key, required this.child});

  @override
  State<StartupSplash> createState() => _StartupSplashState();
}

class _StartupSplashState extends State<StartupSplash> with SingleTickerProviderStateMixin {
  late final AnimationController _fade;
  bool _gone = false;

  @override
  void initState() {
    super.initState();
    _fade = AnimationController(vsync: this, duration: const Duration(milliseconds: 420));
    _fade.addStatusListener((status) {
      if (status == AnimationStatus.completed && mounted) setState(() => _gone = true);
    });
    unawaited(Future<void>.delayed(const Duration(milliseconds: 1400), () {
      if (mounted) _fade.forward();
    }));
  }

  @override
  void dispose() {
    _fade.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        widget.child,
        if (!_gone)
          FadeTransition(
            opacity: Tween<double>(begin: 1, end: 0).animate(CurvedAnimation(parent: _fade, curve: Curves.easeOut)),
            child: const _SplashMark(),
          ),
      ],
    );
  }
}

class _SplashMark extends StatelessWidget {
  const _SplashMark();

  @override
  Widget build(BuildContext context) {
    return const ColoredBox(
      color: Color(0xFFF8F4FC),
      child: Center(
        child: Image(
          image: AssetImage('assets/images/school_logo.png'),
          width: 240,
          height: 240,
          fit: BoxFit.contain,
        ),
      ),
    );
  }
}
