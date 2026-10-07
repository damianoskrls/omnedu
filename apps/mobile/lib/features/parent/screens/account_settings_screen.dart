import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/providers/auth_provider.dart';

class AccountSettingsScreen extends ConsumerStatefulWidget {
  const AccountSettingsScreen({super.key});

  @override
  ConsumerState<AccountSettingsScreen> createState() => _AccountSettingsScreenState();
}

class _AccountSettingsScreenState extends ConsumerState<AccountSettingsScreen> {
  late final TextEditingController _name;
  late final TextEditingController _email;
  bool _saving = false;
  String _error = '';

  @override
  void initState() {
    super.initState();
    final user = ref.read(authProvider).user;
    _name = TextEditingController(text: user?.fullName ?? '');
    _email = TextEditingController(text: user?.email ?? '');
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() { _saving = true; _error = ''; });
    try {
      final dio = ref.read(dioProvider);
      final resp = await dio.patch('/users/me', data: {
        'fullName': _name.text.trim(),
        'email': _email.text.trim(),
      });
      final data = resp.data;
      if (data is Map && data['accessToken'] is String && data['refreshToken'] is String) {
        await ref.read(authProvider.notifier).applySession(data['accessToken'] as String, data['refreshToken'] as String);
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Ο λογαριασμός ενημερώθηκε.')));
      }
    } on DioException catch (error) {
      final message = error.response?.data;
      setState(() {
        _error = message is Map && message['message'] is String
            ? message['message'] as String
            : 'Η αποθήκευση δεν ολοκληρώθηκε.';
      });
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _delete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Διαγραφή λογαριασμού'),
        content: const Text('Ο λογαριασμός θα κλείσει και δεν θα μπορείς να συνδεθείς ξανά με αυτό το email ή κινητό.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Άκυρο')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Διαγραφή', style: TextStyle(color: Color(0xFFDC2626)))),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() { _saving = true; _error = ''; });
    try {
      await ref.read(dioProvider).delete('/users/me');
      await ref.read(authProvider.notifier).logout();
    } on DioException catch (error) {
      final message = error.response?.data;
      setState(() {
        _error = message is Map && message['message'] is String
            ? message['message'] as String
            : 'Η διαγραφή δεν ολοκληρώθηκε.';
      });
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      appBar: AppBar(title: const Text('Ρυθμίσεις λογαριασμού')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          TextField(
            controller: _name,
            decoration: const InputDecoration(labelText: 'Ονοματεπώνυμο', filled: true, fillColor: Colors.white),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(labelText: 'Email', filled: true, fillColor: Colors.white),
          ),
          if (_error.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(_error, style: const TextStyle(color: Color(0xFFDC2626))),
          ],
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _saving ? null : _save,
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFF77328D), minimumSize: const Size.fromHeight(48)),
            child: Text(_saving ? 'Αποθήκευση...' : 'Αποθήκευση'),
          ),
          const SizedBox(height: 28),
          OutlinedButton(
            onPressed: _saving ? null : _delete,
            style: OutlinedButton.styleFrom(foregroundColor: const Color(0xFFDC2626), minimumSize: const Size.fromHeight(48)),
            child: const Text('Διαγραφή λογαριασμού'),
          ),
        ],
      ),
    );
  }
}
