import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

enum StatusTone { neutral, success, warning, danger, info }

class StatusChip extends StatelessWidget {
  const StatusChip({
    super.key,
    required this.label,
    this.tone = StatusTone.neutral,
  });

  final String label;
  final StatusTone tone;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final colors = switch (tone) {
      StatusTone.success => (
        AiPalette.mint,
        AiPalette.mint.withValues(alpha: dark ? 0.18 : 0.12),
      ),
      StatusTone.warning => (
        AiPalette.amber,
        AiPalette.amber.withValues(alpha: dark ? 0.18 : 0.12),
      ),
      StatusTone.danger => (
        AiPalette.danger,
        AiPalette.danger.withValues(alpha: dark ? 0.18 : 0.12),
      ),
      StatusTone.info => (
        AiPalette.blue,
        AiPalette.blue.withValues(alpha: dark ? 0.18 : 0.12),
      ),
      StatusTone.neutral => (
        AiPalette.violet,
        AiPalette.violet.withValues(alpha: dark ? 0.18 : 0.12),
      ),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: colors.$2,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
          color: colors.$1,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
