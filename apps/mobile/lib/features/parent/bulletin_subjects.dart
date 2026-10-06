/// Subjects shown on the daily parent bulletin, in the order of the school form.
const bulletinSubjects = [
  'Γλώσσα',
  'Αγγλικά',
  'Μαθηματικά',
  'Φυσικές Επιστήμες',
  'Τεχνολογία Πληροφοριών & Επικοινωνίας',
  'Θεατρικό Παιχνίδι',
  'Εικαστικά',
  'Μουσική',
  'Περιβάλλον & Αειφόρος Ανάπτυξη',
  'Προσωπική & Κοινωνική Ανάπτυξη',
  'Φυσική Αγωγή',
];

const bulletinSubjectAliases = {
  'Τ.Π.Ε.': 'Τεχνολογία Πληροφοριών & Επικοινωνίας',
  'ΤΠΕ': 'Τεχνολογία Πληροφοριών & Επικοινωνίας',
  'Προσ. & Κοιν. Ανάπτυξη': 'Προσωπική & Κοινωνική Ανάπτυξη',
};

bool bulletinSubjectChecked(List<String> selected, String subject) {
  if (selected.contains(subject)) return true;
  for (final entry in bulletinSubjectAliases.entries) {
    if (entry.value == subject && selected.contains(entry.key)) return true;
  }
  return false;
}

String bulletinMealLabel(String? value) {
  const labels = {
    'all': 'Όλο',
    'most': 'Τα πιο πολλά',
    'half': 'Τα μισά',
    'little': 'Λίγο',
    'none': 'Καθόλου',
    'good': 'Έφαγε',
    'partial': 'Μερικώς',
    'refused': 'Αρνήθηκε',
  };
  if (value == null || value.isEmpty) return '—';
  return labels[value] ?? value;
}

String bulletinNapLabel(int? minutes) {
  if (minutes == null || minutes <= 0) return 'Καθόλου';
  if (minutes < 60) return "$minutes'";
  if (minutes == 60) return '1 ώρα';
  if (minutes == 90) return '1½ ώρα';
  final hours = minutes ~/ 60;
  final rest = minutes % 60;
  if (rest == 0) return '$hours ώρες';
  return '$hoursώ $rest\'';
}
