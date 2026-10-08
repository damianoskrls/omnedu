import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

import '../../../core/api/api_client.dart';
import '../../../core/providers/auth_provider.dart';

class DriverScreen extends ConsumerStatefulWidget {
  final String schoolId;
  const DriverScreen({super.key, required this.schoolId});

  @override
  ConsumerState<DriverScreen> createState() => _DriverScreenState();
}

class _DriverScreenState extends ConsumerState<DriverScreen> {
  final _map = MapController();
  List<Map<String, dynamic>> _buses = [];
  String? _serviceId;
  LatLng? _here;
  bool _sharing = false;
  bool _mapReady = false;
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
      await _start();
    } catch (_) {
      if (mounted) setState(() => _status = 'Τα σχολικά δεν φορτώθηκαν.');
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
    if (_mapReady) _map.move(point, _map.camera.zoom < 3 ? 15 : _map.camera.zoom);
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

  @override
  Widget build(BuildContext context) {
    final here = _here ?? const LatLng(37.9838, 23.7275);
    final bus = _buses.cast<Map<String, dynamic>?>().whereType<Map<String, dynamic>>().cast<Map<String, dynamic>>().where((row) => row['id']?.toString() == _serviceId);
    final name = bus.isEmpty ? 'Σχολικό' : bus.first['name']?.toString() ?? 'Σχολικό';
    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      appBar: AppBar(
        backgroundColor: const Color(0xFF77328D),
        foregroundColor: Colors.white,
        title: const Text('Σχολικό'),
        actions: [
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
            child: FlutterMap(
              mapController: _map,
              options: MapOptions(
                initialCenter: here,
                initialZoom: 15,
                onMapReady: () => _mapReady = true,
              ),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.omnedu.omnedu',
                ),
                if (_here != null)
                  MarkerLayer(markers: [
                    Marker(
                      point: _here!,
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
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
                const SizedBox(height: 6),
                Row(
                  children: [
                    Icon(Icons.circle, size: 10, color: _sharing ? const Color(0xFF059669) : const Color(0xFFB45309)),
                    const SizedBox(width: 8),
                    Expanded(child: Text(_status, style: const TextStyle(color: Color(0xFF4B5563), height: 1.3))),
                  ],
                ),
                if (_buses.length > 1) ...[
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    key: ValueKey(_serviceId),
                    initialValue: _serviceId,
                    decoration: const InputDecoration(labelText: 'Σχολικό'),
                    items: [
                      for (final row in _buses)
                        DropdownMenuItem(value: row['id']?.toString(), child: Text(row['name']?.toString() ?? 'Σχολικό')),
                    ],
                    onChanged: (value) => setState(() => _serviceId = value),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
