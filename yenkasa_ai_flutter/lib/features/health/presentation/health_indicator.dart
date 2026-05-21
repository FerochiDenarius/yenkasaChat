import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/widgets/status_chip.dart';
import 'health_controller.dart';

class HealthIndicator extends ConsumerWidget {
  const HealthIndicator({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final healthAsync = ref.watch(backendHealthProvider);

    return healthAsync.when(
      data: (health) => Tooltip(
        message: '${health.provider} · ${health.model} · ${health.location}',
        child: const StatusChip(
          label: 'Backend healthy',
          tone: StatusTone.success,
        ),
      ),
      error: (error, _) => Tooltip(
        message: error.toString(),
        child: const StatusChip(
          label: 'Backend unreachable',
          tone: StatusTone.danger,
        ),
      ),
      loading: () =>
          const StatusChip(label: 'Checking backend', tone: StatusTone.info),
    );
  }
}
