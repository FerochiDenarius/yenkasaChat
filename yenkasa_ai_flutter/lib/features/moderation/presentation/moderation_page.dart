import 'package:flutter/material.dart';

import '../../../core/widgets/glass_card.dart';
import '../../../core/widgets/metric_card.dart';
import '../../../core/widgets/section_header.dart';
import '../../../core/widgets/status_chip.dart';
import '../../../services/mock_dashboard_data.dart';

class ModerationPage extends StatelessWidget {
  const ModerationPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeader(
          eyebrow: 'Moderation Console',
          title: 'Realtime risk scoring, queue triage, and livestream alerts',
          description:
              'This surface is prepared for future moderation APIs and human review workflows while preserving the same premium YenkasaAI styling.',
        ),
        const SizedBox(height: 20),
        Wrap(
          spacing: 16,
          runSpacing: 16,
          children: moderationMetrics
              .map(
                (metric) => SizedBox(
                  width: 220,
                  child: MetricCard(
                    label: metric.label,
                    value: metric.value,
                    note: metric.note,
                  ),
                ),
              )
              .toList(),
        ),
        const SizedBox(height: 20),
        LayoutBuilder(
          builder: (context, constraints) {
            final wide = constraints.maxWidth > 1080;
            return Flex(
              direction: wide ? Axis.horizontal : Axis.vertical,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: wide ? 13 : 0,
                  child: GlassCard(
                    strong: true,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Pending review',
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 16),
                        for (final item in moderationQueue) ...[
                          GlassCard(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        item.title,
                                        style: Theme.of(context)
                                            .textTheme
                                            .titleSmall
                                            ?.copyWith(
                                              fontWeight: FontWeight.w700,
                                            ),
                                      ),
                                    ),
                                    StatusChip(
                                      label:
                                          'Risk ${(item.risk * 100).toStringAsFixed(0)}%',
                                      tone: item.risk > 0.85
                                          ? StatusTone.danger
                                          : StatusTone.warning,
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  item.owner,
                                  style: Theme.of(
                                    context,
                                  ).textTheme.labelMedium,
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  item.reason,
                                  style: Theme.of(
                                    context,
                                  ).textTheme.bodyMedium?.copyWith(height: 1.5),
                                ),
                                const SizedBox(height: 16),
                                Wrap(
                                  spacing: 12,
                                  children: [
                                    FilledButton(
                                      onPressed: () {},
                                      child: const Text('Approve action'),
                                    ),
                                    OutlinedButton(
                                      onPressed: () {},
                                      child: const Text('Escalate'),
                                    ),
                                    TextButton(
                                      onPressed: () {},
                                      child: Text(item.action),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 12),
                        ],
                      ],
                    ),
                  ),
                ),
                SizedBox(width: wide ? 18 : 0, height: wide ? 0 : 18),
                Expanded(
                  flex: wide ? 8 : 0,
                  child: GlassCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Alert stream',
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 16),
                        for (final alert in const [
                          'Socket room join rate spiked 42% during current livestream.',
                          'Three creator accounts are approaching high-risk moderation thresholds.',
                          'OneSignal delivery degraded for comment notifications in the last 15 minutes.',
                        ]) ...[
                          GlassCard(
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Icon(
                                  Icons.notifications_active_outlined,
                                  color: Color(0xFFF59E0B),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    alert,
                                    style: Theme.of(context)
                                        .textTheme
                                        .bodyMedium
                                        ?.copyWith(height: 1.55),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 12),
                        ],
                      ],
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ],
    );
  }
}
