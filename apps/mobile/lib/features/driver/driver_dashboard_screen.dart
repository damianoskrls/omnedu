import 'package:cached_network_image/cached_network_image.dart';
import 'package:dio/dio.dart' as osrm;
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api/api_client.dart';
import '../../core/providers/auth_provider.dart';
import '../../features/messages/conversation_ui.dart';
import 'driver_route_screen.dart';

class DriverDashboardScreen extends ConsumerStatefulWidget {
  final String schoolId;
  const DriverDashboardScreen({super.key, required this.schoolId});

  @override
  ConsumerState<DriverDashboardScreen> createState() => _DriverDashboardScreenState();
}

class _DriverDashboardScreenState extends ConsumerState<DriverDashboardScreen>
    with SingleTickerProviderStateMixin {
  Map<String, dynamic>? _dashboard;
  bool _loading = true;
  String? _error;

  late AnimationController _pulseCtrl;
  late Animation<double> _pulseAnim;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))
      ..repeat(reverse: true);
    _pulseAnim = Tween<double>(begin: 1.0, end: 1.04).animate(
      CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut),
    );
    _load();
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final resp = await ref.read(dioProvider).get('/schools/${widget.schoolId}/bus-tracking/dashboard');
      final data = resp.data is Map ? Map<String, dynamic>.from(resp.data as Map) : <String, dynamic>{};
      if (!mounted) return;
      setState(() { _dashboard = data; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = apiErrorText(e); _loading = false; });
    }
  }

  void _startRoute(Map<String, dynamic> route) {
    final serviceId = route['serviceId']?.toString() ?? _dashboard?['activeServiceId']?.toString();
    if (serviceId == null) return;
    final busName = route['name']?.toString() ?? 'Σχολικό';
    final isAfternoon = route['direction']?.toString() == 'dropoff';
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => DriverRouteScreen(
          schoolId: widget.schoolId,
          serviceId: serviceId,
          busName: busName,
          isAfternoon: isAfternoon,
        ),
      ),
    ).then((_) => _load());
  }

  Future<void> _showPreview(Map<String, dynamic> route) async {
    final serviceId = route['serviceId']?.toString();
    final busName = route['name']?.toString() ?? 'Σχολικό';
    final isAfternoon = route['direction']?.toString() == 'dropoff';
    if (serviceId == null) return;
    final userId = ref.read(authProvider).user?.id ?? '';

    List<Map<String, dynamic>> riders = [];
    try {
      final resp = await ref.read(dioProvider).get(
        '/schools/${widget.schoolId}/bus-tracking/route',
        queryParameters: {'serviceId': serviceId, 'direction': isAfternoon ? 'dropoff' : 'pickup'},
      );
      final data = resp.data is Map ? resp.data as Map : {};
      riders = (data['riders'] as List? ?? [])
          .whereType<Map>()
          .map((r) => Map<String, dynamic>.from(r))
          .where((r) => r['canPickup'] == true)
          .toList();
    } catch (_) {}

    if (!mounted) return;
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => _RoutePreviewScreen(
          busName: busName,
          isAfternoon: isAfternoon,
          riders: riders,
          schoolId: widget.schoolId,
          driverUserId: userId,
          schoolLat: double.tryParse(_dashboard?['schoolLat']?.toString() ?? ''),
          schoolLng: double.tryParse(_dashboard?['schoolLng']?.toString() ?? ''),
          schoolLogoUrl: _dashboard?['schoolLogoUrl']?.toString(),
          onStart: () {
            Navigator.pop(context);
            _startRoute(route);
          },
        ),
      ),
    );
  }

  static String _appBarTitle(List<Map<String, dynamic>> routes) {
    final hasMorning = routes.any((r) => r['direction'] == 'pickup');
    final hasAfternoon = routes.any((r) => r['direction'] == 'dropoff');
    if (hasMorning && hasAfternoon) return 'Οι Διαδρομές μου';
    if (hasMorning) return 'Πρωινή Παραλαβή';
    if (hasAfternoon) return 'Απογευματινή Παράδοση';
    return 'Σήμερα';
  }

  List<Widget> _buildRouteCards(List<Map<String, dynamic>> routes, String today) {
    if (routes.isEmpty) return [];
    final allDone = routes.every((r) => r['status'] == 'completed');
    final widgets = <Widget>[];

    for (final route in routes) {
      final isAfternoon = route['direction']?.toString() == 'dropoff';
      final done = route['status'] == 'completed';
      widgets.add(_RouteCard(
        label: isAfternoon ? 'Απογευματινή Παράδοση' : 'Πρωινή Παραλαβή',
        badge: isAfternoon ? 'ΑΠΟΓΕΥΜΑ' : 'ΠΡΩΙΝΟ',
        badgeColor: isAfternoon ? const Color(0xFFD97706) : const Color(0xFF77328D),
        date: today,
        startTime: route['startTime']?.toString(),
        stopsCount: route['stopsCount'] as int? ?? 0,
        studentsCount: route['studentsCount'] as int? ?? 0,
        pulseAnim: _pulseAnim,
        completed: done,
        onStart: done ? null : () => _startRoute(route),
        onPreview: () => _showPreview(route),
      ));
      widgets.add(const SizedBox(height: 12));
    }

    if (allDone) {
      widgets.add(const _DayCompleteCard());
    }

    return widgets;
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    final firstName = (user?.fullName ?? 'Οδηγέ').split(' ').first;
    final d = _dashboard;
    final routes = (d?['routes'] as List? ?? [])
        .whereType<Map>()
        .map((r) => Map<String, dynamic>.from(r))
        .toList();
    final firstRoute = routes.isNotEmpty ? routes.first : null;
    final busName = firstRoute?['name']?.toString() ?? 'Σχολικό';
    final busNumber = firstRoute?['busNumber']?.toString() ?? '';

    final conversations = ref.watch(conversationsProvider(widget.schoolId));
    final unread = conversations.asData?.value
            .where((c) => c is Map && c['unread'] == true)
            .length ?? 0;
    final userId = user?.id ?? '';

    String today = '';
    try {
      today = DateFormat('EEEE, d MMMM', 'el').format(DateTime.now());
    } catch (_) {
      today = DateFormat('EEEE, d MMMM').format(DateTime.now());
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      appBar: AppBar(
        backgroundColor: const Color(0xFF77328D),
        foregroundColor: Colors.white,
        title: Text(_appBarTitle(routes), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 17)),
        actions: [
          IconButton(
            icon: Badge(
              isLabelVisible: unread > 0,
              label: Text('$unread'),
              child: const Icon(Icons.chat_bubble_outline_rounded),
            ),
            tooltip: 'Μηνύματα',
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => DriverMessagesScreen(schoolId: widget.schoolId, userId: userId),
              ),
            ),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF77328D)))
          : _error != null
              ? _ErrorState(message: _error!, onRetry: _load)
              : RefreshIndicator(
                  color: const Color(0xFF77328D),
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
                    children: [
                      _GreetingCard(firstName: firstName, busName: busName, busNumber: busNumber),
                      const SizedBox(height: 16),
                      ..._buildRouteCards(routes, today),
                      if (routes.isEmpty && d != null)
                        _EmptyState(onRetry: _load),
                    ],
                  ),
                ),
    );
  }
}

class _GreetingCard extends StatelessWidget {
  final String firstName;
  final String busName;
  final String busNumber;
  const _GreetingCard({required this.firstName, required this.busName, required this.busNumber});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF8B4DA8), Color(0xFF5B1E73)],
        ),
        borderRadius: BorderRadius.circular(22),
        boxShadow: [BoxShadow(color: const Color(0xFF77328D).withOpacity(0.28), blurRadius: 20, offset: const Offset(0, 6))],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Καλημέρα,', style: TextStyle(color: Colors.white70, fontSize: 15)),
                Text('$firstName!', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 28, height: 1.1)),
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.18),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.directions_bus_rounded, color: Colors.white, size: 14),
                      const SizedBox(width: 5),
                      Text(
                        busNumber.isNotEmpty ? '$busName #$busNumber' : busName,
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Image.asset(
            'assets/images/school_bus.png',
            height: 72,
            errorBuilder: (_, __, ___) => const Icon(Icons.directions_bus_rounded, color: Colors.white38, size: 56),
          ),
        ],
      ),
    );
  }
}

class _RouteCard extends StatelessWidget {
  final String label;
  final String badge;
  final Color badgeColor;
  final String date;
  final String? startTime;
  final int stopsCount;
  final int studentsCount;
  final Animation<double> pulseAnim;
  final bool completed;
  final VoidCallback? onStart;
  final VoidCallback? onPreview;

  const _RouteCard({
    required this.label,
    required this.badge,
    required this.badgeColor,
    required this.date,
    required this.startTime,
    required this.stopsCount,
    required this.studentsCount,
    required this.pulseAnim,
    this.completed = false,
    this.onStart,
    this.onPreview,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 14, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(label, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18))),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: badgeColor.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(badge, style: TextStyle(color: badgeColor, fontWeight: FontWeight.w800, fontSize: 12)),
              ),
            ],
          ),
          const SizedBox(height: 3),
          Text(date, style: const TextStyle(color: Color(0xFF6B7280), fontSize: 13)),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(child: _StatTile(icon: Icons.schedule_rounded, iconColor: const Color(0xFF6B7280), label: 'ΕΝΑΡΞΗ', value: startTime ?? '—')),
              const SizedBox(width: 10),
              Expanded(child: _StatTile(icon: Icons.location_on_outlined, iconColor: const Color(0xFFDB2777), label: 'ΣΤΑΣΕΙΣ', value: '$stopsCount')),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(child: _StatTile(icon: Icons.school_rounded, iconColor: const Color(0xFFD97706), label: 'ΜΑΘΗΤΕΣ', value: '$studentsCount')),
              const SizedBox(width: 10),
              Expanded(child: _StatTile(icon: Icons.circle, iconColor: const Color(0xFF059669), label: 'ΚΑΤΑΣΤΑΣΗ', value: 'Ενεργό')),
            ],
          ),
          const SizedBox(height: 18),
          if (completed)
            Container(
              width: double.infinity,
              height: 52,
              decoration: BoxDecoration(
                color: const Color(0xFFF0FDF4),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFF86EFAC)),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.check_circle_rounded, color: Color(0xFF16A34A), size: 22),
                  SizedBox(width: 8),
                  Text('Ολοκληρώθηκε', style: TextStyle(color: Color(0xFF16A34A), fontWeight: FontWeight.w700, fontSize: 16)),
                ],
              ),
            )
          else ...[
            Row(
              children: [
                Expanded(
                  child: ScaleTransition(
                    scale: pulseAnim,
                    child: SizedBox(
                      height: 54,
                      child: FilledButton.icon(
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFFE95926),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        icon: const Icon(Icons.play_arrow_rounded, size: 22),
                        label: const Text(
                          'Έναρξη Διαδρομής',
                          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
                        ),
                        onPressed: onStart,
                      ),
                    ),
                  ),
                ),
                if (onPreview != null) ...[
                  const SizedBox(width: 8),
                  SizedBox(
                    height: 54,
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: badgeColor,
                        side: BorderSide(color: badgeColor),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                      ),
                      onPressed: onPreview,
                      icon: const Icon(Icons.map_outlined, size: 20),
                      label: const Text('Προεπισκόπηση', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String label;
  final String value;
  const _StatTile({required this.icon, required this.iconColor, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(color: const Color(0xFFF6F3FA), borderRadius: BorderRadius.circular(14)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: iconColor, size: 18),
          const SizedBox(height: 4),
          Text(label, style: const TextStyle(color: Color(0xFF9CA3AF), fontWeight: FontWeight.w600, fontSize: 10, letterSpacing: 0.5)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 20, color: Color(0xFF111827))),
        ],
      ),
    );
  }
}

class _RoutePreviewScreen extends ConsumerStatefulWidget {
  final String busName;
  final bool isAfternoon;
  final List<Map<String, dynamic>> riders;
  final String schoolId;
  final String driverUserId;
  final VoidCallback onStart;
  final double? schoolLat;
  final double? schoolLng;
  final String? schoolLogoUrl;

  const _RoutePreviewScreen({
    required this.busName,
    required this.isAfternoon,
    required this.riders,
    required this.schoolId,
    required this.driverUserId,
    required this.onStart,
    this.schoolLat,
    this.schoolLng,
    this.schoolLogoUrl,
  });

  @override
  ConsumerState<_RoutePreviewScreen> createState() => _RoutePreviewScreenState();
}

class _RoutePreviewScreenState extends ConsumerState<_RoutePreviewScreen>
    with SingleTickerProviderStateMixin {
  final _map = MapController();
  List<LatLng> _routePoints = [];
  late AnimationController _drawCtrl;

  @override
  void initState() {
    super.initState();
    _drawCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    );
    _fetchRoute();
  }

  @override
  void dispose() {
    _drawCtrl.dispose();
    super.dispose();
  }

  LatLng? get _schoolPoint {
    final lat = widget.schoolLat ?? 38.0864;
    final lng = widget.schoolLng ?? 23.7332;
    return LatLng(lat, lng);
  }

  Future<void> _fetchRoute() async {
    final riderPts = widget.riders.map(_riderPoint).whereType<LatLng>().toList();
    final school = _schoolPoint;
    final pts = school != null
        ? [school, ...riderPts, school]
        : riderPts;
    if (pts.length < 2) return;
    try {
      final coords = pts.map((p) => '${p.longitude},${p.latitude}').join(';');
      final url =
          'https://router.project-osrm.org/route/v1/driving/$coords?overview=full&geometries=geojson';
      final resp = await osrm.Dio().get(url);
      final routes = ((resp.data as Map)['routes'] as List?) ?? [];
      if (routes.isEmpty || !mounted) return;
      final geometry = (routes[0] as Map)['geometry'] as Map?;
      final coordinates = (geometry?['coordinates'] as List?) ?? [];
      setState(() {
        _routePoints = coordinates.map((c) {
          final arr = c as List;
          return LatLng((arr[1] as num).toDouble(), (arr[0] as num).toDouble());
        }).toList();
      });
      _drawCtrl.forward();
    } catch (_) {}
  }

  LatLng? _riderPoint(Map<String, dynamic> r) {
    final lat = double.tryParse(r['latitude']?.toString() ?? '');
    final lng = double.tryParse(r['longitude']?.toString() ?? '');
    if (lat == null || lng == null) return null;
    return LatLng(lat, lng);
  }

  void _showContact(Map<String, dynamic> rider) {
    final color = widget.isAfternoon ? const Color(0xFFD97706) : const Color(0xFF77328D);
    final name = rider['name']?.toString() ?? '';
    final parentPhone = rider['parentPhone']?.toString() ?? '';
    final parentId = rider['parentId']?.toString() ?? '';
    final rawContact = widget.isAfternoon
        ? rider['dropoffContact']?.toString()
        : rider['pickupContact']?.toString();
    final contactPerson = (rawContact?.isNotEmpty == true)
        ? rawContact!
        : (rider['parentName']?.toString() ?? '');

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 16, 20, 20 + MediaQuery.of(ctx).padding.bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40, height: 4,
                decoration: BoxDecoration(color: const Color(0xFFE5E7EB), borderRadius: BorderRadius.circular(2)),
              ),
            ),
            const SizedBox(height: 16),
            Text(name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF111827))),
            if (contactPerson.isNotEmpty) ...[
              const SizedBox(height: 6),
              Row(
                children: [
                  Icon(Icons.person_rounded, color: color, size: 16),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      '${widget.isAfternoon ? 'Θα παραλάβει' : 'Θα παραδοθεί σε'}: $contactPerson',
                      style: const TextStyle(fontSize: 14, color: Color(0xFF6B7280)),
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 20),
            Row(
              children: [
                if (parentPhone.isNotEmpty) ...[
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () async {
                        final uri = Uri(scheme: 'tel', path: parentPhone);
                        await launchUrl(uri);
                      },
                      icon: const Icon(Icons.phone_rounded, size: 18),
                      label: const Text('Κλήση'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: color,
                        side: BorderSide(color: color),
                        minimumSize: const Size(0, 48),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                ],
                Expanded(
                  child: FilledButton.icon(
                    onPressed: parentId.isNotEmpty ? () async {
                      Navigator.pop(ctx);
                      final me = ref.read(authProvider).user;
                      if (me == null) return;
                      try {
                        final created = await openScopedConversation(
                          ref,
                          schoolId: widget.schoolId,
                          kind: 'driver',
                          withUserId: parentId,
                          participantIds: [me.id, parentId],
                        );
                        final convId = created?['id'] as String?;
                        if (convId == null || !mounted) return;
                        await Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => ChatScreen(
                              schoolId: widget.schoolId,
                              convId: convId,
                              title: rider['parentName']?.toString().trim().isNotEmpty == true
                                  ? rider['parentName'].toString()
                                  : 'Γονέας',
                              subtitle: name,
                              currentUserId: me.id,
                              startedByMe: conversationStartedByMe(created, me.id),
                            ),
                          ),
                        );
                      } catch (_) {}
                    } : null,
                    icon: const Icon(Icons.message_rounded, size: 18),
                    label: const Text('Μήνυμα'),
                    style: FilledButton.styleFrom(
                      backgroundColor: color,
                      minimumSize: const Size(0, 48),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _fit() {
    final riderPts = widget.riders.map(_riderPoint).whereType<LatLng>().toList();
    final school = _schoolPoint;
    final pts = [if (school != null) school, ...riderPts];
    if (pts.isEmpty) return;
    pts.length == 1
        ? _map.move(pts.first, 14)
        : _map.fitCamera(CameraFit.coordinates(coordinates: pts, padding: const EdgeInsets.all(60)));
  }

  @override
  Widget build(BuildContext context) {
    final color = widget.isAfternoon ? const Color(0xFFD97706) : const Color(0xFF77328D);
    final pts = widget.riders.map(_riderPoint).whereType<LatLng>().toList();
    final center = pts.isNotEmpty ? pts.first : const LatLng(37.9838, 23.7275);

    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      appBar: AppBar(
        backgroundColor: color,
        foregroundColor: Colors.white,
        title: Text(
          'Προεπισκόπηση · ${widget.isAfternoon ? 'Παράδοση' : 'Παραλαβή'}',
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 17),
        ),
      ),
      body: Column(
        children: [
          // Map
          SizedBox(
            height: 280,
            child: FlutterMap(
              mapController: _map,
              options: MapOptions(
                initialCenter: center,
                initialZoom: 13,
                onMapReady: () => WidgetsBinding.instance.addPostFrameCallback((_) => _fit()),
              ),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.omnedu.omnedu',
                ),
                // Animated route polyline from OSRM routing
                AnimatedBuilder(
                  animation: _drawCtrl,
                  builder: (_, __) {
                    final total = _routePoints.length;
                    if (total < 2 || _drawCtrl.value == 0) return const SizedBox.shrink();
                    final count = ((_drawCtrl.value) * total).round().clamp(2, total);
                    return PolylineLayer(
                      polylines: [
                        Polyline(
                          points: _routePoints.sublist(0, count),
                          strokeWidth: 4.5,
                          color: color.withValues(alpha: 0.85),
                          borderStrokeWidth: 2.5,
                          borderColor: Colors.white.withValues(alpha: 0.7),
                        ),
                      ],
                    );
                  },
                ),
                MarkerLayer(
                  markers: [
                    for (int i = 0; i < widget.riders.length; i++)
                      if (_riderPoint(widget.riders[i]) != null)
                        Marker(
                          point: _riderPoint(widget.riders[i])!,
                          width: 90,
                          height: 56,
                          alignment: Alignment.topCenter,
                          child: GestureDetector(
                            onTap: () => _showContact(widget.riders[i]),
                            child: _PreviewPin(
                              name: widget.riders[i]['name']?.toString().split(' ').first ?? '',
                              order: i + 1,
                              color: color,
                            ),
                          ),
                        ),
                    if (_schoolPoint != null)
                      Marker(
                        point: _schoolPoint!,
                        width: 56,
                        height: 56,
                        alignment: Alignment.center,
                        child: _SchoolMarker(
                          logoUrl: widget.schoolLogoUrl,
                          color: color,
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),

          // Stop list
          Expanded(
            child: widget.riders.isEmpty
                ? const Center(child: Text('Δεν βρέθηκαν στάσεις.', style: TextStyle(color: Colors.grey)))
                : ListView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
                    itemCount: widget.riders.length,
                    itemBuilder: (_, i) {
                      final r = widget.riders[i];
                      final name = r['name']?.toString() ?? '';
                      final address = r['address']?.toString() ?? '';
                      final time = widget.isAfternoon
                          ? (r['dropoffTime']?.toString() ?? r['pickupTime']?.toString() ?? '')
                          : (r['pickupTime']?.toString() ?? '');
                      final rawContact = widget.isAfternoon
                          ? r['dropoffContact']?.toString()
                          : r['pickupContact']?.toString();
                      final contactPerson = (rawContact?.isNotEmpty == true)
                          ? rawContact!
                          : (r['parentName']?.toString() ?? '');
                      return GestureDetector(
                        onTap: () => _showContact(r),
                        child: Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: const Color(0xFFE5E7EB)),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 30, height: 30,
                                decoration: BoxDecoration(color: color.withValues(alpha: 0.12), shape: BoxShape.circle),
                                child: Center(
                                  child: Text('${i + 1}', style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 13)),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                                    if (contactPerson.isNotEmpty)
                                      Text(contactPerson, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w500), maxLines: 1, overflow: TextOverflow.ellipsis),
                                    if (address.isNotEmpty)
                                      Text(address, style: const TextStyle(color: Color(0xFF6B7280), fontSize: 12), maxLines: 1, overflow: TextOverflow.ellipsis),
                                  ],
                                ),
                              ),
                              if (time.isNotEmpty)
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: color.withValues(alpha: 0.1),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(time, style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 13)),
                                ),
                              const SizedBox(width: 6),
                              Icon(Icons.chevron_right, color: color.withValues(alpha: 0.5), size: 18),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          child: SizedBox(
            height: 56,
            child: FilledButton.icon(
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFE95926),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
              onPressed: widget.onStart,
              icon: const Icon(Icons.play_arrow_rounded, size: 24),
              label: const Text('Έναρξη Διαδρομής', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
            ),
          ),
        ),
      ),
    );
  }
}

class _PreviewPin extends StatelessWidget {
  final String name;
  final int order;
  final Color color;
  const _PreviewPin({required this.name, required this.order, required this.color});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(6)),
          child: Text(
            '$order. $name',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: color),
          ),
        ),
        Icon(Icons.location_pin, color: color, size: 28),
      ],
    );
  }
}

class _SchoolMarker extends StatelessWidget {
  final String? logoUrl;
  final Color color;
  const _SchoolMarker({this.logoUrl, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        color: Colors.white,
        shape: BoxShape.circle,
        border: Border.all(color: color, width: 2.5),
        boxShadow: [BoxShadow(color: Colors.black26, blurRadius: 6, offset: const Offset(0, 2))],
      ),
      clipBehavior: Clip.antiAlias,
      child: logoUrl != null && logoUrl!.isNotEmpty
          ? CachedNetworkImage(imageUrl: logoUrl!, fit: BoxFit.cover, errorWidget: (_, __, ___) => Icon(Icons.school_rounded, color: color, size: 24))
          : Icon(Icons.school_rounded, color: color, size: 24),
    );
  }
}

class _DayCompleteCard extends StatelessWidget {
  const _DayCompleteCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: const Color(0xFFF0FDF4),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF86EFAC)),
      ),
      child: const Column(
        children: [
          Text('🎉', style: TextStyle(fontSize: 36)),
          SizedBox(height: 10),
          Text('Τέλος ημέρας!', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: Color(0xFF15803D))),
          SizedBox(height: 4),
          Text('Και οι δύο διαδρομές ολοκληρώθηκαν.', textAlign: TextAlign.center, style: TextStyle(color: Color(0xFF6B7280), fontSize: 14)),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final VoidCallback onRetry;
  const _EmptyState({required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          children: [
            const Icon(Icons.directions_bus_rounded, size: 64, color: Color(0xFFD1D5DB)),
            const SizedBox(height: 16),
            const Text(
              'Ο διαχειριστής δεν σε έχει συνδέσει ακόμα με σχολικό.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Color(0xFF6B7280), fontSize: 15),
            ),
            const SizedBox(height: 16),
            OutlinedButton(onPressed: onRetry, child: const Text('Ανανέωση')),
          ],
        ),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorState({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline_rounded, size: 48, color: Color(0xFFEF4444)),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center, style: const TextStyle(color: Color(0xFF6B7280))),
            const SizedBox(height: 16),
            FilledButton(onPressed: onRetry, child: const Text('Δοκίμασε ξανά')),
          ],
        ),
      ),
    );
  }
}

class DriverMessagesScreen extends ConsumerStatefulWidget {
  final String schoolId;
  final String userId;
  const DriverMessagesScreen({super.key, required this.schoolId, required this.userId});

  @override
  ConsumerState<DriverMessagesScreen> createState() => _DriverMessagesScreenState();
}

class _DriverMessagesScreenState extends ConsumerState<DriverMessagesScreen> {
  Future<void> _newMessage() async {
    // Load all riders from today's routes
    List<Map<String, dynamic>> allRiders = [];
    try {
      final dash = await ref.read(dioProvider).get('/schools/${widget.schoolId}/bus-tracking/dashboard');
      final d = dash.data is Map ? dash.data as Map : {};
      final routes = (d['routes'] as List? ?? []).whereType<Map>().map((r) => Map<String, dynamic>.from(r)).toList();

      for (final route in routes) {
        final svcId = route['serviceId']?.toString();
        final direction = route['direction']?.toString() ?? 'pickup';
        if (svcId == null) continue;
        try {
          final resp = await ref.read(dioProvider).get(
            '/schools/${widget.schoolId}/bus-tracking/route',
            queryParameters: {'serviceId': svcId, 'direction': direction},
          );
          final data = resp.data is Map ? resp.data as Map : {};
          final riders = (data['riders'] as List? ?? []).whereType<Map>().map((r) => Map<String, dynamic>.from(r)).toList();
          for (final r in riders) {
            if (!allRiders.any((x) => x['parentId'] == r['parentId'])) {
              allRiders.add(r);
            }
          }
        } catch (_) {}
      }
    } catch (_) {}

    if (!mounted) return;
    if (allRiders.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Δεν βρέθηκαν μαθητές σήμερα.')));
      return;
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        minChildSize: 0.4,
        maxChildSize: 0.9,
        expand: false,
        builder: (_, controller) => Column(
          children: [
            const SizedBox(height: 8),
            Container(width: 40, height: 4, decoration: BoxDecoration(color: const Color(0xFFE5E7EB), borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 12),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 20),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text('Επιλογή μαθητή', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 17)),
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: ListView.separated(
                controller: controller,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                itemCount: allRiders.length,
                separatorBuilder: (_, __) => const SizedBox(height: 6),
                itemBuilder: (_, i) {
                  final r = allRiders[i];
                  final name = r['name']?.toString() ?? '';
                  final parentName = r['parentName']?.toString() ?? '';
                  return ListTile(
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    tileColor: const Color(0xFFF6F3FA),
                    leading: CircleAvatar(
                      backgroundColor: const Color(0xFF77328D).withValues(alpha: 0.15),
                      child: Text(name.isNotEmpty ? name[0] : '?', style: const TextStyle(color: Color(0xFF77328D), fontWeight: FontWeight.w800)),
                    ),
                    title: Text(name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                    subtitle: parentName.isNotEmpty ? Text(parentName, style: const TextStyle(fontSize: 12)) : null,
                    trailing: const Icon(Icons.message_rounded, color: Color(0xFF77328D), size: 20),
                    onTap: () async {
                      Navigator.pop(ctx);
                      final parentId = r['parentId']?.toString() ?? '';
                      if (parentId.isEmpty) return;
                      final me = ref.read(authProvider).user;
                      if (me == null) return;
                      try {
                        final created = await openScopedConversation(
                          ref,
                          schoolId: widget.schoolId,
                          kind: 'driver',
                          withUserId: parentId,
                          participantIds: [me.id, parentId],
                        );
                        final convId = created?['id'] as String?;
                        if (convId == null || !mounted) return;
                        await Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => ChatScreen(
                              schoolId: widget.schoolId,
                              convId: convId,
                              title: parentName.isNotEmpty ? parentName : 'Γονέας',
                              subtitle: name,
                              currentUserId: me.id,
                              startedByMe: conversationStartedByMe(created, me.id),
                            ),
                          ),
                        );
                        ref.invalidate(conversationsProvider(widget.schoolId));
                      } catch (_) {}
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final conversations = ref.watch(conversationsProvider(widget.schoolId));
    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      appBar: AppBar(
        title: const Text('Μηνύματα'),
        actions: [
          IconButton(
            onPressed: () => ref.invalidate(conversationsProvider(widget.schoolId)),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _newMessage,
        backgroundColor: const Color(0xFF77328D),
        icon: const Icon(Icons.edit_rounded, size: 20),
        label: const Text('Νέο Μήνυμα', style: TextStyle(fontWeight: FontWeight.w700)),
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
                  'Δεν υπάρχουν μηνύματα. Πάτα + για να στείλεις μήνυμα σε γονέα.',
                  textAlign: TextAlign.center,
                ),
              ),
            );
          }
          return RefreshIndicator(
            color: const Color(0xFF77328D),
            onRefresh: () => ref.refresh(conversationsProvider(widget.schoolId).future),
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
              itemCount: list.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (_, index) {
                final conv = Map<String, dynamic>.from(list[index] as Map);
                return ConversationTile(
                  conv: conv,
                  userId: widget.userId,
                  onTap: () => openChat(context, ref, schoolId: widget.schoolId, userId: widget.userId, conv: conv),
                  onDelete: () => confirmRemoveConversation(
                    context, ref,
                    schoolId: widget.schoolId,
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
