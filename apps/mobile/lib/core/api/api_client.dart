import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../storage/secure_storage.dart';

const _baseUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: 'http://10.0.2.2:3001/api/v1', // Android emulator → localhost
);

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
  return url
      .replaceFirst('http://localhost:', '${_apiOrigin.split(':').take(2).join(':')}:')
      .replaceFirst('https://localhost:', '${_apiOrigin.split(':').take(2).join(':')}:');
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
        final token = await storage.getAccessToken();
        if (token != null) options.headers['Authorization'] = 'Bearer $token';
        handler.next(options);
      },
      onResponse: (response, handler) {
        if (response.data is Map && response.data['data'] != null) {
          response.data = response.data['data'];
        }
        handler.next(response);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401) {
          final refreshToken = await storage.getRefreshToken();
          if (refreshToken != null) {
            try {
              final resp = await Dio().post(
                '$_baseUrl/auth/refresh',
                data: {'refreshToken': refreshToken},
              );
              final newToken = resp.data['data']['accessToken'] as String;
              await storage.storeTokens(
                accessToken: newToken,
                refreshToken: refreshToken,
              );
              error.requestOptions.headers['Authorization'] = 'Bearer $newToken';
              final retried = await dio.fetch(error.requestOptions);
              return handler.resolve(retried);
            } catch (_) {
              await storage.clearAll();
            }
          }
        }
        handler.next(error);
      },
    ),
  );

  return dio;
});
