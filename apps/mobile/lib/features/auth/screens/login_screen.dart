import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers/auth_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _phoneCtrl = TextEditingController();
  bool _showOtp = false;
  String _phone = '';
  String? _phoneError;

  @override
  void dispose() {
    _phoneCtrl.dispose();
    super.dispose();
  }

  Future<void> _requestOtp() async {
    final phone = _phoneCtrl.text.trim();
    if (phone.length < 10) {
      setState(() => _phoneError = 'Εισάγετε έναν έγκυρο αριθμό 10 ψηφίων');
      return;
    }
    // Show OTP screen immediately (optimistic), then validate
    setState(() {
      _phoneError = null;
      _phone = phone;
      _showOtp = true;
    });
    final ok = await ref.read(authProvider.notifier).requestOtp(phone);
    if (!ok && mounted) {
      setState(() => _showOtp = false); // go back if API failed
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final isLoading = authState.isLoading;

    return Scaffold(
      backgroundColor: const Color(0xFFF8F4FC),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 32),
            child: Column(
              children: [
                // Logo
                Image.asset(
                  'assets/images/school_logo.png',
                  width: 160,
                  height: 160,
                  fit: BoxFit.contain,
                ),
                const SizedBox(height: 8),
                Text(
                  _showOtp ? 'Εισάγετε τον κωδικό που λάβατε' : 'Εισάγετε το κινητό σας',
                  style: const TextStyle(color: Color(0xFF6B7280), fontSize: 14),
                ),
                const SizedBox(height: 40),

                // Card
                Container(
                  padding: const EdgeInsets.all(28),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.06),
                        blurRadius: 24,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: _showOtp
                      ? _OtpInput(
                          phone: _phone,
                          isLoading: isLoading,
                          onBack: () => setState(() => _showOtp = false),
                          error: authState.error,
                        )
                      : _PhoneInput(
                          ctrl: _phoneCtrl,
                          isLoading: isLoading,
                          onSubmit: _requestOtp,
                          error: _phoneError ?? authState.error,
                        ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PhoneInput extends StatelessWidget {
  final TextEditingController ctrl;
  final bool isLoading;
  final VoidCallback onSubmit;
  final String? error;
  const _PhoneInput({required this.ctrl, required this.isLoading, required this.onSubmit, this.error});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Αριθμός κινητού',
          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: Color(0xFF374151)),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: ctrl,
          keyboardType: TextInputType.phone,
          autofocus: true,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          style: const TextStyle(fontSize: 18, letterSpacing: 2, fontWeight: FontWeight.w600),
          decoration: InputDecoration(
            prefixIcon: const Padding(
              padding: EdgeInsets.symmetric(horizontal: 14),
              child: Text('+30', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Color(0xFF702E8C))),
            ),
            prefixIconConstraints: const BoxConstraints(minWidth: 0, minHeight: 0),
            hintText: '6900 000 000',
            hintStyle: const TextStyle(color: Color(0xFFD1D5DB), letterSpacing: 2),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: Color(0xFF702E8C), width: 2),
            ),
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          ),
          onSubmitted: (_) => onSubmit(),
        ),
        if (error != null) ...[
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: const Color(0xFFFEF2F2),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFFCA5A5)),
            ),
            child: Row(
              children: [
                const Icon(Icons.error_outline_rounded, size: 16, color: Color(0xFFDC2626)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    error!,
                    style: const TextStyle(color: Color(0xFFDC2626), fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 16),
        SizedBox(
          height: 52,
          child: FilledButton(
            onPressed: isLoading ? null : onSubmit,
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF702E8C),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            child: isLoading
                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Αποστολή κωδικού', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
          ),
        ),
        const SizedBox(height: 16),
        const Text(
          'Ο κωδικός επιβεβαίωσης είναι 000000',
          textAlign: TextAlign.center,
          style: TextStyle(color: Color(0xFF702E8C), fontSize: 12, fontWeight: FontWeight.w600),
        ),
      ],
    );
  }
}

class _OtpInput extends ConsumerStatefulWidget {
  final String phone;
  final bool isLoading;
  final VoidCallback onBack;
  final String? error;
  const _OtpInput({required this.phone, required this.isLoading, required this.onBack, this.error});

  @override
  ConsumerState<_OtpInput> createState() => _OtpInputState();
}

class _OtpInputState extends ConsumerState<_OtpInput> {
  final _controllers = List.generate(6, (_) => TextEditingController());
  final _focuses = List.generate(6, (_) => FocusNode());
  bool _syncing = false;

  @override
  void initState() {
    super.initState();
    for (var i = 0; i < _focuses.length; i++) {
      final index = i;
      _focuses[i].onKeyEvent = (node, event) {
        if (event is! KeyDownEvent || event.logicalKey != LogicalKeyboardKey.backspace) {
          return KeyEventResult.ignored;
        }
        _onBackspace(index);
        return KeyEventResult.handled;
      };
    }
  }

  @override
  void dispose() {
    for (final c in _controllers) {
      c.dispose();
    }
    for (final f in _focuses) {
      f.dispose();
    }
    super.dispose();
  }

  String get _otp => _controllers.map((c) => c.text).join();

  void _fillFrom(int start, String raw) {
    final digits = raw.replaceAll(RegExp(r'\D'), '');
    if (digits.isEmpty) return;
    _syncing = true;
    for (var offset = 0; offset < digits.length && start + offset < 6; offset++) {
      _controllers[start + offset].text = digits[offset];
    }
    _syncing = false;
    final next = (start + digits.length).clamp(0, 5);
    _focuses[next].requestFocus();
    if (_otp.length == 6) _submit();
  }

  void _onChanged(int i, String val) {
    if (_syncing) return;
    final digits = val.replaceAll(RegExp(r'\D'), '');
    if (digits.length > 1) {
      _fillFrom(i, digits);
      return;
    }
    if (digits.length == 1) {
      if (_controllers[i].text != digits) {
        _syncing = true;
        _controllers[i].text = digits;
        _controllers[i].selection = const TextSelection.collapsed(offset: 1);
        _syncing = false;
      }
      if (i < 5) _focuses[i + 1].requestFocus();
      if (_otp.length == 6) _submit();
    }
  }

  void _onBackspace(int i) {
    if (_controllers[i].text.isNotEmpty) {
      _controllers[i].clear();
      if (i > 0) _focuses[i - 1].requestFocus();
      return;
    }
    if (i > 0) {
      _controllers[i - 1].clear();
      _focuses[i - 1].requestFocus();
    }
  }

  Future<void> _submit() async {
    if (_otp.length < 6) return;
    await ref.read(authProvider.notifier).verifyOtp(widget.phone, _otp);
    final error = ref.read(authProvider).error;
    if (error != null && mounted) {
      for (final c in _controllers) {
        c.clear();
      }
      _focuses[0].requestFocus();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Phone hint
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: const Color(0xFFF5F3FF),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            children: [
              const Icon(Icons.phone_android_outlined, size: 16, color: Color(0xFF702E8C)),
              const SizedBox(width: 8),
              Text(
                '+30 ${widget.phone}',
                style: const TextStyle(color: Color(0xFF702E8C), fontWeight: FontWeight.w600, fontSize: 14),
              ),
              const Spacer(),
              GestureDetector(
                onTap: widget.onBack,
                child: const Text('Αλλαγή', style: TextStyle(color: Color(0xFF702E8C), fontSize: 12, decoration: TextDecoration.underline)),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        Row(
          children: [
            for (var i = 0; i < 6; i++) ...[
              if (i > 0) const SizedBox(width: 8),
              Expanded(
                child: _OtpBox(
                  controller: _controllers[i],
                  focusNode: _focuses[i],
                  autofocus: i == 0,
                  onChanged: (value) => _onChanged(i, value),
                ),
              ),
            ],
          ],
        ),
        if (widget.error != null) ...[
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: const Color(0xFFFEF2F2),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFFCA5A5)),
            ),
            child: Row(
              children: [
                const Icon(Icons.error_outline_rounded, size: 16, color: Color(0xFFDC2626)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    widget.error!,
                    style: const TextStyle(color: Color(0xFFDC2626), fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 16),
        SizedBox(
          height: 52,
          child: FilledButton(
            onPressed: widget.isLoading ? null : _submit,
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF702E8C),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            child: widget.isLoading
                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Επιβεβαίωση', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
          ),
        ),
      ],
    );
  }
}

class _OtpBox extends StatelessWidget {
  final TextEditingController controller;
  final FocusNode focusNode;
  final bool autofocus;
  final ValueChanged<String> onChanged;
  const _OtpBox({
    required this.controller,
    required this.focusNode,
    required this.onChanged,
    this.autofocus = false,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 58,
      child: TextField(
        controller: controller,
        focusNode: focusNode,
        autofocus: autofocus,
        keyboardType: TextInputType.number,
        textAlign: TextAlign.center,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: Color(0xFF3D1152), height: 1.1),
        cursorColor: const Color(0xFF702E8C),
        decoration: InputDecoration(
          counterText: '',
          contentPadding: const EdgeInsets.symmetric(vertical: 14),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: Color(0xFFE5E7EB), width: 1.5),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: Color(0xFFE5E7EB), width: 1.5),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: Color(0xFF702E8C), width: 2),
          ),
          fillColor: const Color(0xFFF9FAFB),
          filled: true,
        ),
        onChanged: onChanged,
      ),
    );
  }
}
