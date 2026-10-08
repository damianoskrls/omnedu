import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/providers/auth_provider.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';
import 'core/widgets/app_top_bar.dart';
import 'core/widgets/startup_splash.dart';

class OmneduApp extends ConsumerWidget {
  const OmneduApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    final loggedIn = ref.watch(authProvider).isAuthenticated;
    return MaterialApp.router(
      title: 'Ονειροχώρα',
      theme: AppTheme.light(),
      themeMode: ThemeMode.light,
      routerConfig: router,
      debugShowCheckedModeBanner: false,
      builder: (context, child) {
        final page = child ?? const SizedBox.shrink();
        if (!loggedIn) return StartupSplash(child: page);
        final top = MediaQuery.of(context).padding.top + 58;
        final navigatorKey = router.routerDelegate.navigatorKey;
        return StartupSplash(
          child: Stack(
            children: [
              Padding(
                padding: EdgeInsets.only(top: top),
                child: MediaQuery(
                  data: MediaQuery.of(context).removePadding(removeTop: true),
                  child: page,
                ),
              ),
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: AppTopBar(navigatorKey: navigatorKey),
              ),
            ],
          ),
        );
      },
    );
  }
}
