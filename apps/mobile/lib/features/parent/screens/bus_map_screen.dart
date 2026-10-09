import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/api/api_client.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/utils/system_insets.dart';
import '../../messages/conversation_ui.dart';

class BusMapScreen extends ConsumerStatefulWidget {
  final String schoolId;
  final String studentId;
  final String busName;
  const BusMapScreen({super.key, required this.schoolId, required this.studentId, required this.busName});

  @override
  ConsumerState<BusMapScreen> createState() => _BusMapScreenState();
}

class _BusMapScreenState extends ConsumerState<BusMapScreen> {
  final _map = MapController();
  Timer? _timer;
  Map<String, dynamic>? _bus;
  String? _error;
  bool _fitted = false;
  bool _mapReady = false;
  List<LatLng> _line = const [];
  String? _routeKey;

  @override
  void initState() {
    super.initState();
    _load();
    _timer = Timer.periodic(const Duration(seconds: 6), (_) => _load());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final resp = await ref.read(dioProvider).get('/schools/${widget.schoolId}/bus-tracking/student/${widget.studentId}');
      final data = resp.data is Map ? Map<String, dynamic>.from(resp.data as Map) : <String, dynamic>{};
      final buses = data['buses'] is List ? data['buses'] as List : const [];
      Map<String, dynamic>? match;
      for (final raw in buses) {
        if (raw is! Map) continue;
        final row = Map<String, dynamic>.from(raw);
        if (match == null || row['name']?.toString() == widget.busName) match = row;
      }
      if (!mounted) return;
      setState(() {
        _bus = match;
        _error = null;
      });
      _fit();
      final here = match == null ? null : _point(match['latitude'], match['longitude']);
      final destRaw = match?['destination'];
      final dest = destRaw is Map ? _point(destRaw['latitude'], destRaw['longitude']) : null;
      if (here != null && dest != null) unawaited(_route(here, dest));
    } catch (_) {
      if (mounted) setState(() => _error = 'Ο χάρτης δεν φορτώθηκε.');
    }
  }

  Future<void> _route(LatLng from, LatLng to) async {
    final key = '${from.latitude.toStringAsFixed(3)},${from.longitude.toStringAsFixed(3)}'
        '->${to.latitude.toStringAsFixed(3)},${to.longitude.toStringAsFixed(3)}';
    if (key == _routeKey && _line.length >= 2) return;
    _routeKey = key;
    List<LatLng> line = _curve(from, to);
    try {
      final resp = await Dio().get(
        'https://router.project-osrm.org/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}',
        queryParameters: {'overview': 'full', 'geometries': 'geojson'},
      );
      final routes = resp.data is Map ? resp.data['routes'] : null;
      final geometry = routes is List && routes.isNotEmpty && routes.first is Map ? routes.first['geometry'] : null;
      final coords = geometry is Map ? geometry['coordinates'] : null;
      if (coords is List && coords.length >= 2) {
        line = [
          for (final row in coords)
            if (row is List && row.length >= 2)
              LatLng((row[1] as num).toDouble(), (row[0] as num).toDouble()),
        ];
      }
    } catch (_) {}
    if (!mounted || line.length < 2) return;
    setState(() => _line = line);
  }

  List<LatLng> _curve(LatLng from, LatLng to) {
    final midLat = (from.latitude + to.latitude) / 2;
    final midLng = (from.longitude + to.longitude) / 2;
    final bend = LatLng(midLat + (to.longitude - from.longitude) * 0.18, midLng - (to.latitude - from.latitude) * 0.18);
    return [from, bend, to];
  }

  void _fit() {
    final bus = _point(_bus?['latitude'], _bus?['longitude']);
    final destRaw = _bus?['destination'];
    final dest = destRaw is Map ? _point(destRaw['latitude'], destRaw['longitude']) : null;
    if (!_mapReady || bus == null) return;
    if (!_fitted) {
      _fitted = true;
      final points = [bus, if (dest != null) dest];
      if (points.length == 1) {
        _map.move(bus, 15);
      } else {
        _map.fitCamera(CameraFit.coordinates(coordinates: points, padding: const EdgeInsets.all(72)));
      }
    } else {
      _map.move(bus, _map.camera.zoom);
    }
  }

  LatLng? _point(dynamic lat, dynamic lng) {
    final latitude = double.tryParse(lat?.toString() ?? '');
    final longitude = double.tryParse(lng?.toString() ?? '');
    if (latitude == null || longitude == null) return null;
    return LatLng(latitude, longitude);
  }

  String _mister(Map<String, dynamic>? bus) {
    final raw = bus?['driverName']?.toString().trim() ?? '';
    if (raw.isEmpty) return 'Ο οδηγός';
    final first = raw.split(RegExp(r'\s+')).first;
    return 'Ο κ. $first';
  }

  String? _minutes(Map<String, dynamic>? bus) {
    if (bus == null || bus['live'] != true) return null;
    final minutes = int.tryParse(bus['etaMinutes']?.toString() ?? '');
    if (minutes == null) return null;
    if (minutes <= 1) return 'λιγότερο από 1 λεπτό';
    return '$minutes λεπτά';
  }

  String _fallback(Map<String, dynamic>? bus) {
    if (bus == null) return 'Φόρτωση...';
    if (bus['latitude'] == null) return 'Το σχολικό δεν έχει στείλει ακόμα θέση.';
    if (bus['live'] != true) return 'Τελευταία γνωστή θέση. Ο οδηγός δεν στέλνει αυτή τη στιγμή.';
    return 'Το σχολικό κινείται. Δεν υπάρχει αποθηκευμένη θέση για εκτίμηση άφιξης.';
  }

  Future<void> _contact(Map<String, dynamic> bus) async {
    final phone = bus['driverPhone']?.toString().trim() ?? '';
    final driverId = bus['driverUserId']?.toString() ?? '';
    final name = _mister(bus);
    if (phone.isEmpty && driverId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Δεν υπάρχει τηλέφωνο ή λογαριασμός οδηγού.')));
      return;
    }
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheet) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (phone.isNotEmpty)
                ListTile(
                  leading: const Icon(Icons.phone_rounded, color: Color(0xFFE95926)),
                  title: Text('Κλήση στον $name'),
                  onTap: () async {
                    Navigator.pop(sheet);
                    final uri = Uri.parse('tel:${phone.replaceAll(' ', '')}');
                    if (!await launchUrl(uri)) {
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Η κλήση δεν άνοιξε.')));
                      }
                    }
                  },
                ),
              if (driverId.isNotEmpty)
                ListTile(
                  leading: const Icon(Icons.chat_bubble_rounded, color: Color(0xFF77328D)),
                  title: Text('Μήνυμα στον $name'),
                  onTap: () {
                    Navigator.pop(sheet);
                    _message(driverId, name);
                  },
                ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _message(String driverId, String name) async {
    final me = ref.read(authProvider).user;
    if (me == null) return;
    try {
      final created = await openScopedConversation(
        ref,
        schoolId: widget.schoolId,
        kind: 'driver',
        withUserId: driverId,
        participantIds: [me.id, driverId],
      );
      final id = created?['id'] as String?;
      if (id == null || !mounted) return;
      await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => ChatScreen(
            schoolId: widget.schoolId,
            convId: id,
            title: name,
            subtitle: 'Οδηγός σχολικού',
            currentUserId: me.id,
            startedByMe: conversationStartedByMe(created, me.id),
          ),
        ),
      );
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(apiErrorText(error))));
    }
  }

  @override
  Widget build(BuildContext context) {
    final bus = _bus;
    final here = bus == null ? null : _point(bus['latitude'], bus['longitude']);
    final destRaw = bus?['destination'];
    final dest = destRaw is Map ? _point(destRaw['latitude'], destRaw['longitude']) : null;
    final center = here ?? dest ?? const LatLng(37.9838, 23.7275);
    final title = bus?['name']?.toString() ?? widget.busName;
    final who = _mister(bus);
    final minutes = _minutes(bus);
    final distance = bus?['distanceKm']?.toString();
    final bottom = systemBottomInset(context);
    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      appBar: AppBar(title: Text(title.isEmpty ? 'Σχολικό' : title)),
      body: Column(
        children: [
          Expanded(
            child: FlutterMap(
              mapController: _map,
              options: MapOptions(
                initialCenter: center,
                initialZoom: 13,
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
                if (_line.length >= 2)
                  PolylineLayer(
                    polylines: [
                      Polyline(
                        points: _line,
                        strokeWidth: 6,
                        color: const Color(0xFFE95926),
                        borderStrokeWidth: 2,
                        borderColor: Colors.white,
                      ),
                    ],
                  ),
                MarkerLayer(markers: [
                  if (dest != null)
                    Marker(
                      point: dest,
                      width: 42,
                      height: 42,
                      alignment: Alignment.topCenter,
                      child: const Icon(Icons.location_pin, color: Color(0xFF77328D), size: 40),
                    ),
                  if (here != null)
                    Marker(
                      point: here,
                      width: 78,
                      height: 86,
                      alignment: Alignment.topCenter,
                      child: Image.asset('assets/images/school_bus.png', fit: BoxFit.contain),
                    ),
                ]),
              ],
            ),
          ),
          Container(
            width: double.infinity,
            color: Colors.white,
            padding: EdgeInsets.fromLTRB(20, 16, 16, 16 + bottom),
            child: _error != null
                ? Text(_error!, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, height: 1.35))
                : Row(
                    children: [
                      Expanded(
                        child: minutes == null
                            ? Text(
                                _fallback(bus),
                                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, height: 1.35, color: Color(0xFF2C2422)),
                              )
                            : Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('$who φτάνει σε', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF2C2422))),
                                  const SizedBox(height: 4),
                                  Text(minutes, style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: Color(0xFFE95926))),
                                  if (distance != null && distance.isNotEmpty)
                                    Text('$distance χλμ', style: const TextStyle(color: Color(0xFF6B7280), fontWeight: FontWeight.w600)),
                                ],
                              ),
                      ),
                      const SizedBox(width: 12),
                      Material(
                        color: const Color(0xFFFFF1EC),
                        shape: const CircleBorder(),
                        child: InkWell(
                          customBorder: const CircleBorder(),
                          onTap: bus == null ? null : () => _contact(bus),
                          child: const SizedBox(
                            width: 64,
                            height: 64,
                            child: Icon(Icons.phone_rounded, color: Color(0xFFE95926), size: 30),
                          ),
                        ),
                      ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}
