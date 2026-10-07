import 'dart:io';

import 'package:flutter/widgets.dart';

/// Space occupied by the Android navigation bar or the iOS home indicator.
/// Some Android phones draw the app underneath the buttons and report no inset,
/// so three-button navigation keeps a minimum gap.
double systemBottomInset(BuildContext context) {
  final view = View.of(context);
  final fromView = view.devicePixelRatio == 0 ? 0.0 : view.padding.bottom / view.devicePixelRatio;
  final fromMedia = MediaQuery.viewPaddingOf(context).bottom;
  final gesture = MediaQuery.systemGestureInsetsOf(context).bottom;
  var inset = fromView;
  if (fromMedia > inset) inset = fromMedia;
  if (gesture > inset) inset = gesture;
  if (Platform.isAndroid && inset < 48) inset = 48;
  return inset;
}
