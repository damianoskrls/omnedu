String _todayYmd() {
  final now = DateTime.now();
  final m = now.month.toString().padLeft(2, '0');
  final d = now.day.toString().padLeft(2, '0');
  return '${now.year}-$m-$d';
}

String _eventDay(String? eventDate) {
  if (eventDate == null || eventDate.length < 10) return '';
  return eventDate.substring(0, 10);
}

/// Completed the day after the event. Draft stays draft.
String eventDisplayStatus(String? status, String? eventDate) {
  final base = status ?? 'draft';
  final day = _eventDay(eventDate);
  if (base == 'draft' || day.isEmpty) {
    return base == 'completed' ? 'published' : base;
  }
  final today = _todayYmd();
  if ((base == 'published' || base == 'completed') && day.compareTo(today) < 0) {
    return 'completed';
  }
  if (base == 'completed' && day.compareTo(today) >= 0) return 'published';
  return base;
}

bool eventDayReached(String? eventDate) {
  final day = _eventDay(eventDate);
  if (day.isEmpty) return false;
  return day.compareTo(_todayYmd()) <= 0;
}
