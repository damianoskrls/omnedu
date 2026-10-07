import 'package:flutter/widgets.dart';

/// Space occupied by the Android navigation bar or the iOS home indicator.
/// Scaffold often clears [MediaQuery.padding] while the app still draws
/// underneath the system bar, so the raw view padding is included too.
double systemBottomInset(BuildContext context) {
  final view = View.of(context);
  final fromView = view.devicePixelRatio == 0 ? 0.0 : view.padding.bottom / view.devicePixelRatio;
  final fromMedia = MediaQuery.viewPaddingOf(context).bottom;
  final gesture = MediaQuery.systemGestureInsetsOf(context).bottom;
  var inset = fromView;
  if (fromMedia > inset) inset = fromMedia;
  if (gesture > inset) inset = gesture;
  return inset;
}
