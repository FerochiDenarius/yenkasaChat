import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/glass_card.dart';
import '../../../core/widgets/metric_card.dart';
import '../../../core/widgets/section_header.dart';
import '../../../core/widgets/status_chip.dart';
import '../../../services/mock_dashboard_data.dart';
import '../models/chat_message.dart';
import 'chat_controller.dart';

class ChatPage extends ConsumerStatefulWidget {
  const ChatPage({super.key});

  @override
  ConsumerState<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends ConsumerState<ChatPage> {
  static const double _scrollBottomThreshold = 96;

  late final TextEditingController _controller;
  final ScrollController _scrollController = ScrollController();
  ProviderSubscription<(int, int, bool)>? _messageStreamSubscription;
  Timer? _autoScrollTimer;
  bool _stickToBottom = true;
  bool _isAutoScrolling = false;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: promptSuggestions.first);
    _scrollController.addListener(_handleScroll);
    _messageStreamSubscription = ref.listenManual<(int, int, bool)>(
      chatControllerProvider.select((state) {
        final lastMessageLength = state.messages.isEmpty
            ? 0
            : state.messages.last.content.length;
        return (state.messages.length, lastMessageLength, state.isSending);
      }),
      (_, __) => _queueAutoScroll(),
    );
  }

  @override
  void dispose() {
    _autoScrollTimer?.cancel();
    _messageStreamSubscription?.close();
    _scrollController.removeListener(_handleScroll);
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _handleScroll() {
    if (!_scrollController.hasClients) return;

    final position = _scrollController.position;
    final distanceToBottom = position.maxScrollExtent - position.pixels;
    final nearBottom = distanceToBottom <= _scrollBottomThreshold;

    if (nearBottom) {
      _stickToBottom = true;
    }

    if (distanceToBottom > 240) {
      _stickToBottom = false;
    }
  }

  void _queueAutoScroll() {
    if (!_stickToBottom || !mounted) return;
    if (_autoScrollTimer?.isActive ?? false) return;

    _autoScrollTimer = Timer(const Duration(milliseconds: 120), () {
      if (!mounted) return;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _scrollToBottomIfNeeded();
      });
    });
  }

  Future<void> _scrollToBottomIfNeeded() async {
    if (!_scrollController.hasClients) return;
    if (!_stickToBottom) return;
    if (_isAutoScrolling) return;

    final position = _scrollController.position;
    if (!position.hasContentDimensions) return;

    final target = position.maxScrollExtent;
    if ((target - position.pixels).abs() < 1) return;

    _isAutoScrolling = true;

    try {
      await _scrollController.animateTo(
        target,
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOut,
      );
    } catch (_) {
      // Ignore interrupted scroll animations when layout changes mid-stream.
    } finally {
      _isAutoScrolling = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(chatControllerProvider);
    final controller = ref.read(chatControllerProvider.notifier);
    final isPublic = state.audience == 'public';
    final suggestions = isPublic ? promptSuggestions : engineeringSuggestions;

    return LayoutBuilder(
      builder: (context, constraints) {
        final compactPage = constraints.maxWidth < 920;
        final compactComposer = constraints.maxWidth < 760;
        final hasConversation = state.messages.any(
          (message) => message.role == ChatRole.user,
        );
        final quickPrompts = hasConversation
            ? const <String>[]
            : state.suggestedFollowUps.isNotEmpty
            ? state.suggestedFollowUps
            : (compactComposer ? suggestions.take(2).toList() : suggestions);
        void submitQuestion() {
          if (state.isSending) return;
          final text = _controller.text.trim();
          if (text.isEmpty) return;
          _stickToBottom = true;
          controller.sendMessage(text);
          _controller.clear();
        }

        if (compactPage) {
          return Stack(
            children: [
              const Positioned.fill(
                child: IgnorePointer(child: _AmbientGlow()),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (state.errorMessage != null) ...[
                    _ErrorBanner(
                      message: state.errorMessage!,
                      onRetry: controller.retryLastQuestion,
                    ),
                    const SizedBox(height: 16),
                  ],
                  if (hasConversation)
                    Expanded(
                      child: ListView.separated(
                        controller: _scrollController,
                        padding: const EdgeInsets.fromLTRB(2, 24, 2, 12),
                        physics: const BouncingScrollPhysics(
                          parent: AlwaysScrollableScrollPhysics(),
                        ),
                        keyboardDismissBehavior:
                            ScrollViewKeyboardDismissBehavior.onDrag,
                        itemCount:
                            state.messages.length + (state.isSending ? 1 : 0),
                        separatorBuilder: (_, __) => const SizedBox(height: 14),
                        itemBuilder: (context, index) {
                          if (index >= state.messages.length) {
                            return const _ThinkingBubble();
                          }
                          return _MessageBubble(
                            message: state.messages[index],
                            compact: true,
                          );
                        },
                      ),
                    )
                  else
                    const Spacer(),
                  Padding(
                    padding: const EdgeInsets.only(top: 12, bottom: 8),
                    child: _MinimalComposer(
                      controller: _controller,
                      hintText: 'Ask anything about Yenkasa...',
                      onSubmit: submitQuestion,
                      isSending: state.isSending,
                    ),
                  ),
                ],
              ),
            ],
          );
        }

        final chatPanel = GlassCard(
          strong: true,
          padding: EdgeInsets.all(compactComposer ? 14 : 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (state.errorMessage != null) ...[
                _ErrorBanner(
                  message: state.errorMessage!,
                  onRetry: controller.retryLastQuestion,
                ),
                const SizedBox(height: 14),
              ],
              Expanded(
                child: ListView.separated(
                  controller: _scrollController,
                  physics: const BouncingScrollPhysics(
                    parent: AlwaysScrollableScrollPhysics(),
                  ),
                  keyboardDismissBehavior:
                      ScrollViewKeyboardDismissBehavior.onDrag,
                  itemCount: state.messages.length + (state.isSending ? 1 : 0),
                  separatorBuilder: (_, __) => const SizedBox(height: 14),
                  itemBuilder: (context, index) {
                    if (index >= state.messages.length) {
                      return const _ThinkingBubble();
                    }
                    return _MessageBubble(
                      message: state.messages[index],
                      compact: compactComposer,
                    );
                  },
                ),
              ),
              SizedBox(height: compactComposer ? 14 : 18),
              TextField(
                controller: _controller,
                minLines: compactComposer ? 2 : 3,
                maxLines: 6,
                textInputAction: TextInputAction.newline,
                decoration: InputDecoration(
                  hintText:
                      'Ask what Yenkasa Coin is, how ranks work, or what Live Arena means',
                  suffixIcon: compactComposer
                      ? IconButton(
                          onPressed: submitQuestion,
                          icon: const Icon(Icons.send_rounded),
                        )
                      : null,
                ),
              ),
              SizedBox(height: compactComposer ? 10 : 14),
              if (compactComposer)
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: state.isSending ? null : submitQuestion,
                    icon: Icon(
                      state.isSending
                          ? Icons.hourglass_top_rounded
                          : Icons.send_rounded,
                    ),
                    label: Text(
                      state.isSending ? 'Thinking...' : 'Send to YenkasaAI',
                    ),
                  ),
                )
              else
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
                      onPressed: state.isSending ? null : submitQuestion,
                      icon: Icon(
                        state.isSending
                            ? Icons.hourglass_top_rounded
                            : Icons.send_rounded,
                      ),
                      label: Text(
                        state.isSending ? 'Thinking...' : 'Send to YenkasaAI',
                      ),
                    ),
                  ],
                ),
            ],
          ),
        );
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
            SizedBox(height: compactPage ? 14 : 20),
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
            SizedBox(height: compactPage ? 12 : 20),
            if (!compactPage)
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
            if (quickPrompts.isNotEmpty) ...[
              SizedBox(height: compactPage ? 12 : 16),
              _PromptSuggestionsStrip(
                prompts: quickPrompts,
                onSelect: (prompt) => _controller.text = prompt,
              ),
            ],
            SizedBox(height: compactPage ? 12 : 20),
            Expanded(child: chatPanel),
          ],
        );
      },
    );
  }
}

class _PromptSuggestionsStrip extends StatelessWidget {
  const _PromptSuggestionsStrip({
    required this.prompts,
    required this.onSelect,
  });

  final List<String> prompts;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Suggested questions',
            style: Theme.of(
              context,
            ).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 10),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (final prompt in prompts) ...[
                  ActionChip(
                    label: Text(prompt),
                    onPressed: () => onSelect(prompt),
                  ),
                  const SizedBox(width: 10),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AmbientGlow extends StatelessWidget {
  const _AmbientGlow();

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: const [
        Positioned(
          top: 56,
          left: -110,
          child: _GlowOrb(
            diameter: 250,
            colors: [Color(0x337C3AED), Color(0x00000000)],
          ),
        ),
        Positioned(
          top: 120,
          right: -90,
          child: _GlowOrb(
            diameter: 210,
            colors: [Color(0x223B82F6), Color(0x00000000)],
          ),
        ),
        Positioned(
          bottom: -120,
          right: -40,
          child: _GlowOrb(
            diameter: 260,
            colors: [Color(0x1F7C3AED), Color(0x00000000)],
          ),
        ),
      ],
    );
  }
}

class _GlowOrb extends StatelessWidget {
  const _GlowOrb({required this.diameter, required this.colors});

  final double diameter;
  final List<Color> colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: diameter,
      height: diameter,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(colors: colors),
      ),
    );
  }
}

class _MinimalComposer extends StatelessWidget {
  const _MinimalComposer({
    required this.controller,
    required this.hintText,
    required this.onSubmit,
    required this.isSending,
  });

  final TextEditingController controller;
  final String hintText;
  final VoidCallback onSubmit;
  final bool isSending;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 10, 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.07),
        borderRadius: BorderRadius.circular(32),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.22),
            blurRadius: 22,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.white.withValues(alpha: 0.08),
            ),
            child: IconButton(
              onPressed: () => controller.clear(),
              icon: const Icon(Icons.add_rounded, color: Colors.white),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: TextField(
              controller: controller,
              minLines: 1,
              maxLines: 4,
              textInputAction: TextInputAction.send,
              onSubmitted: (_) {
                if (!isSending) onSubmit();
              },
              decoration: InputDecoration(
                hintText: hintText,
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                filled: false,
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 0,
                  vertical: 12,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: isSending
                  ? null
                  : const LinearGradient(
                      colors: [Color(0xFF7C3AED), Color(0xFF4F46E5)],
                    ),
              color: isSending ? Colors.white.withValues(alpha: 0.08) : null,
              shape: BoxShape.circle,
              boxShadow: isSending
                  ? null
                  : [
                      BoxShadow(
                        color: AiPalette.violet.withValues(alpha: 0.32),
                        blurRadius: 24,
                        offset: const Offset(0, 10),
                      ),
                    ],
            ),
            child: IconButton(
              onPressed: isSending ? null : onSubmit,
              icon: Icon(
                isSending
                    ? Icons.hourglass_top_rounded
                    : Icons.arrow_upward_rounded,
                color: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message, this.compact = false});

  final ChatMessage message;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final isAssistant = message.role == ChatRole.assistant;
    final alignment = isAssistant
        ? Alignment.centerLeft
        : Alignment.centerRight;
    final gradient = isAssistant
        ? null
        : const LinearGradient(colors: [Color(0xFF5B21B6), Color(0xFF3B82F6)]);
    final bubbleContent = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              isAssistant ? Icons.auto_awesome_rounded : Icons.person_rounded,
              size: 18,
            ),
            const SizedBox(width: 8),
            Text(
              isAssistant ? 'YenkasaAI' : 'You',
              style: Theme.of(
                context,
              ).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w700),
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
        if (isAssistant && message.isStreaming)
          SelectableText(
            message.content.isEmpty ? '...' : message.content,
            style: Theme.of(
              context,
            ).textTheme.bodyLarge?.copyWith(height: 1.65),
          )
        else if (isAssistant)
          MarkdownBody(
            data: message.content.isEmpty ? '...' : message.content,
            selectable: true,
            softLineBreak: true,
            styleSheet: MarkdownStyleSheet.fromTheme(Theme.of(context))
                .copyWith(
                  p: Theme.of(
                    context,
                  ).textTheme.bodyLarge?.copyWith(height: 1.65),
                ),
          )
        else
          SelectableText(
            message.content,
            style: Theme.of(
              context,
            ).textTheme.bodyLarge?.copyWith(height: 1.65),
          ),
      ],
    );
    return RepaintBoundary(
      child: Align(
        alignment: alignment,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 820),
          child: Container(
            decoration: BoxDecoration(
              gradient: gradient,
              borderRadius: BorderRadius.circular(compact ? 22 : 24),
              color: gradient == null
                  ? Colors.white.withValues(alpha: compact ? 0.045 : 0.06)
                  : null,
              border: Border.all(
                color: Colors.white.withValues(alpha: compact ? 0.08 : 0.1),
              ),
            ),
            child: Padding(
              padding: EdgeInsets.all(compact ? 14 : 18),
              child: bubbleContent,
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
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
        ),
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
