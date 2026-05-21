import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/widgets/glass_card.dart';
import '../../../core/widgets/metric_card.dart';
import '../../../core/widgets/section_header.dart';
import '../../../core/widgets/status_chip.dart';
import '../../../services/mock_dashboard_data.dart';
import '../models/chat_message.dart';
import '../models/chat_models.dart';
import 'chat_controller.dart';

class ChatPage extends ConsumerStatefulWidget {
  const ChatPage({super.key});

  @override
  ConsumerState<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends ConsumerState<ChatPage> {
  late final TextEditingController _controller;
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: promptSuggestions.first);
  }

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(
      chatControllerProvider.select((state) => state.messages.length),
      (_, __) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (_scrollController.hasClients) {
            _scrollController.animateTo(
              _scrollController.position.maxScrollExtent,
              duration: const Duration(milliseconds: 220),
              curve: Curves.easeOut,
            );
          }
        });
      },
    );

    final state = ref.watch(chatControllerProvider);
    final controller = ref.read(chatControllerProvider.notifier);
    final isPublic = state.audience == 'public';
    final suggestions = isPublic ? promptSuggestions : engineeringSuggestions;

    return LayoutBuilder(
      builder: (context, constraints) {
        final wide = constraints.maxWidth > 1180;
        final compactComposer = constraints.maxWidth < 760;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SectionHeader(
              eyebrow: 'AI Chat Dashboard',
              title: isPublic
                  ? 'Platform answers grounded on Yenkasa knowledge'
                  : 'Engineering answers grounded on Yenkasa architecture',
              description: isPublic
                  ? 'This mode explains product concepts naturally, keeps moderation-sensitive topics safe, and stays accessible for users.'
                  : 'This mode stays focused on distributed systems, livestream scale, moderation workflows, mobile optimization, and AI infrastructure decisions.',
            ),
            const SizedBox(height: 20),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                ChoiceChip(
                  label: const Text('Public Assistant'),
                  selected: isPublic,
                  onSelected: (_) => controller.setAudience('public'),
                ),
                ChoiceChip(
                  label: const Text('Engineering Copilot'),
                  selected: !isPublic,
                  onSelected: (_) => controller.setAudience('engineering'),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Wrap(
              spacing: 16,
              runSpacing: 16,
              children: [
                SizedBox(
                  width: 220,
                  child: MetricCard(
                    label: 'Mode',
                    value: isPublic
                        ? 'Public Assistant'
                        : 'Engineering Copilot',
                    note: isPublic
                        ? 'Beginner-safe explanations'
                        : 'Architecture-grade answers',
                  ),
                ),
                SizedBox(
                  width: 220,
                  child: MetricCard(
                    label: 'Retrieval',
                    value:
                        '${state.timings['retrieval_ms'] ?? state.timings['retrievalMs'] ?? 412}ms',
                    note: isPublic
                        ? 'Platform knowledge search'
                        : 'Engineering Chroma search',
                  ),
                ),
                SizedBox(
                  width: 220,
                  child: MetricCard(
                    label: 'Latency',
                    value:
                        '${state.timings['total_ms'] ?? state.timings['totalMs'] ?? 1900}ms',
                    note: 'Vertex AI + Chroma',
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Flex(
              direction: wide ? Axis.horizontal : Axis.vertical,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: wide ? 14 : 0,
                  child: GlassCard(
                    strong: true,
                    child: Column(
                      children: [
                        if (state.errorMessage != null) ...[
                          _ErrorBanner(
                            message: state.errorMessage!,
                            onRetry: controller.retryLastQuestion,
                          ),
                          const SizedBox(height: 14),
                        ],
                        SizedBox(
                          height: compactComposer ? 420 : 520,
                          child: ListView.separated(
                            controller: _scrollController,
                            itemCount:
                                state.messages.length +
                                (state.isSending ? 1 : 0),
                            separatorBuilder: (_, __) =>
                                const SizedBox(height: 14),
                            itemBuilder: (context, index) {
                              if (index >= state.messages.length) {
                                return const _ThinkingBubble();
                              }
                              return _MessageBubble(
                                message: state.messages[index],
                              );
                            },
                          ),
                        ),
                        const SizedBox(height: 18),
                        TextField(
                          controller: _controller,
                          minLines: 3,
                          maxLines: 6,
                          textInputAction: TextInputAction.newline,
                          decoration: const InputDecoration(
                            hintText:
                                'Ask what Yenkasa Coin is, how ranks work, or what Live Arena means',
                          ),
                        ),
                        const SizedBox(height: 14),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: suggestions
                              .map(
                                (prompt) => ActionChip(
                                  label: Text(prompt),
                                  onPressed: () => _controller.text = prompt,
                                ),
                              )
                              .toList(),
                        ),
                        const SizedBox(height: 16),
                        if (compactComposer) ...[
                          const Wrap(
                            spacing: 10,
                            runSpacing: 10,
                            children: [
                              StatusChip(
                                label: 'Voice input ready next',
                                tone: StatusTone.info,
                                compact: true,
                              ),
                              StatusChip(
                                label: 'History sync planned',
                                tone: StatusTone.neutral,
                                compact: true,
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          SizedBox(
                            width: double.infinity,
                            child: FilledButton.icon(
                              onPressed: state.isSending
                                  ? null
                                  : () {
                                      controller.sendMessage(_controller.text);
                                      _controller.clear();
                                    },
                              icon: Icon(
                                state.isSending
                                    ? Icons.hourglass_top_rounded
                                    : Icons.send_rounded,
                              ),
                              label: Text(
                                state.isSending
                                    ? 'Thinking...'
                                    : 'Send to YenkasaAI',
                              ),
                            ),
                          ),
                        ] else
                          Row(
                            children: [
                              const StatusChip(
                                label: 'Voice input ready next',
                                tone: StatusTone.info,
                              ),
                              const SizedBox(width: 10),
                              const StatusChip(
                                label: 'History sync planned',
                                tone: StatusTone.neutral,
                              ),
                              const Spacer(),
                              FilledButton.icon(
                                onPressed: state.isSending
                                    ? null
                                    : () {
                                        controller.sendMessage(
                                          _controller.text,
                                        );
                                        _controller.clear();
                                      },
                                icon: Icon(
                                  state.isSending
                                      ? Icons.hourglass_top_rounded
                                      : Icons.send_rounded,
                                ),
                                label: Text(
                                  state.isSending
                                      ? 'Thinking...'
                                      : 'Send to YenkasaAI',
                                ),
                              ),
                            ],
                          ),
                      ],
                    ),
                  ),
                ),
                SizedBox(width: wide ? 18 : 0, height: wide ? 0 : 18),
                SizedBox(
                  width: wide ? 360 : double.infinity,
                  child: Column(
                    children: [
                      GlassCard(
                        strong: true,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Answer cards',
                              style: Theme.of(context).textTheme.labelLarge
                                  ?.copyWith(fontWeight: FontWeight.w700),
                            ),
                            const SizedBox(height: 16),
                            if (state.answerCards.isEmpty)
                              Text(
                                'High-signal answer cards appear here after the first query so users can scan the main points quickly.',
                                style: Theme.of(context).textTheme.bodyMedium,
                              ),
                            for (final card in state.answerCards) ...[
                              _AnswerCard(
                                title: card.title,
                                category: card.category,
                                summary: card.summary,
                              ),
                              const SizedBox(height: 12),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      GlassCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Sources used',
                              style: Theme.of(context).textTheme.labelLarge
                                  ?.copyWith(fontWeight: FontWeight.w700),
                            ),
                            const SizedBox(height: 16),
                            if (state.sources.isEmpty)
                              Text(
                                'Retrieved citations, chunk scores, and source excerpts show here once a response lands.',
                                style: Theme.of(context).textTheme.bodyMedium,
                              ),
                            for (final source in state.sources.take(5)) ...[
                              _SourceCard(source: source),
                              const SizedBox(height: 12),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        );
      },
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message});

  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final isAssistant = message.role == ChatRole.assistant;
    final alignment = isAssistant
        ? Alignment.centerLeft
        : Alignment.centerRight;
    final gradient = isAssistant
        ? null
        : const LinearGradient(colors: [Color(0xFF5B21B6), Color(0xFF3B82F6)]);
    return Align(
      alignment: alignment,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 820),
        child: Container(
          decoration: BoxDecoration(
            gradient: gradient,
            borderRadius: BorderRadius.circular(24),
            color: gradient == null ? null : null,
          ),
          child: GlassCard(
            strong: isAssistant,
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      isAssistant
                          ? Icons.auto_awesome_rounded
                          : Icons.person_rounded,
                      size: 18,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      isAssistant ? 'YenkasaAI' : 'You',
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    if (message.isStreaming) ...[
                      const SizedBox(width: 10),
                      const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 12),
                if (isAssistant)
                  MarkdownBody(
                    data: message.content.isEmpty ? '...' : message.content,
                    selectable: true,
                    styleSheet: MarkdownStyleSheet.fromTheme(Theme.of(context))
                        .copyWith(
                          p: Theme.of(
                            context,
                          ).textTheme.bodyLarge?.copyWith(height: 1.65),
                        ),
                  )
                else
                  Text(
                    message.content,
                    style: Theme.of(
                      context,
                    ).textTheme.bodyLarge?.copyWith(height: 1.65),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ThinkingBubble extends StatelessWidget {
  const _ThinkingBubble();

  @override
  Widget build(BuildContext context) {
    return const Align(
      alignment: Alignment.centerLeft,
      child: GlassCard(
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 10,
              height: 10,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
            SizedBox(width: 12),
            Text('YenkasaAI is thinking...'),
          ],
        ),
      ),
    );
  }
}

class _AnswerCard extends StatelessWidget {
  const _AnswerCard({
    required this.title,
    required this.category,
    required this.summary,
  });

  final String title;
  final String category;
  final String summary;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          StatusChip(label: category, tone: StatusTone.info),
          const SizedBox(height: 12),
          Text(
            title,
            style: Theme.of(
              context,
            ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          Text(
            summary,
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(height: 1.55),
          ),
        ],
      ),
    );
  }
}

class _SourceCard extends StatelessWidget {
  const _SourceCard({required this.source});

  final SourceChunkModel source;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  source.title,
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              StatusChip(
                label: '${(source.score * 100).toStringAsFixed(0)}%',
                tone: StatusTone.success,
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(source.area, style: Theme.of(context).textTheme.labelMedium),
          const SizedBox(height: 8),
          Text(
            source.excerpt,
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(height: 1.55),
          ),
        ],
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFEF4444).withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(22),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline_rounded, color: Color(0xFFEF4444)),
          const SizedBox(width: 12),
          Expanded(child: Text(message)),
          const SizedBox(width: 12),
          TextButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}
