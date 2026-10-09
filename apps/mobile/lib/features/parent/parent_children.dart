import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';

final myChildrenProvider = FutureProvider.family<List<dynamic>, String>(
  (ref, schoolId) async {
    final dio = ref.read(dioProvider);
    final resp = await dio.get('/schools/$schoolId/students/my-children');
    final data = resp.data;
    return data is List ? data : [];
  },
);
