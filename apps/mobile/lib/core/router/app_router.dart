import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';
import '../../features/auth/screens/login_screen.dart';
import '../../features/teacher/screens/teacher_shell.dart';
import '../../features/parent/screens/parent_shell.dart';

class _RouterNotifier extends ChangeNotifier {
  final Ref _ref;
  AuthState _authState;

  _RouterNotifier(this._ref) : _authState = _ref.read(authProvider) {
    _ref.listen(authProvider, (_, next) {
      _authState = next;
      notifyListeners();
    });
  }

  String? redirect(BuildContext context, GoRouterState state) {
    if (_authState.isLoading) return null;

    final loggedIn = _authState.isAuthenticated;
    final onAuth = state.matchedLocation.startsWith('/login');

    if (!loggedIn && !onAuth) return '/login';
    if (loggedIn && onAuth) {
      final user = _authState.user!;
      if (user.isTeacher || user.isSchoolAdmin) return '/teacher';
      if (user.isParent) return '/parent';
      return '/teacher';
    }
    return null;
  }
}

final routerProvider = Provider<GoRouter>((ref) {
  final notifier = _RouterNotifier(ref);

  return GoRouter(
    initialLocation: '/login',
    refreshListenable: notifier,
    redirect: notifier.redirect,
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),

      ShellRoute(
        builder: (context, state, child) => child,
        routes: [
          GoRoute(
            path: '/teacher',
            builder: (_, __) => const TeacherShell(),
            routes: [
              GoRoute(
                path: 'report/:classId',
                builder: (_, state) => TeacherShell(initialClassId: state.pathParameters['classId']),
              ),
            ],
          ),
          GoRoute(
            path: '/parent',
            builder: (_, __) => const ParentShell(),
          ),
        ],
      ),
    ],
    errorBuilder: (_, state) => Scaffold(
      body: Center(child: Text('Error: ${state.error?.message}')),
    ),
  );
});
