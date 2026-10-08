import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/user.dart';
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
    final roles = authState.pendingRoles;

    return Scaffold(
      backgroundColor: const Color(0xFFF8F4FC),
      resizeToAvoidBottomInset: true,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final showCredit = roles == null && !_showOtp;
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 32),
              child: Column(
                children: [
                  Expanded(
                    child: SingleChildScrollView(
                      child: ConstrainedBox(
                        constraints: BoxConstraints(minHeight: constraints.maxHeight - 64 - (showCredit ? 28 : 0)),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                Image.asset(
                  'assets/images/school_logo.png',
                  width: 160,
                  height: 160,
                  fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) => const Text(
                    'ονειροχώρα',
                    style: TextStyle(color: Color(0xFFE95926), fontSize: 28, fontWeight: FontWeight.w800),
                  ),
                ),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFF77328D),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Text(
                    'omnedu v. 1.14',
                    style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  roles != null
                      ? 'Πώς θέλετε να συνδεθείτε;'
                      : _showOtp
                          ? 'Εισάγετε τον κωδικό που λάβατε'
                          : 'Εισάγετε το κινητό σας',
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
                  child: roles != null
                      ? _RoleChoice(
                          choices: roles.choices,
                          isLoading: isLoading,
                          error: authState.error,
                          onBack: () => ref.read(authProvider.notifier).clearPendingRoles(),
                          onSelect: (choice) => ref.read(authProvider.notifier).selectRole(
                                pendingToken: roles.pendingToken,
                                userId: choice.userId,
                                schoolId: choice.schoolId,
                                role: choice.role,
                              ),
                        )
                      : _showOtp
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
                  if (showCredit)
                    const Text(
                      'Design & Development by Siteland.gr',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                ],
              ),
            );
          },
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

class _RoleChoice extends StatelessWidget {
  final List<RoleOption> choices;
  final bool isLoading;
  final String? error;
  final VoidCallback onBack;
  final ValueChanged<RoleOption> onSelect;
  const _RoleChoice({
    required this.choices,
    required this.isLoading,
    required this.onBack,
    required this.onSelect,
    this.error,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Το κινητό αυτό έχει περισσότερους από έναν ρόλους.',
          style: TextStyle(color: Color(0xFF6B7280), fontSize: 13, height: 1.4),
        ),
        const SizedBox(height: 16),
        for (final choice in choices) ...[
          SizedBox(
            height: 56,
            child: FilledButton.icon(
              onPressed: isLoading ? null : () => onSelect(choice),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF702E8C),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              icon: Icon(_roleIcon(choice.role)),
              label: Text(
                'Συνέχεια ως ${_roleAccusative(choice.role)}',
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
              ),
            ),
          ),
          if (choice.schoolName.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 6, bottom: 12),
              child: Text(
                choice.schoolName,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12),
              ),
            )
          else
            const SizedBox(height: 12),
        ],
        if (error != null) ...[
          const SizedBox(height: 4),
          Text(error!, style: const TextStyle(color: Color(0xFFDC2626), fontSize: 13)),
        ],
        TextButton(onPressed: isLoading ? null : onBack, child: const Text('Πίσω στον κωδικό')),
      ],
    );
  }
}

String _roleAccusative(String role) {
  switch (role) {
    case 'parent':
      return 'γονέα';
    case 'teacher':
      return 'εκπαιδευτικό';
    case 'school_admin':
      return 'διαχειριστή';
    case 'owner':
      return 'ιδιοκτήτη';
    default:
      return 'άλλο ρόλο';
  }
}

IconData _roleIcon(String role) {
  switch (role) {
    case 'parent':
      return Icons.family_restroom_rounded;
    case 'teacher':
      return Icons.school_rounded;
    default:
      return Icons.admin_panel_settings_rounded;
  }
}

class _OtpInput extends ConsumerStatefulWidget {
  final String phone;
  final bool isLoading;
  final VoidCallback onBack;
  final String? error;
  const _OtpInput({
    required this.phone,
    required this.isLoading,
    required this.onBack,
    this.error,
  });

  @override
  ConsumerState<_OtpInput> createState() => _OtpInputState();
}

class _OtpInputState extends ConsumerState<_OtpInput> {
  final _controller = TextEditingController();
  final _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    _focus.addListener(() {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  String get _otp => _controller.text;

  void _onChanged(String raw) {
    final digits = raw.replaceAll(RegExp(r'\D'), '');
    final clipped = digits.length > 6 ? digits.substring(0, 6) : digits;
    if (clipped != _controller.text) {
      _controller.value = TextEditingValue(
        text: clipped,
        selection: TextSelection.collapsed(offset: clipped.length),
      );
    }
    setState(() {});
    if (clipped.length == 6) _submit();
  }

  Future<void> _submit() async {
    if (_otp.length < 6) return;
    final result = await ref.read(authProvider.notifier).verifyOtp(widget.phone, _otp);
    if (result != null) return;
    final error = ref.read(authProvider).error;
    if (error != null && mounted) {
      _controller.clear();
      setState(() {});
      _focus.requestFocus();
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
        GestureDetector(
          onTap: () => _focus.requestFocus(),
          child: LayoutBuilder(
            builder: (context, constraints) {
              const gap = 8.0;
              final box = ((constraints.maxWidth - gap * 5) / 6).clamp(0.0, 52.0);
              return SizedBox(
                height: 58,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Positioned.fill(
                      child: Theme(
                        data: Theme.of(context).copyWith(
                          inputDecorationTheme: const InputDecorationTheme(
                            filled: false,
                            border: InputBorder.none,
                            enabledBorder: InputBorder.none,
                            focusedBorder: InputBorder.none,
                            disabledBorder: InputBorder.none,
                            errorBorder: InputBorder.none,
                            focusedErrorBorder: InputBorder.none,
                            isCollapsed: true,
                            contentPadding: EdgeInsets.zero,
                          ),
                        ),
                        child: TextField(
                          controller: _controller,
                          focusNode: _focus,
                          autofocus: true,
                          keyboardType: TextInputType.number,
                          textAlign: TextAlign.center,
                          enableInteractiveSelection: false,
                          enableSuggestions: false,
                          autocorrect: false,
                          showCursor: false,
                          cursorWidth: 0,
                          style: const TextStyle(color: Colors.transparent, fontSize: 1, height: 1),
                          cursorColor: Colors.transparent,
                          inputFormatters: [
                            FilteringTextInputFormatter.digitsOnly,
                            LengthLimitingTextInputFormatter(6),
                          ],
                          decoration: const InputDecoration(
                            counterText: '',
                            filled: false,
                            fillColor: Colors.transparent,
                            border: InputBorder.none,
                            enabledBorder: InputBorder.none,
                            focusedBorder: InputBorder.none,
                            disabledBorder: InputBorder.none,
                            errorBorder: InputBorder.none,
                            focusedErrorBorder: InputBorder.none,
                            contentPadding: EdgeInsets.zero,
                            isCollapsed: true,
                          ),
                          onChanged: _onChanged,
                        ),
                      ),
                    ),
                    IgnorePointer(
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          for (var i = 0; i < 6; i++) ...[
                            if (i > 0) const SizedBox(width: gap),
                            _DigitBox(
                              width: box,
                              digit: i < _controller.text.length ? _controller.text[i] : '',
                              active: _focus.hasFocus && _controller.text.length == i,
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
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

class _DigitBox extends StatelessWidget {
  final double width;
  final String digit;
  final bool active;
  const _DigitBox({required this.width, required this.digit, required this.active});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: 58,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: const Color(0xFFF9FAFB),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: active ? const Color(0xFF702E8C) : const Color(0xFFE5E7EB), width: active ? 2 : 1.5),
      ),
      child: Text(
        digit,
        style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: Color(0xFF3D1152), height: 1.1),
      ),
    );
  }
}
