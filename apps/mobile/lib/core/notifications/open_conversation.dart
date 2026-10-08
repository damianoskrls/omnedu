import 'package:flutter/foundation.dart';

/// The conversation currently open on screen. A reply there is already visible,
/// so it does not need a second notification.
final openConversationId = ValueNotifier<String?>(null);
