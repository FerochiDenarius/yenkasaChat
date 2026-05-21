import 'package:flutter/material.dart';

import '../config/app_config.dart';
import '../theme/app_theme.dart';

class AppLogo extends StatelessWidget {
  const AppLogo({super.key, this.compact = false});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final icon = AppConfig.logoAsset.isNotEmpty
        ? ClipRRect(
            borderRadius: BorderRadius.circular(18),
            child: Image.asset(
              AppConfig.logoAsset,
              width: compact ? 42 : 52,
              height: compact ? 42 : 52,
              fit: BoxFit.cover,
            ),
          )
        : Container(
            width: compact ? 42 : 52,
            height: compact ? 42 : 52,
            decoration: BoxDecoration(
              gradient: AiPalette.primaryGradient,
              borderRadius: BorderRadius.circular(18),
            ),
            child: const Icon(Icons.auto_awesome, color: Colors.white),
          );

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        icon,
        const SizedBox(width: 14),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'YenkasaAI',
              style: textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w800,
              ),
            ),
            if (!compact)
              Text(
                'AI operating system for Yenkasa',
                style: textTheme.bodySmall?.copyWith(
                  color: textTheme.bodySmall?.color?.withValues(alpha: 0.68),
                ),
              ),
          ],
        ),
      ],
    );
  }
}
