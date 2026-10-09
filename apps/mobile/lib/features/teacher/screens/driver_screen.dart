import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

import '../../../core/api/api_client.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/utils/system_insets.dart';
import '../../messages/conversation_ui.dart';

class DriverScreen extends ConsumerStatefulWidget {
  final String schoolId;
  const DriverScreen({super.key, required this.schoolId});

  @override
  ConsumerState<DriverScreen> createState() => _DriverScreenState();
}

class _DriverScreenState extends ConsumerState<DriverScreen> {
  final _map = MapController();
  List<Map<String, dynamic>> _buses = [];
  List<Map<String, dynamic>> _riders = [];
  String? _serviceId;
  String? _selectedId;
  LatLng? _here;
  bool _sharing = false;
  bool _mapReady = false;
  bool _fitted = false;
  bool _picking = false;
  String _status = 'Ενεργοποίηση τοποθεσίας...';
  StreamSubscription<Position>? _stream;
  Timer? _timer;
  Position? _last;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _stream?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final resp = await ref.read(dioProvider).get('/schools/${widget.schoolId}/bus-tracking/mine');
      final data = resp.data is Map ? Map<String, dynamic>.from(resp.data as Map) : <String, dynamic>{};
      final buses = data['buses'] is List
          ? (data['buses'] as List).whereType<Map>().map((row) => Map<String, dynamic>.from(row)).toList()
          : <Map<String, dynamic>>[];
      if (!mounted) return;
      setState(() {
        _buses = buses;
        _serviceId = buses.isEmpty ? null : buses.first['id']?.toString();
      });
      if (buses.isEmpty) {
        setState(() => _status = 'Ο διαχειριστής δεν σε έχει συνδέσει ακόμα με σχολικό.');
        return;
      }
      await Future.wait([_start(), _roster()]);
    } catch (_) {
      if (mounted) setState(() => _status = 'Τα σχολικά δεν φορτώθηκαν.');
    }
  }

  Future<void> _roster() async {
    final serviceId = _serviceId;
    if (serviceId == null) return;
    try {
      final resp = await ref.read(dioProvider).get(
        '/schools/${widget.schoolId}/bus-tracking/route',
        queryParameters: {'serviceId': serviceId},
      );
      final data = resp.data is Map ? Map<String, dynamic>.from(resp.data as Map) : <String, dynamic>{};
      final riders = data['riders'] is List
          ? (data['riders'] as List).whereType<Map>().map((row) => Map<String, dynamic>.from(row)).toList()
          : <Map<String, dynamic>>[];
      if (!mounted) return;
      setState(() => _riders = riders);
      _fit();
    } catch (_) {
      if (mounted) setState(() => _status = 'Το πρόγραμμα δεν φορτώθηκε.');
    }
  }

  Future<void> _start() async {
    final enabled = await Geolocator.isLocationServiceEnabled();
    if (!enabled) {
      if (mounted) setState(() => _status = 'Άνοιξε την τοποθεσία στο κινητό.');
      return;
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) permission = await Geolocator.requestPermission();
    if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
      if (mounted) setState(() => _status = 'Χρειάζεται άδεια τοποθεσίας για να βλέπουν οι γονείς το σχολικό.');
      return;
    }
    await _stream?.cancel();
    _timer?.cancel();
    _stream = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 10),
    ).listen((position) {
      _last = position;
      _show(position);
      _send(position);
    });
    _timer = Timer.periodic(const Duration(seconds: 8), (_) {
      final position = _last;
      if (position != null) _send(position);
    });
    final current = await Geolocator.getCurrentPosition();
    _last = current;
    _show(current);
    await _send(current);
  }

  void _show(Position position) {
    final point = LatLng(position.latitude, position.longitude);
    if (!mounted) return;
    setState(() => _here = point);
    if (_mapReady && !_fitted) _map.move(point, 15);
  }

  void _fit() {
    if (!_mapReady || _fitted) return;
    final points = <LatLng>[
      if (_here != null) _here!,
      for (final rider in _riders)
        if (_point(rider) != null) _point(rider)!,
    ];
    if (points.isEmpty) return;
    _fitted = true;
    if (points.length == 1) {
      _map.move(points.first, 15);
    } else {
      _map.fitCamera(CameraFit.coordinates(coordinates: points, padding: const EdgeInsets.all(72)));
    }
  }

  Future<void> _send(Position position) async {
    final serviceId = _serviceId;
    if (serviceId == null) return;
    try {
      await ref.read(dioProvider).post('/schools/${widget.schoolId}/bus-tracking/ping', data: {
        'serviceId': serviceId,
        'latitude': position.latitude,
        'longitude': position.longitude,
        'heading': position.heading,
        'speed': position.speed,
      });
      if (mounted) {
        setState(() {
          _sharing = true;
          _status = 'Η θέση στέλνεται. Κράτα την εφαρμογή ανοιχτή.';
        });
      }
    } catch (_) {
      if (mounted) setState(() => _status = 'Η θέση δεν στάλθηκε. Έλεγξε τη σύνδεση.');
    }
  }

  Future<void> _pickup(Map<String, dynamic> rider) async {
    final studentId = rider['studentId']?.toString() ?? '';
    final serviceId = _serviceId;
    if (studentId.isEmpty || serviceId == null || _picking) return;
    setState(() => _picking = true);
    try {
      await ref.read(dioProvider).post('/schools/${widget.schoolId}/bus-tracking/pickup', data: {
        'serviceId': serviceId,
        'studentId': studentId,
      });
      await _roster();
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(apiErrorText(error))));
      }
    } finally {
      if (mounted) setState(() => _picking = false);
    }
  }

  Future<void> _message(Map<String, dynamic> rider) async {
    final parentId = rider['parentId']?.toString() ?? '';
    final me = ref.read(authProvider).user;
    if (parentId.isEmpty || me == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Δεν υπάρχει γονέας για μήνυμα.')));
      return;
    }
    try {
      final created = await openScopedConversation(
        ref,
        schoolId: widget.schoolId,
        kind: 'driver',
        withUserId: parentId,
        participantIds: [me.id, parentId],
      );
      final id = created?['id'] as String?;
      if (id == null || !mounted) return;
      await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => ChatScreen(
            schoolId: widget.schoolId,
            convId: id,
            title: rider['parentName']?.toString().trim().isNotEmpty == true ? rider['parentName'].toString() : 'Γονέας',
            subtitle: rider['name']?.toString() ?? 'Παιδί',
            currentUserId: me.id,
            startedByMe: conversationStartedByMe(created, me.id),
          ),
        ),
      );
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(apiErrorText(error))));
    }
  }

  Map<String, dynamic>? get _selected {
    for (final rider in _riders) {
      if (rider['studentId']?.toString() == _selectedId) return rider;
    }
    return null;
  }

  LatLng? _point(Map<String, dynamic> rider) {
    final latitude = double.tryParse(rider['latitude']?.toString() ?? '');
    final longitude = double.tryParse(rider['longitude']?.toString() ?? '');
    if (latitude == null || longitude == null) return null;
    return LatLng(latitude, longitude);
  }

  @override
  Widget build(BuildContext context) {
    final here = _here ?? const LatLng(37.9838, 23.7275);
    final bus = _buses.where((row) => row['id']?.toString() == _serviceId);
    final name = bus.isEmpty ? 'Σχολικό' : bus.first['name']?.toString() ?? 'Σχολικό';
    final selected = _selected;
    final userId = ref.watch(authProvider).user?.id ?? '';
    final conversations = ref.watch(conversationsProvider(widget.schoolId));
    final unread = conversations.asData?.value.where((row) => row is Map && row['unread'] == true).length ?? 0;
    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      appBar: AppBar(
        backgroundColor: const Color(0xFF77328D),
        foregroundColor: Colors.white,
        title: const Text('Σχολικό'),
        actions: [
          IconButton(
            tooltip: 'Πρόγραμμα',
            onPressed: _serviceId == null
                ? null
                : () async {
                    await Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => DriverScheduleScreen(schoolId: widget.schoolId, serviceId: _serviceId!),
                      ),
                    );
                    if (mounted) await _roster();
                  },
            icon: const Icon(Icons.list_alt_rounded),
          ),
          IconButton(
            tooltip: 'Μηνύματα',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => DriverMessagesScreen(schoolId: widget.schoolId, userId: userId)),
              );
            },
            icon: Badge(
              isLabelVisible: unread > 0,
              label: Text('$unread'),
              child: const Icon(Icons.chat_bubble_rounded),
            ),
          ),
          IconButton(
            onPressed: () => ref.read(authProvider.notifier).logout(),
            icon: const Icon(Icons.logout_rounded),
            tooltip: 'Αποσύνδεση',
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            flex: 5,
            child: Stack(
              children: [
                FlutterMap(
                  mapController: _map,
                  options: MapOptions(
                    initialCenter: here,
                    initialZoom: 15,
                    onMapReady: () {
                      _mapReady = true;
                      _fit();
                    },
                  ),
                  children: [
                    TileLayer(
                      urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'com.omnedu.omnedu',
                    ),
                    MarkerLayer(markers: [
                      for (final rider in _riders)
                        if (_point(rider) != null)
                          Marker(
                            point: _point(rider)!,
                            width: 92,
                            height: 64,
                            alignment: Alignment.topCenter,
                            child: GestureDetector(
                              onTap: () => setState(() => _selectedId = rider['studentId']?.toString()),
                              child: _RiderPin(
                                name: _firstName(rider['name']?.toString() ?? ''),
                                pickedUp: rider['pickedUp'] == true,
                                selected: rider['studentId']?.toString() == _selectedId,
                              ),
                            ),
                          ),
                      if (_here != null)
                        Marker(
                          point: _here!,
                          width: 78,
                          height: 86,
                          alignment: Alignment.topCenter,
                          child: Image.asset('assets/images/school_bus.png', fit: BoxFit.contain),
                        ),
                    ]),
                  ],
                ),
                if (selected != null)
                  Positioned(
                    left: 12,
                    right: 12,
                    top: 12,
                    child: Material(
                      color: Colors.white,
                      elevation: 3,
                      borderRadius: BorderRadius.circular(16),
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
                        child: Row(
                          children: [
                            Expanded(child: _RiderFacts(rider: selected)),
                            if ((selected['parentId']?.toString() ?? '').isNotEmpty)
                              IconButton(
                                tooltip: 'Μήνυμα',
                                onPressed: () => _message(selected),
                                icon: const Icon(Icons.chat_bubble_rounded, color: Color(0xFF77328D)),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            flex: 4,
            child: Container(
            width: double.infinity,
            color: Colors.white,
            padding: EdgeInsets.fromLTRB(16, 12, 16, 12 + systemBottomInset(context)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Icon(Icons.circle, size: 10, color: _sharing ? const Color(0xFF059669) : const Color(0xFFB45309)),
                    const SizedBox(width: 8),
                    Expanded(child: Text(_status, style: const TextStyle(color: Color(0xFF4B5563), height: 1.3))),
                  ],
                ),
                if (_buses.length > 1) ...[
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(
                    key: ValueKey(_serviceId),
                    initialValue: _serviceId,
                    decoration: const InputDecoration(labelText: 'Σχολικό'),
                    items: [
                      for (final row in _buses)
                        DropdownMenuItem(value: row['id']?.toString(), child: Text(row['name']?.toString() ?? 'Σχολικό')),
                    ],
                    onChanged: (value) {
                      setState(() {
                        _serviceId = value;
                        _selectedId = null;
                        _fitted = false;
                      });
                      _roster();
                    },
                  ),
                ],
                const SizedBox(height: 8),
                Expanded(
                  child: _riders.isEmpty
                      ? const Center(child: Text('Δεν υπάρχουν παιδιά σε αυτό το σχολικό.', style: TextStyle(color: Color(0xFF6B7280))))
                      : ListView.separated(
                          itemCount: _riders.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 6),
                          itemBuilder: (_, index) {
                            final rider = _riders[index];
                            final active = rider['studentId']?.toString() == _selectedId;
                            return Material(
                              color: active ? const Color(0xFFFFF1EC) : const Color(0xFFF6F3FA),
                              borderRadius: BorderRadius.circular(14),
                              child: InkWell(
                                borderRadius: BorderRadius.circular(14),
                                onTap: () => setState(() => _selectedId = rider['studentId']?.toString()),
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                  child: _RiderFacts(rider: rider, compact: true),
                                ),
                              ),
                            );
                          },
                        ),
                ),
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  height: 64,
                  child: FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: selected?['pickedUp'] == true ? const Color(0xFF059669) : const Color(0xFFE95926),
                      disabledBackgroundColor: const Color(0xFFE5E7EB),
                    ),
                    onPressed: selected == null || selected['canPickup'] != true || selected['pickedUp'] == true || _picking
                        ? null
                        : () => _pickup(selected),
                    child: Text(
                      selected == null
                          ? 'Πάτα το όνομα του παιδιού'
                          : selected['pickedUp'] == true
                              ? 'Παρελήφθη'
                              : 'Παρέλαβα',
                      style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
                    ),
                  ),
                ),
              ],
            ),
          ),
          ),
        ],
      ),
    );
  }
}

class DriverScheduleScreen extends ConsumerStatefulWidget {
  final String schoolId;
  final String serviceId;
  const DriverScheduleScreen({super.key, required this.schoolId, required this.serviceId});

  @override
  ConsumerState<DriverScheduleScreen> createState() => _DriverScheduleScreenState();
}

class _DriverScheduleScreenState extends ConsumerState<DriverScheduleScreen> {
  List<Map<String, dynamic>> _riders = [];
  String? _selectedId;
  bool _loading = true;
  bool _picking = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final resp = await ref.read(dioProvider).get(
        '/schools/${widget.schoolId}/bus-tracking/route',
        queryParameters: {'serviceId': widget.serviceId},
      );
      final data = resp.data is Map ? Map<String, dynamic>.from(resp.data as Map) : <String, dynamic>{};
      final riders = data['riders'] is List
          ? (data['riders'] as List).whereType<Map>().map((row) => Map<String, dynamic>.from(row)).toList()
          : <Map<String, dynamic>>[];
      if (!mounted) return;
      setState(() {
        _riders = riders;
        _loading = false;
        _error = null;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = 'Το πρόγραμμα δεν φορτώθηκε.';
        });
      }
    }
  }

  Future<void> _pickup(Map<String, dynamic> rider) async {
    final studentId = rider['studentId']?.toString() ?? '';
    if (studentId.isEmpty || _picking) return;
    setState(() => _picking = true);
    try {
      await ref.read(dioProvider).post('/schools/${widget.schoolId}/bus-tracking/pickup', data: {
        'serviceId': widget.serviceId,
        'studentId': studentId,
      });
      await _load();
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(apiErrorText(error))));
    } finally {
      if (mounted) setState(() => _picking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    Map<String, dynamic>? selected;
    for (final rider in _riders) {
      if (rider['studentId']?.toString() == _selectedId) selected = rider;
    }
    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      appBar: AppBar(title: const Text('Πρόγραμμα σχολικού')),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF77328D)))
          : _error != null
              ? Center(child: Text(_error!))
              : Column(
                  children: [
                    Expanded(
                      child: _riders.isEmpty
                          ? const Center(child: Text('Δεν υπάρχουν παιδιά σε αυτό το σχολικό.'))
                          : ListView.separated(
                              padding: const EdgeInsets.all(16),
                              itemCount: _riders.length,
                              separatorBuilder: (_, __) => const SizedBox(height: 8),
                              itemBuilder: (_, index) {
                                final rider = _riders[index];
                                final active = rider['studentId']?.toString() == _selectedId;
                                return Material(
                                  color: Colors.white,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(16),
                                    side: BorderSide(color: active ? const Color(0xFFE95926) : Colors.transparent, width: 2),
                                  ),
                                  child: InkWell(
                                    borderRadius: BorderRadius.circular(16),
                                    onTap: () => setState(() => _selectedId = rider['studentId']?.toString()),
                                    child: Padding(
                                      padding: const EdgeInsets.all(14),
                                      child: _RiderFacts(rider: rider),
                                    ),
                                  ),
                                );
                              },
                            ),
                    ),
                    Padding(
                      padding: EdgeInsets.fromLTRB(16, 8, 16, 12 + systemBottomInset(context)),
                      child: SizedBox(
                        width: double.infinity,
                        height: 64,
                        child: FilledButton(
                          style: FilledButton.styleFrom(
                            backgroundColor: selected?['pickedUp'] == true ? const Color(0xFF059669) : const Color(0xFFE95926),
                            disabledBackgroundColor: const Color(0xFFE5E7EB),
                          ),
                          onPressed: selected == null || selected['canPickup'] != true || selected['pickedUp'] == true || _picking
                              ? null
                              : () => _pickup(selected!),
                          child: Text(
                            selected == null
                                ? 'Πάτα το όνομα του παιδιού'
                                : selected['pickedUp'] == true
                                    ? 'Παρελήφθη'
                                    : 'Παρέλαβα',
                            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
    );
  }
}

class DriverMessagesScreen extends ConsumerWidget {
  final String schoolId;
  final String userId;
  const DriverMessagesScreen({super.key, required this.schoolId, required this.userId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final conversations = ref.watch(conversationsProvider(schoolId));
    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      appBar: AppBar(
        title: const Text('Μηνύματα'),
        actions: [
          IconButton(
            onPressed: () => ref.invalidate(conversationsProvider(schoolId)),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: conversations.when(
        loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFF77328D))),
        error: (error, _) => Center(child: Text(apiErrorText(error))),
        data: (list) {
          if (list.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: Text(
                  'Δεν υπάρχουν μηνύματα. Οι γονείς των παιδιών του σχολικού μπορούν να σου γράψουν εδώ.',
                  textAlign: TextAlign.center,
                ),
              ),
            );
          }
          return RefreshIndicator(
            color: const Color(0xFF77328D),
            onRefresh: () => ref.refresh(conversationsProvider(schoolId).future),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: list.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (_, index) {
                final conv = Map<String, dynamic>.from(list[index] as Map);
                return ConversationTile(
                  conv: conv,
                  userId: userId,
                  onTap: () => openChat(context, ref, schoolId: schoolId, userId: userId, conv: conv),
                  onDelete: () => confirmRemoveConversation(
                    context,
                    ref,
                    schoolId: schoolId,
                    conversationId: conv['id']?.toString() ?? '',
                    startedByMe: conv['startedByMe'] == true,
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}

class _RiderPin extends StatelessWidget {
  final String name;
  final bool pickedUp;
  final bool selected;
  const _RiderPin({required this.name, required this.pickedUp, required this.selected});

  @override
  Widget build(BuildContext context) {
    final color = pickedUp ? const Color(0xFF059669) : selected ? const Color(0xFFE95926) : const Color(0xFF77328D);
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8)),
          child: Text(
            name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: color),
          ),
        ),
        Icon(Icons.location_pin, color: color, size: 30),
      ],
    );
  }
}

class _RiderFacts extends StatelessWidget {
  final Map<String, dynamic> rider;
  final bool compact;
  const _RiderFacts({required this.rider, this.compact = false});

  @override
  Widget build(BuildContext context) {
    final name = rider['name']?.toString() ?? 'Παιδί';
    final pickup = _clock(rider['pickupTime']?.toString());
    final dropoff = _clock(rider['dropoffTime']?.toString());
    final handsOver = rider['pickupContact']?.toString().trim() ?? '';
    final receives = rider['dropoffContact']?.toString().trim() ?? '';
    final address = rider['address']?.toString().trim() ?? '';
    final picked = rider['pickedUp'] == true;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(child: Text(name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16))),
            if (picked) const Icon(Icons.check_circle_rounded, color: Color(0xFF059669), size: 18),
          ],
        ),
        const SizedBox(height: 2),
        Text('Παραλαβή $pickup${handsOver.isEmpty ? '' : ' · $handsOver'}', style: const TextStyle(color: Color(0xFF374151))),
        Text('Παράδοση $dropoff${receives.isEmpty ? '' : ' · $receives'}', style: const TextStyle(color: Color(0xFF374151))),
        if (!compact && address.isNotEmpty)
          Text(address, style: const TextStyle(color: Color(0xFF6B7280), fontSize: 13)),
      ],
    );
  }
}

String _firstName(String name) {
  final trimmed = name.trim();
  if (trimmed.isEmpty) return 'Παιδί';
  return trimmed.split(RegExp(r'\s+')).first;
}

String _clock(String? value) {
  final text = value?.trim() ?? '';
  if (text.isEmpty) return 'χωρίς ώρα';
  final match = RegExp(r'^(\d{1,2}):(\d{2})').firstMatch(text);
  if (match == null) return text;
  return '${match.group(1)!.padLeft(2, '0')}:${match.group(2)}';
}
