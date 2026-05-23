import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

enum StatusTone { neutral, success, warning, danger, info }

class StatusChip extends StatelessWidget {
  const StatusChip({
    super.key,
    required this.label,
    this.tone = StatusTone.neutral,
    this.compact = false,
  });

  final String label;
  final StatusTone tone;
  final bool compact;

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
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 8 : 12,
        vertical: compact ? 4 : 8,
      ),
      decoration: BoxDecoration(
        color: colors.$2,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style:
            (compact
                    ? Theme.of(context).textTheme.labelSmall
                    : Theme.of(context).textTheme.labelMedium)
                ?.copyWith(color: colors.$1, fontWeight: FontWeight.w700),
      ),
    );
  }
}
