import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/user.dart';
import '../storage/secure_storage.dart';
import '../api/api_client.dart';

class AuthState {
  final AuthUser? user;
  final bool isLoading;
  final String? error;

  const AuthState({this.user, this.isLoading = false, this.error});
  bool get isAuthenticated => user != null;
  AuthState copyWith({AuthUser? user, bool? isLoading, String? error}) =>
      AuthState(user: user ?? this.user, isLoading: isLoading ?? this.isLoading, error: error);
}

class AuthNotifier extends StateNotifier<AuthState> {
  final SecureStorageService _storage;
  final Ref _ref;

  AuthNotifier(this._storage, this._ref) : super(const AuthState(isLoading: true)) {
    _restoreSession();
  }

  Future<void> _restoreSession() async {
    final token = await _storage.getAccessToken();
    if (token == null) {
      state = const AuthState();
      return;
    }
    try {
      final parts = token.split('.');
      final payload = jsonDecode(
        utf8.decode(base64Url.decode(base64Url.normalize(parts[1]))),
      ) as Map<String, dynamic>;

      final exp = payload['exp'] as int?;
      if (exp != null && DateTime.fromMillisecondsSinceEpoch(exp * 1000).isBefore(DateTime.now())) {
        await _refreshToken();
        return;
      }
      state = AuthState(user: AuthUser.fromTokenPayload(payload));
    } catch (_) {
      state = const AuthState();
    }
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

  Future<void> verifyOtp(String phone, String otp) async {
    state = const AuthState(isLoading: true);
    try {
      final dio = _ref.read(dioProvider);
      final resp = await dio.post('/auth/otp/verify', data: {'phone': phone, 'otp': otp});
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

  Future<void> switchContext(String schoolId, String role) async {
    final dio = _ref.read(dioProvider);
    final resp = await dio.post('/auth/switch-context', data: {'schoolId': schoolId, 'role': role});
    final newToken = (resp.data as Map<String, dynamic>)['accessToken'] as String;
    final refreshToken = await _storage.getRefreshToken();
    await _storage.storeTokens(accessToken: newToken, refreshToken: refreshToken!);
    final payload = _decodeJwt(newToken);
    state = AuthState(user: AuthUser.fromTokenPayload(payload));
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
    final refreshToken = await _storage.getRefreshToken();
    if (refreshToken == null) {
      state = const AuthState();
      return;
    }
    try {
      final dio = _ref.read(dioProvider);
      final resp = await dio.post('/auth/refresh', data: {'refreshToken': refreshToken});
      final newToken = (resp.data as Map<String, dynamic>)['accessToken'] as String;
      await _storage.storeTokens(accessToken: newToken, refreshToken: refreshToken);
      final payload = _decodeJwt(newToken);
      state = AuthState(user: AuthUser.fromTokenPayload(payload));
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
