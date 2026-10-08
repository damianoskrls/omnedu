import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';

import '../../../core/api/api_client.dart';

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
    } catch (_) {
      if (mounted) setState(() => _error = 'Ο χάρτης δεν φορτώθηκε.');
    }
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
        _map.fitCamera(CameraFit.coordinates(coordinates: points, padding: const EdgeInsets.all(64)));
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

  String _eta(Map<String, dynamic> bus) {
    if (bus['latitude'] == null) return 'Το σχολικό δεν έχει στείλει ακόμα θέση.';
    if (bus['live'] != true) return 'Τελευταία γνωστή θέση. Ο οδηγός δεν στέλνει αυτή τη στιγμή.';
    final minutes = int.tryParse(bus['etaMinutes']?.toString() ?? '');
    final distance = bus['distanceKm']?.toString();
    if (minutes == null) return 'Το σχολικό κινείται. Δεν υπάρχει αποθηκευμένη θέση στάσης για εκτίμηση άφιξης.';
    final distanceText = distance == null || distance.isEmpty ? '' : ' · $distance χλμ';
    if (minutes <= 1) return 'Φτάνει σε λιγότερο από ένα λεπτό$distanceText.';
    return 'Φτάνει σε περίπου $minutes λεπτά$distanceText.';
  }

  @override
  Widget build(BuildContext context) {
    final bus = _bus;
    final here = bus == null ? null : _point(bus['latitude'], bus['longitude']);
    final destRaw = bus?['destination'];
    final dest = destRaw is Map ? _point(destRaw['latitude'], destRaw['longitude']) : null;
    final center = here ?? dest ?? const LatLng(37.9838, 23.7275);
    final title = bus?['name']?.toString() ?? widget.busName;
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
                MarkerLayer(markers: [
                  if (dest != null)
                    Marker(
                      point: dest,
                      width: 40,
                      height: 40,
                      child: const Icon(Icons.home_rounded, color: Color(0xFF77328D), size: 32),
                    ),
                  if (here != null)
                    Marker(
                      point: here,
                      width: 52,
                      height: 52,
                      child: const Icon(Icons.directions_bus_rounded, color: Color(0xFFE95926), size: 42),
                    ),
                ]),
              ],
            ),
          ),
          Container(
            width: double.infinity,
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
            child: Text(
              _error ?? (bus == null ? 'Φόρτωση...' : _eta(bus)),
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, height: 1.35, color: Color(0xFF2C2422)),
            ),
          ),
        ],
      ),
    );
  }
}
