import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../storage/secure_storage.dart';

const productionApiUrl = 'https://omneduapi-production.up.railway.app/api/v1';

const _envApiUrl = String.fromEnvironment('API_URL', defaultValue: productionApiUrl);

bool _localApi(String url) {
  final host = Uri.tryParse(url)?.host ?? '';
  return host == '10.0.2.2' || host == 'localhost' || host == '127.0.0.1';
}

// 10.0.2.2 is the Android emulator's name for the computer. On an iPhone it
// never answers, so a saved run config that still points there times out.
String get _baseUrl {
  if (!Platform.isAndroid && _localApi(_envApiUrl)) return productionApiUrl;
  return _envApiUrl;
}

bool _publicAuth(String path) {
  return path.contains('/auth/otp') || path.contains('/auth/login') || path.contains('/auth/refresh');
}

// The API host (scheme + host + port) derived from _baseUrl.
// Used to rewrite media URLs that the server emits as "http://localhost:..."
String get _apiOrigin {
  final uri = Uri.tryParse(_baseUrl);
  if (uri == null) return 'http://10.0.2.2:3001';
  return '${uri.scheme}://${uri.host}:${uri.port}';
}

/// Rewrite any URL the API returns that still points to localhost so it
/// resolves correctly on a physical device or non-emulator environment.
String fixMediaUrl(String? url) {
  if (url == null || url.isEmpty) return '';
  var value = url.trim();
  if (value.startsWith('/')) value = '$_apiOrigin$value';
  return value
      .replaceFirst(RegExp(r'https?://localhost:\d+'), _apiOrigin)
      .replaceFirst(RegExp(r'https?://127\.0\.0\.1:\d+'), _apiOrigin);
}

void Function()? onSessionExpired;
Future<String?>? _refreshing;

Map<String, dynamic>? _payload(String token) {
  try {
    final parts = token.split('.');
    if (parts.length < 2) return null;
    return jsonDecode(utf8.decode(base64Url.decode(base64Url.normalize(parts[1])))) as Map<String, dynamic>;
  } catch (_) {
    return null;
  }
}

bool _expired(String token) {
  final payload = _payload(token);
  final exp = payload?['exp'];
  if (exp is! int) return false;
  final expiry = DateTime.fromMillisecondsSinceEpoch(exp * 1000);
  return DateTime.now().isAfter(expiry.subtract(const Duration(seconds: 30)));
}

Future<String?> refreshSession(SecureStorageService storage) {
  final current = _refreshing;
  if (current != null) return current;
  final run = _refreshSession(storage);
  _refreshing = run;
  return run.whenComplete(() {
    if (identical(_refreshing, run)) _refreshing = null;
  });
}

Future<String?> _refreshSession(SecureStorageService storage) async {
  final refreshToken = await storage.getRefreshToken();
  if (refreshToken == null || refreshToken.isEmpty) return null;
  final current = await storage.getAccessToken();
  final payload = current == null ? null : _payload(current);
  try {
    final resp = await Dio(BaseOptions(
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 20),
    )).post(
      '$_baseUrl/auth/refresh',
      data: {
        'refreshToken': refreshToken,
        if (payload?['schoolId'] is String) 'schoolId': payload!['schoolId'],
        if (payload?['role'] is String) 'role': payload!['role'],
      },
    );
    final data = resp.data is Map ? resp.data['data'] : null;
    if (data is! Map || data['accessToken'] is! String) return null;
    final access = data['accessToken'] as String;
    final nextRefresh = data['refreshToken'] is String ? data['refreshToken'] as String : refreshToken;
    await storage.storeTokens(accessToken: access, refreshToken: nextRefresh);
    return access;
  } on DioException catch (error) {
    final code = error.response?.statusCode;
    if (code == 401 || code == 403) {
      await storage.clearAll();
      onSessionExpired?.call();
    }
    return null;
  } catch (_) {
    return null;
  }
}

final dioProvider = Provider<Dio>((ref) {
  final storage = ref.read(secureStorageProvider);
  final dio = Dio(BaseOptions(
    baseUrl: _baseUrl,
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 30),
    headers: {'Content-Type': 'application/json'},
  ));

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        if (_publicAuth(options.path)) {
          options.headers.remove('Authorization');
          return handler.next(options);
        }
        var token = await storage.getAccessToken();
        if (token != null && _expired(token)) {
          token = await refreshSession(storage) ?? token;
        }
        if (token != null && token.isNotEmpty) options.headers['Authorization'] = 'Bearer $token';
        handler.next(options);
      },
      onResponse: (response, handler) {
        if (response.data is Map && response.data['data'] != null) {
          response.data = response.data['data'];
        }
        handler.next(response);
      },
      onError: (error, handler) async {
        final already = error.requestOptions.extra['retried'] == true;
        if (error.response?.statusCode == 401 && !already) {
          final access = await refreshSession(storage);
          if (access != null) {
            error.requestOptions.extra['retried'] = true;
            error.requestOptions.headers['Authorization'] = 'Bearer $access';
            try {
              final retried = await dio.fetch(error.requestOptions);
              return handler.resolve(retried);
            } catch (retryError) {
              if (retryError is DioException) return handler.next(retryError);
            }
          }
        }
        handler.next(error);
      },
    ),
  );

  return dio;
});
