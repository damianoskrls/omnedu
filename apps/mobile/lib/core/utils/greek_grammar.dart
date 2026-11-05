/// Small Greek grammar helpers for parent-facing copy (gender + vocative).

bool isFemaleGender(String? gender, {String? firstName}) {
  final g = (gender ?? '').trim().toLowerCase();
  if (g == 'female' || g == 'f' || g == 'κορίτσι' || g == 'girl') return true;
  if (g == 'male' || g == 'm' || g == 'αγόρι' || g == 'boy') return false;

  // Fallback when gender is missing: common Greek given-name endings.
  final name = (firstName ?? '').trim().toLowerCase();
  if (name.isEmpty) return false;
  if (name.endsWith('ας') || name.endsWith('ης') || name.endsWith('ος') || name.endsWith('έας') || name.endsWith('ους')) {
    return false;
  }
  if (name.endsWith('α') || name.endsWith('η') || name.endsWith('ω')) {
    return true;
  }
  return false;
}

String firstNameOf(String fullName) {
  final parts = fullName.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
  return parts.isEmpty ? '' : parts.first;
}

/// Accusative phrase: «την Ίριδα» / «τον Νίκο».
String childAccusativePhrase(String fullName, {String? gender}) {
  final first = firstNameOf(fullName);
  if (first.isEmpty) return 'το παιδί';
  final girl = isFemaleGender(gender, firstName: first);
  return girl ? 'την $first' : 'τον $first';
}

/// Mood label agreeing with child gender.
String moodLabelForGender(String? mood, {String? gender, String? firstName}) {
  if (mood == null || mood.trim().isEmpty) return '';
  final key = mood.trim().toLowerCase();
  final girl = isFemaleGender(gender, firstName: firstName);
  const male = {
    'χαρούμενος': 'Χαρούμενος',
    'happy': 'Χαρούμενος',
    'ήρεμος': 'Ήρεμος',
    'calm': 'Ήρεμος',
    'κουρασμένος': 'Κουρασμένος',
    'tired': 'Κουρασμένος',
    'λυπημένος': 'Λυπημένος',
    'sad': 'Λυπημένος',
    'αγχωμένος': 'Αγχωμένος',
    'anxious': 'Αγχωμένος',
    'ενθουσιασμένος': 'Ενθουσιασμένος',
  };
  const female = {
    'χαρούμενος': 'Χαρούμενη',
    'happy': 'Χαρούμενη',
    'ήρεμος': 'Ήρεμη',
    'calm': 'Ήρεμη',
    'κουρασμένος': 'Κουρασμένη',
    'tired': 'Κουρασμένη',
    'λυπημένος': 'Λυπημένη',
    'sad': 'Λυπημένη',
    'αγχωμένος': 'Αγχωμένη',
    'anxious': 'Αγχωμένη',
    'ενθουσιασμένος': 'Ενθουσιασμένη',
  };
  final map = girl ? female : male;
  return map[key] ?? mood;
}

/// Informal vocative for greetings: Δαμιανός → Δαμιανέ, Γιάννης → Γιάννη.
String greekVocative(String firstName) {
  final name = firstName.trim();
  if (name.isEmpty) return name;
  final lower = name.toLowerCase();

  String replaceEnding(String ending, String withEnding) {
    if (!lower.endsWith(ending)) return name;
    return name.substring(0, name.length - ending.length) + withEnding;
  }

  // Keep accent style of the stem by only swapping the last syllable letters.
  if (lower.endsWith('ιος')) return replaceEnding('ιος', 'ιε');
  if (lower.endsWith('ός')) return replaceEnding('ός', 'έ');
  if (lower.endsWith('ος')) return replaceEnding('ος', 'ε');
  if (lower.endsWith('ής')) return replaceEnding('ής', 'ή');
  if (lower.endsWith('ης')) return replaceEnding('ης', 'η');
  if (lower.endsWith('άς')) return replaceEnding('άς', 'ά');
  if (lower.endsWith('ας')) return replaceEnding('ας', 'α');
  if (lower.endsWith('έας')) return replaceEnding('έας', 'έα');
  if (lower.endsWith('έας'.toLowerCase())) return replaceEnding('έας', 'έα');

  // Feminine / other: nominative is fine in greetings.
  return name;
}
