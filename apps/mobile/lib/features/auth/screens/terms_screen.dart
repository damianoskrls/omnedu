import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/providers/auth_provider.dart';

class TermsScreen extends ConsumerStatefulWidget {
  const TermsScreen({super.key});

  @override
  ConsumerState<TermsScreen> createState() => _TermsScreenState();
}

class _TermsScreenState extends ConsumerState<TermsScreen> {
  bool _accepted = false;
  bool _saving = false;
  String? _error;
  String _operating = '';
  String _financial = '';
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final schoolId = ref.read(authProvider).user?.schoolId ?? '';
    if (schoolId.isEmpty) {
      if (mounted) setState(() => _loading = false);
      return;
    }
    try {
      final resp = await ref.read(dioProvider).get('/schools/$schoolId/regulations');
      final data = resp.data is Map ? Map<String, dynamic>.from(resp.data as Map) : <String, dynamic>{};
      if (!mounted) return;
      setState(() {
        _operating = data['operatingRegulation']?.toString().trim() ?? '';
        _financial = data['financialRegulation']?.toString().trim() ?? '';
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _submit() async {
    if (!_accepted || _saving) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(authProvider.notifier).acceptTerms();
    } catch (_) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = 'Η αποδοχή δεν αποθηκεύτηκε. Δοκίμασε ξανά.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F4FC),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 20, 24, 8),
              child: Column(
                children: [
                  Image.asset('assets/images/school_logo.png', width: 96, height: 96, fit: BoxFit.contain),
                  const SizedBox(height: 12),
                  const Text(
                    'Όροι και προστασία δεδομένων',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: Color(0xFF2C2422)),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Την πρώτη φορά που μπαίνεις, διάβασε και αποδέξου τους όρους του σχολείου.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Color(0xFF6B7280), height: 1.4),
                  ),
                ],
              ),
            ),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator(color: Color(0xFF77328D)))
                  : ListView(
                      padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
                      children: [
                        const _Block(
                          title: 'Τι τηρεί το σχολείο',
                          body:
                              'Η Ονειροχώρα επεξεργάζεται τα στοιχεία σου και του παιδιού σου μόνο για τη λειτουργία του σταθμού: παρουσίες, ημερήσιο δελτίο, ανακοινώσεις, πληρωμές, φωτογραφίες εκδηλώσεων και επικοινωνία με τους εκπαιδευτικούς. Τα στοιχεία δεν δίνονται σε τρίτους για διαφήμιση. Μπορείς να δεις, να διορθώσεις ή να ζητήσεις διαγραφή του λογαριασμού σου από τις ρυθμίσεις.',
                        ),
                        if (_operating.isNotEmpty) _Block(title: 'Κανονισμός λειτουργίας', body: _operating),
                        if (_financial.isNotEmpty) _Block(title: 'Οικονομικός κανονισμός', body: _financial),
                      ],
                    ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  InkWell(
                    onTap: () => setState(() => _accepted = !_accepted),
                    borderRadius: BorderRadius.circular(12),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Row(
                        children: [
                          Checkbox(
                            value: _accepted,
                            activeColor: const Color(0xFF702E8C),
                            onChanged: (value) => setState(() => _accepted = value ?? false),
                          ),
                          const Expanded(
                            child: Text(
                              'Αποδέχομαι τους όρους του σχολείου και την επεξεργασία των δεδομένων.',
                              style: TextStyle(fontSize: 14, height: 1.35, color: Color(0xFF2C2422)),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 6),
                    Text(_error!, style: const TextStyle(color: Color(0xFFDC2626), fontSize: 13)),
                  ],
                  const SizedBox(height: 8),
                  SizedBox(
                    height: 52,
                    child: FilledButton(
                      onPressed: _accepted && !_saving ? _submit : null,
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF702E8C),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                      child: _saving
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Text('Συνέχεια', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                    ),
                  ),
                  TextButton(
                    onPressed: _saving ? null : () => ref.read(authProvider.notifier).logout(),
                    child: const Text('Αποσύνδεση', style: TextStyle(color: Color(0xFF6B7280))),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Block extends StatelessWidget {
  final String title;
  final String body;
  const _Block({required this.title, required this.body});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF0E6F4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF77328D))),
          const SizedBox(height: 8),
          Text(body, style: const TextStyle(fontSize: 14, height: 1.45, color: Color(0xFF374151))),
        ],
      ),
    );
  }
}
