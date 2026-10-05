import 'package:flutter/material.dart';

class TeacherMessagesScreen extends StatelessWidget {
  final String schoolId;
  final String userId;
  const TeacherMessagesScreen({super.key, required this.schoolId, required this.userId});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Messages')),
      body: const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.chat_bubble_outline, size: 64, color: Color(0xFFE5E7EB)),
            SizedBox(height: 16),
            Text('No conversations yet', style: TextStyle(color: Colors.grey)),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {},
        child: const Icon(Icons.add),
      ),
    );
  }
}
