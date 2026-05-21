import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../features/chat/data/ai_api_service.dart';
import '../../../models/backend_health.dart';

final backendHealthProvider = FutureProvider<BackendHealth>((ref) async {
  return ref.watch(aiApiServiceProvider).fetchHealth();
});
