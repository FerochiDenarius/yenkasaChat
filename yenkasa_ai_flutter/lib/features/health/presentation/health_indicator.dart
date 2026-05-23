import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/widgets/status_chip.dart';
import 'health_controller.dart';

class HealthIndicator extends ConsumerWidget {
  const HealthIndicator({super.key, this.compact = false});

  final bool compact;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final healthAsync = ref.watch(backendHealthProvider);

    return GestureDetector(
      onTap: () => ref.invalidate(backendHealthProvider),
      child: healthAsync.when(
        data: (health) => Tooltip(
          message:
              '${health.provider} · ${health.model} · ${health.location} · tap to refresh',
          child: StatusChip(
            label: compact ? 'Online' : 'Backend healthy',
            tone: StatusTone.success,
            compact: compact,
          ),
        ),
        error: (error, _) => Tooltip(
          message: '${error.toString()} · tap to retry',
          child: StatusChip(
            label: compact ? 'Offline' : 'Backend unreachable',
            tone: StatusTone.danger,
            compact: compact,
          ),
        ),
        loading: () => StatusChip(
          label: compact ? 'Checking' : 'Checking backend',
          tone: StatusTone.info,
          compact: compact,
        ),
      ),
    );
  }
}
