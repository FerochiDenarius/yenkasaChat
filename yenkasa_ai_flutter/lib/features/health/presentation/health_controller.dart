import 'dart:async';

import '../../../core/config/app_config.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../features/chat/data/ai_api_service.dart';
import '../../../models/backend_health.dart';

final _backendHealthPollProvider = StreamProvider<int>((ref) async* {
  yield 0;
  var tick = 1;
  while (true) {
    await Future<void>.delayed(AppConfig.healthPollInterval);
    yield tick++;
  }
});

final backendHealthProvider = FutureProvider<BackendHealth>((ref) async {
  ref.watch(_backendHealthPollProvider);
  return ref.watch(aiApiServiceProvider).fetchHealth();
});
