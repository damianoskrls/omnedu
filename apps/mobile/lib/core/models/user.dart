import 'package:equatable/equatable.dart';

class Membership extends Equatable {
  final String schoolId;
  final String schoolName;
  final String role;

  const Membership({
    required this.schoolId,
    required this.schoolName,
    required this.role,
  });

  factory Membership.fromJson(Map<String, dynamic> json) => Membership(
        schoolId: json['schoolId'] as String,
        schoolName: json['schoolName'] as String,
        role: json['role'] as String,
      );

  @override
  List<Object?> get props => [schoolId, role];
}

class AuthUser extends Equatable {
  final String id;
  final String email;
  final String fullName;
  final String? avatarUrl;
  final bool isSuperAdmin;
  final String? schoolId;
  final String? role;
  final String? schoolLogoUrl;
  final String? schoolPrimaryColor;
  final bool termsAccepted;
  final List<Membership> memberships;

  const AuthUser({
    required this.id,
    required this.email,
    required this.fullName,
    this.avatarUrl,
    required this.isSuperAdmin,
    this.schoolId,
    this.role,
    this.schoolLogoUrl,
    this.schoolPrimaryColor,
    this.termsAccepted = false,
    required this.memberships,
  });

  AuthUser copyWith({String? email, String? fullName}) => AuthUser(
        id: id,
        email: email ?? this.email,
        fullName: fullName ?? this.fullName,
        avatarUrl: avatarUrl,
        isSuperAdmin: isSuperAdmin,
        schoolId: schoolId,
        role: role,
        schoolLogoUrl: schoolLogoUrl,
        schoolPrimaryColor: schoolPrimaryColor,
        termsAccepted: termsAccepted,
        memberships: memberships,
      );

  bool get isTeacher => role == 'teacher';
  bool get isParent => role == 'parent';
  bool get isSchoolAdmin => role == 'school_admin';

  factory AuthUser.fromTokenPayload(Map<String, dynamic> payload) => AuthUser(
        id: payload['sub'] as String,
        email: payload['email'] as String,
        fullName: payload['fullName'] as String,
        isSuperAdmin: payload['isSuperAdmin'] as bool? ?? false,
        schoolId: payload['schoolId'] as String?,
        role: payload['role'] as String?,
        schoolLogoUrl: payload['schoolLogoUrl'] as String?,
        schoolPrimaryColor: payload['schoolPrimaryColor'] as String?,
        termsAccepted: payload['termsAccepted'] == true,
        memberships: (payload['memberships'] as List?)
                ?.map((m) => Membership.fromJson(m as Map<String, dynamic>))
                .toList() ??
            [],
      );

  @override
  List<Object?> get props => [id, schoolId, role, email, fullName, termsAccepted];
}
