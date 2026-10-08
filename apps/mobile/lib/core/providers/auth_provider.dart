import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../models/user.dart';
import '../storage/secure_storage.dart';

class OtpVerification {
  final String pendingToken;
  final List<RoleOption> choices;

  const OtpVerification({required this.pendingToken, required this.choices});
}

class AuthState {
  final AuthUser? user;
  final bool isLoading;
  final String? error;
  final OtpVerification? pendingRoles;

  const AuthState({this.user, this.isLoading = false, this.error, this.pendingRoles});
  bool get isAuthenticated => user != null;
  AuthState copyWith({AuthUser? user, bool? isLoading, String? error, OtpVerification? pendingRoles}) =>
      AuthState(
        user: user ?? this.user,
        isLoading: isLoading ?? this.isLoading,
        error: error,
        pendingRoles: pendingRoles ?? this.pendingRoles,
      );
}

class AuthNotifier extends StateNotifier<AuthState> {
  final SecureStorageService _storage;
  final Ref _ref;

  AuthNotifier(this._storage, this._ref) : super(const AuthState(isLoading: true)) {
    onSessionExpired = () {
      state = const AuthState();
    };
    _restoreSession();
  }

  Future<void> _restoreSession() async {
    final token = await _storage.getAccessToken();
    if (token == null) {
      state = const AuthState();
      return;
    }
    await _refreshToken();
  }

  Future<void> login(String email, String password) async {
    state = const AuthState(isLoading: true);
    try {
      final dio = _ref.read(dioProvider);
      final resp = await dio.post('/auth/login', data: {'email': email, 'password': password});
      final data = resp.data as Map<String, dynamic>;
      await _storage.storeTokens(
        accessToken: data['accessToken'] as String,
        refreshToken: data['refreshToken'] as String,
      );
      final payload = _decodeJwt(data['accessToken'] as String);
      state = AuthState(user: AuthUser.fromTokenPayload(payload));
    } on Exception catch (e) {
      state = AuthState(error: _extractMessage(e));
    }
  }

  Future<bool> requestOtp(String phone) async {
    state = const AuthState(isLoading: true);
    try {
      final dio = _ref.read(dioProvider);
      await dio.post('/auth/otp/request', data: {'phone': phone});
      state = const AuthState();
      return true;
    } on Exception catch (e) {
      state = AuthState(error: _extractMessage(e));
      return false;
    }
  }

  Future<OtpVerification?> verifyOtp(String phone, String otp) async {
    state = const AuthState(isLoading: true);
    try {
      final dio = _ref.read(dioProvider);
      final resp = await dio.post('/auth/otp/verify', data: {'phone': phone, 'otp': otp});
      final data = resp.data as Map<String, dynamic>;
      if (data['needsRole'] == true) {
        final pending = data['pendingToken'] as String?;
        final choices = _roleOptions(data['choices']);
        if (pending == null || choices.length < 2) {
          state = const AuthState(error: 'Δεν ήταν δυνατή η επιλογή ρόλου');
          return null;
        }
        final pendingRoles = OtpVerification(pendingToken: pending, choices: choices);
        state = AuthState(pendingRoles: pendingRoles);
        return pendingRoles;
      }
      await _storeSession(data);
      return null;
    } on Exception catch (e) {
      state = AuthState(error: _extractMessage(e));
      return null;
    }
  }

  Future<void> selectRole({
    required String pendingToken,
    required String userId,
    required String schoolId,
    required String role,
  }) async {
    state = AuthState(isLoading: true, pendingRoles: state.pendingRoles);
    try {
      final dio = _ref.read(dioProvider);
      final resp = await dio.post('/auth/otp/select', data: {
        'pendingToken': pendingToken,
        'userId': userId,
        'schoolId': schoolId,
        'role': role,
      });
      await _storeSession(resp.data as Map<String, dynamic>);
    } on Exception catch (e) {
      state = AuthState(error: _extractMessage(e), pendingRoles: state.pendingRoles);
    }
  }

  void clearPendingRoles() {
    state = const AuthState();
  }

  Future<void> switchContext(String schoolId, String role, {String? userId}) async {
    final dio = _ref.read(dioProvider);
    final resp = await dio.post('/auth/switch-context', data: {
      'schoolId': schoolId,
      'role': role,
      if (userId != null) 'userId': userId,
    });
    final data = resp.data as Map<String, dynamic>;
    final newToken = data['accessToken'] as String;
    final refreshToken = data['refreshToken'] as String? ?? await _storage.getRefreshToken();
    await _storage.storeTokens(accessToken: newToken, refreshToken: refreshToken!);
    final payload = _decodeJwt(newToken);
    state = AuthState(user: AuthUser.fromTokenPayload(payload));
  }

  List<RoleOption> _roleOptions(dynamic raw) {
    if (raw is! List) return [];
    return raw
        .whereType<Map>()
        .map((row) => RoleOption.fromJson(Map<String, dynamic>.from(row)))
        .toList();
  }

  Future<void> _storeSession(Map<String, dynamic> data) async {
    final accessToken = data['accessToken'] as String;
    final refreshToken = data['refreshToken'] as String;
    await _storage.storeTokens(accessToken: accessToken, refreshToken: refreshToken);
    state = AuthState(user: AuthUser.fromTokenPayload(_decodeJwt(accessToken)));
  }

  Future<void> acceptTerms() async {
    final dio = _ref.read(dioProvider);
    final resp = await dio.post('/users/me/terms');
    final data = resp.data as Map<String, dynamic>;
    await applySession(data['accessToken'] as String, data['refreshToken'] as String);
  }

  Future<void> applySession(String accessToken, String refreshToken) async {
    await _storage.storeTokens(accessToken: accessToken, refreshToken: refreshToken);
    state = AuthState(user: AuthUser.fromTokenPayload(_decodeJwt(accessToken)));
  }

  Future<void> logout() async {
    final refreshToken = await _storage.getRefreshToken();
    if (refreshToken != null) {
      try {
        final dio = _ref.read(dioProvider);
        await dio.post('/auth/logout', data: {'refreshToken': refreshToken});
      } catch (_) {}
    }
    await _storage.clearAll();
    state = const AuthState();
  }

  Future<void> _refreshToken() async {
    final access = await refreshSession(_storage);
    if (access != null) {
      state = AuthState(user: AuthUser.fromTokenPayload(_decodeJwt(access)));
      return;
    }
    final stored = await _storage.getAccessToken();
    if (stored == null) {
      state = const AuthState();
      return;
    }
    try {
      state = AuthState(user: AuthUser.fromTokenPayload(_decodeJwt(stored)));
    } catch (_) {
      state = const AuthState();
    }
  }

  Map<String, dynamic> _decodeJwt(String token) {
    final parts = token.split('.');
    return jsonDecode(
      utf8.decode(base64Url.decode(base64Url.normalize(parts[1]))),
    ) as Map<String, dynamic>;
  }

  String _extractMessage(Exception e) {
    if (e is DioException) {
      final data = e.response?.data;
      if (data is Map) {
        final msg = data['message'] as String?;
        if (msg != null && msg.isNotEmpty) return msg;
      }
      switch (e.type) {
        case DioExceptionType.connectionTimeout:
        case DioExceptionType.receiveTimeout:
        case DioExceptionType.sendTimeout:
          return 'Η σύνδεση έληξε. Ελέγξτε το δίκτυό σας.';
        case DioExceptionType.connectionError:
          return 'Δεν είναι δυνατή η σύνδεση. Ελέγξτε ότι είστε στο ίδιο δίκτυο.';
        default:
          return e.message ?? 'Σφάλμα σύνδεσης';
      }
    }
    return e.toString().replaceAll('Exception: ', '');
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final storage = ref.read(secureStorageProvider);
  return AuthNotifier(storage, ref);
});
