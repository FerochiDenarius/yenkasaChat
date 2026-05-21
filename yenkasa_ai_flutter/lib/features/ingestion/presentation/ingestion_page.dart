import 'package:flutter/material.dart';

import '../../../core/widgets/glass_card.dart';
import '../../../core/widgets/metric_card.dart';
import '../../../core/widgets/section_header.dart';
import '../../../core/widgets/status_chip.dart';
import '../../../services/mock_dashboard_data.dart';

class IngestionPage extends StatelessWidget {
  const IngestionPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeader(
          eyebrow: 'Upload & Ingestion',
          title: 'Knowledge ingestion control surface',
          description:
              'This page is shaped for future file upload adapters, source tagging, and ingestion jobs. For now it shows the operational path and room for voice, auth, and synced ingestion history.',
        ),
        const SizedBox(height: 20),
        Wrap(
          spacing: 16,
          runSpacing: 16,
          children: const [
            SizedBox(
              width: 240,
              child: MetricCard(
                label: 'Target collection',
                value: 'public',
                note: 'Yenkasa platform knowledge',
              ),
            ),
            SizedBox(
              width: 240,
              child: MetricCard(
                label: 'Embedding backend',
                value: 'HF now',
                note: 'Gemini migration prepared',
              ),
            ),
            SizedBox(
              width: 240,
              child: MetricCard(
                label: 'Storage path',
                value: 'GCS',
                note: 'Snapshot-backed Chroma',
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),
        GlassCard(
          strong: true,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Ingestion pipeline',
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 16),
              for (final stage in ingestionStages) ...[
                GlassCard(
                  child: Row(
                    children: [
                      StatusChip(
                        label: stage.status,
                        tone: stage.status == 'done'
                            ? StatusTone.success
                            : stage.status == 'active'
                            ? StatusTone.info
                            : StatusTone.warning,
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              stage.name,
                              style: Theme.of(context).textTheme.titleSmall
                                  ?.copyWith(fontWeight: FontWeight.w700),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              stage.detail,
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
              ],
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: () {},
                icon: const Icon(Icons.upload_file_rounded),
                label: const Text('Attach file picker later'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
