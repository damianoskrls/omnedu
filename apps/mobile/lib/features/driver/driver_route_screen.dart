import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api/api_client.dart';
import '../../core/providers/auth_provider.dart';
import '../../features/messages/conversation_ui.dart';

class DriverRouteScreen extends ConsumerStatefulWidget {
  final String schoolId;
  final String serviceId;
  final String busName;
  final bool isAfternoon;

  const DriverRouteScreen({
    super.key,
    required this.schoolId,
    required this.serviceId,
    required this.busName,
    this.isAfternoon = false,
  });

  @override
  ConsumerState<DriverRouteScreen> createState() => _DriverRouteScreenState();
}

class _DriverRouteScreenState extends ConsumerState<DriverRouteScreen>
    with TickerProviderStateMixin {
  final _map = MapController();
  List<Map<String, dynamic>> _riders = [];
  LatLng? _here;
  bool _mapReady = false;
  bool _fitted = false;
  bool _sharing = false;
  bool _busy = false;
  bool _routeCompleted = false;
  StreamSubscription<Position>? _posStream;
  Timer? _pingTimer;
  Position? _lastPos;

  // Animation for current stop card
  late AnimationController _currentStopCtrl;
  late Animation<double> _currentStopScale;

  // Progress bar animation
  late AnimationController _progressCtrl;
  late Animation<double> _progressAnim;
  double _lastProgress = 0.0;

  int get _totalPickup => _riders.where((r) => r['canPickup'] == true).length;
  int get _pickedCount => _riders.where((r) => r['pickedUp'] == true).length;
  int get _absentCount => _riders.where((r) => r['isAbsent'] == true).length;

  Map<String, dynamic>? get _currentStop {
    for (final r in _riders) {
      if (r['canPickup'] == true && r['pickedUp'] != true && r['isAbsent'] != true) return r;
    }
    return null;
  }

  @override
  void initState() {
    super.initState();
    _currentStopCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 350));
    _currentStopScale = Tween<double>(begin: 0.92, end: 1.0).animate(
      CurvedAnimation(parent: _currentStopCtrl, curve: Curves.elasticOut),
    );
    _progressCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 500));
    _progressAnim = Tween<double>(begin: 0.0, end: 0.0).animate(
      CurvedAnimation(parent: _progressCtrl, curve: Curves.easeOut),
    );
    _load();
    WidgetsBinding.instance.addPostFrameCallback((_) => _askGpsConsent());
  }

  @override
  void dispose() {
    _currentStopCtrl.dispose();
    _progressCtrl.dispose();
    _posStream?.cancel();
    _pingTimer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final resp = await ref.read(dioProvider).get(
        '/schools/${widget.schoolId}/bus-tracking/route',
        queryParameters: {
          'serviceId': widget.serviceId,
          'direction': widget.isAfternoon ? 'dropoff' : 'pickup',
        },
      );
      final data = resp.data is Map ? Map<String, dynamic>.from(resp.data as Map) : <String, dynamic>{};
      final riders = (data['riders'] as List? ?? [])
          .whereType<Map>()
          .map((r) => Map<String, dynamic>.from(r))
          .toList();
      if (!mounted) return;
      final newProgress = _totalPickup == 0 ? 0.0 : (riders.where((r) => r['pickedUp'] == true || r['isAbsent'] == true).length) / riders.where((r) => r['canPickup'] == true).length.toDouble();
      setState(() { _riders = riders; });
      _animateProgress(newProgress);
      _currentStopCtrl.forward(from: 0);
      _fit();
    } catch (_) {}
  }

  void _animateProgress(double target) {
    _progressAnim = Tween<double>(begin: _lastProgress, end: target).animate(
      CurvedAnimation(parent: _progressCtrl, curve: Curves.easeOut),
    );
    _lastProgress = target;
    _progressCtrl.forward(from: 0);
  }

  Future<void> _askGpsConsent() async {
    if (!mounted) return;
    final direction = widget.isAfternoon ? 'παράδοσης' : 'παραλαβής';
    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(children: [
          Icon(Icons.gps_fixed_rounded, color: Color(0xFF77328D), size: 24),
          SizedBox(width: 10),
          Text('Κοινοποίηση τοποθεσίας', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
        ]),
        content: Text(
          'Κατά τη διάρκεια της διαδρομής $direction, η τοποθεσία σου θα είναι ορατή στους γονείς των παιδιών μέσω της εφαρμογής.',
          style: const TextStyle(fontSize: 14, color: Color(0xFF374151), height: 1.5),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Ακύρωση', style: TextStyle(color: Color(0xFF6B7280))),
          ),
          FilledButton.icon(
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFF77328D), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
            onPressed: () => Navigator.pop(ctx, true),
            icon: const Icon(Icons.play_arrow_rounded, size: 18),
            label: const Text('Έναρξη GPS'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      _startGps();
    } else if (mounted) {
      Navigator.pop(context);
    }
  }

  Future<void> _startGps() async {
    final enabled = await Geolocator.isLocationServiceEnabled();
    if (!enabled) return;
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
    if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) return;

    _posStream = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 10),
    ).listen((pos) {
      _lastPos = pos;
      _show(pos);
      _ping(pos);
    });
    _pingTimer = Timer.periodic(const Duration(seconds: 8), (_) {
      if (_lastPos != null) _ping(_lastPos!);
    });
    final cur = await Geolocator.getCurrentPosition();
    _lastPos = cur;
    _show(cur);
    await _ping(cur);
  }

  void _show(Position pos) {
    final point = LatLng(pos.latitude, pos.longitude);
    if (!mounted) return;
    setState(() => _here = point);
    if (_mapReady && !_fitted) _map.move(point, 15);
  }

  Future<void> _ping(Position pos) async {
    try {
      await ref.read(dioProvider).post('/schools/${widget.schoolId}/bus-tracking/ping', data: {
        'serviceId': widget.serviceId,
        'latitude': pos.latitude,
        'longitude': pos.longitude,
        'heading': pos.heading,
        'speed': pos.speed,
      });
      if (mounted) setState(() => _sharing = true);
    } catch (_) {}
  }

  void _fit() {
    if (!_mapReady || _fitted) return;
    final pts = <LatLng>[
      if (_here != null) _here!,
      for (final r in _riders) if (_riderPoint(r) != null) _riderPoint(r)!,
    ];
    if (pts.isEmpty) return;
    _fitted = true;
    pts.length == 1
        ? _map.move(pts.first, 15)
        : _map.fitCamera(CameraFit.coordinates(coordinates: pts, padding: const EdgeInsets.all(72)));
  }

  Future<void> _pickup(Map<String, dynamic> rider) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await ref.read(dioProvider).post('/schools/${widget.schoolId}/bus-tracking/pickup', data: {
        'serviceId': widget.serviceId,
        'studentId': rider['studentId']?.toString(),
      });
      await _load();
      await _checkAutoComplete();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(apiErrorText(e))));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _markAbsent(Map<String, dynamic> rider) async {
    if (_busy) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Σήμανση ως απών;'),
        content: Text('${rider['name']} δεν είναι στη στάση;'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Ακύρωση')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFFEF4444)),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Απών'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() => _busy = true);
    try {
      await ref.read(dioProvider).post('/schools/${widget.schoolId}/bus-tracking/absent', data: {
        'serviceId': widget.serviceId,
        'studentId': rider['studentId']?.toString(),
      });
      await _load();
      await _checkAutoComplete();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(apiErrorText(e))));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _callParent(Map<String, dynamic> rider) async {
    final phone = rider['parentPhone']?.toString() ?? '';
    if (phone.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Δεν υπάρχει τηλέφωνο γονέα.')));
      return;
    }
    final uri = Uri.parse('tel:$phone');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  Future<void> _messageParent(Map<String, dynamic> rider) async {
    final parentId = rider['parentId']?.toString() ?? '';
    final me = ref.read(authProvider).user;
    if (parentId.isEmpty || me == null) return;
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
            subtitle: rider['name']?.toString() ?? '',
            currentUserId: me.id,
            startedByMe: conversationStartedByMe(created, me.id),
          ),
        ),
      );
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(apiErrorText(e))));
    }
  }

  Future<void> _doComplete() async {
    if (_routeCompleted) return;
    try {
      await ref.read(dioProvider).post(
        '/schools/${widget.schoolId}/bus-tracking/complete',
        data: {
          'serviceId': widget.serviceId,
          'direction': widget.isAfternoon ? 'dropoff' : 'pickup',
          'studentsCount': _riders.where((r) => r['canPickup'] == true).length,
        },
      );
    } catch (_) {}
    _posStream?.cancel();
    _pingTimer?.cancel();
    if (mounted) setState(() => _routeCompleted = true);
  }

  Future<void> _completeRoute() async {
    if (_routeCompleted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Το δρομολόγιο έχει ήδη ολοκληρωθεί.')),
      );
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Ολοκλήρωση διαδρομής;'),
        content: const Text('Επιβεβαιώνεις ότι η διαδρομή ολοκληρώθηκε;'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Πίσω')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFF059669), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Ολοκλήρωση'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    await _doComplete();
  }

  Future<void> _checkAutoComplete() async {
    final total = _riders.where((r) => r['canPickup'] == true).length;
    final done = _riders.where((r) => r['canPickup'] == true && (r['pickedUp'] == true || r['isAbsent'] == true)).length;
    if (total > 0 && done >= total && !_routeCompleted) {
      await _doComplete();
    }
  }

  Widget _buildCompletedScreen() {
    final label = widget.isAfternoon ? 'Παράδοση' : 'Παραλαβή';
    return Scaffold(
      backgroundColor: const Color(0xFFF0F4F0),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: Align(
                alignment: Alignment.centerLeft,
                child: IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.arrow_back_rounded),
                ),
              ),
            ),
            const Spacer(),
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 32),
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 40),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(28),
                boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 24, offset: const Offset(0, 8))],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 80, height: 80,
                    decoration: BoxDecoration(color: const Color(0xFFDCFCE7), shape: BoxShape.circle),
                    child: const Icon(Icons.check_circle_rounded, color: Color(0xFF059669), size: 48),
                  ),
                  const SizedBox(height: 20),
                  Text('$label Ολοκληρώθηκε!',
                    style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: Color(0xFF1F2937))),
                  const SizedBox(height: 10),
                  const Text('Το δρομολόγιο καταγράφηκε επιτυχώς.',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 14, color: Color(0xFF6B7280), height: 1.5)),
                  const SizedBox(height: 28),
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF77328D),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                      onPressed: () => Navigator.pop(context),
                      child: const Text('Επιστροφή', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                    ),
                  ),
                ],
              ),
            ),
            const Spacer(),
          ],
        ),
      ),
    );
  }

  LatLng? _riderPoint(Map<String, dynamic> rider) {
    final lat = double.tryParse(rider['latitude']?.toString() ?? '');
    final lng = double.tryParse(rider['longitude']?.toString() ?? '');
    if (lat == null || lng == null) return null;
    return LatLng(lat, lng);
  }

  @override
  Widget build(BuildContext context) {
    if (_routeCompleted) return _buildCompletedScreen();
    final here = _here ?? const LatLng(37.9838, 23.7275);
    final current = _currentStop;
    final done = _pickedCount + _absentCount;
    final total = _totalPickup;
    final nextAddr = current?['address']?.toString() ?? '';
    final nextTime = current?['pickupTime']?.toString() ?? '';

    return Scaffold(
      backgroundColor: const Color(0xFFF0F4F0),
      body: Column(
        children: [
          // Sticky header
          _StickyHeader(
            nextAddress: nextAddr.isNotEmpty ? nextAddr : (current?['name']?.toString() ?? 'Τέλος στάσεων'),
            nextTime: nextTime,
            done: done,
            total: total,
            progressAnim: _progressAnim,
            onBack: () => Navigator.pop(context),
          ),

          // Map
          Expanded(
            flex: 4,
            child: Stack(
              children: [
                FlutterMap(
                  mapController: _map,
                  options: MapOptions(
                    initialCenter: here,
                    initialZoom: 14,
                    onMapReady: () { _mapReady = true; _fit(); },
                  ),
                  children: [
                    TileLayer(
                      urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'com.omnedu.omnedu',
                    ),
                    MarkerLayer(markers: [
                      for (final rider in _riders)
                        if (_riderPoint(rider) != null)
                          Marker(
                            point: _riderPoint(rider)!,
                            width: 80, height: 56,
                            alignment: Alignment.topCenter,
                            child: _StopPin(
                              name: _firstName(rider['name']?.toString() ?? ''),
                              status: rider['pickedUp'] == true
                                  ? _StopStatus.done
                                  : rider['isAbsent'] == true
                                      ? _StopStatus.absent
                                      : rider['studentId'] == current?['studentId']
                                          ? _StopStatus.current
                                          : _StopStatus.upcoming,
                            ),
                          ),
                      if (_here != null)
                        Marker(
                          point: _here!,
                          width: 78, height: 86,
                          alignment: Alignment.topCenter,
                          child: Image.asset('assets/images/school_bus.png', fit: BoxFit.contain),
                        ),
                    ]),
                  ],
                ),
                // Navigate FAB
                if (current != null && _riderPoint(current) != null)
                  Positioned(
                    right: 12,
                    bottom: 12,
                    child: FloatingActionButton(
                      mini: false,
                      backgroundColor: const Color(0xFF2563EB),
                      onPressed: () async {
                        final pt = _riderPoint(current)!;
                        final uri = Uri.parse('geo:${pt.latitude},${pt.longitude}?q=${Uri.encodeComponent(nextAddr)}');
                        if (await canLaunchUrl(uri)) {
                          await launchUrl(uri, mode: LaunchMode.externalApplication);
                        }
                      },
                      child: const Icon(Icons.navigation_rounded, color: Colors.white),
                    ),
                  ),
                if (!_sharing)
                  Positioned(
                    top: 8, left: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(color: Colors.white.withOpacity(0.9), borderRadius: BorderRadius.circular(8)),
                      child: const Row(children: [
                        Icon(Icons.gps_off, size: 13, color: Color(0xFFD97706)),
                        SizedBox(width: 4),
                        Text('GPS...', style: TextStyle(fontSize: 11, color: Color(0xFFD97706))),
                      ]),
                    ),
                  ),
              ],
            ),
          ),

          // Stop list
          Expanded(
            flex: 5,
            child: Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
                    child: Row(
                      children: [
                        const Text('Στάσεις Διαδρομής', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                        const Spacer(),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(color: const Color(0xFFDCFCE7), borderRadius: BorderRadius.circular(20)),
                          child: Row(children: [
                            Container(width: 6, height: 6, decoration: const BoxDecoration(color: Color(0xFF059669), shape: BoxShape.circle)),
                            const SizedBox(width: 4),
                            const Text('Ενεργή', style: TextStyle(color: Color(0xFF059669), fontWeight: FontWeight.w600, fontSize: 11)),
                          ]),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  Expanded(
                    child: _riders.isEmpty
                        ? const Center(child: CircularProgressIndicator(color: Color(0xFF77328D)))
                        : ListView.builder(
                            padding: const EdgeInsets.fromLTRB(12, 0, 12, 16),
                            itemCount: _riders.length + 1,
                            itemBuilder: (_, i) {
                              if (i == _riders.length) {
                                return _CompleteRouteButton(onComplete: _completeRoute);
                              }
                              final rider = _riders[i];
                              final isCurrent = rider['studentId'] == current?['studentId'];
                              final isPicked = rider['pickedUp'] == true;
                              final isAbsent = rider['isAbsent'] == true;
                              if (isCurrent) {
                                return ScaleTransition(
                                  scale: _currentStopScale,
                                  child: _CurrentStopCard(
                                    rider: rider,
                                    busy: _busy,
                                    onPickup: () => _pickup(rider),
                                    onAbsent: () => _markAbsent(rider),
                                    onCall: () => _callParent(rider),
                                    onMessage: () => _messageParent(rider),
                                  ),
                                );
                              }
                              return _StopRow(
                                rider: rider,
                                isPicked: isPicked,
                                isAbsent: isAbsent,
                              );
                            },
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

class _StickyHeader extends StatelessWidget {
  final String nextAddress;
  final String nextTime;
  final int done;
  final int total;
  final Animation<double> progressAnim;
  final VoidCallback onBack;

  const _StickyHeader({
    required this.nextAddress,
    required this.nextTime,
    required this.done,
    required this.total,
    required this.progressAnim,
    required this.onBack,
  });

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top;
    return Container(
      color: Colors.white,
      padding: EdgeInsets.fromLTRB(0, top, 0, 0),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.arrow_back_rounded),
                  onPressed: onBack,
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Text('ΕΠΟΜΕΝΗ ΣΤΑΣΗ', style: TextStyle(color: Color(0xFF6B7280), fontWeight: FontWeight.w700, fontSize: 10, letterSpacing: 0.8)),
                          if (nextTime.isNotEmpty) ...[
                            const Text(' • ', style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 10)),
                            Text(nextTime, style: const TextStyle(color: Color(0xFF059669), fontWeight: FontWeight.w700, fontSize: 10)),
                          ],
                        ],
                      ),
                      Text(
                        nextAddress.isNotEmpty ? nextAddress : 'Χωρίς άλλες στάσεις',
                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: Color(0xFF111827)),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(color: const Color(0xFFFEE2E2), borderRadius: BorderRadius.circular(20)),
                  child: Text('$done/$total', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: Color(0xFFE95926))),
                ),
              ],
            ),
          ),
          AnimatedBuilder(
            animation: progressAnim,
            builder: (_, __) => LinearProgressIndicator(
              value: progressAnim.value,
              backgroundColor: const Color(0xFFF3F4F6),
              valueColor: const AlwaysStoppedAnimation(Color(0xFF059669)),
              minHeight: 4,
            ),
          ),
        ],
      ),
    );
  }
}

class _CurrentStopCard extends StatelessWidget {
  final Map<String, dynamic> rider;
  final bool busy;
  final VoidCallback onPickup;
  final VoidCallback onAbsent;
  final VoidCallback onCall;
  final VoidCallback onMessage;

  const _CurrentStopCard({
    required this.rider,
    required this.busy,
    required this.onPickup,
    required this.onAbsent,
    required this.onCall,
    required this.onMessage,
  });

  @override
  Widget build(BuildContext context) {
    final name = rider['name']?.toString() ?? '';
    final address = rider['address']?.toString() ?? '';
    final time = rider['pickupTime']?.toString() ?? '';
    final avatarUrl = rider['avatarUrl']?.toString() ?? '';
    final parentName = rider['parentName']?.toString() ?? '';
    final parentAvatarUrl = rider['parentAvatarUrl']?.toString() ?? '';
    final pickupContact = rider['pickupContact']?.toString() ?? '';
    final dropoffContact = rider['dropoffContact']?.toString() ?? '';
    final parentPhone = rider['parentPhone']?.toString() ?? '';

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFFBBF24), width: 2),
        boxShadow: [BoxShadow(color: const Color(0xFFFBBF24).withOpacity(0.25), blurRadius: 12, offset: const Offset(0, 4))],
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                // Avatar
                Container(
                  width: 48, height: 48,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF3E8FF),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: avatarUrl.isNotEmpty
                      ? ClipRRect(
                          borderRadius: BorderRadius.circular(14),
                          child: Image.network(avatarUrl, fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => _InitialAvatar(name: name)),
                        )
                      : _InitialAvatar(name: name),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                      Text(
                        '${time.isNotEmpty ? '$time • ' : ''}$address',
                        style: const TextStyle(color: Color(0xFF6B7280), fontSize: 12),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(8)),
                  child: const Text('ΤΩΡΑ', style: TextStyle(color: Color(0xFFD97706), fontWeight: FontWeight.w800, fontSize: 11)),
                ),
              ],
            ),

            // Guardian info
            if (pickupContact.isNotEmpty || parentName.isNotEmpty) ...[
              const SizedBox(height: 10),
              _GuardianChip(
                label: 'Παραδίδει',
                name: pickupContact.isNotEmpty ? pickupContact : parentName,
                avatarUrl: pickupContact.isEmpty ? parentAvatarUrl : '',
              ),
            ],
            if (dropoffContact.isNotEmpty && dropoffContact != pickupContact) ...[
              const SizedBox(height: 4),
              _GuardianChip(label: 'Παραλαμβάνει', name: dropoffContact, avatarUrl: ''),
            ],

            const SizedBox(height: 12),

            // Action buttons row
            Row(
              children: [
                Expanded(
                  child: SizedBox(
                    height: 48,
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF059669),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: busy ? null : onPickup,
                      icon: const Icon(Icons.person_rounded, size: 18),
                      label: const Text('Παραλαβή', style: TextStyle(fontWeight: FontWeight.w800)),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: SizedBox(
                    height: 48,
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFFEF4444),
                        side: const BorderSide(color: Color(0xFFEF4444)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: busy ? null : onAbsent,
                      icon: const Icon(Icons.person_off_rounded, size: 18),
                      label: const Text('Απών', style: TextStyle(fontWeight: FontWeight.w800)),
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 8),

            // Call + Message row
            Row(
              children: [
                if (parentPhone.isNotEmpty)
                  Expanded(
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF2563EB),
                        side: const BorderSide(color: Color(0xFF2563EB)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        padding: const EdgeInsets.symmetric(vertical: 8),
                      ),
                      onPressed: onCall,
                      icon: const Icon(Icons.phone_rounded, size: 16),
                      label: const Text('Κλήση', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                    ),
                  ),
                if (parentPhone.isNotEmpty) const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF77328D),
                      side: const BorderSide(color: Color(0xFF77328D)),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      padding: const EdgeInsets.symmetric(vertical: 8),
                    ),
                    onPressed: onMessage,
                    icon: const Icon(Icons.chat_bubble_outline_rounded, size: 16),
                    label: const Text('Μήνυμα', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 8),
            const Row(
              children: [
                Icon(Icons.security_rounded, size: 12, color: Color(0xFF9CA3AF)),
                SizedBox(width: 4),
                Text('Παρακαλώ επιβεβαιώστε την ασφαλή είσοδο του παιδιού', style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 11)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _GuardianChip extends StatelessWidget {
  final String label;
  final String name;
  final String avatarUrl;
  const _GuardianChip({required this.label, required this.name, required this.avatarUrl});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text('$label: ', style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12)),
        if (avatarUrl.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(right: 4),
            child: CircleAvatar(
              radius: 10,
              backgroundImage: NetworkImage(avatarUrl),
              backgroundColor: const Color(0xFFE5E7EB),
            ),
          ),
        Text(name, style: const TextStyle(color: Color(0xFF374151), fontWeight: FontWeight.w600, fontSize: 12)),
      ],
    );
  }
}

class _StopRow extends StatelessWidget {
  final Map<String, dynamic> rider;
  final bool isPicked;
  final bool isAbsent;
  const _StopRow({required this.rider, required this.isPicked, required this.isAbsent});

  @override
  Widget build(BuildContext context) {
    final name = rider['name']?.toString() ?? '';
    final address = rider['address']?.toString() ?? '';
    final time = rider['pickupTime']?.toString() ?? '';

    Color rowBg;
    Color textColor;
    Widget statusWidget;

    if (isPicked) {
      rowBg = const Color(0xFFF0FDF4);
      textColor = const Color(0xFF9CA3AF);
      statusWidget = Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
        decoration: BoxDecoration(color: const Color(0xFFDCFCE7), borderRadius: BorderRadius.circular(6)),
        child: const Text('PICKED UP', style: TextStyle(color: Color(0xFF059669), fontWeight: FontWeight.w700, fontSize: 10)),
      );
    } else if (isAbsent) {
      rowBg = const Color(0xFFFFF1F2);
      textColor = const Color(0xFF9CA3AF);
      statusWidget = Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
        decoration: BoxDecoration(color: const Color(0xFFFFE4E6), borderRadius: BorderRadius.circular(6)),
        child: const Text('ΑΠΩΝ', style: TextStyle(color: Color(0xFFEF4444), fontWeight: FontWeight.w700, fontSize: 10)),
      );
    } else {
      rowBg = Colors.transparent;
      textColor = const Color(0xFF374151);
      statusWidget = const SizedBox();
    }

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      margin: const EdgeInsets.symmetric(vertical: 3, horizontal: 4),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: isPicked || isAbsent ? rowBg : const Color(0xFFF6F3FA),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 250),
            child: isPicked
                ? const Icon(Icons.check_circle_rounded, color: Color(0xFF059669), size: 22, key: ValueKey('check'))
                : isAbsent
                    ? const Icon(Icons.cancel_rounded, color: Color(0xFFEF4444), size: 22, key: ValueKey('absent'))
                    : Container(
                        key: const ValueKey('upcoming'),
                        width: 22, height: 22,
                        decoration: BoxDecoration(
                          color: const Color(0xFFE5E7EB),
                          borderRadius: BorderRadius.circular(11),
                        ),
                      ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${time.isNotEmpty ? '$time — ' : ''}$name',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: textColor),
                ),
                if (address.isNotEmpty)
                  Text(address, style: TextStyle(color: textColor.withOpacity(0.7), fontSize: 12), maxLines: 1, overflow: TextOverflow.ellipsis),
              ],
            ),
          ),
          statusWidget,
        ],
      ),
    );
  }
}

class _CompleteRouteButton extends StatelessWidget {
  final VoidCallback onComplete;
  const _CompleteRouteButton({required this.onComplete});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 12, 4, 4),
      child: SizedBox(
        width: double.infinity,
        height: 58,
        child: FilledButton.icon(
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xFF059669),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          ),
          onPressed: onComplete,
          icon: const Icon(Icons.flag_rounded, size: 22),
          label: const Text('Ολοκλήρωση Διαδρομής', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
        ),
      ),
    );
  }
}

class _StopPin extends StatelessWidget {
  final String name;
  final _StopStatus status;
  const _StopPin({required this.name, required this.status});

  @override
  Widget build(BuildContext context) {
    final color = switch (status) {
      _StopStatus.done => const Color(0xFF059669),
      _StopStatus.absent => const Color(0xFFEF4444),
      _StopStatus.current => const Color(0xFFE95926),
      _StopStatus.upcoming => const Color(0xFF77328D),
    };
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(6)),
          child: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: color)),
        ),
        Icon(Icons.location_pin, color: color, size: 28),
      ],
    );
  }
}

enum _StopStatus { done, absent, current, upcoming }

class _InitialAvatar extends StatelessWidget {
  final String name;
  const _InitialAvatar({required this.name});

  @override
  Widget build(BuildContext context) {
    final initial = name.trim().isNotEmpty ? name.trim()[0].toUpperCase() : '?';
    return Center(
      child: Text(initial, style: const TextStyle(color: Color(0xFF77328D), fontWeight: FontWeight.bold, fontSize: 20)),
    );
  }
}

String _firstName(String name) {
  final trimmed = name.trim();
  if (trimmed.isEmpty) return 'Παιδί';
  return trimmed.split(RegExp(r'\s+')).first;
}
